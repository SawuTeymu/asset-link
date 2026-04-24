/**
 * ==========================================
 * 檔案：src/types/database.ts
 * 狀態：V0.0 旗艦不刪減完全體
 * 職責：全系統數據結構強型別鎖定 (ERI 17欄 / NSR 16欄)
 * ==========================================
 */

/**
 * 🚀 1. ERI 設備預約 / 歷史結案規格 (對齊 17 欄物理軌道 A-Q)
 * 用途：負責廠商填報、資訊室核定與歷史庫對沖
 */
export interface AssetEntry {
  created_at?: string;    // A: 時間戳記 (timestamp)
  form_id: string;        // B: 表單號 (VDS-XXXXXX-XXX)
  install_date: string;   // C: 裝機日期 (YYYY-MM-DD)
  area: string;           // D: 棟別 (A-T / OTHER)
  floor: string;          // E: 樓層 (00樓 格式)
  unit: string;           // F: 使用單位 (全銜)
  applicant: string;      // G: 姓名#分機 (行政窄化規範)
  device_type: string;    // H: 設備類型 (桌機/筆電/印表機...)
  model: string;          // I: 品牌型號
  sn: string;             // J: 產品序號 (12位大寫碼)
  mac1: string;           // K: 主要 MAC (XX:XX:XX:XX:XX:XX)
  mac2: string;           // L: 無線 MAC (XX:XX:XX:XX:XX:XX)
  name: string;           // M: 設備名稱標記 (棟別樓層-分機-流水號)
  ip: string;             // N: 核定 IP (10.x.x.x)
  status: string;         // O: 狀態 (待核定/已結案/退回修正/已封存)
  reject_reason: string;  // P: 行政/退回原因
  vendor: string;         // Q: 來源廠商
}

/**
 * 🚀 2. NSR 網點需求規格 (對齊 16 欄物理軌道 A-P)
 * 用途：115 年度維護合約之施工申請與階梯計價對沖
 */
export interface NsrEntry {
  form_id: string;        // A: 申請單號 (C01-YYYYMMDD-XXX)
  request_date: string;   // B: 申請日期
  area: string;           // C: 棟別
  floor: string;          // D: 樓層
  dept_code: string;      // E: 部門代號 (4位碼)
  unit: string;           // F: 申請單位
  applicant: string;      // G: 申請人#分機
  phone: string;          // H: 連絡電話
  qty: number;            // I: 需求點位數量 (1, 2, 5...)
  cable_type: string;     // J: 線材規格 (CAT 6 / CAT 6A)
  reason: string;         // K: 施工事由
  total_price: number;    // L: 行政核銷總價 (115 合約自動結算)
  status: string;         // M: 狀態 (未處理/待核定/已結案/退回)
  finish_date?: string;   // N: 完工日期
  finish_remark?: string; // O: 完工/行政備註
  source: string;         // P: 數據來源標記
}

/**
 * 🚀 3. 廠商授權名錄規格 (對齊 SHEET_VENDOR)
 */
export interface VendorEntry {
  id?: string;
  name: string;           // 廠商全稱
  contact: string;        // 物理窗口
  status: '啟用' | '停用'; // 存取權限狀態
  remark: string;         // 合約編號或備註
}

/**
 * 🚀 4. 全自動系統審計日誌規格 (對齊 SHEET_SYSTEM_LOG)
 */
export interface SystemLog {
  timestamp: string;      // 物理時間
  identity: string;       // 操作身分 (Email / User ID)
  action: string;         // 執行動作描述
  version: string;        // 系統版本標記
}

/**
 * 🚀 5. 通用回應介面 (API Response)
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  msg?: string;
}