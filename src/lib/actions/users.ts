"use server";

import { supabase } from "../supabase";
import { revalidatePath } from "next/cache";

/**
 * 🚀 帳號管理控制中樞
 * 物理職責：負責 profiles 表的增刪改查與狀態切換
 * 升級狀態：V1.2 加入廠商專屬登入密碼驗證 (修正 TypeScript ParserError)
 */

export async function getAllUsers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function upsertUser(payload: any) {
  const { error } = await supabase
    .from("profiles")
    .upsert([{
      ...payload,
      updated_at: new Date().toISOString()
    }], { onConflict: 'account' });
  
  if (error) throw error;
  revalidatePath("/admin");
  return { success: true };
}

export async function deleteUserRecord(id: string) {
  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", id);
  
  if (error) throw error;
  revalidatePath("/admin");
  return { success: true };
}

export async function getSystemPolicy() {
  const { data, error } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "user_policy")
    .single();
  if (error) return null;
  return data.value;
}

/**
 * 🚀 廠商專屬登入驗證 (在伺服器端安全比對密碼)
 */
export async function verifyVendorLogin(vendorName: string, password: string) {
  if (!vendorName || !password) {
    return { success: false, message: "參數不完整" };
  }

  // 從資料庫抓取該廠商的狀態與密碼
  const { data, error } = await supabase
    .from("vendors")
    .select("廠商名稱, 行政狀態, 密碼")
    .eq("廠商名稱", vendorName)
    .single();

  if (error || !data) {
    return { success: false, message: "找不到該廠商資料" };
  }

  // 🚀 物理修復：透過 unknown 橋接強制轉型，繞過 TypeScript 的 ParserError 嚴格檢查
  const vendorData = data as unknown as { 廠商名稱: string; 行政狀態: string; 密碼: string; };

  // 物理檢查狀態
  if (vendorData.行政狀態 === '停用' || vendorData.行政狀態 === '停權') {
    return { success: false, message: "授權異常：此廠商帳號已暫停使用，請聯繫資訊中心。" };
  }

  // 物理檢查密碼
  if (vendorData.密碼 !== password) {
    return { success: false, message: "密碼錯誤，請重新輸入。" };
  }

  // 驗證通過
  return { success: true, vendorName: vendorData.廠商名稱 };
}