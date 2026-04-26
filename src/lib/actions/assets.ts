"use server";

import { supabase } from "@/lib/supabase";
import { formatFloor, formatMAC } from "@/lib/logic/formatters";
import { unstable_noStore as noStore } from "next/cache";

/**
 * ==========================================
 * 檔案：src/lib/actions/assets.ts
 * 狀態：最終嚴格校準版 (請確保貼入 assets.ts)
 * 物理職責：處理 ERI 17 欄位行政軌道、待辦核定、內部快速配發與衝突防禦。
 * ==========================================
 */

interface BatchAssetPayload {
  form_id: string;
  install_date: string;
  area: string;
  floor: string;
  unit: string;
  applicant: string;
  model: string;
  sn: string;
  mac1: string;
  mac2: string;
  remark: string;
  status?: string;
  vendor: string;
}

interface InternalIssuePayload {
  installDate: string;
  area: string;
  floor: string;
  unit: string;
  ext: string;
  type: string;
  model: string;
  sn: string;
  mac1: string;
  mac2: string;
  ip: string;
  name: string;
  remark: string;
}

interface AssetDbRow {
  案件編號: string;
  裝機日期: string;
  院區: string;
  樓層: string;
  使用單位: string;
  姓名分機: string;
  設備類型: string;
  品牌型號: string;
  產品序號: string;
  主要mac: string;
  無線mac: string;
  備註: string;
  狀態: string;
  行政退回原因: string;
  來源廠商: string;
  設備名稱標記: string;
  核定ip: string;
}

export async function getAdminPendingData() {
  noStore();
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .in("狀態", ["待核定", "退回修正"])
    .order("建立時間", { ascending: false });

  if (error) throw new Error("待辦池讀取失敗: " + error.message);

  const typedData = data as unknown as AssetDbRow[] | null;

  return (typedData || []).map((r) => ({
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

  const response = await supabase
    .from("historical_assets")
    .select("使用單位")
    .eq("核定ip", ip.trim())
    .not("狀態", "ilike", "%已報廢%");

  const data = response.data as unknown as { 使用單位: string }[] | null;

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

  if (error) throw new Error("資產核發失敗: 欄位標題不匹配");
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

  if (error) throw new Error("退回動作失敗: " + error.message);
  return { success: true };
}

export async function submitAssetBatch(batchData: BatchAssetPayload[]) {
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
  if (error) throw new Error("批次提交失敗: " + error.message);
  return { success: true };
}

export async function submitInternalIssue(pkg: InternalIssuePayload) {
  const { error } = await supabase.from("assets").insert([{
    案件編號: `INT-${Date.now().toString().slice(-6)}`,
    裝機日期: pkg.installDate,
    院區: pkg.area,
    樓層: formatFloor(pkg.floor),
    使用單位: pkg.unit,
    姓名分機: pkg.ext,
    設備類型: pkg.type,
    品牌型號: pkg.model,
    產品序號: String(pkg.sn).toUpperCase(),
    主要mac: formatMAC(pkg.mac1),
    無線mac: formatMAC(pkg.mac2),
    設備名稱標記: pkg.name,
    核定ip: pkg.ip,
    狀態: "已結案",
    備註: pkg.remark,
    來源廠商: "系統管理端錄入"
  }]);

  if (error) throw new Error("內部配發物理入庫失敗: " + error.message);
  return { success: true };
}

export async function getNextSequence(prefix: string) {
  const response = await supabase
    .from("historical_assets")
    .select("設備名稱標記")
    .like("設備名稱標記", `${prefix}%`);

  const data = response.data as unknown as { 設備名稱標記: string }[] | null;

  let max = 0;
  data?.forEach((r) => {
    const seqStr = String(r.設備名稱標記 || "").replace(prefix, "");
    const seq = parseInt(seqStr, 10);
    if (!isNaN(seq) && seq > max) max = seq;
  });

  return String(max + 1).padStart(3, "0");
}
