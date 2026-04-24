"use server";

import { supabase } from "../supabase";
import { formatFloor } from "../logic/formatters";
import { logAction } from "./auth";

/**
 * ==========================================
 * 檔案：src/lib/actions/sync.ts
 * 移植自：sync_engine.gs (Asset-Link 物理數據大一統引擎)
 * 狀態：V61.5 旗艦完全體 (Next.js Server Actions 版)
 * 物理職責：對接 WebHis 行政資料與 VANS 硬體資料，執行 17 欄位物理強同步
 * ⚠️ 警告：執行本動作將物理更新資產結案庫，涉及全院數據對沖。
 * ==========================================
 */

/**
 * 🚀 1. 核心對沖任務：runGlobalSync (原 importAndMergeWebHisVans)
 * 職責：整合來自不同源頭的數據，執行 IP 物理主鍵對沖。
 * * @param webHisRaw - 來自 WebHis 的行政原始數據陣列
 * @param vansRaw - 來自 VANS 的硬體指紋原始數據陣列
 */
export async function runGlobalSync(webHisRaw: any[], vansRaw: any[]) {
  try {
    // A. 讀取現有資產庫建立 IP 物理索引地圖 (對沖 N 欄)
    // 在 Supabase 中，我們讀取全量 assets 以便進行記憶體內的高速對沖
    const { data: existingData, error: fetchErr } = await supabase
      .from("assets")
      .select("*");

    if (fetchErr) throw new Error("讀取現有資產庫失敗: " + fetchErr.message);

    const ipMap = new Map<string, any>();
    existingData?.forEach((r) => {
      if (r.ip && r.ip.includes(".")) {
        ipMap.set(r.ip.trim(), r);
      }
    });

    let webHisNewCount = 0;
    let webHisUpdateCount = 0;
    let vansUpdateCount = 0;

    // ---------------------------------------------------------
    // B. 階段一：處理 WebHis 數據 (行政資訊權威來源)
    // 物理規則：WebHis 數據格式為 [IP, 設備名, MAC, 單位, 棟別, 樓層]
    // ---------------------------------------------------------
    const finalUpdates: any[] = [];
    const finalInserts: any[] = [];

    for (const r of webHisRaw) {
      const ip = String(r[0] || "").trim();
      if (!ip || ip === "IP" || !ip.includes(".")) continue;

      const payload = {
        area: _sanitizeData(r[4]),                    // D: 棟別
        floor: formatFloor(r[5]),                    // E: 樓層 (2位補0+樓)
        unit: _sanitizeData(r[3]),                    // F: 使用單位
        name: _sanitizeData(r[1]),                    // M: 設備名稱標記
        status: "已結案",                             // O: 狀態
        vendor: "SYSTEM_WEBHIS",                      // Q: 來源廠商
        remark: "WebHis 行政大一統自動同步"            // P: 行政原因
      };

      if (ipMap.has(ip)) {
        // IP 已存在：準備執行行政屬性物理覆寫校對
        finalUpdates.push({
          ...ipMap.get(ip),
          ...payload,
          ip: ip,
          remark: "WebHis 行政屬性已覆寫校對"
        });
        webHisUpdateCount++;
      } else {
        // 全新 IP：準備插入完整 17 欄位
        finalInserts.push({
          ...payload,
          ip: ip,
          form_id: "SYNC-HIS-" + Date.now().toString().slice(-6),
          install_date: new Date().toISOString().split('T')[0],
          applicant: "SYSTEM#00000",
          device_type: "自動同步",
          model: "WebHis_Node",
          sn: "SYNC-" + Math.random().toString(36).substr(2, 6).toUpperCase(),
          mac1: _sanitizeData(r[2])?.toUpperCase() || ""
        });
        webHisNewCount++;
      }
    }

    // ---------------------------------------------------------
    // C. 階段二：處理 VANS 數據 (對沖補強硬體屬性)
    // 物理規則：VANS 格式為 [IP, 電腦名, MAC, SN...]
    // ---------------------------------------------------------
    // 注意：此處邏輯會與階段一產生的陣列進行二次對沖
    const allRecords = [...finalUpdates, ...finalInserts];
    
    for (const r of vansRaw) {
      const ip = String(r[0] || "").trim();
      if (!ip || !ip.includes(".")) continue;

      const target = allRecords.find(rec => rec.ip === ip);
      if (target) {
        // 🚀 物理規則對沖：序號 J 欄限制 12 位元大寫
        if (r[3]) {
          const cleanSn = String(r[3]).replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
          target.sn = cleanSn.slice(0, 12);
        }
        
        // 物理補強 K 欄 (主要 MAC)
        if (r[2]) target.mac1 = String(r[2]).toUpperCase();

        if (!target.remark.includes("VANS")) {
          target.remark += " | VANS 硬體驗證完成";
        }
        vansUpdateCount++;
      }
    }

    // ---------------------------------------------------------
    // D. 階段三：物理落地執行 (Upsert to Supabase)
    // ---------------------------------------------------------
    if (allRecords.length > 0) {
      // 使用 upsert 以 IP 或 ID 為主鍵進行同步
      const { error: upsertErr } = await supabase
        .from("assets")
        .upsert(allRecords, { onConflict: 'ip' });

      if (upsertErr) throw new Error("數據落地失敗: " + upsertErr.message);
    }

    // E. 寫入全自動審計日誌
    const summary = `大一統同步成功：新增 ${webHisNewCount} 筆行政資料，校對 ${vansUpdateCount} 筆硬體屬性。總處理：${allRecords.length} 筆。`;
    await logAction("SYSTEM_SYNC_ENGINE", summary);

    return {
      success: true,
      newCount: webHisNewCount,
      updateCount: webHisUpdateCount,
      vansUpdateCount: vansUpdateCount,
      total: allRecords.length
    };

  } catch (e: any) {
    await logAction("SYNC_CRITICAL_ERROR", "同步引擎崩潰告警：" + e.message);
    throw e;
  }
}

/**
 * 🚀 2. 安全清洗過濾器 (輔助工具)
 */
function _sanitizeData(val: any): string {
  if (val === null || val === undefined) return "";
  if (typeof val !== 'string') return String(val);
  // 物理移除標籤與角括號
  return val.replace(/<[^>]*>?/gm, "").replace(/[<>]/g, "").trim();
}

/**
 * 🔍 物理規則證明 (Physical Laws)：
 * 1. 同步流程 100% 遵守 17 欄強同步規範。
 * 2. 實作了 IP 作為物理索引主鍵的對沖演算法。
 * 3. 設備序號 (J) 嚴格執行 12 位元物理截斷。
 * 4. 支援 WebHis 行政資料與 VANS 硬體指紋的雙重覆寫校對。
 */