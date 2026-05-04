"use server";

import { supabase } from "../supabase";
import { unstable_noStore as noStore } from "next/cache";
import { systemLog } from "./assets";

export async function getDashboardStats() {
  noStore();
  try {
    const [hist, pending, nsr, vendors] = await Promise.all([
      supabase.from("historical_assets").select("產品序號", { count: "exact", head: true }),
      supabase.from("資產").select("產品序號", { count: "exact", head: true }).eq("狀態", "待核定"),
      supabase.from("nsr_records").select("申請單號", { count: "exact", head: true }).eq("處理狀態", "未處理"),
      supabase.from("vendors").select("廠商名稱", { count: "exact", head: true })
    ]);

    return {
      success: true,
      data: {
        totalHistory: hist.count || 0,
        pendingReview: pending.count || 0,
        pendingNsr: nsr.count || 0,
        totalVendors: vendors.count || 0
      }
    };
  } catch (err: any) { return { success: false, message: err.message }; }
}

export async function getHistoricalArchive(limit = 500) {
  noStore();
  const { data, error } = await supabase
    .from("historical_assets")
    .select("*")
    .order("建立時間", { ascending: false })
    .order("裝機日期", { ascending: false })
    .limit(limit);

  if (error) throw new Error("歷史庫讀取失敗: " + error.message);
  
  const typedData = data as unknown as Record<string, unknown>[];
  return typedData.map(r => ({
    sn: String(r.產品序號 || ""), 
    deviceName: String(r.設備名稱標記 || ""), // 🚀 補上設備名稱抓取
    date: String(r.裝機日期 || ""), 
    unit: String(r.使用單位 || ""),
    area: String(r.棟別 || ""), 
    floor: String(r.樓層 || ""), 
    model: String(r.品牌型號 || ""),
    deviceType: String(r.設備類型 || ""), 
    ip: String(r.核定ip || ""), 
    mac: String(r.主要mac || ""),
    status: String(r.狀態 || ""), 
    source: String(r.同步來源 || ""), 
    remark: String(r.行政備註 || ""), 
    created_at: String(r.建立時間 || "")
  }));
}

export async function getVendorsAdmin() {
  noStore();
  const { data, error } = await supabase.from("vendors").select("廠商名稱, 行政狀態, 授權啟用開關, 建立時間").order("建立時間", { ascending: true });
  if (error) throw new Error("廠商清單讀取失敗: " + error.message);
  const typedData = data as unknown as { 廠商名稱: string; 行政狀態: string; 授權啟用開關: boolean; 建立時間: string }[];
  return typedData.map(v => ({ name: v.廠商名稱, status: v.行政狀態, isActive: v.授權啟用開關, createdAt: v.建立時間 }));
}

export async function addVendorAdmin(vendorName: string) {
  const cleanName = vendorName.trim();
  if (!cleanName) throw new Error("廠商名稱不可為空");
  const { error } = await supabase.from("vendors").insert([{ "廠商名稱": cleanName, "行政狀態": "正常", "授權啟用開關": true, "密碼": "123456" }]);
  if (error) {
    if (error.code === '23505') throw new Error("該廠商名稱已存在於系統中");
    throw new Error("新增廠商失敗: " + error.message);
  }
  await systemLog("管理員(Admin)", `新增合作廠商帳號: ${cleanName}`);
  return { success: true };
}

export async function toggleVendorStatusAdmin(vendorName: string, currentStatus: string) {
  const newStatus = currentStatus === '正常' ? '停用' : '正常';
  const newActive = newStatus === '正常';
  const { error } = await supabase.from("vendors").update({ "行政狀態": newStatus, "授權啟用開關": newActive }).eq("廠商名稱", vendorName);
  if (error) throw new Error("狀態切換失敗: " + error.message);
  await systemLog("管理員(Admin)", `變更廠商狀態: ${vendorName} (${newStatus})`);
  return { success: true };
}

export async function resetVendorPasswordAdmin(vendorName: string) {
  const { error } = await supabase.from("vendors").update({ "密碼": "123456" }).eq("廠商名稱", vendorName);
  if (error) throw new Error("密碼重置失敗: " + error.message);
  await systemLog("管理員(Admin)", `強制重置廠商密碼: ${vendorName} (恢復為預設)`);
  return { success: true };
}

export async function uploadVansIps(ips: string[]) {
  const chunkSize = 1000;
  for (let i = 0; i < ips.length; i += chunkSize) {
    const chunk = ips.slice(i, i + chunkSize).map(ip => ({ ip_address: ip }));
    const { error } = await supabase.from('vans_active_ips').upsert(chunk, { onConflict: 'ip_address' });
    if (error) throw new Error("VANS IP 上傳失敗: " + error.message);
  }
  return { success: true };
}

export async function executeVansCleansing() {
  const { error } = await supabase.rpc('run_vans_cleansing');
  if (error) throw new Error("清洗引擎執行失敗: " + error.message);
  await systemLog("管理員(Admin)", "執行 VANS 報表比對與歷史庫智慧清洗作業");
  return { success: true };
}