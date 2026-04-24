"use server";

import { supabase } from "@/lib/supabase";
import { NsrEntry } from "@/types/database";
import { formatFloor } from "../logic/formatters";

/**
 * ==========================================
 * 檔案：src/lib/actions/nsr.ts
 * 移植自：api_core.js (Asset-Link NSR 網點需求引擎)
 * 狀態：V0.0 旗艦不刪減完全體 (Next.js Server Actions 版)
 * 物理職責：執行 16 欄位 A-P 軌道強同步、需求錄入與行政計價結案
 * ==========================================
 */

/**
 * 🚀 1. 獲取 NSR 需求清單 (getNsrList)
 * 移植邏輯：
 * 1. 讀取 nsr_records 全量資料。
 * 2. 依照申請日期降序排列。
 * 3. 物理對沖：模擬 GAS 的 row.map 處理，進行資料清洗與型別轉換。
 */
export async function getNsrList() {
  // 物理權限檢查 (此處預留，後續可由 auth 模組驗證 ADMIN 身分)
  // await verifyIdentity("ADMIN");

  const { data, error } = await supabase
    .from("nsr_records")
    .select("*")
    .order("request_date", { ascending: false });

  if (error) {
    throw new Error("讀取 NSR 歷史資料庫失敗: " + error.message);
  }

  // 物理對沖與資料映射 (對位 api_core.js 的 16 欄位結構)
  return data
    .filter((r) => r.form_id && r.form_id.trim() !== "")
    .map((r: NsrEntry) => ({
      id: r.form_id,                        // A: 申請單號
      date: r.request_date,                  // B: 申請日
      area: r.area,                         // C: 棟別
      floor: r.floor,                        // D: 樓層 (00樓格式)
      deptCode: r.dept_code,                 // E: 部門代號
      unit: r.unit,                          // F: 申請單位
      user: r.applicant,                     // G: 申請人#分機
      ext: r.phone,                          // H: 連絡電話
      points: r.qty,                         // I: 需求數量
      type: r.cable_type,                    // J: 線材規格
      reason: r.reason,                      // K: 事由
      total: r.total_price,                  // L: 總價
      status: r.status,                      // M: 狀態
      finishDate: r.finish_date,             // N: 完工日期
      finishRemark: r.finish_remark,         // O: 完工備註
      source: r.source                       // P: 數據來源
    }));
}

/**
 * 🚀 2. 施工需求申請錄入 (submitNsrData)
 * 移植邏輯：
 * 1. 嚴格對齊 16 欄位 A-P 物理軌道。
 * 2. 呼叫 formatFloor 執行樓層自動補 0。
 * 3. 初始狀態物理鎖定為「未處理」。
 */
export async function submitNsr(d: {
  id: string;
  date?: string;
  area: string;
  floor: string;
  deptCode: string;
  unit: string;
  user: string;
  ext?: string;
  points: number;
  type: string;
  desc?: string;
}) {
  // 組裝物理寫入載荷 (Payload)
  const payload: Partial<NsrEntry> = {
    form_id: d.id.trim().toUpperCase(),    // A: 申請單號
    request_date: d.date || new Date().toISOString().split('T')[0], // B: 申請日
    area: d.area,                         // C: 棟別
    floor: formatFloor(d.floor),           // D: 樓層 (執行補0+樓物理規則)
    dept_code: d.deptCode,                 // E: 部門代號
    unit: d.unit,                          // F: 申請單位
    applicant: d.user,                     // G: 申請人#分機 (行政窄化規範)
    phone: d.ext || "",                    // H: 連絡電話
    qty: d.points,                         // I: 需求數量
    cable_type: d.type,                    // J: 線材規格 (CAT 6 / 6A)
    reason: d.desc || "",                  // K: 事由說明
    total_price: 0,                        // L: 總價 (待結案核銷)
    status: "未處理",                      // M: 狀態
    source: "系統管理端錄入"                // P: 數據來源
  };

  const { error } = await supabase
    .from("nsr_records")
    .insert([payload]);

  if (error) {
    throw new Error("NSR 施工需求錄入失敗: " + error.message);
  }

  return { success: true };
}

/**
 * 🚀 3. 執行行政計價結案核銷 (settleNsrRecord)
 * 移植邏輯：
 * 1. 根據單號執行物理對沖。
 * 2. 寫入計算後的 L 欄對沖總價。
 * 3. 更新狀態、完工日期與行政備註。
 */
export async function settleNsr(d: { 
  id: string; 
  total: number; 
  status: string; 
  remark: string 
}) {
  // 物理執行資料庫更新 (Update by form_id)
  const { error } = await supabase
    .from("nsr_records")
    .update({
      total_price: d.total,                 // L: 寫入 115 年度合約對沖總價
      status: d.status,                     // M: 狀態變更 (已結案)
      finish_date: new Date().toISOString(), // N: 完工日期
      finish_remark: d.remark               // O: 完工備註
    } as Partial<NsrEntry>)
    .eq("form_id", d.id);

  if (error) {
    throw new Error("NSR 行政結案核銷失敗: " + error.message);
  }

  return { success: true };
}

/**
 * 🚀 4. 物理刪除/撤回單據 (預留行政功能)
 */
export async function deleteNsrRecord(id: string) {
  const { error } = await supabase
    .from("nsr_records")
    .delete()
    .eq("form_id", id);

  if (error) throw new Error("案件撤回失敗: " + error.message);
  return { success: true };
}

/**
 * 🔍 物理規則證明 (Physical Laws)：
 * 1. 100% 保留了 NSR 16 欄位 A-P 的資料對位。
 * 2. 樓層欄位 (D) 在錄入時強制執行行政窄化格式化。
 * 3. 結案流程 (settleNsr) 物理鎖定單價結算結果與完工標籤。
 */