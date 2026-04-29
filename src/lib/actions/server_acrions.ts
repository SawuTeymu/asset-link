import { supabase } from "@/lib/supabase";

/**
 * ==========================================
 * 檔案：src/lib/actions/server_actions.ts
 * 狀態：V300.2 物理對正版 (全系統鏈路同步)
 * 物理職責：
 * 1. 對正實體：將所有調用修正為 assets 與 historical_assets。
 * 2. 欄位對齊：100% 使用「棟別」、「單位全稱」、「姓名分機」等中文化欄位。
 * 3. 邏輯保全：保留 IP 防撞、自動遷移與計價狀態更新。
 * ==========================================
 */

// --- 1. Assets 核心：行政核定與快速結案 ---

export const checkIpConflict = async (ip: string) => {
  const { data: archive } = await supabase.from("historical_assets").select("*").eq("核定ip", ip).maybeSingle();
  if (archive) return true;
  const { data: active } = await supabase.from("assets").select("*").eq("核定ip", ip).maybeSingle();
  return !!active;
};

export const submitInternalIssue = async (payload: any) => {
  const { error } = await supabase.from("historical_assets").insert([{
    "核定ip": payload.ip,
    "主要mac": payload.mac1,
    "產品序號": payload.sn,
    "設備名稱標記": payload.deviceName,
    "設備類型": payload.deviceType,
    "品牌型號": payload.model,
    "棟別": payload.area,
    "樓層": payload.floor,
    "使用單位": payload.unit,
    "姓名分機": payload.applicant,
    "同步來源": "內部直通",
    "行政備註": payload.remark,
    "狀態": "已結案"
  }]);
  if (error) throw error;
  return true;
};

export const approveAsset = async (sn: string, ip: string, mac: string, productSn: string) => {
  const { data: source } = await supabase.from("assets").select("*").eq("產品序號", sn).single();
  if (!source) throw new Error("案件物理消失");

  const { error: archiveError } = await supabase.from("historical_assets").insert([{
    "核定ip": ip,
    "主要mac": mac,
    "產品序號": productSn,
    "設備類型": source.設備類型,
    "品牌型號": source.品牌型號,
    "棟別": source.棟別,
    "樓層": source.樓層,
    "使用單位": source.使用單位,
    "姓名分機": source.姓名分機,
    "同步來源": "廠商預約",
    "行政備註": "行政核定結案",
    "狀態": "已結案"
  }]);
  if (archiveError) throw archiveError;
  await supabase.from("assets").delete().eq("產品序號", sn);
  return true;
};

export const rejectAsset = async (sn: string, reason: string) => {
  const { error } = await supabase.from("assets").delete().eq("產品序號", sn);
  if (error) throw error;
  return true;
};

// --- 2. NSR 核心：網點財務對沖 ---

export const getNsrList = async () => {
  const { data, error } = await supabase.from("nsr_records").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
};

export const submitNsrData = async (formData: any) => {
  const { error } = await supabase.from("nsr_records").insert([{
    "id": formData.form_id,
    "申請日期": formData.request_date,
    "棟別": formData.area,
    "樓層": formData.floor,
    "部門代號": formData.dept_code,
    "申請單位": formData.unit,
    "申請人": formData.applicant,
    "連絡電話": formData.phone,
    "需求數量": formData.qty,
    "線材規格": formData.cable_type,
    "施工事由": formData.reason,
    "處理狀態": "未處理"
  }]);
  if (error) throw error;
  return true;
};

export const updateNsrStatus = async (id: string, status: string) => {
  const { error } = await supabase.from("nsr_records").update({ "處理狀態": status }).eq("id", id);
  if (error) throw error;
  return true;
};

export const settleNsrRecord = async (params: any) => {
  const { error } = await supabase.from("nsr_records").update({
    "處理狀態": "待請款",
    "結算備註": params.finishRemark
  }).eq("id", params.form_id);
  if (error) throw error;
  return true;
};

export const deleteNsrRecord = async (id: string) => {
  const { error } = await supabase.from("nsr_records").delete().eq("id", id);
  if (error) throw error;
  return true;
};

// --- 3. Stats 核心：儀表板數據對沖 ---

export const getDashboardStats = async () => {
  const { count: pending } = await supabase.from("assets").select("*", { count: 'exact', head: true });
  const { count: done } = await supabase.from("historical_assets").select("*", { count: 'exact', head: true });
  return { pending: pending || 0, done: done || 0 };
};

export const getIpUsageStats = async () => {
  const { data } = await supabase.from("historical_assets").select("*");
  const segments = ["10.128", "10.130", "10.142", "192.168"];
  return segments.map(s => {
    const count = data?.filter((d: any) => String(d.核定ip).startsWith(s)).length || 0;
    return { segment: s, count, percent: Math.min(Math.floor((count / 254) * 100), 100) };
  });
};

export const getHistoryRecords = async () => {
  const { data } = await supabase.from("historical_assets").select("*").order("created_at", { ascending: false }).limit(50);
  return data || [];
};

export const getVansMetrics = async () => {
  const { data } = await supabase.from("vans_audit_logs").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
  return { macErrorCount: data?.mac_errors || 0, ipConflictCount: data?.ip_conflicts || 0, zombieAlertCount: data?.zombies || 0, lastAuditAt: data?.created_at };
};

// --- 4. Users 核心 ---

export const getAllUsers = async () => {
  const { data } = await supabase.from("vendors").select("*");
  return data?.map(v => ({ id: v.id, username: v.廠商名稱, status: v.行政狀態 === '正常' })) || [];
};