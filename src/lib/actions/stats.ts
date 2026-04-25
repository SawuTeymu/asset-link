"use server";

import { supabase } from "@/lib/supabase";
import { unstable_noStore as noStore } from "next/cache";

/**
 * ==========================================
 * 檔案：src/lib/actions/stats.ts
 * 物理職責：
 * 1. 執行 assets (待辦) 與 historical_assets (歷史) 兩張表的行政流量統計。
 * 2. 透過字串指紋掃描演算 VANS 03/13/38 三大資安指標。
 * 3. 執行「中英橋接」映射，保證前端 UI 功能不失真。
 * ==========================================
 */

/**
 * 🚀 1. 獲取儀表板統計 (getDashboardStats)
 */
export async function getDashboardStats() {
  noStore(); // 物理擊穿快取
  try {
    // 統計 assets 表中狀態為「待核定」的筆數
    const { count: pendingCount, error: pErr } = await supabase
      .from("assets")
      .select("*", { count: 'exact', head: true })
      .eq("狀態", "待核定");

    if (pErr) throw pErr;

    // 統計 historical_assets 表中狀態為「已結案」的總筆數
    const { count: doneCount, error: dErr } = await supabase
      .from("historical_assets")
      .select("*", { count: 'exact', head: true })
      .eq("狀態", "已結案");

    if (dErr) throw dErr;

    return {
      pending: pendingCount || 0,
      done: doneCount || 0
    };
  } catch (err: any) {
    console.error("【儀表板統計失敗】物理攔截:", err.message);
    throw new Error("儀表板統計獲取失敗: " + err.message);
  }
}

/**
 * 🚀 2. 10.x 核心網段負載演算 (getIpUsageStats)
 */
export async function getIpUsageStats() {
  noStore();
  try {
    const { data, error } = await supabase
      .from("historical_assets")
      .select("核定ip")
      .eq("狀態", "已結案");

    if (error) throw error;

    const segments: Record<string, number> = {};
    data?.forEach((r: any) => {
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
  } catch (err: any) {
    console.error("【IP 負載分析失敗】:", err.message);
    throw new Error("IP 負載分析讀取失敗");
  }
}

/**
 * 🚀 3. 控制台最近紀錄 (getHistoryRecords)
 */
export async function getHistoryRecords() {
  noStore();
  try {
    const { data, error } = await supabase
      .from("historical_assets")
      .select("*")
      .order("數據匯入時間", { ascending: false })
      .limit(10); // 僅取前 10 筆用於 Dashboard 展示

    if (error) throw error;

    // 🚀 執行 100% 不刪減映射
    return (data || []).map((r: any) => ({
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
  } catch (err: any) {
    console.error("【歷史紀錄獲取失敗】:", err.message);
    return [];
  }
}

/**
 * 🚀 4. VANS 資安指標偵測 (getVansMetrics)
 * 物理職責：掃描行政備註中的資安標籤
 */
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

    data?.forEach((r: any) => {
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
  } catch (err: any) {
    console.error("【VANS 指標對沖失敗】:", err.message);
    throw err;
  }
}