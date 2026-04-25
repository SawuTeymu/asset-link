"use server";

import { supabase } from "../supabase";
import { formatFloor, formatMAC } from "../logic/formatters";
import { unstable_noStore as noStore } from "next/cache";

/**
 * ==========================================
 * 檔案：src/lib/actions/assets.ts
 * 物理職責：
 * 1. 處理 ERI 17 欄位行政軌道 (A-Q)。
 * 2. 執行實時 IP 衝突對沖稽核。
 * 3. 執行核定入庫與物理遷移。
 * ==========================================
 */

export async function getAdminPendingData() {
  noStore();
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .in("狀態", ["待核定", "退回修正"])
    .order("建立時間", { ascending: false });

  if (error) throw new Error("待辦池對沖失敗: " + error.message);

  return (data || []).map((r: any) => ({
    formId: r.案件編號,
    date: r.裝機日期,
    area: r.院區,
    floor: r.樓層,
    unit: r.使用單位,
    ext: r.姓名分機,
    deviceType: r.設備類型,
    model: r.品牌型號,
    sn: r.產品序號,
    mac1: r.主要mac,
    mac2: r.無線mac,
    remark: r.備註,
    status: r.狀態,
    rejectReason: r.行政退回原因,
    vendor: r.來源廠商,
    name: r.設備名稱標記,
    ip: r.核定ip
  }));
}

export async function checkIpConflict(ip: string, isReplace: boolean) {
  if (isReplace) return { conflict: false, source: "" };

  const { data } = await supabase
    .from("historical_assets")
    .select("使用單位")
    .eq("核定ip", ip.trim())
    .not("狀態", "ilike", "%已報廢%");

  if (data && data.length > 0) {
    return { conflict: true, source: String(data[0].使用單位) };
  }
  return { conflict: false, source: "" };
}

export async function approveAsset(sn: string, ip: string, deviceName: string, type: string) {
  const { error } = await supabase
    .from("assets")
    .update({
      核定ip: ip,
      設備名稱標記: deviceName,
      設備類型: type,
      狀態: "已結案"
    })
    .eq("產品序號", sn);

  if (error) throw new Error("核定落地失敗: " + error.message);
  return { success: true };
}

export async function rejectAsset(sn: string, reason: string) {
  const { error } = await supabase
    .from("assets")
    .update({
      狀態: "退回修正",
      行政退回原因: reason
    })
    .eq("產品序號", sn);

  if (error) throw error;
  return { success: true };
}

export async function submitAssetBatch(batchData: any[]) {
  const chineseData = batchData.map(d => ({
    案件編號: d.form_id,
    裝機日期: d.install_date,
    院區: d.area,
    樓層: formatFloor(d.floor),
    使用單位: d.unit,
    姓名分機: d.applicant,
    品牌型號: d.model,
    產品序號: String(d.sn).toUpperCase(),
    主要mac: formatMAC(d.mac1),
    無線mac: formatMAC(d.mac2),
    備註: d.remark,
    狀態: d.status || "待核定",
    來源廠商: d.vendor
  }));

  const { error } = await supabase.from("assets").insert(chineseData);
  if (error) throw error;
  return { success: true };
}

export async function getNextSequence(prefix: string) {
  const { data } = await supabase
    .from("historical_assets")
    .select("設備名稱標記")
    .like("設備名稱標記", `${prefix}%`);

  let max = 0;
  data?.forEach((r: any) => {
    const seqStr = String(r.設備名稱標記 || "").replace(prefix, "");
    const seq = parseInt(seqStr, 10);
    if (!isNaN(seq) && seq > max) max = seq;
  });

  return String(max + 1).padStart(3, "0");
}