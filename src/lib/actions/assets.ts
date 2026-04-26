"use server";

import { supabase } from "../supabase";
import { logAction } from "./auth";
import { unstable_noStore as noStore } from "next/cache";

/**
 * ==========================================
 * 檔案：src/lib/actions/assets.ts
 * 狀態：V6.0 旗艦完全體 (修復 Vercel 編譯中斷)
 * 物理職責：
 * 1. 補齊 submitAssetBatch 讓廠商端 (keyin) 能夠正常批次寫入資料。
 * 2. 補齊 approveAsset 的 6 個引數 (包含 mac1, mac2)。
 * 3. 負責 ERI 資產的核發 (遷移至 historical_assets) 與退回。
 * 4. 提供 IP 衝突實時掃描與 VDS 自動流水號演算。
 * 5. 整合內部快速配發 (submitInternalIssue)，並植入強型別消除 any。
 * ==========================================
 */

/**
 * 🚀 0. 定義廠商預約載荷強型別 (消除 any，防堵編譯錯誤)
 */
export interface VendorSubmitPayload {
  form_id: string;
  install_date: string;
  area: string;
  floor: string;
  unit: string;
  applicant: string;
  model: string;
  sn: string;
  mac1: string;
  mac2: string;
  remark: string;
  vendor: string;
  status: string;
}

/**
 * 🚀 1. 執行廠商預約批次入庫 (供 keyin/page.tsx 呼叫)
 */
export async function submitAssetBatch(batchData: VendorSubmitPayload[]) {
  // 物理對位：將前端傳來的英文屬性精準映射為 Supabase 繁體中文欄位
  const insertData = batchData.map(d => ({
    案件編號: d.form_id,
    裝機日期: d.install_date,
    院區: d.area,
    樓層: d.floor,
    使用單位: d.unit,
    姓名分機: d.applicant,
    品牌型號: d.model,
    // 物理防呆：若廠商未填序號，系統先自動給予亂數暫存，防撞唯一鍵
    產品序號: d.sn || `SN-AUTO-${Math.floor(Math.random() * 100000)}`, 
    主要mac: d.mac1,
    無線mac: d.mac2,
    備註: d.remark,
    來源廠商: d.vendor,
    狀態: d.status
  }));

  const { error } = await supabase.from("assets").insert(insertData);
  
  if (error) throw new Error("廠商預約資料批次寫入失敗: " + error.message);

  // 寫入系統安全日誌
  await logAction("VENDOR_KEYIN", `廠商 [${batchData[0]?.vendor}] 批次提交 ${batchData.length} 筆預約單 (${batchData[0]?.form_id})`);
  
  return { success: true };
}

/**
 * 🚀 2. 獲取待核定案件清單
 */
export async function getAdminPendingData() {
  noStore();
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .in("狀態", ["待核定", "退回修正"])
    .order("建立時間", { ascending: true });

  if (error) throw new Error("讀取待核定案件失敗: " + error.message);

  // 雙重轉型：抹除 Supabase 中文解析異常
  const typedData = data as unknown as Record<string, unknown>[];

  // 物理映射回前端 UI 鍵值
  return (typedData || []).map((r) => ({
    formId: String(r.案件編號 || ""),
    date: String(r.裝機日期 || ""),
    area: String(r.院區 || ""),
    floor: String(r.樓層 || ""),
    unit: String(r.使用單位 || ""),
    ext: String(r.姓名分機 || ""),
    model: String(r.品牌型號 || ""),
    sn: String(r.產品序號 || ""),
    mac1: String(r.主要mac || ""),
    mac2: String(r.無線mac || ""),
    status: String(r.狀態 || ""),
    vendor: String(r.來源廠商 || ""),
    remark: String(r.備註 || "")
  }));
}

/**
 * 🚀 3. 實時 IP 衝突對沖掃描
 */
export async function checkIpConflict(ip: string, isReplace: boolean) {
  noStore();
  // 若為舊換新，物理豁免 IP 衝突
  if (isReplace) return { conflict: false, source: "" };

  const { data, error } = await supabase
    .from("historical_assets")
    .select("使用單位")
    .eq("核定ip", ip.trim())
    .not("狀態", "ilike", "%已報廢%");

  if (error) throw new Error("IP 衝突檢測失敗");

  const typedData = data as unknown as { 使用單位: string }[];

  if (typedData && typedData.length > 0) {
    return { conflict: true, source: String(typedData[0].使用單位) };
  }
  return { conflict: false, source: "" };
}

/**
 * 🚀 4. 執行資產核定與物理遷移 (接收 6 個引數)
 */
export async function approveAsset(
  sn: string, 
  ip: string, 
  deviceName: string, 
  type: string, 
  mac1: string = "", 
  mac2: string = ""
) {
  // A. 從待辦池抓取原始案件資料
  const { data: assetData, error: fetchErr } = await supabase
    .from("assets")
    .select("*")
    .eq("產品序號", sn)
    .single();

  if (fetchErr || !assetData) throw new Error("找不到對應的待核定案件");
  
  const asset = assetData as unknown as Record<string, unknown>;
  const isReplace = String(asset.備註 || "").includes("[REPLACE]");

  // B. 汰換邏輯：物理封存歷史庫中同 IP 之舊機
  if (isReplace) {
    await supabase
      .from("historical_assets")
      .update({
        狀態: "已封存(汰換)",
        行政備註: "汰換日期：" + new Date().toISOString().split('T')[0]
      })
      .eq("核定ip", ip.trim());
  }

  // C. 寫入歷史大表 (大一統沉降)
  // 物理規則：若管理員有輸入新的 mac1/mac2，優先使用新值，否則繼承原值
  const { error: insertErr } = await supabase
    .from("historical_assets")
    .insert([{
      結案單號: String(asset.案件編號 || ""),
      裝機日期: String(asset.裝機日期 || ""),
      院區: String(asset.院區 || ""),
      樓層: String(asset.樓層 || ""),
      使用單位: String(asset.使用單位 || ""),
      姓名分機: String(asset.姓名分機 || ""),
      設備類型: type,
      品牌型號: String(asset.品牌型號 || ""),
      產品序號: sn,
      主要mac: mac1 || String(asset.主要mac || ""), 
      無線mac: mac2 || String(asset.無線mac || ""),
      設備名稱標記: deviceName,
      核定ip: ip,
      狀態: "已結案",
      行政備註: isReplace ? "舊換新結案" : "新機配發結案",
      同步來源: String(asset.來源廠商 || "")
    }]);

  if (insertErr) throw new Error("物理遷移至歷史庫失敗：" + insertErr.message);

  // D. 從待辦池物理刪除 (結案閉環)
  const { error: delErr } = await supabase
    .from("assets")
    .delete()
    .eq("產品序號", sn);

  if (delErr) throw new Error("清理待辦池失敗：" + delErr.message);

  // E. 寫入系統安全日誌
  await logAction("SYSTEM_ADMIN", `執行 17 欄位對沖核定成功 (SN: ${sn})`);

  return { success: true };
}

/**
 * 🚀 5. 執行案件退回
 */
export async function rejectAsset(sn: string, reason: string) {
  const { error } = await supabase
    .from("assets")
    .update({
      狀態: "退回修正",
      行政退回原因: reason
    })
    .eq("產品序號", sn);

  if (error) throw new Error("退回更新失敗：" + error.message);
  
  await logAction("SYSTEM_ADMIN", `退回案件修正 (SN: ${sn}, 原因: ${reason})`);
  return { success: true };
}

/**
 * 🚀 6. 自動獲取設備流水號
 */
export async function getNextSequence(prefix: string) {
  noStore();
  const { count, error } = await supabase
    .from("historical_assets")
    .select("*", { count: 'exact', head: true })
    .like("設備名稱標記", `${prefix}%`);
    
  if (error) throw new Error("流水號抓取失敗");
  return String((count || 0) + 1).padStart(3, '0');
}

/**
 * 🚀 7. 定義內部配發資料封裝型別 (消除 any)
 */
export interface InternalIssuePayload {
  installDate: string;
  area: string;
  floor: string;
  unit: string;
  ext: string;
  type: string;
  model: string;
  sn: string;
  mac1: string;
  mac2: string;
  ip: string;
  name: string;
  remark: string;
}

/**
 * 🚀 8. 內部緊急配發通道入庫 (供 internal/page.tsx 呼叫)
 */
export async function submitInternalIssue(pkg: InternalIssuePayload) {
  const { error } = await supabase.from("assets").insert([{
    案件編號: `INT-${Date.now().toString().slice(-6)}`,
    裝機日期: pkg.installDate,
    院區: pkg.area,
    樓層: pkg.floor,
    使用單位: pkg.unit,
    姓名分機: pkg.ext,
    設備類型: pkg.type,
    品牌型號: pkg.model,
    產品序號: pkg.sn,
    主要mac: pkg.mac1,
    無線mac: pkg.mac2,
    設備名稱標記: pkg.name,
    核定ip: pkg.ip,
    狀態: "已結案",
    備註: pkg.remark || "系統管理端錄入",
    來源廠商: "內部快速配發"
  }]);

  if (error) throw new Error("內部配發物理入庫失敗: " + error.message);
  await logAction("SYSTEM_ADMIN", `執行內部快速配發結案 (SN: ${pkg.sn})`);
  return { success: true };
}