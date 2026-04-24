"use server";

import { supabase } from "../supabase";
import { AUTHORIZED_ADMIN_EMAILS, SYSTEM_SECRET, SYSTEM_VERSION } from "../constants";
import { createHash } from "crypto";

/**
 * ==========================================
 * 檔案：src/lib/actions/auth.ts
 * 狀態：V280.1 修正版 (解決 Server Action 必修 async 問題)
 * 移植自：auth_manager.js (Asset-Link 安全中心)
 * 物理職責：身分對校、SSO 跳轉邏輯、數位憑證生成、XSS 安全清洗、全自動操作審計日誌
 * ==========================================
 */

/**
 * 🚀 1. 管理者 SSO 物理驗證 (verifyAdminSSO)
 */
export async function verifyAdminAccess(email: string) {
  const userEmail = email.toLowerCase().trim();
  
  if (!userEmail) {
    return { 
      success: false, 
      msg: "⚠️ 安全警報：無法偵測您的身分標記。請確保已登入授權帳號。" 
    };
  }

  // 權限對沖：比對白名單
  const isAdmin = AUTHORIZED_ADMIN_EMAILS.some(
    (e) => e.toLowerCase().trim() === userEmail
  );

  if (isAdmin) {
    await logAction(userEmail, "管理者 SSO 原生身分登入成功");
    return { 
      success: true, 
      url: "/admin",
      authorized: true
    };
  }
  
  await logAction("UNAUTHORIZED", `非授權管理者登入嘗試：${userEmail}`);
  return { 
    success: false, 
    authorized: false,
    msg: `🚫 存取拒絕：帳號 [${userEmail}] 未獲得管理授權。` 
  };
}

/**
 * 🚀 2. 數位憑證生成引擎 (generateSecureToken)
 */
export async function generateSecureToken(identity: string): Promise<string> {
  if (!identity) return "";

  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, ''); // yyyyMMdd
  const rawStr = identity + dateStr + SYSTEM_SECRET;
  
  // 執行物理雜湊演算
  const hash = createHash("sha256").update(rawStr).digest("hex");
  
  return hash.substring(0, 16);
}

/**
 * 🚀 3. 物理審計日誌寫入 (logSystemAction)
 */
export async function logAction(user: string, action: string) {
  try {
    // 物理校準：呼叫非同步清洗函式
    const sanitizedUser = await sanitize(user);
    const sanitizedAction = await sanitize(action);

    const { error } = await supabase.from("system_logs").insert([
      {
        operator: sanitizedUser,       // 操作身分
        action: sanitizedAction,       // 執行動作
        system_version: SYSTEM_VERSION, // 系統版本
      }
    ]);

    if (error) throw error;
  } catch (e: any) {
    console.error("日誌系統物理故障: " + e.message);
  }
}

/**
 * 🚀 4. 資料安全清洗工具 (_sanitizeInput)
 * ⚠️ 關鍵修正：Server Action 檔案中匯出的函式必須為 async
 */
export async function sanitize(input: string): Promise<string> {
  if (input === null || input === undefined) return "";
  const str = typeof input !== 'string' ? String(input) : input;
  
  // 物理清洗：移除標籤與角括號，保留行政專用符號 # :
  return str
    .replace(/<[^>]*>?/gm, "")
    .replace(/[<>]/g, "")
    .trim();
}

/**
 * 🚀 5. 內部權限攔截守衛 (原 _verifyIdentity)
 */
export async function verifyServerSideIdentity(email: string) {
  const isAdmin = AUTHORIZED_ADMIN_EMAILS.some(
    (e) => e.toLowerCase().trim() === email.toLowerCase().trim()
  );
  
  if (!isAdmin) {
    throw new Error(`🚫 權限不足：帳號 [${email}] 嘗試執行未授權的管理指令。`);
  }
  
  return true;
}

/**
 * 🔍 物理規則證明 (Physical Laws)：
 * 1. 修正了 sanitize 函式的同步定義錯誤，滿足 Next.js 編譯器要求。
 * 2. logAction 內部同步更新為 await 模式，確保寫入資料庫前的數據已完成清洗。
 * 3. 100% 保持行政窄化規則（姓名#分機）不受 XSS 清洗破壞。
 */