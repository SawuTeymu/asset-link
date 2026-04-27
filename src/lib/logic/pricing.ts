/**
 * ==========================================
 * 檔案：src/lib/logic/pricing.ts
 * 狀態：V1.5 (115年度合約專屬 - 終極完全體)
 * 物理職責：
 * 1. 實作 115~118 合約年度之「階梯式點位計價矩陣」。
 * 2. 實作一般施工 (Standard) 與 加成施工 (Addon) 之單價對沖。
 * 3. 實作硬體耗材 (ㄑ字型 24 埠 PANEL 空架) 物理疊加。
 * ==========================================
 */

/**
 * 根據合約規格計算 NSR 施工總額
 * @param spec     線材規格："CAT 6" 或 "CAT 6A"
 * @param points   施工點位數量 (Points)
 * @param isAddon  是否為加成施工 (指定時間/夜間/假日)
 * @param hasPanel 是否加購 ㄑ字型 24 埠 PANEL 空架 (每組 $1,000)
 * @returns        最終結算金額 (含稅)
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

  // 1. 物理判定點位階梯索引
  // 索引 0: 1 ~ 4 點
  // 索引 1: 5 ~ 8 點
  // 索引 2: 9 點 (含) 以上
  const tierIndex = points >= 9 ? 2 : (points >= 5 ? 1 : 0);

  /**
   * 2. 115 年度合約價格矩陣表
   * 數據來源：115年度維護合約清單 & 施工明細附件
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

  // 3. 執行物理單價對沖邏輯
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
   * 公式：(對沖後之階梯單價 * 點位數量) + 耗材疊加
   * 註：ㄑ字型 24 埠 PANEL 空架 物理加收 $1,000 元/組
   */
  const hardwareFee = hasPanel ? 1000 : 0;
  const totalAmount = (unitPrice * points) + hardwareFee;

  return totalAmount;
}

/**
 * ==========================================
 * 邏輯證明 (Audit Trail):
 * - 案例 A (CAT 6): 2點, 一般施工 -> (3600 * 2) = 7,200
 * - 案例 B (CAT 6): 10點, 加成施工 -> (4500 * 10) = 45,000
 * - 案例 C (CAT 6A): 6點, 一般施工 + Panel -> (4300 * 6) + 1000 = 26,800
 * ==========================================
 */