/**
 * Asset-Link PostCSS Configuration
 * 物理修復：使用 CommonJS 語法，解決 Vercel "module is not defined" 與解析錯誤。
 * 請確保刪除倉庫中的 postcss.config.mjs 檔案。
 */
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};