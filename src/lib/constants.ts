/**
 * ==========================================
 * 檔案：src/lib/constants.ts
 * 移植自：config.js (Asset-Link 全域配置)
 * 狀態：V0.0 旗艦不刪減完全體 (115年度合約對沖版)
 * 職責：集中管理行政白名單、115合約費率、外部系統物理 ID
 * ==========================================
 */

export const SYSTEM_VERSION = "Asset-Link V0.0 (Flagship Production)";
export const SYSTEM_SECRET = "ERI_ASSET_LINK_2026_V0";

// 📧 SSO 管理員授權白名單
export const AUTHORIZED_ADMIN_EMAILS = [
  "jackysawu0212@gmail.com",
  "020807@tool.caaumed.org.tw",
  "admin@cmuh.org.tw"
];

// 🔄 數據大一統引擎：外部系統物理 ID (對沖目標)
export const EXTERNAL_IDS = {
  WEBHIS: "1fZzc_frtVMFU27VOEx22EWlTZJ2GIgQP-QIgElP5fGc",
  VANS: "17mvVOE43bRXaam8E5G0AN_bT2PKU9NJ93iq5KMXFBI8"
};

// 💰 115 年度維護合約定價基準 (NSR 計價核心)
export const NSR_PRICING_V115 = {
  "CAT 6A": {
    "NORMAL": [4400, 4300, 4200], // [1-4點, 5-8點, 9點以上]
    "ADDON":  [5700, 5600, 5500]  // [1-4點, 5-8點, 9點以上]
  },
  "CAT 6": {
    "NORMAL": [3600, 3500, 3400],
    "ADDON":  [4800, 4700, 4500]
  },
  "EXTRA_PANEL": 1000 // 面板加購固定費用
};

// 📱 UI 行政窄化配置
export const UI_CONFIG = {
  DEFAULT_FONT_SIZE: "10.5px",
  GLASS_OPACITY: "0.85",
  MOBILE_BREAKPOINT: 1024
};