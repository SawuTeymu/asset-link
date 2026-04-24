"use server";

import { supabase } from "../supabase";
import { AUTHORIZED_ADMIN_EMAILS, SYSTEM_SECRET, ADMIN_CREDENTIALS } from "../constants";
import { createHash } from "crypto";

/**
 * ==========================================
 * 檔案：src/lib/actions/auth.ts
 * 狀態：V280.2 帳密雙驗證升級版
 * 物理職責：身分對校、密碼驗證、數位憑證生成、XSS 安全清洗、全自動操作審計日誌
 * ==========================================
 */

/**
 * 🚀 1. 管理者 SSO 物理驗證 (verifyAdminAccess)
 * 新增了 password 參數，確保只有帳號與密碼完全吻合時才放行
 */
export async function verifyAdminAccess(email: string, password?: string) {
  const userEmail = email.toLowerCase().trim();
  
  if (!userEmail) {
    return { 
      success: false, 
      msg: "⚠️ 安全警報：無法偵測您的身分標記。請確保已輸入帳號。" 
    };
  }

  // 物理規則：密碼阻斷驗證 (對沖 constants.ts 內的 ADMIN_CREDENTIALS)
  if (password !== ADMIN_CREDENTIALS.password) {
    await logAction("UNAUTHORIZED", `密碼驗證失敗：${userEmail}`);
    return { 
      success: false, 
      authorized: false,
      msg: "🚫 存取拒絕：管理密碼不正確。" 
    };
  }

  // 權限對沖：比對 Email 白名單 或 特權 UID
  const isAdmin = AUTHORIZED_ADMIN_EMAILS.some(
    (e) => e.toLowerCase().trim() === userEmail
  );

  if (isAdmin || userEmail === ADMIN_CREDENTIALS.uid) {
    await logAction(userEmail, "管理者帳號與密碼雙重驗證登入成功");
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
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const rawStr = identity + dateStr + SYSTEM_SECRET;
  const hash = createHash("sha256").update(rawStr).digest("hex");
  return hash.substring(0, 16);
}

/**
 * 🚀 3. 物理審計日誌寫入 (logSystemAction)
 */
export async function logAction(user: string, action: string) {
  try {
    const sanitizedUser = await sanitize(user);
    const sanitizedAction = await sanitize(action);

    const { error } = await supabase.from("system_logs").insert([
      {
        operator: sanitizedUser,
        action: sanitizedAction,
        system_version: "Asset-Link V0.0 (Flagship Production)",
      }
    ]);

    if (error) throw error;
  } catch (e: any) {
    console.error("日誌系統物理故障: " + e.message);
  }
}

/**
 * 🚀 4. 資料安全清洗工具
 */
export async function sanitize(input: string): Promise<string> {
  if (input === null || input === undefined) return "";
  const str = typeof input !== 'string' ? String(input) : input;
  return str
    .replace(/<[^>]*>?/gm, "")
    .replace(/[<>]/g, "")
    .trim();
}

/**
 * 🚀 5. 內部權限攔截守衛
 */
export async function verifyServerSideIdentity(email: string) {
  const isAdmin = AUTHORIZED_ADMIN_EMAILS.some(
    (e) => e.toLowerCase().trim() === email.toLowerCase().trim()
  ) || email === ADMIN_CREDENTIALS.uid;
  
  if (!isAdmin) {
    throw new Error(`🚫 權限不足：帳號 [${email}] 嘗試執行未授權的管理指令。`);
  }
  
  return true;
}