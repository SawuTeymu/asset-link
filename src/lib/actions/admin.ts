"use server";

import { supabase } from "../supabase";
import { unstable_noStore as noStore } from "next/cache";
import { systemLog } from "./assets";

/**
 * ==========================================
 * 檔案：src/lib/actions/admin.ts
 * 狀態：V1.0 總控台戰情後端
 * 職責：
 * 1. 儀表板統計：取得系統各維度的高階數據。
 * 2. 歷史庫檢索：支援 SN、IP、MAC、單位的大數據模糊搜尋。
 * 3. 帳號管理：廠商清單、新增廠商、停權/啟用、重設密碼。
 * ==========================================
 */

// --- 1. 取得儀表板統計數據 ---
export async function getDashboardStats() {
  noStore();
  try {
    const [pendingRes, histRes, nsrRes, vendorRes] = await Promise.all([
      supabase.from("資產").select("產品序號", { count: "exact", head: true }).eq("狀態", "待核定"),
      supabase.from("historical_assets").select("產品序號", { count: "exact", head: true }),
      supabase.from("nsr_records").select("申請單號", { count: "exact", head: true }).eq("處理狀態", "未處理"),
      supabase.from("vendors").select("廠商名稱", { count: "exact", head: true })
    ]);

    return {
      success: true,
      data: {
        pendingCount: pendingRes.count || 0,
        historicalCount: histRes.count || 0,
        nsrPendingCount: nsrRes.count || 0,
        vendorCount: vendorRes.count || 0
      }
    };
  } catch (err: any) {
    return { success: false, message: "統計數據讀取失敗" };
  }
}

// --- 2. 大數據檢索：歷史結案資料庫 ---
export async function searchHistoricalAssets(keyword: string) {
  noStore();
  try {
    let query = supabase
      .from("historical_assets")
      .select("*")
      .order("裝機日期", { ascending: false })
      .limit(150); // 為保證效能，最多回傳前 150 筆符合的資料

    if (keyword && keyword.trim() !== "") {
      const kw = `%${keyword.trim()}%`;
      // 支援多欄位模糊搜尋 (SN, IP, MAC, 單位, 廠商)
      query = query.or(`產品序號.ilike.${kw},核定ip.ilike.${kw},主要mac.ilike.${kw},使用單位.ilike.${kw},同步來源.ilike.${kw}`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const typedData = data as unknown as Record<string, unknown>[];
    return {
      success: true,
      data: typedData.map(r => ({
        sn: String(r.產品序號 || ""),
        formId: String(r.結案單號 || ""),
        date: String(r.裝機日期 || ""),
        area: String(r.棟別 || ""),
        floor: String(r.樓層 || ""),
        unit: String(r.使用單位 || ""),
        applicantName: String(r.姓名 || ""),
        applicantExt: String(r.分機 || ""),
        deviceType: String(r.設備類型 || ""),
        model: String(r.品牌型號 || ""),
        mac1: String(r.主要mac || ""),
        ip: String(r.核定ip || ""),
        vendor: String(r.同步來源 || ""),
        remark: String(r.行政備註 || ""),
        status: String(r.狀態 || "")
      }))
    };
  } catch (err: any) {
    return { success: false, message: "歷史庫檢索失敗: " + err.message };
  }
}

// --- 3. 取得所有廠商帳號 ---
export async function getVendorsAdmin() {
  noStore();
  try {
    const { data, error } = await supabase
      .from("vendors")
      .select("*")
      .order("廠商名稱", { ascending: true });

    if (error) throw error;
    
    const typedData = data as unknown as Record<string, unknown>[];
    return {
      success: true,
      data: typedData.map(r => ({
        name: String(r.廠商名稱 || ""),
        status: String(r.行政狀態 || ""),
        isActive: Boolean(r.授權啟用開關),
        password: String(r.密碼 || "")
      }))
    };
  } catch (err: any) {
    return { success: false, message: "廠商清單讀取失敗" };
  }
}

// --- 4. 新增合作廠商 ---
export async function addVendorAdmin(name: string, password: string = "123456") {
  const cleanName = name.trim();
  if (!cleanName) return { success: false, message: "廠商名稱不可為空" };

  try {
    const { error } = await supabase.from("vendors").insert([{
      "廠商名稱": cleanName,
      "行政狀態": "正常",
      "授權啟用開關": true,
      "密碼": password
    }]);

    if (error) {
      if (error.code === '23505') return { success: false, message: "該廠商名稱已存在" };
      throw error;
    }

    await systemLog("管理員(Admin)", `新增合作廠商帳號: ${cleanName}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, message: "新增廠商失敗" };
  }
}

// --- 5. 切換廠商狀態 (停權/啟用) ---
export async function toggleVendorStatusAdmin(name: string, currentIsActive: boolean) {
  try {
    const newIsActive = !currentIsActive;
    const newStatus = newIsActive ? "正常" : "停權";

    const { error } = await supabase
      .from("vendors")
      .update({ "授權啟用開關": newIsActive, "行政狀態": newStatus })
      .eq("廠商名稱", name);

    if (error) throw error;

    await systemLog("管理員(Admin)", `變更廠商狀態: ${name} -> ${newStatus}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, message: "狀態切換失敗" };
  }
}

// --- 6. 管理員強制重設廠商密碼 ---
export async function resetVendorPasswordAdmin(name: string, newPassword: string) {
  if (!newPassword || newPassword.length < 6) return { success: false, message: "密碼長度至少需 6 碼" };

  try {
    const { error } = await supabase
      .from("vendors")
      .update({ "密碼": newPassword })
      .eq("廠商名稱", name);

    if (error) throw error;

    await systemLog("管理員(Admin)", `強制重設廠商密碼: ${name}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, message: "密碼重設失敗" };
  }
}