"use server";

import { supabase } from "../supabase";
import { logAction } from "./auth";
import { revalidatePath } from "next/cache";

/**
 * ==========================================
 * 檔案：src/lib/actions/seeder.ts
 * 狀態：V0.4 旗艦完全體 (全繁體中文欄位適配版)
 * 物理職責：
 * 1. 投放符合全繁體中文欄位規範的測試種子資料。
 * 2. 活化 Admin 面板，確保統計圖表與資安指標 (03/13/38) 具備對沖樣本。
 * 3. 確保資料庫在初次建置後具備基礎廠商授權白名單。
 * ==========================================
 */

export async function runSystemSeed() {
  try {
    // --- 階段 1：投放授權廠商母本 (Table: vendors) ---
    // 物理職責：確保首頁登入選單有預設廠商可選
    await supabase.from("vendors").upsert([
      { 
        廠商名稱: "大同世界科技", 
        聯絡窗口: "張技術員", 
        行政狀態: "啟用", 
        合約備註: "115年度維護合約",
        授權啟用開關: true 
      },
      { 
        廠商名稱: "采奕資訊", 
        聯絡窗口: "李工程師", 
        行政狀態: "啟用", 
        合約備註: "資安維護專案",
        授權啟用開關: true 
      }
    ], { onConflict: '廠商名稱' });

    // --- 階段 2：投放 ERI 待核定樣本 (Table: assets) ---
    // 物理職責：校準 assets 表中文標頭，並產生 Dashboard 待辦筆數
    await supabase.from("assets").upsert([
      {
        案件編號: "VDS-260425-001",
        裝機日期: "2026-04-25",
        院區: "A",
        樓層: "05樓",
        使用單位: "資訊室測試站",
        姓名分機: "管理員#5888",
        產品序號: "SN-SEED-001",
        主要mac: "AA:BB:CC:DD:EE:01",
        狀態: "待核定",
        來源廠商: "大同世界科技",
        備註: "系統初始化測試"
      },
      {
        案件編號: "VDS-260425-002",
        裝機日期: "2026-04-25",
        院區: "K",
        樓層: "01樓",
        使用單位: "護理部",
        姓名分機: "陳護理長#12345",
        產品序號: "SN-SEED-REPLACE",
        主要mac: "AA:BB:CC:DD:EE:02",
        狀態: "待核定",
        來源廠商: "采奕資訊",
        備註: "[REPLACE] 舊機汰換對沖測試"
      }
    ], { onConflict: '產品序號' });

    // --- 階段 3：投放 NSR 網點樣本 (Table: nsr_records) ---
    // 物理職責：校準 nsr_records 表中文標頭，供 115 合約計價模組測試
    await supabase.from("nsr_records").upsert([
      {
        申請單號: "C01-20260425-001",
        申請日期: "2026-04-25",
        棟別: "A",
        樓層: "03樓",
        申請單位: "病歷課",
        申請人: "張組長#5566",
        需求數量: 2,
        線材規格: "CAT 6A",
        處理狀態: "未處理",
        數據來源標記: "系統自動初始化"
      }
    ], { onConflict: '申請單號' });

    // --- 階段 4：寫入系統審計日誌 (Table: system_logs) ---
    await logAction("SYSTEM_ADMIN", "執行全繁體中文欄位種子數據投放成功");
    
    // 強制 Next.js 重新對沖路由快取
    revalidatePath('/admin');
    
    return { 
      success: true, 
      message: " 全系統繁體中文數據活化完成，儀表板已同步更新。" 
    };

  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Seeder 物理執行失敗:", errorMsg);
    return { 
      success: false, 
      message: "❌ 投放失敗，請檢查資料庫欄位名稱是否正確：" + errorMsg 
    };
  }
}

/**
 * 🔍 物理功能核對：
 * 1. 廠商名稱、案件編號、申請單號等 Key 值完全符合您的 SQL 實體列標題。
 * 2. 保留了 Upsert 邏輯，重複執行不會產生重複數據。
 * 3. 完整移植了 [REPLACE] 標籤，確保資安衝突邏輯可被驗證。
 * 4. 0 簡化：包含錯誤攔截、日誌記錄與快取重新驗證機制。
 */