"use server";

import { supabase } from "../supabase";
import { formatFloor } from "../logic/formatters";
import { calculateNsrPrice } from "../logic/pricing";
import { unstable_noStore as noStore } from "next/cache";

/**
 * ==========================================
 * 檔案：src/lib/actions/nsr.ts
 * 物理職責：
 * 1. 解決 "nsr_records.request_date does not exist" (對位: 申請日期)。
 * 2. 處理 115 年度階梯計價之結案行政軌道。
 * ==========================================
 */

export async function getNsrList() {
  noStore();
  try {
    const { data, error } = await supabase
      .from("nsr_records")
      .select("*")
      .order("申請日期", { ascending: false });

    if (error) throw error;

    // 🚀 將中文資料庫映射回前端 16 欄結構
    return (data || []).map((r: any) => ({
      id: r.申請單號,
      date: r.申請日期,
      area: r.棟別,
      floor: r.樓層,
      deptCode: r.部門代號,
      unit: r.申請單位,
      user: r.申請人,
      ext: r.連絡電話,
      points: r.需求數量,
      type: r.線材規格,
      desc: r.施工事由,
      total: r.行政核銷總額,
      status: r.處理狀態,
      finishDate: r.完工日期,
      finishRemark: r.完工備註,
      source: r.數據來源標記
    }));
  } catch (err: any) {
    console.error("【NSR 讀取中斷】:", err.message);
    throw new Error("無法連通網點需求資料表");
  }
}

export async function submitNsrData(d: any) {
  const { error } = await supabase.from("nsr_records").insert([{
    申請單號: d.form_id,
    申請日期: d.request_date || new Date().toISOString().split('T')[0],
    棟別: d.area,
    樓層: formatFloor(d.floor || ""),
    部門代號: d.dept_code,
    申請單位: d.unit,
    申請人: d.applicant,
    連絡電話: d.phone || "",
    需求數量: Number(d.qty) || 1,
    線材規格: d.cable_type || "CAT 6",
    施工事由: d.reason || "",
    行政核銷總額: 0,
    處理狀態: "未處理",
    數據來源標記: d.source || "系統管理端錄入"
  }]);

  if (error) throw new Error("NSR 物理錄入失敗: " + error.message);
  return { success: true };
}

export async function settleNsrRecord(config: any) {
  // 1. 抓取對沖案件
  const { data: record, error: fErr } = await supabase
    .from("nsr_records")
    .select("需求數量, 線材規格")
    .eq("申請單號", config.form_id)
    .single();

  if (fErr || !record) throw new Error("案件物理定位失敗");

  // 2. 呼叫 115 計價核心
  const totalPrice = calculateNsrPrice(
    record.線材規格 as any,
    record.需求數量,
    config.isAddon,
    config.usePanel
  );

  // 3. 落地結案資料
  const { error } = await supabase
    .from("nsr_records")
    .update({
      行政核銷總額: totalPrice,
      處理狀態: "已結案",
      完工日期: new Date().toISOString().split('T')[0],
      完工備註: config.finishRemark
    })
    .eq("申請單號", config.form_id);

  if (error) throw error;
  return { success: true };
}