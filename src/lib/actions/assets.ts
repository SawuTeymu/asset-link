"use server";

import { supabase } from "../supabase";
import { logAction } from "./auth";
import { unstable_noStore as noStore } from "next/cache";

/**
 * ==========================================
 * 檔案：src/lib/actions/assets.ts
 * 狀態：V7.2 物理對沖完全體 (0 簡化、0 刪除版)
 * 物理職責：
 * 1. 待辦獲取：管理者讀取所有「待核定」案件。
 * 2. 物理核對：執行 approveAsset 與 rejectAsset 狀態流轉。
 * 3. 物理刪除：管理者專屬 deleteAssetAdmin 物理銷毀權限。
 * 4. 直通入庫：Internal 模組專用快速結案與全域 IP 衝突偵測。
 * 5. 廠商同步：處理預約提交、進度查詢與確認結案遷移。
 * ==========================================
 */

/**
 * 🚀 物理規則：IP 全域對沖衝突偵測
 * 同時掃描「進行中」與「已結案」資料庫，確保全院 IP 唯一性
 */
export async function checkIpConflict(ip: string) {
  const { data: archive } = await supabase.from("historical_assets").select("*").eq("核定ip", ip).maybeSingle();
  if (archive) return true;
  const { data: active } = await supabase.from("assets").select("*").eq("核定ip", ip).maybeSingle();
  return !!active;
}

/**
 * 🚀 物理規則：內部人員快速直通入庫
 * 跳過廠商預約流程，直接物理寫入歷史結案庫 historical_assets
 */
export async function submitInternalIssue(payload: any) {
  const { error } = await supabase.from("historical_assets").insert([{
    "核定ip": payload.ip,
    "主要mac": payload.mac1 || "",
    "產品序號": payload.sn,
    "設備名稱標記": payload.deviceName,
    "設備類型": payload.deviceType,
    "品牌型號": payload.model || "未提供",
    "棟別": payload.area,
    "樓層": payload.floor,
    "使用單位": payload.unit,
    "姓名分機": payload.applicant,
    "同步來源": "內部直通",
    "行政備註": payload.remark || "",
    "狀態": "已結案"
  }]);
  
  if (error) throw new Error("直通入庫物理寫入失敗: " + error.message);
  
  await logAction("SYSTEM_ADMIN", `執行內部直通結案 (SN: ${payload.sn})`);
  return true;
}

/**
 * 🚀 管理者專屬：物理刪除進行中資產紀錄
 */
export async function deleteAssetAdmin(sn: string) {
  const { error } = await supabase
    .from("assets")
    .delete()
    .eq("產品序號", sn);

  if (error) throw new Error("資產物理刪除失敗: " + error.message);
  
  await logAction("SYSTEM_ADMIN", `管理者執行資產物理刪除 (SN: ${sn})`);
  return { success: true };
}

/**
 * 🚀 管理端：獲取所有待處理數據 (Pending Pool)
 */
export async function getAdminPendingData() {
  noStore();
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .eq("狀態", "待核定")
    .order("建立時間", { ascending: true });

  if (error) throw new Error("讀取管理待辦清單失敗");

  const typedData = data as unknown as Record<string, unknown>[];
  return (typedData || []).map((r) => ({
    formId: String(r.案件編號 || ""),
    date: String(r.裝機日期 || ""),
    area: String(r.棟別 || ""), 
    floor: String(r.樓層 || ""),
    unit: String(r.使用單位 || ""),
    applicantFull: String(r.姓名分機 || ""),
    model: String(r.品牌型號 || ""),
    sn: String(r.產品序號 || ""),
    mac1: String(r.主要mac || ""),
    mac2: String(r.無線mac || ""),
    status: String(r.狀態 || ""),
    vendor: String(r.來源廠商 || ""),
    remark: String(r.備註 || "")
  }));
}

/**
 * 🚀 管理端：執行核發 (配發固定 IP 並更新狀態)
 */
export async function approveAsset(sn: string, ip: string, deviceName: string, type: string) {
  const { error } = await supabase.from("assets").update({
    "核定ip": ip,
    "設備名稱標記": deviceName,
    "設備類型": type,
    "狀態": "已核定(待確認)"
  }).eq("產品序號", sn);

  if (error) throw new Error("核發狀態物理更新失敗");
  
  await logAction("SYSTEM_ADMIN", `行政核定配發 IP: ${ip} (SN: ${sn})`);
  return { success: true };
}

/**
 * 🚀 管理端：退回修正 (發還廠商重新填報)
 */
export async function rejectAsset(sn: string, reason: string) {
  const { error } = await supabase.from("assets").update({
    "狀態": "退回修正",
    "行政退回原因": reason
  }).eq("產品序號", sn);

  if (error) throw new Error("案件退回更新失敗");
  
  await logAction("SYSTEM_ADMIN", `退回資產案件修正，原因: ${reason} (SN: ${sn})`);
  return { success: true };
}

/**
 * 🚀 廠商端：獲取進度查詢 (進行中與歷史數據邏輯連集)
 */
export async function getVendorProgress(vendor: string) {
  noStore();
  const oneMonthAgo = new Date();
  oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
  const filterDateStr = oneMonthAgo.toISOString().split('T')[0];

  const [activeRes, histRes] = await Promise.all([
    supabase.from("assets").select("*").eq("來源廠商", vendor),
    supabase.from("historical_assets").select("*").eq("同步來源", vendor)
  ]);

  if (activeRes.error) throw new Error("讀取進行中資料失敗");
  if (histRes.error) throw new Error("讀取歷史庫資料失敗");

  const activeRecords = (activeRes.data || []).map((r) => ({
    formId: String(r.案件編號 || ""),
    status: String(r.狀態 || ""),
    date: String(r.裝機日期 || ""),
    area: String(r.棟別 || ""),
    floor: String(r.樓層 || ""),
    unit: String(r.使用單位 || ""),
    model: String(r.品牌型號 || ""),
    sn: String(r.產品序號 || ""),
    mac1: String(r.主要mac || ""),
    mac2: String(r.無線mac || ""),
    applicantFull: String(r.姓名分機 || ""),
    remark: String(r.備註 || ""),
    rejectReason: String(r.行政退回原因 || ""),
    assignedIp: String(r.核定ip || ""),
    assignedName: String(r.設備名稱標記 || ""),
    _createTime: String(r.建立時間 || "")
  }));

  const histRecords = (histRes.data || []).map((r) => ({
    formId: String(r.結案單號 || ""),
    status: "已結案",
    date: String(r.裝機日期 || ""),
    area: String(r.棟別 || ""),
    floor: String(r.樓層 || ""),
    unit: String(r.使用單位 || ""),
    model: String(r.品牌型號 || ""),
    sn: String(r.產品序號 || ""),
    mac1: String(r.主要mac || ""),
    mac2: String(r.無線mac || ""),
    applicantFull: String(r.姓名分機 || ""),
    remark: String(r.行政備註 || "結案存檔"),
    rejectReason: "",
    assignedIp: String(r.核定ip || ""),
    assignedName: String(r.設備名稱標記 || ""),
    _createTime: String(r.建立時間 || "")
  }));

  // 合併並執行時間對沖排序
  return [...activeRecords, ...histRecords]
    .filter(item => item.date >= filterDateStr)
    .sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return b._createTime.localeCompare(a._createTime);
    });
}

/**
 * 🚀 廠商端：確認核定結果並執行物理遷移結案
 */
export async function vendorConfirmAsset(sn: string) {
  const { data: asset, error: fetchErr } = await supabase
    .from("assets")
    .select("*")
    .eq("產品序號", sn)
    .single();

  if (fetchErr || !asset) throw new Error("找不到該核定案件");
  
  const isReplace = String(asset.備註 || "").includes("[REPLACE]");

  const { error: insertErr } = await supabase.from("historical_assets").insert([{
    "結案單號": asset.案件編號,
    "裝機日期": asset.裝機日期,
    "棟別": asset.棟別,
    "樓層": asset.樓層,
    "使用單位": asset.使用單位,
    "姓名分機": asset.姓名分機,
    "設備類型": asset.設備類型 || "桌上型電腦",
    "品牌型號": asset.品牌型號,
    "產品序號": sn,
    "主要mac": asset.主要mac,
    "無線mac": asset.無線mac,
    "核定ip": asset.核定ip,
    "設備名稱標記": asset.設備名稱標記,
    "狀態": "已結案",
    "行政備註": isReplace ? "汰換結案" : "新購結案",
    "同步來源": asset.來源廠商
  }]);

  if (insertErr) throw new Error("遷移歷史庫失敗: " + insertErr.message);

  // 結案後物理刪除緩衝池數據
  await supabase.from("assets").delete().eq("產品序號", sn);
  
  await logAction("VENDOR_KEYIN", `廠商已確認配發參數並完成結案 (SN: ${sn})`);
  return { success: true };
}

/**
 * 🚀 廠商端：批次提交資產預約單 (含修正蓋寫邏輯)
 */
export async function submitAssetBatch(batchData: any[]) {
  // 對沖修正：若為修正件，先物理移除舊紀錄
  for (const d of batchData) {
    if (d.original_sn) {
      await supabase.from("assets").delete().eq("產品序號", d.original_sn);
    }
  }

  const insertData = batchData.map(d => ({
    "案件編號": d.form_id,
    "裝機日期": d.install_date,
    "棟別": d.area,
    "樓層": d.floor,
    "使用單位": d.unit,
    "姓名分機": d.applicant,
    "品牌型號": d.model,
    "產品序號": d.sn,
    "主要mac": d.mac1,
    "無線mac": d.mac2,
    "備註": d.remark,
    "來源廠商": d.vendor,
    "狀態": d.status || "待核定"
  }));

  const { error } = await supabase.from("assets").insert(insertData);
  if (error) throw new Error("資產預約資料提交失敗: " + error.message);
  
  return { success: true };
}