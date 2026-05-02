"use server";

import { supabase } from "../supabase";
import { unstable_noStore as noStore } from "next/cache";
import { systemLog } from "./assets";

/**
 * ==========================================
 * 檔案：src/lib/actions/nsr.ts
 * 狀態：V1.1 NSR 真實資料庫 Schema 對齊版
 * 職責：
 * 1. 專責操作 nsr_records 資料表。
 * 2. 🚀 精準對齊真實欄位：申請單號, 申請日期, 申請人, 施工事由, 處理狀態...等。
 * 3. 綁定 systemLog 留下操作軌跡。
 * ==========================================
 */

// --- 1. 提交 NSR 網點申請 (精準對應真實 Schema) ---
export async function submitNsrRequest(requests: any[]) {
  if (!requests || requests.length === 0) return { success: true };

  const insertData = requests.map(r => ({
    "申請單號": r.sn,
    "申請日期": r.date,
    "棟別": r.area,
    "樓層": r.floor,
    "部門代號": "", // 預設留空
    "申請單位": r.unit,
    "申請人": r.applicantExt ? `${r.applicantName}#${r.applicantExt}` : r.applicantName, // 將分機合併進姓名
    "連絡電話": "", 
    "需求數量": 1, // 預設單一工程數量
    "線材規格": "CAT 6", // 預設線材
    "施工事由": `【${r.type}】[${r.location}] ${r.remark}`.trim(), // 將工程類別與位置寫入事由
    "行政核銷總額": "0",
    "處理狀態": "未處理", // 預設為未處理
    "完工日期": null,
    "完工備註": null,
    "數據來源標記": "管理端錄入"
  }));

  const { error } = await supabase.from("nsr_records").insert(insertData);
  
  if (error) {
    if (error.code === '23505') throw new Error("系統已存在相同單號的 NSR 申請，請檢查是否重複提交。");
    throw new Error("NSR 申請提交失敗: " + error.message);
  }
  
  await systemLog("管理員(Admin)", `新增 NSR 網點申請 (共 ${requests.length} 筆)`);
  return { success: true };
}

// --- 2. 獲取 NSR 申請紀錄 (供計價頁面使用) ---
export async function getNsrRecords(statusFilter: string) {
  noStore();
  
  let query = supabase
    .from("nsr_records")
    .select("*")
    .order("申請日期", { ascending: false });

  if (statusFilter !== "ALL") {
    query = query.eq("處理狀態", statusFilter); // 🚀 修正為真實欄位 "處理狀態"
  }

  const { data, error } = await query;
  if (error) throw new Error("讀取 NSR 紀錄失敗: " + error.message);

  const typedData = data as unknown as Record<string, unknown>[];
  return (typedData || []).map((r) => ({
    sn: String(r.申請單號 || ""),
    date: String(r.申請日期 || ""),
    area: String(r.棟別 || ""),
    floor: String(r.樓層 || ""),
    unit: String(r.申請單位 || ""),
    applicantName: String(r.申請人 || ""), // 這裡已經包含分機
    applicantExt: "", 
    type: String(r.線材規格 || ""),
    location: "", 
    remark: String(r.施工事由 || ""),
    status: String(r.處理狀態 || "") // 🚀 修正為真實欄位 "處理狀態"
  }));
}

// --- 3. 單筆標記已計價結算 ---
export async function markNsrBilled(sn: string) {
  const { error } = await supabase
    .from("nsr_records")
    .update({ "處理狀態": "已計價結算" }) // 🚀 修正為真實欄位
    .eq("申請單號", sn); // 🚀 修正為真實欄位

  if (error) throw new Error("計價更新失敗: " + error.message);
  
  await systemLog("管理員(Admin)", `標記 NSR 網點完成計價結算 (單號: ${sn})`);
  return { success: true };
}

// --- 4. 批次標記已計價結算 ---
export async function batchMarkNsrBilled(sns: string[]) {
  if (!sns || sns.length === 0) return { success: true };
  
  const { error } = await supabase
    .from("nsr_records")
    .update({ "處理狀態": "已計價結算" }) // 🚀 修正為真實欄位
    .in("申請單號", sns); // 🚀 修正為真實欄位

  if (error) throw new Error("批次計價更新失敗: " + error.message);
  
  await systemLog("管理員(Admin)", `批次標記 NSR 網點完成計價結算 (共 ${sns.length} 筆)`);
  return { success: true };
}