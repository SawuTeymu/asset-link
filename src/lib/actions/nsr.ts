"use server";

import { supabase } from "../supabase";
import { formatFloor } from "../logic/formatters";
import { unstable_noStore as noStore } from "next/cache";

/**
 * ==========================================
 * 檔案：src/lib/actions/nsr.ts
 * 狀態：V5.11 物理介面對正版 (修正 TS2353)
 * 物理職責：
 * 1. 介面對沖：明確定義 settleNsrRecord 接收參數，包含加成與面板屬性。
 * 2. 數據同步：處理 nsr_records 物理表之增刪改查。
 * 3. 0 簡化：保留 115 年度財務結算邏輯。
 * ==========================================
 */

export async function getNsrList() {
  noStore();
  const { data, error } = await supabase
    .from("nsr_records")
    .select("*")
    .order("申請日期", { ascending: false });
    
  if (error) throw new Error("NSR 資料庫讀取失敗: " + error.message);
  return data;
}

export async function submitNsrData(d: any) {
  const { error } = await supabase.from("nsr_records").upsert([{
    "id": d.form_id || d.id,
    "申請日期": d.request_date || d.date,
    "棟別": d.area,
    "樓層": formatFloor(d.floor || ""),
    "申請單位": d.unit,
    "申請人": d.applicant || d.user,
    "連絡電話": d.phone || d.ext || "",
    "需求數量": Number(d.qty || d.points) || 1,
    "線材規格": d.cable_type || d.type || "CAT 6",
    "施工事由": d.reason || d.desc || "",
    "處理狀態": d.status || "未處理",
    "部門代號": d.dept_code || "N/A"
  }], { onConflict: 'id' });

  if (error) throw new Error("NSR 需求立案失敗: " + error.message);
  return { success: true };
}

export async function updateNsrStatus(id: string, status: string) {
  const { error } = await supabase
    .from("nsr_records")
    .update({ "處理狀態": status })
    .eq("id", id);

  if (error) throw new Error(`狀態更新失敗: ` + error.message);
  return { success: true };
}

/**
 * 🚀 物理修正：擴充 params 型別定義，對正前端傳入之物件屬性
 */
export async function settleNsrRecord(params: { 
  form_id: string; 
  finishRemark: string;
  isAddon?: boolean;   // 物理新增：允許接收加成標記
  usePanel?: boolean;  // 物理新增：允許接收面板標記
}) {
  const { error } = await supabase
    .from("nsr_records")
    .update({
      "處理狀態": "待請款",
      "結算備註": params.finishRemark
      // 註：若資料庫有對應欄位可在此擴充寫入 isAddon/usePanel
    })
    .eq("id", params.form_id);

  if (error) throw new Error("財務結算寫入失敗: " + error.message);
  return { success: true };
}

export async function deleteNsrRecord(id: string) {
  const { error } = await supabase
    .from("nsr_records")
    .delete()
    .eq("id", id);

  if (error) throw new Error("單據抹除失敗: " + error.message);
  return { success: true };
} 