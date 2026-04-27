// "use server";

import { supabase } from "@/lib/supabase";
import { unstable_noStore as noStore } from "next/cache";

/**
 * ==========================================
 * 檔案：src/lib/actions/vendors.ts
 * 狀態：V4.8 旗艦不刪減完全體 (全繁體中文欄位適配版)
 * 物理職責：
 * 1. 管理 vendors 資料表之繁體中文欄位對沖。
 * 2. 驅動首頁登入頁面之廠商白名單過濾。
 * 3. 處理管理端針對廠商權限之物理阻斷與恢復。
 * 4. 執行數據對映 (Data Mapping)，確保 UI 與 DB 零位移。
 * ==========================================
 */

/**
 * 🚀 1. 獲取可用廠商清單 (getVendorList)
 * 職責：專供登入首頁 (page.tsx) 調用。
 * 邏輯：僅回傳「授權啟用開關」為 True 且「行政狀態」非「停用」之廠商。
 */
export async function getVendorList() {
  // 物理擊穿：確保管理員在後台停權後，首頁選單能即時消失
  noStore();

  const { data, error } = await supabase
    .from("vendors")
    .select("廠商名稱, 行政狀態, 授權啟用開關")
    .eq("授權啟用開關", true);

  if (error) {
    console.error("【廠商名單讀取失敗】:", error.message);
    return [];
  }

  // 🚀 數據過濾與對映：
  // 排除資料庫標記為「停用」的列，並映射為前端慣用的 { name } 格式
  return (data || [])
    .filter((v: any) => v.行政狀態 !== "停用")
    .map((v: any) => ({
      name: v.廠商名稱
    }));
}

/**
 * 🚀 2. 獲取全量廠商明細 (getAllVendors)
 * 職責：管理後台專用，展示所有 7 欄位行政軌道。
 * 證明 0 刪減：包含 ID、建立時間、名稱、窗口、狀態、備註、開關。
 */
export async function getAllVendors() {
  noStore();

  const { data, error } = await supabase
    .from("vendors")
    .select("*")
    .order("建立時間", { ascending: false });

  if (error) {
    throw new Error("無法獲取廠商名錄: " + error.message);
  }

  // 🚀 數據對映：將中文回傳轉回前端 UI 預期之英文 Key
  return (data || []).map((v: any) => ({
    id: v.id,                    // 物理 UUID
    name: v.廠商名稱,             // 廠商全銜
    contact: v.聯絡窗口,          // 第一線窗口
    status: v.行政狀態,           // 啟用/停用
    remark: v.合約備註,           // 合約內容
    is_active: v.授權啟用開關,     // 物理阻斷位
    createdAt: v.建立時間          // 寫入時間
  }));
}

/**
 * 🚀 3. 更新廠商狀態與權限 (updateVendor)
 * 職責：執行行政狀態變更或物理開關切換。
 */
export async function updateVendor(id: string, updates: { 
  status?: "啟用" | "停用"; 
  is_active?: boolean;
  contact?: string;
  remark?: string;
}) {
  // 🚀 物理轉換層：將前端傳入的英文屬性精準轉化為中文資料表欄位
  const chineseUpdates: any = {};
  
  if (updates.status !== undefined) chineseUpdates.行政狀態 = updates.status;
  if (updates.is_active !== undefined) chineseUpdates.授權啟用開關 = updates.is_active;
  if (updates.contact !== undefined) chineseUpdates.聯絡窗口 = updates.contact;
  if (updates.remark !== undefined) chineseUpdates.合約備註 = updates.remark;

  const { error } = await supabase
    .from("vendors")
    .update(chineseUpdates)
    .eq("id", id);

  if (error) {
    console.error("【廠商更新失敗】:", error.message);
    throw new Error("更新失敗: " + error.message);
  }
  
  return { success: true };
}

/**
 * 🚀 4. 物理新增廠商授權 (addVendor)
 * 職責：在白名單中新增一家廠商。
 */
export async function addVendor(v: { name: string; contact?: string; remark?: string }) {
  const { error } = await supabase.from("vendors").insert([
    {
      廠商名稱: v.name,
      聯絡窗口: v.contact || "",
      行政狀態: "啟用",
      合約備註: v.remark || "",
      授權啟用開關: true
    }
  ]);

  if (error) {
    console.error("【廠商新增失敗】:", error.message);
    throw new Error("廠商已存在或欄位錯誤: " + error.message);
  }
  
  return { success: true };
}

/**
 * 🚀 5. 物理刪除廠商 (deleteVendor)
 * 警告：此動作具備物理破壞性，建議優先使用 updateVendor 將其停權。
 */
export async function deleteVendor(id: string) {
  const { error } = await supabase
    .from("vendors")
    .delete()
    .eq("id", id);

  if (error) throw error;
  return { success: true };
}

/**
 * 🔍 物理功能核對 (Physical Proof)：
 * 1. 100% 採用您 SQL 中的繁體中文 Key 值 (如：廠商名稱、授權啟用開關)。
 * 2. 0 功能簡化：保留了「合約備註」與「建立時間」等所有行政歷史軌道。
 * 3. 具備數據轉換層，保證您不需要為了資料庫中文化而修改首頁登入頁面的 React 代碼。
 */