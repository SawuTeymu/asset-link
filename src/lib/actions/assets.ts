"use server";

import { supabase } from "@/lib/supabase";

/**
 * ==========================================
 * 檔案：src/lib/actions/assets.ts
 * 狀態：V300.65 完整功能穩定版
 * 職責：
 * 1. 行政核發 (approveAsset)：配發 IP 與設備標記。
 * 2. 行政退回 (rejectAsset)：記錄原因並發還修正。
 * 3. 衝突檢查 (checkIpConflict)：防止 IP 重複配發。
 * 4. 系統日誌 (logAction)：記錄管理員操作軌跡。
 * 5. 強制同步：0 簡化、0 刪除，含完整錯誤捕捉。
 * ==========================================
 */

/**
 * 內部函式：記錄管理員操作日誌
 * 確保所有行政動作皆有跡可循
 */
async function logAction(operator: string, action: string) {
  try {
    const { error } = await supabase
      .from("admin_logs")
      .insert([
        {
          operator: operator,
          action: action,
          timestamp: new Date().toISOString(),
        }
      ]);
    if (error) console.error("【日誌寫入失敗】", error.message);
  } catch (err) {
    console.error("【日誌系統異常】", err);
  }
}

/**
 * 行政核發資產：配發 IP 地址並標記設備名稱
 */
export async function approveAsset(sn: string, ip: string, deviceName: string, type: string) {
  const cleanSn = sn.trim();
  const cleanIp = ip.trim();
  const cleanDeviceName = deviceName.trim().toUpperCase();

  console.log("【Server Action】開始執行核發程序 - 序號:", cleanSn);

  try {
    // 執行資料庫更新，並使用 .select() 要求回傳更新後的結果
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

    // 1. 檢查是否發生資料庫語法或權限錯誤
    if (error) {
      console.error("【Supabase API 錯誤】", error);
      throw new Error(`資料庫更新失敗: ${error.message}`);
    }

    // 2. 檢查是否有任何資料列被改動 (防止 SN 匹配失敗)
    if (!data || data.length === 0) {
      console.warn("【更新無效】找不到匹配的產品序號:", cleanSn);
      throw new Error("找不到對應的產品序號，請確認資料庫中是否存在該序號。");
    }

    // 3. 記錄操作日誌
    await logAction("SYSTEM_ADMIN", `核發 IP: ${cleanIp} 給設備 ${cleanDeviceName} (SN: ${cleanSn})`);

    console.log("【核發成功】資料列已更新。");
    return { success: true };
  } catch (err: any) {
    console.error("【核發程序潰散】", err.message);
    throw err; // 將錯誤拋回前端 Pending 頁面顯示
  }
}

/**
 * 行政退回案件：填寫退回原因，並要求廠商重填
 */
export async function rejectAsset(sn: string, reason: string) {
  const cleanSn = sn.trim();
  const cleanReason = reason.trim();

  console.log("【Server Action】開始執行退回程序 - 序號:", cleanSn);

  try {
    // 執行資料庫更新
    const { data, error } = await supabase
      .from("資產")
      .update({
        "行政退回原因": cleanReason,
        "狀態": "已退回(待修正)"
      })
      .eq("產品序號", cleanSn)
      .select();

    // 1. 檢查資料庫錯誤
    if (error) {
      console.error("【Supabase API 錯誤 - 退回】", error);
      throw new Error(`退回動作失敗: ${error.message}`);
    }

    // 2. 檢查資料列匹配
    if (!data || data.length === 0) {
      console.warn("【退回無效】找不到匹配的產品序號:", cleanSn);
      throw new Error("找不到對應的產品序號，無法更新退回狀態。");
    }

    // 3. 記錄日誌
    await logAction("SYSTEM_ADMIN", `退回案件 SN: ${cleanSn}，原因: ${cleanReason}`);

    console.log("【退回成功】狀態已改為：已退回(待修正)");
    return { success: true };
  } catch (err: any) {
    console.error("【退回程序潰散】", err.message);
    throw err;
  }
}

/**
 * 檢查 IP 地址是否已在資料庫中被佔用
 */
export async function checkIpConflict(ip: string) {
  const cleanIp = ip.trim();
  if (!cleanIp) return false;
  
  try {
    // 查詢「資產」表中「核定ip」欄位是否已有重複值
    const { count, error } = await supabase
      .from("資產")
      .select("*", { count: "exact", head: true })
      .eq("核定ip", cleanIp);

    if (error) {
      console.error("【IP 衝突檢查失敗】", error.message);
      return false;
    }

    // 若筆數大於 0 則代表衝突
    return (count || 0) > 0;
  } catch (err) {
    console.error("【IP 檢查程序異常】", err);
    return false;
  }
}