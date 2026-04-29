"use server";

import { supabase } from "@/lib/supabase";
import { logAction } from "./auth";

/**
 * ==========================================
 * 檔案：src/lib/actions/maintenance.ts
 * 物理職責：執行行政資料表健康度掃描 (中文欄位版)
 * ==========================================
 */

/**
 *  1. 執行全系統物理完整性診斷 (checkSystemIntegrity)
 * 職責：透過 Promise.all 併發執行輕量級筆數查詢 (head: true)，獲取核心資料表狀態。
 */
export async function checkSystemIntegrity() {
  try {
    // 執行輕量筆數統計：assets (ERI), nsr_records (NSR), vendors (廠商)
    const [assetsRes, nsrRes, vendorsRes] = await Promise.all([
      supabase.from("assets").select("*", { count: "exact", head: true }),
      supabase.from("nsr_records").select("*", { count: "exact", head: true }),
      supabase.from("vendors").select("*", { count: "exact", head: true }),
    ]);

    // 寫入系統審計日誌
    await logAction("SYSTEM_MAINTENANCE", "執行全系統物理結構診斷");

    return {
      status: "HEALTHY",
      counts: {
        eri: assetsRes.count || 0,
        nsr: nsrRes.count || 0,
        vendors: vendorsRes.count || 0,
      }
    };
  } catch (err: any) {
    // 異常對沖與日誌存證
    await logAction("SYSTEM_ERROR", `診斷失敗: ${err.message}`);
    throw new Error("診斷中斷：" + err.message);
  }
}

/**
 *  2. 驗證資料表架構對齊狀況 (checkSchemaAlignment)
 * 職責：檢查 historical_assets 表中是否存在「行政備註」關鍵中文欄位，
 * 用以判定資料庫是否已完成繁體中文化重構。
 */
export async function checkSchemaAlignment() {
  // 驗證關鍵中文欄位「行政備註」是否存在 (嘗試選取 1 筆資料)
  const { error } = await supabase
    .from("historical_assets")
    .select("行政備註")
    .limit(1);

  // 回傳對齊結果與錯誤訊息 (若存在)
  return { aligned: !error, error: error?.message };
}