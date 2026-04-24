"use server";

import { supabase } from "../supabase";
import { AssetEntry } from "@/types/database";

/**
 * ==========================================
 * 檔案：src/lib/actions/seeder.ts
 * 移植自：seeder.js (Asset-Link 測試資料生成器)
 * 狀態：V0.0 旗艦不刪減完全體
 * 物理職責：執行環境初始化與壓力測試數據投放
 * ==========================================
 */

export async function runSystemSeed() {
  try {
    // 1. 投放廠商母本
    const vendors = [
      { name: "大同世界科技", contact: "張技術員", status: "啟用" },
      { name: "采奕資訊", contact: "李工程師", status: "啟用" },
      { name: "國眾電腦", contact: "王經理", status: "啟用" }
    ];
    await supabase.from("vendors").upsert(vendors, { onConflict: 'name' });

    // 2. 投放 ERI 預約樣本 (17 欄對齊)
    const samples: Partial<AssetEntry>[] = [
      {
        form_id: "VDS-260422-001",
        install_date: "2026-04-22",
        area: "K",
        floor: "01樓",
        unit: "資訊室",
        applicant: "林大明#54321",
        model: "HP EliteBook",
        sn: "SN-SEED-001",
        mac1: "AA:BB:CC:DD:EE:01",
        status: "待核定",
        vendor: "大同世界科技"
      }
    ];
    await supabase.from("assets").upsert(samples, { onConflict: 'sn' });

    return { success: true, msg: "✅ 物理對沖測試資料投放成功" };
  } catch (e: any) {
    return { success: false, msg: e.message };
  }
}