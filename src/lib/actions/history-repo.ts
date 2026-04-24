"use server";

import { supabase } from "../supabase";

/**
 * ==========================================
 * 檔案：src/lib/actions/history-repo.ts
 * 物理職責：負責萬級歷史數據的讀取、分頁與全域搜索
 * ==========================================
 */

// 1. 分頁獲取歷史數據 (防止一次讀取數萬筆導致記憶體崩潰)
export async function getHistoryPaged(page: number = 1, pageSize: number = 50, query?: string) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let request = supabase
    .from("historical_assets")
    .select("*", { count: "exact" });

  // 若有搜索條件 (執行全域物理過濾)
  if (query) {
    request = request.or(`ip.ilike.%${query}%,sn.ilike.%${query}%,unit.ilike.%${query}%,form_id.ilike.%${query}%`);
  }

  const { data, count, error } = await request
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  return {
    data,
    totalCount: count || 0,
    currentPage: page
  };
}

// 2. 執行全量歷史對沖 (IP 衝突檢查)
export async function checkHistoryConflict(ip: string) {
  const { data } = await supabase
    .from("historical_assets")
    .select("unit, form_id, status")
    .eq("ip", ip)
    .not("status", "ilike", "%已封存%")
    .limit(1);

  return data && data.length > 0 ? data[0] : null;
}

// 3. 物理封存歷史設備 (汰換流程)
export async function archiveHistoricalAsset(ip: string, reason: string) {
  const { error } = await supabase
    .from("historical_assets")
    .update({ 
      status: "已封存(汰換)",
      remark: `[汰換封存] ${reason} - ${new Date().toLocaleDateString()}`
    })
    .eq("ip", ip)
    .eq("status", "已結案");

  if (error) throw error;
  return { success: true };
}