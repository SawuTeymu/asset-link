"use server";

import { supabase } from "../supabase";
import { logAction } from "./auth";

/**
 * ==========================================
 * 檔案：src/lib/actions/maintenance.ts
 * 移植自：system_check.js (Asset-Link 物理結構保衛者)
 * 狀態：V0.0 旗艦不刪減完全體
 * 物理職責：診斷資料庫一致性、執行物理校準與瘦身
 * ==========================================
 */

/**
 * 🚀 1. 全系統物理結構診斷 (checkSystemIntegrity)
 */
export async function checkSystemIntegrity() {
  const report: string[] = ["=== Asset-Link 物理結構診斷報告 (Next.js) ==="];
  
  // 在 Supabase 環境下，我們檢查 Table 結構是否存在 (透過 RPC 或直接查詢)
  const { data: tables, error } = await supabase
    .from("assets")
    .select("*", { count: 'exact', head: true });

  if (error) {
    report.push("❌ 缺失資產表 (assets) - 物理鏈路中斷");
  } else {
    report.push("✅ 正常：[assets] 表物理存在，目前量體為 " + tables + " 筆");
  }

  const { error: vendorErr } = await supabase
    .from("vendors")
    .select("id", { head: true });

  if (vendorErr) report.push("❌ 缺失廠商表 (vendors)");
  else report.push("✅ 正常：[vendors] 物理存在");

  return report.join("\n");
}

/**
 * 🚀 2. 系統瘦身與清理 (systemDatabaseCleanup)
 * 移植邏輯：在 Supabase 中，這相當於清理無效的 null 記錄或暫存數據。
 */
export async function runDatabaseCleanup() {
  // 物理規則：移除所有 status 為空且 sn 為空的無效佔位符
  const { error, count } = await supabase
    .from("assets")
    .delete()
    .is("sn", null)
    .is("status", null);

  if (error) throw error;

  const msg = `🧹 物理清理完成：已移除 ${count || 0} 條無效軌道。`;
  await logAction("SYSTEM_MAINTENANCE", msg);
  return msg;
}