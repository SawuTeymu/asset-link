"use server";

import { supabase } from "../supabase";
import { logAction } from "./auth";
import { unstable_noStore as noStore } from "next/cache";

/**
 * ==========================================
 * 檔案：src/lib/actions/assets.ts
 * 狀態：V400.6 伺服器端權限守門員 (100% 全功能完整版)
 * 職責：
 * 1. 物理防護：新增 verifyVendorAuth 函式，每次操作前查核 vendors 狀態。
 * 2. 零刪減：保留所有跨頁面呼叫的 Server Actions (含內部直通、刪除等)。
 * 3. 穩定防呆：包含最新版防呆、trim() 去除空白與 .select() 驗證的核發/退回功能。
 * ==========================================
 */

// --- 0. 廠商權限驗證 (物理守門員) ---
async function verifyVendorAuth(vendorName: string) {
  if (!vendorName) throw new Error("缺少廠商識別名稱，拒絕存取");
  
  const { data, error } = await supabase
    .from("vendors")
    .select("授權啟用開關, 行政狀態")
    .eq("廠商名稱", vendorName)
    .single();
    
  if (error || !data) {
    throw new Error(`無法驗證廠商身分 [${vendorName}]，可能該廠商不存在於資料庫。`);
  }
  
  if (data.授權啟用開關 !== true || data.行政狀態 !== '正常') {
    throw new Error(`【存取拒絕】廠商 [${vendorName}] 帳號已停權或停用，系統禁止操作。`);
  }
}

// --- 1. IP 衝突檢查 (包含歷史庫與現行庫) ---
export async function checkIpConflict(ip: string) {
  const cleanIp = ip.trim();
  if (!cleanIp) return false;
  
  // 檢查歷史結案庫
  const { data: archive } = await supabase.from("historical_assets").select("*").eq("核定ip", cleanIp).maybeSingle();
  if (archive) return true;
  
  // 檢查現行資產庫
  const { data: active } = await supabase.from("資產").select("*").eq("核定ip", cleanIp).maybeSingle();
  return !!active;
}

// --- 2. 內部直通入庫 (供 /internal 使用) ---
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
    "姓名": payload.applicantName,
    "分機": payload.applicantExt,
    "同步來源": "內部直通",
    "行政備註": payload.remark || "",
    "狀態": "已結案"
  }]);
  
  if (error) throw new Error("入庫寫入失敗: " + error.message);
  await logAction("SYSTEM_ADMIN", `執行內部直通結案 (SN: ${payload.sn})`);
  return true;
}

// --- 3. 管理端刪除資產 ---
export async function deleteAssetAdmin(sn: string) {
  const { error } = await supabase.from("資產").delete().eq("產品序號", sn);
  if (error) throw new Error("資產刪除失敗: " + error.message);
  await logAction("SYSTEM_ADMIN", `管理者執行資產刪除 (SN: ${sn})`);
  return { success: true };
}

// --- 4. 取得待核定清單 ---
export async function getAdminPendingData() {
  noStore();
  const { data, error } = await supabase
    .from("資產")
    .select("*")
    .eq("狀態", "待核定")
    .order("建立時間", { ascending: true });

  if (error) throw new Error("讀取待辦清單失敗: " + error.message);

  const typedData = data as unknown as Record<string, unknown>[];
  return (typedData || []).map((r) => ({
    formId: String(r.案件編號 || ""),
    date: String(r.裝機日期 || ""),
    area: String(r.棟別 || ""), 
    floor: String(r.樓層 || ""),
    unit: String(r.使用單位 || ""),
    applicantName: String(r.姓名 || ""),
    applicantExt: String(r.分機 || ""),
    model: String(r.品牌型號 || ""),
    sn: String(r.產品序號 || ""),
    mac1: String(r.主要mac || ""),
    mac2: String(r.無線mac || ""),
    status: String(r.狀態 || ""),
    vendor: String(r.來源廠商 || ""),
    remark: String(r.備註 || "")
  }));
}

// --- 5. 行政核發資產 ---
export async function approveAsset(sn: string, ip: string, deviceName: string, type: string) {
  const cleanSn = sn.trim();
  const cleanIp = ip.trim();
  const cleanDeviceName = deviceName.trim().toUpperCase();

  try {
    const { data, error } = await supabase
      .from("資產")
      .update({
        "核定ip": cleanIp,
        "設備名稱標記": cleanDeviceName,
        "設備類型": type,
        "狀態": "已核定(待確認)"
      })
      .eq("產品序號", cleanSn)
      .select();

    if (error) throw new Error(`資料庫更新失敗: ${error.message}`);
    if (!data || data.length === 0) throw new Error("找不到對應的產品序號，無法更新狀態。");

    await logAction("SYSTEM_ADMIN", `行政核定配發 IP: ${cleanIp} (SN: ${cleanSn})`);
    return { success: true };
  } catch (err: any) {
    console.error("【Server Action 崩潰 - approveAsset】", err);
    throw err;
  }
}

// --- 6. 行政退回案件 ---
export async function rejectAsset(sn: string, reason: string) {
  const cleanSn = sn.trim();
  const cleanReason = reason.trim();

  try {
    const { data, error } = await supabase
      .from("資產")
      .update({
        "行政退回原因": cleanReason,
        "狀態": "已退回(待修正)"
      })
      .eq("產品序號", cleanSn)
      .select();

    if (error) throw new Error(`資料庫更新失敗: ${error.message}`);
    if (!data || data.length === 0) throw new Error("找不到對應的產品序號，無法執行退回操作。");

    await logAction("SYSTEM_ADMIN", `退回資產案件修正，原因: ${cleanReason} (SN: ${cleanSn})`);
    return { success: true };
  } catch (err: any) {
    console.error("【Server Action 崩潰 - rejectAsset】", err);
    throw err;
  }
}

// --- 7. 取得廠商進度 (供 /keyin 使用) ---
export async function getVendorProgress(vendor: string) {
  noStore();
  
  // 🚀 安全攔截：檢查廠商是否有權限讀取資料
  await verifyVendorAuth(vendor);

  const filterDateStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [activeRes, histRes] = await Promise.all([
    supabase.from("資產").select("*").eq("來源廠商", vendor),
    supabase.from("historical_assets").select("*").eq("同步來源", vendor)
  ]);

  if (activeRes.error) throw new Error("讀取進行中資料失敗");
  if (histRes.error) throw new Error("讀取歷史庫資料失敗");

  const activeRecords = (activeRes.data || []).map((r) => ({
    formId: String(r.案件編號 || ""), status: String(r.狀態 || ""), date: String(r.裝機日期 || ""),
    area: String(r.棟別 || ""), floor: String(r.樓層 || ""), unit: String(r.使用單位 || ""),
    model: String(r.品牌型號 || ""), sn: String(r.產品序號 || ""), mac1: String(r.主要mac || ""), mac2: String(r.無線mac || ""),
    applicantName: String(r.姓名 || ""), applicantExt: String(r.分機 || ""),
    remark: String(r.備註 || ""), rejectReason: String(r.行政退回原因 || ""),
    assignedIp: String(r.核定ip || ""), assignedName: String(r.設備名稱標記 || ""), _createTime: String(r.建立時間 || "")
  }));

  const histRecords = (histRes.data || []).map((r) => ({
    formId: String(r.結案單號 || ""), status: "已結案", date: String(r.裝機日期 || ""),
    area: String(r.棟別 || ""), floor: String(r.樓層 || ""), unit: String(r.使用單位 || ""),
    model: String(r.品牌型號 || ""), sn: String(r.產品序號 || ""), mac1: String(r.主要mac || ""), mac2: String(r.無線mac || ""),
    applicantName: String(r.姓名 || ""), applicantExt: String(r.分機 || ""),
    remark: String(r.行政備註 || "結案存檔"), rejectReason: "",
    assignedIp: String(r.核定ip || ""), assignedName: String(r.設備名稱標記 || ""), _createTime: String(r.建立時間 || "")
  }));

  return [...activeRecords, ...histRecords]
    .filter(item => item.date >= filterDateStr)
    .sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return b._createTime.localeCompare(a._createTime);
    });
}

// --- 8. 廠商確認結案歸檔 ---
export async function vendorConfirmAsset(sn: string) {
  const { data: asset, error: fetchErr } = await supabase.from("資產").select("*").eq("產品序號", sn).single();
  if (fetchErr || !asset) throw new Error("找不到該核定案件");
  
  // 🚀 安全攔截：檢查結案廠商是否有權限操作
  await verifyVendorAuth(asset.來源廠商);

  const isReplace = String(asset.備註 || "").includes("[REPLACE]");
  const { error: insertErr } = await supabase.from("historical_assets").insert([{
    "結案單號": asset.案件編號, "裝機日期": asset.裝機日期, "棟別": asset.棟別, "樓層": asset.樓層,
    "使用單位": asset.使用單位, "姓名": asset.姓名, "分機": asset.分機, "設備類型": asset.設備類型 || "桌上型電腦",
    "品牌型號": asset.品牌型號, "產品序號": sn, "主要mac": asset.主要mac, "無線mac": asset.無線mac,
    "核定ip": asset.核定ip, "設備名稱標記": asset.設備名稱標記, "狀態": "已結案",
    "行政備註": isReplace ? "汰換結案" : "新購結案", "同步來源": asset.來源廠商
  }]);

  if (insertErr) throw new Error("遷移歷史庫失敗: " + insertErr.message);
  await supabase.from("資產").delete().eq("產品序號", sn);
  await logAction("VENDOR_KEYIN", `廠商確認結案 (SN: ${sn})`);
  return { success: true };
}

// --- 9. 批次提交預約 ---
export async function submitAssetBatch(batchData: any[]) {
  if (!batchData || batchData.length === 0) return { success: true };

  // 🚀 安全攔截：從資料列中抽出廠商名稱進行驗證
  const vendorName = batchData[0].vendor || batchData[0].來源廠商;
  await verifyVendorAuth(vendorName);

  for (const d of batchData) {
    if (d.original_sn) await supabase.from("資產").delete().eq("產品序號", d.original_sn);
  }
  
  const insertData = batchData.map(d => ({
    "案件編號": d.form_id, "裝機日期": d.install_date, "棟別": d.area, "樓層": d.floor,
    "使用單位": d.unit, "姓名": d.applicantName, "分機": d.applicantExt, "品牌型號": d.model, "產品序號": d.sn,
    "主要mac": d.mac1, "無線mac": d.mac2, "備註": d.remark, "來源廠商": d.vendor, "狀態": d.status || "待核定"
  }));
  
  const { error } = await supabase.from("資產").insert(insertData);
  if (error) throw new Error("預約資料提交失敗: " + error.message);
  return { success: true };
}