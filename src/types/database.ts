/**
 * ==========================================
 * 檔案：src/types/database.ts
 * 狀態：V0.0 旗艦不刪減完全體
 * 職責：全系統數據結構強型別鎖定 (ERI 17欄 / NSR 16欄)
 * ==========================================
 */

// 17 欄 ERI 資產規格 (A-Q)
export interface AssetEntry {
  created_at?: string;    // A: 時間戳記
  form_id: string;        // B: 派工單號
  install_date: string;   // C: 裝機日期
  area: string;           // D: 棟別
  floor: string;          // E: 樓層 (00樓格式)
  unit: string;           // F: 使用單位
  applicant: string;      // G: 姓名#分機
  device_type: string;    // H: 設備類型
  model: string;          // I: 品牌型號
  sn: string;             // J: 產品序號
  mac1: string;           // K: 主要 MAC
  mac2: string;           // L: 無線 MAC
  name: string;           // M: 設備名稱標記 (自動演算)
  remark?: string;        // 物理追加：備註與標記 (存放 VANS/舊換新標籤)
  ip: string;             // N: 核定 IP
  status: string;         // O: 狀態 (待核定/已結案/已封存)
  reject_reason: string;  // P: 行政/退回原因
  vendor: string;         // Q: 來源廠商
}

// 16 欄 NSR 網點規格 (A-P)
export interface NsrEntry {
  form_id: string;        // A: 申請單號
  request_date: string;   // B: 申請日
  area: string;           // C: 棟別
  floor: string;          // D: 樓層
  dept_code: string;      // E: 部門代號
  unit: string;           // F: 申請單位
  applicant: string;      // G: 申請人#分機
  phone: string;          // H: 連絡電話
  qty: number;            // I: 需求數量
  cable_type: string;     // J: 線材規格
  reason: string;         // K: 事由
  total_price: number;    // L: 總價
  status: string;         // M: 狀態
  finish_date?: string;   // N: 完工日期
  finish_remark?: string; // O: 完工備註
  source: string;         // P: 數據來源
}