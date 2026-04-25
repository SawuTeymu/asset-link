"use server";

import { supabase } from "../supabase";
import { unstable_noStore as noStore } from "next/cache";

/**
 * ==========================================
 * 檔案：src/lib/actions/history-repo.ts
 * 物理職責：處理 historical_assets 萬級大數據的高效檢索與分頁。
 * 映射標準：數據匯入時間 (A), 結案單號 (B), 核定ip (N), 產品序號 (J)。
 * ==========================================
 */

export async function getHistoryPaged(page: number = 1, pageSize: number = 50, query?: string) {
  noStore(); 
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    let request = supabase
      .from("historical_assets")
      .select("*", { count: "exact" });

    // 🚀 多維度中文模糊搜尋
    if (query && query.trim() !== "") {
      const q = query.trim();
      request = request.or(`核定ip.ilike.%${q}%,產品序號.ilike.%${q}%,使用單位.ilike.%${q}%,結案單號.ilike.%${q}%`);
    }

    const { data, count, error } = await request
      .order("數據匯入時間", { ascending: false })
      .range(from, to);

    if (error) throw error;

    // 🚀 100% 不刪減映射矩陣
    const mappedData = (data || []).map((r: any) => ({
      id: r.id,
      form_id: r.結案單號,
      install_date: r.裝機日期,
      area: r.院區,
      floor: r.樓層,
      unit: r.使用單位,
      applicant: r.姓名分機,
      sn: r.產品序號,
      mac1: r.主要mac,
      ip: r.核定ip,
      status: r.狀態,
      remark: r.行政備註,
      vendor: r.同步來源,
      createdAt: r.數據匯入時間
    }));

    return {
      data: mappedData,
      totalCount: count || 0,
      currentPage: page,
      totalPages: Math.ceil((count || 0) / pageSize)
    };
  } catch (err: any) {
    console.error("【歷史分頁致命故障】:", err.message);
    throw new Error("數據檢索鏈路中斷");
  }
}