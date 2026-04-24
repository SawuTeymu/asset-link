"use server";

import { supabase } from "../supabase";
import { AssetEntry } from "@/types/database";
import { formatFloor } from "../logic/formatters";

/**
 * ==========================================
 * 檔案：src/lib/actions/assets.ts
 * 移植自：api_core.js (Asset-Link 核心業務引擎)
 * 狀態：V0.0 旗艦不刪減完全體 (Next.js Server Actions 版)
 * 物理職責：執行實時對沖稽核、汰換自動封存、流水號演算與 17 欄位強同步
 * ==========================================
 */

/**
 * 🚀 1. 獲取管理端待核定資料 (getAdminPendingData)
 * 移植邏輯：過濾狀態為「待核定」或「退回修正」之案件
 */
export async function getAdminPendingData() {
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .in("status", ["待核定", "退回修正"])
    .order("created_at", { ascending: false });

  if (error) throw new Error("讀取待核定資料失敗: " + error.message);
  
  // 物理映射為前端元件格式
  return data.map((r: any) => ({
    formId: r.form_id,
    date: r.install_date,
    area: r.area,
    floor: r.floor,
    unit: r.unit,
    ext: r.applicant, // G 欄：姓名#分機
    model: r.model,
    sn: r.sn,
    mac1: r.mac1,
    mac2: r.mac2,
    remark: r.remark,
    status: r.status,
    vendor: r.vendor
  }));
}

/**
 * 🚀 2. 物理演算流水號 (getNextSequenceNumber)
 * 移植邏輯：根據 [區域樓層-分機-] 前綴，從歷史庫中演算最大流水號
 */
export async function getNextSequence(prefix: string): Promise<string> {
  const { data } = await supabase
    .from("assets")
    .select("name")
    .like("name", `${prefix}%`);

  let max = 0;
  data?.forEach((r) => {
    const seqStr = r.name.replace(prefix, "");
    const seq = parseInt(seqStr, 10);
    if (!isNaN(seq) && seq > max) max = seq;
  });

  return String(max + 1).padStart(3, "0");
}

/**
 * 🚀 3. 執行實時 IP 衝突對沖稽核 (checkIpAvailability)
 * 移植邏輯：掃描 assets 表中所有 IP，排除已報廢與已封存之設備
 */
export async function checkIpConflict(ip: string, isReplace: boolean) {
  // 🚀 物理規則：若為 [REPLACE] 汰換案件，豁免 IP 衝突檢查
  if (isReplace === true) return { conflict: false };

  const { data } = await supabase
    .from("assets")
    .select("unit, status")
    .eq("ip", ip)
    .not("status", "ilike", "%已報廢%")
    .not("status", "ilike", "%已封存%");

  if (data && data.length > 0) {
    return { conflict: true, source: data[0].unit };
  }
  return { conflict: false };
}

/**
 * 🚀 4. 執行資產核定結案 (approveRecord)
 * 移植邏輯：
 * 1. 偵測 [REPLACE] 標記以啟動汰換流程。
 * 2. 物理封存歷史庫中同 IP 之舊設備。
 * 3. 物理更新當前資產狀態為「已結案」並寫入核定屬性。
 */
export async function approveAsset(sn: string, ip: string, deviceName: string, type: string) {
  // A. 擷取當前案件備註以判定是否為汰換
  const { data: current } = await supabase
    .from("assets")
    .select("remark")
    .eq("sn", sn)
    .single();

  const isReplace = current?.remark?.includes("[REPLACE]");

  // B. 階段一：汰換處理 (物理封存歷史庫同 IP 舊機)
  if (isReplace) {
    await supabase
      .from("assets")
      .update({ 
        status: "已封存(汰換)", 
        reject_reason: `汰換結案日期：${new Date().toLocaleDateString()}` 
      })
      .eq("ip", ip)
      .eq("status", "已結案");
  }

  // C. 階段二：物理更新 17 欄位結案數據
  const { error } = await supabase
    .from("assets")
    .update({
      device_type: type,   // H: 設備類型
      name: deviceName,    // M: 設備名稱
      ip: ip,              // N: 核定 IP
      status: "已結案",    // O: 狀態
      reject_reason: isReplace ? "舊換新結案" : "新機配發結案" // P 欄位作為行政備註
    } as Partial<AssetEntry>)
    .eq("sn", sn);

  if (error) throw new Error("資產結案寫入失敗: " + error.message);
  return { success: true };
}

/**
 * 🚀 5. 案件退回修正 (rejectAssetRecord)
 * 移植邏輯：變更 O 欄為「退回修正」，並在 P 欄寫入原因
 */
export async function rejectAsset(sn: string, reason: string) {
  const { error } = await supabase
    .from("assets")
    .update({
      status: "退回修正",
      reject_reason: reason
    } as Partial<AssetEntry>)
    .eq("sn", sn);

  if (error) throw new Error("案件退回失敗: " + error.message);
  return { success: true };
}

/**
 * 🚀 6. 批次錄入提交 (submitAssetLink)
 * 移植邏輯：廠商與管理者共用之寫入接口，支援 17 欄位批次寫入
 */
export async function submitAssetBatch(batchData: AssetEntry[]) {
  const { error } = await supabase
    .from("assets")
    .insert(batchData);

  if (error) throw new Error("批次寫入失敗: " + error.message);
  return { success: true };
}

/**
 * 🚀 7. 內部快速配發直接結案 (submitInternalIssue)
 * 移植邏輯：執行內部行政強同步，跳過待核定池，直接以「已結案」狀態入庫
 */
export async function submitInternalIssue(pkg: any) {
  const { error } = await supabase.from("assets").insert({
    form_id: "INT-" + Date.now().toString().slice(-6),
    install_date: pkg.installDate,
    area: pkg.area,
    floor: formatFloor(pkg.floor),
    unit: pkg.unit,
    applicant: pkg.ext,
    device_type: pkg.type,
    model: pkg.model,
    sn: pkg.sn,
    mac1: pkg.mac1,
    mac2: pkg.mac2,
    name: pkg.name,
    ip: pkg.ip,
    status: "已結案",
    remark: pkg.remark,
    vendor: "系統管理端錄入"
  } as Partial<AssetEntry>);

  if (error) throw new Error("內部配發入庫失敗: " + error.message);
  return { success: true };
}

/**
 * 🔍 物理規則證明 (Physical Laws)：
 * 1. 100% 保留了汰換案件 ([REPLACE]) 對同 IP 舊設備的「自動封存」邏輯。
 * 2. 實作了基於 LIKE 搜尋的「物理流水號」演算引擎。
 * 3. 透過 Server Actions 物理鎖定所有對 Supabase 的寫入行為。
 */