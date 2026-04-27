"use server";

import { supabase } from "../supabase";
import { unstable_noStore as noStore } from "next/cache";

/**
 * ==========================================
 * 檔案：src/lib/actions/logs.ts
 * 物理職責：
 * 1. 執行 system_logs 繁體中文標頭對位。
 * 2. 負責系統審計軌跡的寫入與讀取。
 * ==========================================
 */

export async function logAction(user: string, action: string) {
  try {
    // 物理對位：操作人身分, 執行動作描述, 系統版本
    const { error } = await supabase.from("system_logs").insert([
      {
        操作人身分: user,
        執行動作描述: action,
        系統版本: "Asset-Link V0.0 Flagship (Chinese Protocol)"
      }
    ]);
    if (error) console.error("【日誌寫入失敗】:", error.message);
  } catch (err: any) {
    console.error("【日誌系統崩潰】:", err.message);
  }
}

export async function getSystemLogs(limit: number = 100) {
  noStore();
  try {
    const { data, error } = await supabase
      .from("system_logs")
      .select("*")
      .order("事件時間", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((l: any) => ({
      time: new Date(l.事件時間).toLocaleString('zh-TW', { hour12: false }),
      operator: l.操作人身分,
      action: l.執行動作描述
    }));
  } catch (err: any) {
    console.error("【日誌讀取異常】:", err.message);
    return [];
  }
}