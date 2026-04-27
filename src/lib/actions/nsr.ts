"use server";

import { supabase } from "../supabase";
import { formatFloor } from "../logic/formatters";
import { unstable_noStore as noStore } from "next/cache";

/**
 * ==========================================
 * 狀態：V5.9 整合修正版 (對齊 16 欄位行政軌道)
 * 物理職責：負責與 Supabase 中文欄位進行物理對沖。
 * ==========================================
 */

export interface NsrSubmitPayload {
  form_id: string;
  request_date: string;
  area: string;
  floor: string;
  dept_code: string;
  unit: string;
  applicant: string;
  phone: string;
  qty: number;
  cable_type: string;
  reason: string;
  source?: string;
}

export interface NsrSettleConfig {
  form_id: string;
  isAddon: boolean;
  usePanel: boolean;
  finishRemark: string;
}

export async function getNsrList() {
  noStore();
  const { data, error } = await supabase
    .from("nsr_records")
    .select("*")
    .order("申請日期", { ascending: false });
  if (error) throw error;
  return data;
}

export async function submitNsrData(d: NsrSubmitPayload) {
  const { error } = await supabase.from("nsr_records").upsert([{
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
    數據來源標記: d.source || "管理端錄入"
  }], { onConflict: '申請單號' });

  if (error) throw new Error("NSR 物理寫入失敗: " + error.message);
  return { success: true };
}

export async function settleNsrRecord(config: NsrSettleConfig) {
  const { error } = await supabase
    .from("nsr_records")
    .update({
      完工備註: config.finishRemark,
      處理狀態: "待請款",
      完工日期: new Date().toISOString().split('T')[0]
      // 註：行政核銷總額建議由後端 RPC 或特定 Logic 根據 isAddon/usePanel 寫入
    })
    .eq("申請單號", config.form_id);

  if (error) throw error;
  return { success: true };
}

export async function updateNsrStatus(id: string, status: string) {
  const { error } = await supabase
    .from("nsr_records")
    .update({ 處理狀態: status })
    .eq("申請單號", id);
  if (error) throw error;
  return { success: true };
}

export async function deleteNsrRecord(id: string) {
  const { error } = await supabase
    .from("nsr_records")
    .delete()
    .eq("申請單號", id);
  if (error) throw error;
  return { success: true };
}