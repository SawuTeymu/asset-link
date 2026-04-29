import { supabase } from "@/lib/supabase";

/**
 * ==========================================
 * 檔案：src/lib/actions/server_actions.ts
 * 狀態：V300.1 後端引擎 (型別 Parser 修復版)
 * 物理職責：
 * 1. 整合 Assets, NSR, Stats, Users 四大核心 Actions
 * 2. 修復 TS2339: 繞過 Supabase 對中文字段的 ParserError
 * ==========================================
 */

// ==========================================
// 1. Assets 核心：ERI 簽核與 IP 防撞
// ==========================================

/**
 * 檢查 IP 是否已被佔用
 * @param ip 欲檢查的 IP
 * @param includePending 是否包含待核定池
 */
export const checkIpConflict = async (ip: string, includePending = false) => {
  //  修復 TS2339 ParserError: 改用 select("*") 繞過中文欄位解析錯誤
  const { data: archive } = await supabase
    .from("assets_archive")
    .select("*")
    .eq("核定ip", ip)
    .maybeSingle();
  
  if (archive) return true;

  if (includePending) {
    const { data: pending } = await supabase
      .from("assets_pending")
      .select("*")
      .eq("核定ip", ip)
      .maybeSingle();
    return !!pending;
  }
  return false;
};

/**
 * 內部直通建檔 (免審核直接歸檔)
 */
export const submitInternalIssue = async (payload: any) => {
  const { error } = await supabase.from("assets_archive").insert([{
    "核定ip": payload.ip,
    "主要mac": payload.mac1,
    "產品序號": payload.sn,
    "設備名稱標記": payload.deviceName,
    "設備類型": payload.deviceType,
    "品牌型號": payload.model,
    "院區": payload.area,
    "樓層": payload.floor,
    "使用單位": payload.unit,
    "填報人": payload.applicant,
    "同步來源": "內部直通",
    "行政備註": payload.remark
  }]);
  if (error) throw error;
  return true;
};

/**
 * ERI 行政核定 (物理搬移：Pending -> Archive)
 * @param id 申請單 UUID
 * @param ip 核定 IP
 * @param mac 主要 MAC
 * @param sn 產品序號
 */
export const approveAsset = async (id: string, ip: string, mac: string, sn: string) => {
  // 1. 取得 Pending 資料備份
  const { data: source } = await supabase
    .from("assets_pending")
    .select("*")
    .eq("id", id)
    .single();

  if (!source) throw new Error("案件物理消失，無法核定");

  // 2. 注入正式歸檔庫
  const { error: archiveError } = await supabase.from("assets_archive").insert([{
    "核定ip": ip,
    "主要mac": mac,
    "產品序號": sn,
    "設備類型": source.設備類型,
    "品牌型號": source.品牌型號,
    "院區": source.棟別,
    "樓層": source.樓層,
    "使用單位": source.使用單位,
    "填報人": source.填報人,
    "同步來源": "廠商預約",
    "行政備註": `ERI核定結案於 ${new Date().toLocaleString()}`
  }]);

  if (archiveError) throw archiveError;

  // 3. 從緩衝池物理刪除
  await supabase.from("assets_pending").delete().eq("id", id);
  return true;
};

/**
 * ERI 退回案件
 */
export const rejectAsset = async (id: string, reason: string) => {
  const { error } = await supabase.from("assets_pending").delete().eq("id", id);
  if (error) throw error;
  return true;
};

// ==========================================
// 2. NSR 核心：115年度網點計價對沖
// ==========================================

export const getNsrList = async () => {
  const { data, error } = await supabase
    .from("nsr_records")
    .select("*")
    .order("created_at", { ascending: false });
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
  const { error } = await supabase
    .from("nsr_records")
    .update({ "處理狀態": status })
    .eq("id", id);
  if (error) throw error;
  return true;
};

export const settleNsrRecord = async (params: { form_id: string, isAddon: boolean, usePanel: boolean, finishRemark: string }) => {
  const { error } = await supabase
    .from("nsr_records")
    .update({
      "處理狀態": "已完工",
      "結算備註": params.finishRemark
    })
    .eq("id", params.form_id);
  if (error) throw error;
  return true;
};

export const deleteNsrRecord = async (id: string) => {
  const { error } = await supabase.from("nsr_records").delete().eq("id", id);
  if (error) throw error;
  return true;
};

// ==========================================
// 3. Stats 核心：儀表板大數據分析
// ==========================================

export const getDashboardStats = async () => {
  const { count: pending } = await supabase.from("assets_pending").select("*", { count: 'exact', head: true });
  const { count: done } = await supabase.from("assets_archive").select("*", { count: 'exact', head: true });
  return { pending: pending || 0, done: done || 0 };
};

export const getIpUsageStats = async () => {
  //  修復 TS2339 ParserError: 改用 select("*")
  const { data } = await supabase.from("assets_archive").select("*");
  const segments = ["10.128", "10.130", "10.142", "192.168"];
  const stats = segments.map(s => {
    //  加上 (d: any) 型別斷言，確保 TypeScript 不再干涉動態中文鍵值
    const count = data?.filter((d: any) => String(d.核定ip).startsWith(s)).length || 0;
    return { segment: s, count, percent: Math.min(Math.floor((count / 254) * 100), 100) };
  });
  return stats;
};

export const getHistoryRecords = async () => {
  const { data } = await supabase
    .from("assets_archive")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  return data || [];
};

export const getVansMetrics = async () => {
  const { data } = await supabase
    .from("vans_audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  
  return {
    macErrorCount: data?.mac_errors || 0,
    ipConflictCount: data?.ip_conflicts || 0,
    zombieAlertCount: data?.zombies || 0,
    lastAuditAt: data?.created_at
  };
};

// ==========================================
// 4. Users 核心：權限管理
// ==========================================

export const getAllUsers = async () => {
  const { data } = await supabase.from("vendors").select("*");
  return data?.map(v => ({
    id: v.id,
    username: v.廠商名稱,
    status: v.行政狀態 === '正常'
  })) || [];
};