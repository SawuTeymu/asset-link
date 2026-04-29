/**
 * ==========================================
 * 檔案：src/lib/constants.ts
 * 狀態：V0.3 帳密集中管理版 (115年度合約對沖版)
 * 職責：集中管理管理員多重帳密、NSR 計價費率、系統全域常數
 * ==========================================
 */

// 🏷 系統版本資訊
export const SYSTEM_VERSION = "Asset-Link V0.0 (Flagship Production)";

// 🔑 內部 API 二次驗證金鑰 (用於安全簽章生成)
export const SYSTEM_SECRET = "ERI_ASSET_LINK_2026_V0";

/**
 * 🔐 管理端登入特權帳密陣列
 * 物理職責：取代原有的 SSO 白名單。
 * 未來若要新增或刪除管理員帳號，直接在此陣列中進行增刪即可。
 */
export const ADMIN_CREDENTIALS_LIST = [
  {
    uid: "020807",             // 預設特權帳號
    password: "r4r8dWJSP5Z",   // 預設特權密碼 (對齊舊版 ADMIN_PSW)
    role: "SuperAdmin"
  },
  {
    uid: "admin2",             // 備援/測試用帳號
    password: "password123",   
    role: "Admin"
  }
];

/**
 * 💰 115 年度維護合約定價基準 (NSR 計價核心)
 * 數據來源：115~118 年度正式維護合約清單
 * 物理規則：[1-4點位單價, 5-8點位單價, 9點以上單價]
 */
export const NSR_PRICING_V115 = {
  "CAT 6A": {
    "NORMAL": [4400, 4300, 4200], 
    "ADDON":  [5700, 5600, 5500]  // 加成施工單價
  },
  "CAT 6": {
    "NORMAL": [3600, 3500, 3400],
    "ADDON":  [4800, 4700, 4500]
  },
  "EXTRA_PANEL": 1000 // 加購面板固定費用
};

/**
 * 📱 UI 視覺與行政窄化配置
 */
export const UI_CONFIG = {
  DEFAULT_FONT_SIZE: "10.5px", // 行政規範字體大小
  GLASS_OPACITY: "0.85",       // 毛玻璃透明度
  MOBILE_BREAKPOINT: 1024      // RWD 斷點門檻 (px)
};