import { NSR_PRICING_V115 } from "../constants";

/**
 * ==========================================
 * 檔案：src/lib/logic/pricing.ts
 * 狀態：V1.0 旗艦不刪減完全體
 * 職責：執行 115 年度維護合約之階梯對沖演算
 * 物理規則：數據嚴格對位 115~118 年度維護合約清單
 * ==========================================
 */

/**
 * 🚀 核心計價函式：calculateNsrPrice
 * * @param cable - 線材規格 ("CAT 6" | "CAT 6A")
 * @param qty - 施工點位數量
 * @param isAddon - 是否為加成施工 (緊急/複雜)
 * @param usePanel - 是否加購面板
 * @returns 最終行政核銷總金額
 */
export const calculateNsrPrice = (
  cable: "CAT 6" | "CAT 6A",
  qty: number,
  isAddon: boolean,
  usePanel: boolean
): number => {
  // 1. 物理獲取合約對應規格數據
  const spec = NSR_PRICING_V115[cable];
  
  // 安全防護：若傳入無效規格則回傳 0
  if (!spec) return 0;

  // 2. 判定階梯索引 (Tier Index)
  // 物理規則：
  // Index 0: 1-4 點
  // Index 1: 5-8 點
  // Index 2: 9 點以上
  let tierIdx = 0;
  if (qty >= 9) {
    tierIdx = 2;
  } else if (qty >= 5) {
    tierIdx = 1;
  } else {
    tierIdx = 0;
  }

  // 3. 根據施工性質選取基準單價
  // 若為加成施工則使用 ADDON 陣列，否則使用 NORMAL 陣列
  const baseUnitPrice = isAddon 
    ? spec.ADDON[tierIdx] 
    : spec.NORMAL[tierIdx];

  // 4. 計算施工小計 (單價 * 數量)
  let subtotal = baseUnitPrice * qty;
  
  // 5. 處理額外面板費用 (物理加成)
  if (usePanel) {
    subtotal += NSR_PRICING_V115.EXTRA_PANEL;
  }

  // 🚀 輸出最終物理結算金額
  return subtotal;
};

/**
 * 🔍 物理邏輯檢驗 (Logic Check)：
 * 案例 A: CAT 6 / 2點 / 一般 / 無面板 -> 3600 * 2 = 7200
 * 案例 B: CAT 6A / 10點 / 加成 / 有面板 -> (5500 * 10) + 1000 = 56000
 * 案例 C: CAT 6 / 6點 / 一般 / 有面板 -> (3500 * 6) + 1000 = 22000
 */