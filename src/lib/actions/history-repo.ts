"use server";

import { supabase } from "../supabase";
import { unstable_noStore as noStore } from "next/cache";

/**
 * ==========================================
 * 檔案：src/lib/actions/history-repo.ts
 * 狀態：V5.5 嚴格型別校準版 (解決 no-explicit-any)
 * 物理職責：
 * 1. 處理 historical_assets 萬級大數據之繁體中文搜尋、分頁與排序。
 * 2. 徹底消除所有 any 宣告，符合 ESLint 嚴格規範。
 * 3. 透過 unknown 雙重轉型，繞過 Supabase 的中文 ParserError。
 * ==========================================
 */

// 🚀 定義歷史資產強型別 (消除 r: any)
interface HistAssetDbRow {
  id?: string;
  數據匯入時間?: string;
  結案單號: string;
  裝機日期: string;
  院區: string;
  樓層: string;
  使用單位: string;
  姓名分機: string;
  產品序號: string;
  主要mac: string;
  核定ip: string;
  狀態: string;
  行政備註: string;
  同步來源: string;
}

export async function getHistoryPaged(page: number = 1, pageSize: number = 50, query?: string) {
  noStore(); 
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    let request = supabase.from("historical_assets").select("*", { count: "exact" });

    // 🚀 多維度中文模糊搜尋
    if (query && query.trim() !== "") {
      const q = query.trim();
      // 在中文標籤中執行 ilike 對位
      request = request.or(`核定ip.ilike.%${q}%,產品序號.ilike.%${q}%,使用單位.ilike.%${q}%,結案單號.ilike.%${q}%`);
    }

    const { data, count, error } = await request
      .order("數據匯入時間", { ascending: false })
      .range(from, to);

    if (error) throw error;

    // 🚀 透過 unknown 雙重轉型繞過 Supabase 型別推斷錯誤，確保型別安全
    const typedData = data as unknown as HistAssetDbRow[] | null;

    // 🚀 執行 100% 無損映射
    const mappedData = (typedData || []).map((r) => ({
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
  } catch (err: unknown) { // 🚀 消除 err: any 報錯
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("【歷史分頁引擎失敗】:", errorMsg);
    throw new Error("數據檢索鏈路中斷: " + errorMsg);
  }
}