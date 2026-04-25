/**
 * ==========================================
 * 檔案：src/types/database.ts
 * 狀態：V4.1 旗艦完全體 (對齊 SQL 實體列資料)
 * 物理職責：
 * 1. 鎖定 Supabase 五大資料表之繁體中文欄位名稱。
 * 2. 確保 ERI (19欄)、歷史大數據 (18欄)、NSR (17欄) 等物理軌道數據不失真。
 * 3. 供 Server Actions 執行中英對映 (Mapping) 時的強型別參照標準。
 * ==========================================
 */

/**
 * 🚀 1. ERI 待辦資產表 (Table: assets)
 * 對應 assets_rows.sql。
 * 包含行政退回原因與備註雙軌道，用於處理新申請與退回件。
 */
export interface AssetEntry {
  /** 系統物理主鍵 */
  id?: string;
  /** A 欄：數據建立時間戳記 */
  建立時間?: string | Date;
  /** B 欄：案件編號 (如 VDS-260425-001) */
  案件編號: string;
  /** C 欄：裝機日期 */
  裝機日期: string;
  /** D 欄：院區棟別 */
  院區: string;
  /** E 欄：樓層區域 (規範：00樓格式) */
  樓層: string;
  /** F 欄：使用單位全銜 */
  使用單位: string;
  /** G 欄：姓名#分機協議 */
  姓名分機: string;
  /** H 欄：設備類型 (電腦/印表機...) */
  設備類型: string | null;
  /** I 欄：品牌型號 */
  品牌型號: string;
  /** J 欄：產品序號 (物理鎖定：12位元大寫) */
  產品序號: string;
  /** K 欄：主要有線 MAC */
  主要mac: string;
  /** L 欄：無線網路 MAC */
  無線mac: string | null;
  /** M 欄：系統演算標記名稱 (如 A05-15888-001) */
  設備名稱標記: string | null;
  /** N 欄：資訊室核定 IP (10.x.x.x) */
  核定ip: string | null;
  /** O 欄：流程狀態 (待核定/退回修正) */
  狀態: string;
  /** P 欄：管理者填寫之退回說明 */
  行政退回原因: string | null;
  /** Q 欄：來源廠商名稱 (對沖廠商清單) */
  來源廠商: string;
  /** 備註：存放 [REPLACE] 標籤或 VANS 稽核軌道 */
  備註: string | null;
}

/**
 * 🚀 2. 歷史結案大數據表 (Table: historical_assets)
 * 對應 historical_assets_rows.sql。
 * 針對數萬筆匯入資料優化，包含數據匯入時間與同步來源標記。
 */
export interface HistoricalAssetEntry {
  /** 系統物理主鍵 */
  id?: string;
  /** A 欄：歷史數據匯入時間 */
  數據匯入時間?: string | Date;
  /** B 欄：結案單號 (SYNC/VDS) */
  結案單號: string;
  /** C 欄：裝機日期 */
  裝機日期: string | null;
  /** D 欄：院區 */
  院區: string | null;
  /** E 欄：樓層 */
  樓層: string | null;
  /** F 欄：使用單位 */
  使用單位: string | null;
  /** G 欄：姓名分機 */
  姓名分機: string | null;
  /** H 欄：設備類型 */
  設備類型: string | null;
  /** I 欄：品牌型號 */
  品牌型號: string | null;
  /** J 欄：產品序號 (12位元唯一碼) */
  產品序號: string | null;
  /** K 欄：主要 MAC 地址 */
  主要mac: string | null;
  /** L 欄：無線 MAC 地址 */
  無線mac: string | null;
  /** M 欄：設備名稱標記 (A05-15888-001) */
  設備名稱標記: string | null;
  /** N 欄：核定 IP 位址 */
  核定ip: string | null;
  /** O 欄：狀態 (固定為：已結案) */
  狀態: string;
  /** P 欄：行政備註 (含 VANS 同步標籤) */
  行政備註: string | null;
  /** Q 欄：同步來源 (WebHis/VANS) */
  同步來源: string | null;
}

/**
 * 🚀 3. NSR 網點需求紀錄表 (Table: nsr_records)
 * 對應 nsr_records_rows.sql。
 * 包含 115 年度合約計價所需的所有 17 欄物理軌道。
 */
export interface NsrEntry {
  /** 系統物理主鍵 */
  id?: string;
  /** A 欄：申請單號 (C01-...) */
  申請單號: string;
  /** B 欄：申請日期 */
  申請日期: string;
  /** C 欄：棟別 */
  棟別: string;
  /** D 欄：樓層 */
  樓層: string;
  /** E 欄：部門代號 (4位碼) */
  部門代號: string | null;
  /** F 欄：申請單位 */
  申請單位: string;
  /** G 欄：申請人名稱 */
  申請人: string;
  /** H 欄：連絡電話/分機 */
  連絡電話: string | null;
  /** I 欄：需求數量 (計價點位) */
  需求數量: number;
  /** J 欄：線材規格 (CAT 6/6A) */
  線材規格: string;
  /** K 欄：施工詳細事由 */
  施工事由: string | null;
  /** L 欄：115合約核銷總額 */
  行政核銷總額: number | null;
  /** M 欄：處理狀態 (未處理/已結案) */
  處理狀態: string;
  /** N 欄：完工日期 */
  完工日期: string | null;
  /** O 欄：完工備註 */
  完工備註: string | null;
  /** P 欄：數據來源標記 (系統/手動) */
  數據來源標記: string | null;
}

/**
 * 🚀 4. 授權廠商名錄表 (Table: vendors)
 * 對應 vendors_rows.sql。
 * 驅動首頁白名單與後台權限控管。
 */
export interface VendorEntry {
  /** 系統物理主鍵 */
  id?: string;
  /** 數據建立時間 */
  建立時間?: string | Date;
  /** 廠商全名 (物理主鍵) */
  廠商名稱: string;
  /** 聯絡窗口姓名 */
  聯絡窗口: string | null;
  /** 行政狀態 (啟用/停用) */
  行政狀態: string;
  /** 合約備註 */
  合約備註: string | null;
  /** 物理授權開關 */
  授權啟用開關: boolean;
}

/**
 * 🚀 5. 系統審計日誌表 (Table: system_logs)
 * 負責記錄管理員與系統自動對沖的物理軌跡。
 */
export interface LogEntry {
  /** 系統物理主鍵 */
  id?: string;
  /** A 欄：事件發生時間 */
  事件時間: string | Date;
  /** B 欄：操作人身分或系統程序 */
  操作人身分: string;
  /** C 欄：執行動作詳細描述 */
  執行動作描述: string;
  /** D 欄：系統版本資訊 (V0.0) */
  系統版本: string;
}