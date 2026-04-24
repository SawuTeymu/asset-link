/**
 * ==========================================
 * 檔案：src/lib/logic/formatters.ts
 * 狀態：V1.5 旗艦完全體 (Next.js 移植版)
 * 移植自：parser.js / MAC格式.js
 * 職責：執行行政窄化校準規則，確保全系統數據對沖一致性
 * ==========================================
 */

/**
 * 1. 樓層格式化 (對沖 00樓 行政規範)
 * 邏輯：
 * - 處理地下室：B1, B2, B3 直接回傳
 * - 處理一般樓層：將數字補足兩位並附加「樓」字元 (如 "5" -> "05樓")
 */
export const formatFloor = (f: string): string => {
  if (!f) return "";
  const v = f.toUpperCase().trim();
  
  // 處理地下室 (B1-B3)
  if (v.startsWith('B')) {
    const bNum = v.replace(/[^1-3]/g, '');
    return bNum ? `B${bNum}` : v;
  }
  
  // 處理一般樓層 (數字部分補零 + 樓)
  const num = v.replace(/\D/g, '');
  if (num) {
    // 物理規則：醫院無 4 樓，但格式化引擎僅負責格式對位，不進行業務阻斷
    return `${num.padStart(2, '0')}樓`;
  }
  return v;
};

/**
 * 2. MAC 位址物理校對 (XX:XX:XX:XX:XX:XX)
 * 邏輯：
 * - 物理清洗：移除所有分隔符 ( : , - , 空格 ) 並轉大寫
 * - 物理驗證：必須為 12 字元之十六進制碼
 * - 物理重構：強制補回標準冒號分隔符
 */
export const formatMAC = (input: string): string => {
  if (!input) return "";
  
  // 1. 移除所有雜訊字元
  const raw = input.toUpperCase().replace(/[:\s-]/g, "");
  
  // 2. 驗證十六進制格式與長度
  if (raw.length === 12 && /^[0-9A-F]{12}$/.test(raw)) {
    // 3. 每兩碼補一個冒號
    return raw.match(/.{1,2}/g)?.join(":") || raw;
  }
  
  // 若非標準 MAC 則保留原值，不破壞數據
  return input;
};

/**
 * 3. 智慧命名解析 (提取行政屬性)
 * 邏輯：
 * - 解析規則：^[棟別][樓層]-[分機] (如 A05-5888)
 * - 分機處理：4 位碼若首碼非 0 則補 1 (1XXXX)，首碼為 0 則轉純數字
 */
export const parseSmartName = (deviceName: string) => {
  const result = { 
    area: null as string | null, 
    floor: null as string | null, 
    ext: null as string | null 
  };
  
  if (!deviceName) return result;

  const upper = deviceName.trim().toUpperCase();
  // 正則分組：1.棟別(A-Z), 2.樓層(2位數或B1-3), 3.分機(4-5位)
  const match = upper.match(/^([A-Z])(\d{2}|B\d)-?(\d{4,5})/);
  
  if (match) {
    result.area = match[1];
    result.floor = formatFloor(match[2]);
    
    const rawExt = match[3];
    // 執行分機規則鎖定 (醫院內部交換機邏輯)
    if (rawExt.length === 4) {
      if (rawExt.charAt(0) !== '0') {
        // 首碼不為 0，物理補 1
        result.ext = "1" + rawExt; 
      } else {
        // 首碼為 0，轉化為純整數格式 (如 0888 -> 888)
        result.ext = parseInt(rawExt, 10).toString(); 
      }
    } else {
      result.ext = rawExt; 
    }
  }
  return result;
};

/**
 * 4. 申請人資訊拆解 (姓名#分機)
 * 職責：處理 G 欄位行政規範，確保「#」字元兩側數據精準落地
 */
export const parseApplicant = (info: string) => {
  if (!info) return { name: "", ext: "" };
  
  if (!info.includes('#')) {
    return { name: info.trim(), ext: "" };
  }
  
  const [name, ext] = info.split('#');
  return { 
    name: name ? name.trim() : "", 
    ext: ext ? ext.trim() : "" 
  };
};