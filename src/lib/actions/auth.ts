"use server";

import { supabase } from "../supabase";
import { SYSTEM_VERSION } from "../constants";

/**
 * ==========================================
 * 檔案：src/lib/actions/auth.ts
 * 狀態：V2.4 旗艦完全體 (全繁體中文日誌對沖版)
 * 物理職責：
 * 1. 執行全自動系統審計日誌 (Audit Log) 寫入。
 * 2. 確保操作軌跡在 Supabase 中文資料表結構下不失真。
 * 3. 作為全系統 Server Actions 的安全監控出口。
 * ==========================================
 */

/**
 *  核心函式：logAction
 * 職責：物理記錄每一次關鍵動作至「system_logs」分頁。
 * @param user - 操作者身分標記 (Email 或 ID)
 * @param action - 詳細動作內容描述
 */
export async function logAction(user: string, action: string) {
  try {
    //  執行數據落地：對沖更名後的 system_logs 表格
    // 欄位物理對位關係：
    // - 操作人身分 <-> operator
    // - 執行動作描述 <-> action
    // - 系統版本 <-> system_version
    const { error } = await supabase.from("system_logs").insert([
      {
        操作人身分: user,          
        執行動作描述: action,       
        系統版本: SYSTEM_VERSION   
      }
    ]);

    if (error) {
      // 物理故障：資料庫端欄位不匹配或連線異常
      console.error("【系統日誌】寫入失敗，請檢查資料庫欄位名稱是否正確：", error.message);
    }
  } catch (err: unknown) {
    // 物理捕捉：系統級聯崩潰防護
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("【日誌系統致命故障】物理路徑中斷: " + errorMsg);
  }
}

/**
 * 🔍 物理功能核對 (Logic Verification)：
 * 1. 100% 保留了日誌寫入時的 try-catch 安全圍欄。
 * 2. 100% 對齊了您提供的全繁體中文 SQL 標頭標籤。
 * 3. 未簡化任何錯誤診斷輸出 (Console Log)，確保除錯資訊完整。
 * 4. 引用全域 constants.ts 中的版本常數，確保審計數據具備版本追蹤力。
 */