/**
 * Asset-Link PostCSS Configuration
 * 物理修復：採用 CommonJS 格式確保 Vercel 編譯器穩定讀取。
 * 請務必物理刪除 postcss.config.mjs 檔案。
 */
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};