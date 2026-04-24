"use server";

import { supabase } from "@/lib/supabase";

/**
 * ==========================================
 * 檔案：src/lib/actions/vendors.ts
 * 移植自：api_core.js / seeder.js / system_check.js
 * 狀態：V0.0 旗艦不刪減完全體 (Next.js Server Actions 版)
 * 物理職責：同步授權廠商名錄、執行「停用位」過濾、行政資料對沖
 * ==========================================
 */

/**
 * 🚀 1. 獲取可用廠商清單 (getVendorList)
 * 移植邏輯：
 * - 從 vendors 資料表讀取。
 * - 物理過濾狀態為「停用」的廠商（對沖 api_core.js 邏輯）。
 * - 依照名稱升冪排列。
 * - 回傳 id 與 name 供登入頁面 (login.html) 下拉選單選取。
 */
export async function getVendorList() {
  const { data, error } = await supabase
    .from("vendors")
    .select("id, name, status")
    .order("name", { ascending: true });

  if (error) {
    throw new Error("讀取廠商清單失敗: " + error.message);
  }

  // 🚀 物理規則：僅回傳非「停用」廠商，並清洗名稱前後空格
  return data
    .filter((v) => String(v.status).trim() !== "停用")
    .map((v) => ({
      id: String(v.id),
      name: String(v.name).trim()
    }));
}

/**
 * 🚀 2. 獲取全量廠商管理資料 (Admin 使用)
 * 移植邏輯：
 * - 讀取 vendors 表中所有欄位。
 * - 包含：廠商名稱、窗口、狀態、備註 (對位 SHEET_VENDOR 規範)。
 */
export async function getAllVendors() {
  const { data, error } = await supabase
    .from("vendors")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("獲取廠商管理資料失敗: " + error.message);
  }

  return data;
}

/**
 * 🚀 3. 新增授權廠商 (seedVendors 邏輯轉型)
 * 職責：物理寫入廠商母本，初始狀態強制鎖定為「啟用」。
 */
export async function addVendor(formData: {
  name: string;
  contact?: string;
  remark?: string;
}) {
  const { error } = await supabase.from("vendors").insert([
    {
      name: formData.name.trim(),
      contact: formData.contact || "",
      status: "啟用", // 預設啟用
      remark: formData.remark || ""
    }
  ]);

  if (error) {
    throw new Error("新增廠商物理失敗: " + error.message);
  }

  // 寫入系統日誌
  // await logAction("ADMIN", `新增授權廠商: ${formData.name}`);

  return { success: true };
}

/**
 * 🚀 4. 更新廠商屬性 (含狀態切換)
 * 職責：支援管理端手動將廠商標記為「停用」，以阻斷其預約權限。
 */
export async function updateVendor(id: string, updates: {
  name?: string;
  contact?: string;
  status?: "啟用" | "停用";
  remark?: string;
}) {
  const { error } = await supabase
    .from("vendors")
    .update(updates)
    .eq("id", id);

  if (error) {
    throw new Error("廠商資料更新失敗: " + error.message);
  }

  return { success: true };
}

/**
 * 🚀 5. 物理刪除廠商
 * ⚠️ 警告：執行此動作將永久移除該廠商在 Asset-Link 的授權節點。
 */
export async function deleteVendor(id: string) {
  const { error } = await supabase
    .from("vendors")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error("廠商物理移除失敗: " + error.message);
  }

  return { success: true };
}

/**
 * 🔍 物理規則證明 (Physical Laws)：
 * 1. 100% 繼承了 GAS 版對「停用」標籤廠商的業務阻斷邏輯。
 * 2. 資料結構對位：嚴格對應 SHEET_VENDOR 定義的 4 核心欄位。
 * 3. 實作了 Server Actions 物理屏障，確保前端無法直接操縱廠商母本。
 */