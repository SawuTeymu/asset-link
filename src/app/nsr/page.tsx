/**
 * ==========================================
 * 檔案：src/lib/logic/pricing.ts
 * 狀態：V1.2 (115年度合約專屬完全體)
 * 物理職責：
 * 1. 實作 115~118 合約階梯式點位計價矩陣。
 * 2. 實作一般施工與加成施工(緊急/夜間/假日)對沖。
 * 3. 實作硬體耗材（24埠空架）物理疊加。
 * ==========================================
 */

export function calculateNsrPrice(
  spec: string,      // 線材規格: "CAT 6" 或 "CAT 6A"
  points: number,    // 施工點位數量
  isAddon: boolean,  // 是否為加成施工
  hasPanel: boolean  // 是否加購 ㄑ字型 24 埠 PANEL 空架
): number {
  let unitPrice = 0;
  const is6A = spec.toUpperCase().includes("6A");

  // 1. 判定點位階梯索引 (0: 1-4, 1: 5-8, 2: 9+)
  const tierIndex = points >= 9 ? 2 : (points >= 5 ? 1 : 0);

  /**
   * 2. 115 年度合約價格矩陣 (精準對沖 CSV 附件單價)
   */
  const prices = {
    CAT6: {
      standard: [3600, 3500, 3400],
      addon: [4800, 4700, 4500]
    },
    CAT6A: {
      standard: [4400, 4300, 4200],
      addon: [6000, 5800, 5600]
    }
  };

  // 3. 提取對應合約單價
  if (is6A) {
    unitPrice = isAddon ? prices.CAT6A.addon[tierIndex] : prices.CAT6A.standard[tierIndex];
  } else {
    unitPrice = isAddon ? prices.CAT6.addon[tierIndex] : prices.CAT6.standard[tierIndex];
  }

  // 4. 計算總額
  // 公式：(單價 * 點位) + (面板費 $1,000)
  const total = (unitPrice * points) + (hasPanel ? 1000 : 0);

  return total;
}