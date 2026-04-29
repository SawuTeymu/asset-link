"use server";

import { supabase } from "../supabase";
import { unstable_noStore as noStore } from "next/cache";

/**
 * ==========================================
 * 檔案：src/lib/actions/core-repo.ts
 * 狀態：V5.4 嚴格型別校準版 (解決 ParserError 與 no-explicit-any)
 * 物理職責：
 * 1. 定義 ERI (19欄) 與 歷史庫 (18欄) 的全繁體中文資料庫對映層。
 * 2. 徹底消除所有 any 宣告，並透過 unknown 雙重轉型解決 Supabase 中文解析錯誤。
 * 3. 解決 Vercel 日誌中所有 "column does not exist" 的物理根源。
 * 4. 提供跨表大一統搜索與單筆資料實時抓取。
 * ==========================================
 */

//  定義待辦資產強型別 (消除 mapAssetToEnglish 的 any)
interface AssetDbRow {
  id?: string;
  建立時間?: string;
  案件編號: string;
  裝機日期: string;
  院區: string;
  樓層: string;
  使用單位: string;
  姓名分機: string;
  設備類型: string;
  品牌型號: string;
  產品序號: string;
  主要mac: string;
  無線mac: string;
  設備名稱標記: string;
  核定ip: string;
  狀態: string;
  行政退回原因: string;
  來源廠商: string;
  備註: string;
}

//  定義歷史資產強型別 (消除 mapHistAssetToEnglish 的 any)
interface HistAssetDbRow {
  id?: string;
  數據匯入時間?: string;
  結案單號: string;
  裝機日期: string;
  院區: string;
  樓層: string;
  使用單位: string;
  姓名分機: string;
  設備類型: string;
  品牌型號: string;
  產品序號: string;
  主要mac: string;
  無線mac: string;
  設備名稱標記: string;
  核定ip: string;
  狀態: string;
  行政備註: string;
  同步來源: string;
}

//  定義 IP 矩陣強型別 (解決 ParserError 缺失屬性)
interface IpMatrixRow {
  使用單位: string;
  核定ip: string;
  狀態: string;
}

/**
 *  1. 物理映射適配器：待辦資產表 (Asset Adapter)
 */
export function mapAssetToEnglish(r: AssetDbRow) {
  if (!r) return null;
  return {
    id: r.id,
    createdAt: r.建立時間,
    formId: r.案件編號,
    installDate: r.裝機日期,
    area: r.院區,
    floor: r.樓層,
    unit: r.使用單位,
    applicant: r.姓名分機,
    deviceType: r.設備類型,
    model: r.品牌型號,
    sn: r.產品序號,
    mac1: r.主要mac,    
    mac2: r.無線mac,    
    name: r.設備名稱標記,
    ip: r.核定ip,       
    status: r.狀態,
    rejectReason: r.行政退回原因,
    vendor: r.來源廠商,
    remark: r.備註
  };
}

/**
 *  2. 物理映射適配器：歷史大數據表 (History Adapter)
 */
export function mapHistAssetToEnglish(r: HistAssetDbRow) {
  if (!r) return null;
  return {
    id: r.id,
    importDate: r.數據匯入時間,
    formId: r.結案單號,
    installDate: r.裝機日期,
    area: r.院區,
    floor: r.樓層,
    unit: r.使用單位,
    applicant: r.姓名分機,
    deviceType: r.設備類型,
    model: r.品牌型號,
    sn: r.產品序號,
    mac1: r.主要mac,
    mac2: r.無線mac,
    name: r.設備名稱標記,
    ip: r.核定ip,
    status: r.狀態,
    remark: r.行政備註,
    vendor: r.同步來源
  };
}

/**
 *  3. 跨表大一統搜尋 (searchAllAssets)
 */
export async function searchAllAssets(query: string) {
  noStore();
  const q = query.trim();
  if (!q) return { pending: [], history: [] };

  try {
    // A. 檢索待辦池 (assets) 
    const { data: pendingData } = await supabase
      .from("assets")
      .select("*")
      .or(`產品序號.ilike.%${q}%,核定ip.ilike.%${q}%,使用單位.ilike.%${q}%,案件編號.ilike.%${q}%`)
      .limit(20);

    const typedPending = pendingData as unknown as AssetDbRow[] | null;

    // B. 檢索歷史池 (historical_assets) 
    const { data: historyData } = await supabase
      .from("historical_assets")
      .select("*")
      .or(`產品序號.ilike.%${q}%,核定ip.ilike.%${q}%,使用單位.ilike.%${q}%,結案單號.ilike.%${q}%`)
      .limit(20);

    const typedHistory = historyData as unknown as HistAssetDbRow[] | null;

    return {
      pending: (typedPending || []).map(mapAssetToEnglish),
      history: (typedHistory || []).map(mapHistAssetToEnglish)
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("【跨表檢索崩潰】:", errorMsg);
    throw new Error("跨表檢索失敗: 物理標頭不匹配");
  }
}

/**
 *  4. 精準序號定位 (fetchAssetBySn)
 */
export async function fetchAssetBySn(sn: string) {
  noStore();
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .eq("產品序號", sn.toUpperCase())
    .single();

  if (error || !data) return null;
  
  const typedData = data as unknown as AssetDbRow;
  return mapAssetToEnglish(typedData);
}

/**
 *  5. 全院 IP 使用率對沖清單 (fetchIpMatrix)
 */
export async function fetchIpMatrix() {
  noStore();
  const { data, error } = await supabase
    .from("historical_assets")
    .select("使用單位, 核定ip, 狀態")
    .eq("狀態", "已結案");

  if (error) throw new Error("IP 矩陣對沖中斷");
  
  //  透過雙重轉型解決 TS2339 Supabase ParserError
  const typedData = data as unknown as IpMatrixRow[] | null;
  
  return (typedData || []).map(r => ({
    unit: r.使用單位,
    ip: r.核定ip,
    status: r.狀態
  }));
}