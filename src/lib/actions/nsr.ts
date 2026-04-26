"use server";

import { supabase } from "../supabase";
import { formatFloor } from "../logic/formatters";
import { calculateNsrPrice } from "../logic/pricing";
import { unstable_noStore as noStore } from "next/cache";

/**
 * ==========================================
 * 檔案：src/lib/actions/nsr.ts
 * 狀態：V5.8 旗艦完全體 (解決 Vercel 500 Error 與 409 衝突)
 * 物理職責：
 * 1. 解決 409 Conflict 報錯 -> 將 insert 升級為 upsert。
 * 2. 徹底消除所有 any 宣告，並透過 unknown 雙重轉型解決 Supabase 中文解析錯誤。
 * 3. 處理 NSR 16 欄位行政軌道與 115 年度合約計價。
 * ==========================================
 */

// 🚀 1. 定義 NSR 資料庫回傳強型別 (消除 r: any)
interface NsrDbRow {
  申請單號: string;
  申請日期: string;
  棟別: string;
  樓層: string;
  部門代號: string;
  申請單位: string;
  申請人: string;
  連絡電話: string;
  需求數量: number;
  線材規格: string;
  施工事由: string;
  行政核銷總額: number;
  處理狀態: string;
  完工日期: string;
  完工備註: string;
  數據來源標記: string;
}

// 🚀 2. 定義 NSR 錄入載荷強型別 (消除 d: any)
interface NsrSubmitPayload {
  form_id: string;
  request_date?: string;
  area: string;
  floor?: string;
  dept_code: string;
  unit: string;
  applicant: string;
  phone?: string;
  qty: number | string;
  cable_type?: string;
  reason?: string;
  source?: string;
}

// 🚀 3. 定義 NSR 結算配置強型別 (消除 config: any)
interface NsrSettleConfig {
  form_id: string;
  isAddon: boolean;
  usePanel: boolean;
  finishRemark: string;
}

export async function getNsrList() {
  noStore();
  try {
    const { data, error } = await supabase
      .from("nsr_records")
      .select("*")
      .order("申請日期", { ascending: false });

    if (error) throw error;

    // 🚀 雙重轉型：繞過 Supabase 中文標題推斷錯誤
    const typedData = data as unknown as NsrDbRow[] | null;

    // 🚀 數據適配：資料庫中文 -> 前端 UI 英文
    return (typedData || []).map((r) => ({
      id: r.申請單號,
      date: r.申請日期,
      area: r.棟別,
      floor: r.樓層,
      deptCode: r.部門代號,
      unit: r.申請單位,
      user: r.申請人,
      ext: r.連絡電話,
      points: r.需求數量,
      type: r.線材規格,
      desc: r.施工事由,
      total: r.行政核銷總額,
      status: r.處理狀態,
      finishDate: r.完工日期,
      finishRemark: r.完工備註,
      source: r.數據來源標記
    }));
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("【NSR 數據鏈路中斷】:", errorMsg);
    throw new Error("讀取 NSR 歷史資料庫失敗: " + errorMsg);
  }
}

export async function submitNsrData(d: NsrSubmitPayload) {
  // 🚀 物理對位：執行全繁體中文欄位寫入
  // 🚀 物理修復：將 insert 變更為 upsert 並掛載 onConflict，解決 409 Conflict 報錯
  const { error } = await supabase.from("nsr_records").upsert([{
    申請單號: d.form_id,
    申請日期: d.request_date || new Date().toISOString().split('T')[0],
    棟別: d.area,
    樓層: formatFloor(d.floor || ""),
    部門代號: d.dept_code,
    申請單位: d.unit,
    申請人: d.applicant,
    連絡電話: d.phone || "",
    需求數量: Number(d.qty) || 1,
    線材規格: d.cable_type || "CAT 6",
    施工事由: d.reason || "",
    行政核銷總額: 0,
    處理狀態: "未處理",
    數據來源標記: d.source || "管理端錄入"
  }], { onConflict: '申請單號' });

  if (error) throw new Error("NSR 物理寫入失敗: " + error.message);
  return { success: true };
}

export async function settleNsrRecord(config: NsrSettleConfig) {
  // 1. 抓取對稱計價基數 (申請單號為物理 Key)
  const { data: record, error: fErr } = await supabase
    .from("nsr_records")
    .select("需求數量, 線材規格")
    .eq("申請單號", config.form_id)
    .single();

  if (fErr || !record) throw new Error("找不到對沖案件");

  // 🚀 雙重轉型解決 TS2339 ParserError，同時消滅 as any
  const typedRecord = record as unknown as { 需求數量: number; 線材規格: string };

  // 2. 演算 115 年度合約階梯單價
  const totalPrice = calculateNsrPrice(
    typedRecord.線材規格 as "CAT 6" | "CAT 6A",
    typedRecord.需求數量,
    config.isAddon,
    config.usePanel
  );

  // 3. 落地更新處理狀態與總額
  const { error } = await supabase
    .from("nsr_records")
    .update({
      行政核銷總額: totalPrice,
      處理狀態: "已結案",
      完工日期: new Date().toISOString().split('T')[0],
      完工備註: config.finishRemark
    })
    .eq("申請單號", config.form_id);

  if (error) throw error;
  return { success: true };
}