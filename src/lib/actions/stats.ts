"use server";

import { supabase } from "@/lib/supabase";
import { unstable_noStore as noStore } from "next/cache";

/**
 * ==========================================
 * 檔案：src/lib/actions/stats.ts
 * 狀態：最終嚴格校準版 (請確保貼入 stats.ts)
 * 物理職責：處理大數據網段分析、儀表板統計與 VANS 資安偏差偵測。
 * ==========================================
 */

interface HistAssetDbRow {
  裝機日期: string;
  結案單號: string;
  院區: string;
  樓層: string;
  使用單位: string;
  產品序號: string;
  主要mac: string;
  核定ip: string;
  狀態: string;
  行政備註: string;
  同步來源: string;
}

interface IpUsageRow {
  核定ip: string;
}

interface VansMetricsRow {
  行政備註: string;
  狀態: string;
}

export async function getDashboardStats() {
  noStore();
  try {
    const { count: pendingCount, error: pErr } = await supabase
      .from("assets")
      .select("*", { count: 'exact', head: true })
      .eq("狀態", "待核定");

    if (pErr) throw pErr;

    const { count: doneCount, error: dErr } = await supabase
      .from("historical_assets")
      .select("*", { count: 'exact', head: true })
      .eq("狀態", "已結案");

    if (dErr) throw dErr;

    return {
      pending: pendingCount || 0,
      done: doneCount || 0
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("【儀表板統計獲取失敗】:", errorMsg);
    throw new Error("儀表板統計獲取失敗: " + errorMsg);
  }
}

export async function getIpUsageStats() {
  noStore();
  try {
    const { data, error } = await supabase
      .from("historical_assets")
      .select("核定ip")
      .eq("狀態", "已結案");

    if (error) throw error;

    const segments: Record<string, number> = {};
    const typedData = data as unknown as IpUsageRow[] | null;

    typedData?.forEach((r) => {
      const ipStr = String(r.核定ip || "").trim();
      if (ipStr.startsWith("10.") && ipStr.includes(".")) {
        const parts = ipStr.split('.');
        if (parts.length >= 3) {
          const s = `${parts[0]}.${parts[1]}.${parts[2]}`;
          segments[s] = (segments[s] || 0) + 1;
        }
      }
    });

    return Object.keys(segments)
      .map((key) => ({
        segment: key,
        count: segments[key],
        percent: Math.min(100, Math.floor((segments[key] / 254) * 100))
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("【IP 負載分析失敗】:", errorMsg);
    throw new Error("IP 負載分析讀取失敗");
  }
}

export async function getHistoryRecords() {
  noStore();
  try {
    const { data, error } = await supabase
      .from("historical_assets")
      .select("*")
      .order("數據匯入時間", { ascending: false })
      .limit(10);

    if (error) throw error;

    const typedData = data as unknown as HistAssetDbRow[] | null;

    return (typedData || []).map((r) => ({
      date: r.裝機日期,
      formId: r.結案單號,
      area: r.院區,
      floor: r.樓層,
      unit: r.使用單位,
      sn: r.產品序號,
      mac1: r.主要mac,
      ip: r.核定ip,
      status: r.狀態,
      remark: r.行政備註,
      vendor: r.同步來源
    }));
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("【最近紀錄讀取失敗】:", errorMsg);
    return [];
  }
}

export async function getVansMetrics() {
  noStore();
  try {
    const { data, error } = await supabase
      .from("historical_assets")
      .select("行政備註, 狀態");

    if (error) throw error;

    let macErr = 0;      
    let ipConflict = 0;  
    let zombieAlert = 0; 

    const typedData = data as unknown as VansMetricsRow[] | null;

    typedData?.forEach((r) => {
      const rmk = String(r.行政備註 || "");
      const st = String(r.狀態 || "");

      if (rmk.includes('MAC偏差') || rmk.includes('VANS同步')) macErr++;
      if (rmk.includes('[REPLACE]') || rmk.includes('IP衝突')) ipConflict++;
      if (st === '已報廢' || st.includes('已封存')) zombieAlert++;
    });

    return {
      macErrorCount: macErr,
      ipConflictCount: ipConflict,
      zombieAlertCount: zombieAlert
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("【VANS 指標對沖異常】:", errorMsg);
    throw err;
  }
}