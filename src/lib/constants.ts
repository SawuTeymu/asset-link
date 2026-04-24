/**
 * ==========================================
 * 檔案：src/lib/constants.ts
 * 狀態：V0.2 物理瘦身版 (移除 GAS 歷史遺跡)
 * 職責：集中管理行政白名單、115合約費率、管理員登入密碼
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

// 🔐 管理端登入特權密碼
export const ADMIN_CREDENTIALS = {
  uid: "020807",
  password: "r4r8dWJSP5Z"
};

// 💰 115 年度維護合約定價基準 (NSR 計價核心)
export const NSR_PRICING_V115 = {
  "CAT 6A": {
    "NORMAL": [4400, 4300, 4200], 
    "ADDON":  [5700, 5600, 5500]  
  },
  "CAT 6": {
    "NORMAL": [3600, 3500, 3400],
    "ADDON":  [4800, 4700, 4500]
  },
  "EXTRA_PANEL": 1000
};

// 📱 UI 行政窄化配置
export const UI_CONFIG = {
  DEFAULT_FONT_SIZE: "10.5px",
  GLASS_OPACITY: "0.85",
  MOBILE_BREAKPOINT: 1024
};