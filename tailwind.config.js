/** @type {import('tailwindcss').Config} */

/**
 * Asset-Link Tailwind CSS Configuration
 * 物理職責：
 * 1. 定義掃描路徑 (Content)：確保 src 內所有組件均能物理對沖樣式。
 * 2. 修正 ESLint 報警：將配置賦值給具名變數再行導出。
 * 3. 對位生產環境：支援 Vercel 佈署之實體 CSS 生成。
 */
const tailwindConfig = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      // 🚀 這裡可以物理擴充 ALink 專屬的玻璃擬態深度顏色
    },
  },
  plugins: [],
};

export default tailwindConfig;