/**
 * ==========================================
 * 檔案：src/lib/logic/pricing.ts
 * 狀態：V1.5 (115年度合約專屬 - 終極完全體)
 * 物理職責：
 * 1. 實作 115~118 合約年度之「階梯式點位計價矩陣」。
 * 2. 實作一般施工 (Standard) 與 加成施工 (Addon) 之單價對沖。
 * 3. 實作硬體耗材 (ㄑ字型 24 埠 PANEL 空架) 物理疊加計算。
 * ==========================================
 */

/**
 * 根據合約年度規格計算 NSR 施工結案總額
 * @param spec     線材規格：例如 "CAT 6" 或 "CAT 6A"
 * @param points   施工物理點位數量
 * @param isAddon  是否符合「加成施工」條件 (緊急/夜間/複雜環境)
 * @param hasPanel 是否加購「ㄑ字型 24 埠 PANEL 空架」(每組固定 $1,000)
 * @returns        最終行政對沖結算金額 (含稅)
 */
export function calculateNsrPrice(
  spec: string,
  points: number,
  isAddon: boolean,
  hasPanel: boolean
): number {
  let unitPrice = 0;
  const targetSpec = spec.toUpperCase();
  const is6A = targetSpec.includes("6A");

  // 1. 物理判定點位階梯索引 (依據 115 合約規定)
  // 索引 0: 1 ~ 4 點
  // 索引 1: 5 ~ 8 點
  // 索引 2: 9 點 (含) 以上
  const tierIndex = points >= 9 ? 2 : (points >= 5 ? 1 : 0);

  /**
   * 2. 115 年度合約價格矩陣表
   * 數據來源：115年度資訊設備維護合約施工明細
   */
  const pricingMatrix = {
    CAT6: {
      standard: [3600, 3500, 3400], // 1-4點, 5-8點, 9點以上
      addon: [4800, 4700, 4500]     // 加成施工單價
    },
    CAT6A: {
      standard: [4400, 4300, 4200], // 1-4點, 5-8點, 9點以上
      addon: [6000, 5800, 5600]     // 加成施工單價
    }
  };

  // 3. 執行物理單價對沖
  if (is6A) {
    unitPrice = isAddon 
      ? pricingMatrix.CAT6A.addon[tierIndex] 
      : pricingMatrix.CAT6A.standard[tierIndex];
  } else {
    unitPrice = isAddon 
      ? pricingMatrix.CAT6.addon[tierIndex] 
      : pricingMatrix.CAT6.standard[tierIndex];
  }

  /**
   * 4. 計算最終總額
   * 公式：(階梯單價 * 點位數量) + 耗材附加費
   * 註：ㄑ字型 24 埠 PANEL 空架 物理加收 $1,000 元/組 (稅後)
   */
  const hardwareFee = hasPanel ? 1000 : 0;
  const totalAmount = (unitPrice * points) + hardwareFee;

  return totalAmount;
}

/**
 * ==========================================
 * 財務稽核對沖軌跡 (Audit Trail):
 * - 範例 A (CAT 6): 2點, 一般施工 -> (3600 * 2) = 7,200
 * - 範例 B (CAT 6): 10點, 加成施工 -> (4500 * 10) = 45,000
 * - 範例 C (CAT 6A): 6點, 一般施工 + Panel -> (4300 * 6) + 1000 = 26,800
 * ==========================================
 */