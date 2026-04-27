"use server";

import { supabase } from "../supabase";
import { logAction } from "./auth";
import { unstable_noStore as noStore } from "next/cache";

/**
 * ==========================================
 * 檔案：src/lib/actions/assets.ts
 * 狀態：V6.7 旗艦完全體 (修復進度查詢全資料顯示)
 * 物理職責：
 * 1. 實作「退回修正」自管理端隱藏。
 * 2. 實作「已核定(待確認)」狀態，等候廠商確認才入歷史庫。
 * 3. 升級 IP 衝突引擎，涵蓋「待確認中」之暫存防護。
 * 4. 徹底落實「雙重轉型 (Double Casting)」，消滅編譯器紅字。
 * 5. [重磅升級] 進度查詢改為「跨表聯集 (Union)」，合併顯示進行中與歷史已結案全資料。
 * ==========================================
 */

export interface VendorSubmitPayload {
  form_id: string;
  install_date: string;
  area: string;
  floor: string;
  unit: string;
  applicant: string;
  model: string;
  sn: string;
  original_sn?: string; // 🚀 用於承接廠商重送的舊序號，物理覆蓋
  mac1: string;
  mac2: string;
  remark: string;
  vendor: string;
  status: string;
}

/**
 * 🚀 廠商批次提交預約單
 */
export async function submitAssetBatch(batchData: VendorSubmitPayload[]) {
  // 🚀 物理防線：廠商「載入修正」重送時，物理刪除被退回的舊紀錄，確保單軌替換
  for (const d of batchData) {
    if (d.original_sn) {
      await supabase.from("assets").delete().eq("產品序號", d.original_sn);
    }
  }

  const insertData = batchData.map(d => ({
    案件編號: d.form_id,
    裝機日期: d.install_date,
    院區: d.area,
    樓層: d.floor,
    使用單位: d.unit,
    姓名分機: d.applicant,
    品牌型號: d.model,
    產品序號: d.sn || `SN-AUTO-${Math.floor(Math.random() * 100000)}`, 
    主要mac: d.mac1,
    無線mac: d.mac2,
    備註: d.remark,
    來源廠商: d.vendor,
    狀態: d.status
  }));

  const { error } = await supabase.from("assets").insert(insertData);
  if (error) throw new Error("預約資料寫入失敗: " + error.message);

  await logAction("VENDOR_KEYIN", `廠商 [${batchData[0]?.vendor}] 提交預約單 (${batchData[0]?.form_id})`);
  return { success: true };
}

/**
 * 🚀 管理端待辦獲取 (物理過濾退回案件)
 */
export async function getAdminPendingData() {
  noStore();
  // 🚀 物理修復：只抓取「待核定」，退回案件物理隱藏，等待廠商重送
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .eq("狀態", "待核定")
    .order("建立時間", { ascending: true });

  if (error) throw new Error("讀取待核定失敗: " + error.message);

  const typedData = data as unknown as Record<string, unknown>[];
  return (typedData || []).map((r) => ({
    formId: String(r.案件編號 || ""),
    date: String(r.裝機日期 || ""),
    area: String(r.院區 || ""),
    floor: String(r.樓層 || ""),
    unit: String(r.使用單位 || ""),
    ext: String(r.姓名分機 || ""),
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
 * 🚀 廠商端進度獲取 (專屬通道：跨表聯集合併全資料)
 */
export async function getVendorProgress(vendor: string) {
  noStore();
  
  // 1. 從 assets 表抓取「進行中」的資料
  const { data: activeData, error: activeErr } = await supabase
    .from("assets")
    .select("*")
    .eq("來源廠商", vendor);

  if (activeErr) throw new Error("讀取進行中進度失敗: " + activeErr.message);

  // 2. 從 historical_assets 表抓取「已結案」的資料
  // 結案庫中廠商名稱是存在「同步來源」欄位
  const { data: histData, error: histErr } = await supabase
    .from("historical_assets")
    .select("*")
    .eq("同步來源", vendor);

  if (histErr) throw new Error("讀取已結案進度失敗: " + histErr.message);

  const typedActive = (activeData || []) as unknown as Record<string, unknown>[];
  const typedHist = (histData || []) as unknown as Record<string, unknown>[];

  // 3. 轉換進行中資料格式
  const activeRecords = typedActive.map((r) => ({
    formId: String(r.案件編號 || ""),
    date: String(r.裝機日期 || ""),
    area: String(r.院區 || ""),
    floor: String(r.樓層 || ""),
    unit: String(r.使用單位 || ""),
    applicantFull: String(r.姓名分機 || ""),
    model: String(r.品牌型號 || ""),
    sn: String(r.產品序號 || ""),
    mac1: String(r.主要mac || ""),
    mac2: String(r.無線mac || ""),
    status: String(r.狀態 || ""),
    remark: String(r.備註 || ""),
    rejectReason: String(r.行政退回原因 || ""),
    assignedIp: String(r.核定ip || ""),
    assignedName: String(r.設備名稱標記 || ""),
    _rawTime: String(r.建立時間 || r.裝機日期 || "") // 用於排序
  }));

  // 4. 轉換已結案資料格式
  const histRecords = typedHist.map((r) => ({
    formId: String(r.結案單號 || ""),
    date: String(r.裝機日期 || ""),
    area: String(r.院區 || ""),
    floor: String(r.樓層 || ""),
    unit: String(r.使用單位 || ""),
    applicantFull: String(r.姓名分機 || ""),
    model: String(r.品牌型號 || ""),
    sn: String(r.產品序號 || ""),
    mac1: String(r.主要mac || ""),
    mac2: String(r.無線mac || ""),
    status: String(r.狀態 || "已結案"),
    remark: String(r.行政備註 || ""), 
    rejectReason: "", // 已結案不會有退回原因
    assignedIp: String(r.核定ip || ""),
    assignedName: String(r.設備名稱標記 || ""),
    _rawTime: String(r.建立時間 || r.裝機日期 || "") // 用於排序
  }));

  // 5. 將兩包資料合併，並依照建立時間遞減排序 (新的在上面)
  const combinedRecords = [...activeRecords, ...histRecords].sort((a, b) => {
    return b._rawTime.localeCompare(a._rawTime);
  });

  return combinedRecords;
}

/**
 * 🚀 IP 衝突深度掃描 (涵蓋待確認區)
 */
export async function checkIpConflict(ip: string, isReplace: boolean) {
  noStore();
  if (isReplace) return { conflict: false, source: "" };

  // 1. 檢查歷史庫
  const { data: histData } = await supabase.from("historical_assets").select("使用單位").eq("核定ip", ip.trim()).not("狀態", "ilike", "%已報廢%");
  if (histData && histData.length > 0) return { conflict: true, source: String((histData[0] as unknown as Record<string, unknown>).使用單位) };

  // 2. 🚀 檢查待確認區 (防禦管理員連續核發相同 IP)
  const { data: pendData } = await supabase.from("assets").select("使用單位").eq("核定ip", ip.trim()).eq("狀態", "已核定(待確認)");
  if (pendData && pendData.length > 0) return { conflict: true, source: `[待確認中] ${String((pendData[0] as unknown as Record<string, unknown>).使用單位)}` };

  return { conflict: false, source: "" };
}

/**
 * 🚀 管理端執行核發 (僅更新狀態，不移表)
 */
export async function approveAsset(sn: string, ip: string, deviceName: string, type: string, mac1: string = "", mac2: string = "") {
  const { error } = await supabase.from("assets").update({
    核定ip: ip,
    設備名稱標記: deviceName,
    設備類型: type,
    主要mac: mac1 || undefined, 
    無線mac: mac2 || undefined,
    狀態: "已核定(待確認)"
  }).eq("產品序號", sn);

  if (error) throw new Error("核發狀態更新失敗");
  await logAction("SYSTEM_ADMIN", `核定配發 IP 等待廠商確認 (SN: ${sn})`);
  return { success: true };
}

/**
 * 🚀 廠商端確認結案 (物理遷移至歷史庫)
 */
export async function vendorConfirmAsset(sn: string) {
  const { data: assetData, error: fetchErr } = await supabase.from("assets").select("*").eq("產品序號", sn).single();
  if (fetchErr || !assetData) throw new Error("找不到該核定案件");
  
  const asset = assetData as unknown as Record<string, unknown>;
  const isReplace = String(asset.備註 || "").includes("[REPLACE]");
  const ip = String(asset.核定ip || "");
  const type = String(asset.設備類型 || "桌上型電腦");

  // 舊換新：封存舊機紀錄
  if (isReplace && ip) {
    await supabase.from("historical_assets").update({
      狀態: "已封存(汰換)",
      行政備註: "汰換日期：" + new Date().toISOString().split('T')[0]
    }).eq("核定ip", ip.trim());
  }

  // 寫入歷史結案庫
  const { error: insertErr } = await supabase.from("historical_assets").insert([{
    結案單號: String(asset.案件編號 || ""),
    裝機日期: String(asset.裝機日期 || ""),
    院區: String(asset.院區 || ""),
    樓層: String(asset.樓層 || ""),
    使用單位: String(asset.使用單位 || ""),
    姓名分機: String(asset.姓名分機 || ""),
    設備類型: type,
    品牌型號: String(asset.品牌型號 || ""),
    產品序號: sn,
    主要mac: String(asset.主要mac || ""), 
    無線mac: String(asset.無線mac || ""),
    設備名稱標記: String(asset.設備名稱標記 || ""),
    核定ip: ip,
    狀態: "已結案",
    行政備註: isReplace ? "舊換新結案" : "新機配發結案",
    同步來源: String(asset.來源廠商 || "")
  }]);

  if (insertErr) throw new Error("遷移至歷史庫失敗：" + insertErr.message);

  // 從待辦表移除
  await supabase.from("assets").delete().eq("產品序號", sn);
  await logAction("VENDOR_KEYIN", `廠商確認結果並結案 (SN: ${sn})`);
  return { success: true };
}

/**
 * 🚀 退回案件修正
 */
export async function rejectAsset(sn: string, reason: string) {
  const { error } = await supabase.from("assets").update({
    狀態: "退回修正",
    行政退回原因: reason
  }).eq("產品序號", sn);

  if (error) throw new Error("退回更新失敗");
  await logAction("SYSTEM_ADMIN", `退回案件修正 (SN: ${sn})`);
  return { success: true };
}

/**
 * 🚀 獲取下一組設備名稱流水號
 */
export async function getNextSequence(prefix: string) {
  noStore();
  const { count, error } = await supabase.from("historical_assets").select("*", { count: 'exact', head: true }).like("設備名稱標記", `${prefix}%`);
  if (error) throw new Error("流水號抓取失敗");
  return String((count || 0) + 1).padStart(3, '0');
}

export interface InternalIssuePayload {
  installDate: string; area: string; floor: string; unit: string; ext: string; type: string; model: string; sn: string; mac1: string; mac2: string; ip: string; name: string; remark: string;
}

/**
 * 🚀 系統管理端內部錄入
 */
export async function submitInternalIssue(pkg: InternalIssuePayload) {
  const { error } = await supabase.from("assets").insert([{
    案件編號: `INT-${Date.now().toString().slice(-6)}`, 
    裝機日期: pkg.installDate, 
    院區: pkg.area, 
    樓層: pkg.floor, 
    使用單位: pkg.unit, 
    姓名分機: pkg.ext, 
    設備類型: pkg.type, 
    品牌型號: pkg.model, 
    產品序號: pkg.sn, 
    主要mac: pkg.mac1, 
    無線mac: pkg.mac2, 
    設備名稱標記: pkg.name, 
    核定ip: pkg.ip, 
    狀態: "已結案", 
    備註: pkg.remark || "系統管理端錄入", 
    來源廠商: "內部快速配發"
  }]);
  if (error) throw new Error("內部配發失敗: " + error.message);
  return { success: true };
}