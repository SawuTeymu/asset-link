/**
 * Asset-Link PostCSS Configuration
 * 物理修復：使用最穩定的 CommonJS 格式，防止 Vercel 模組解析崩潰。
 * (請務必刪除專案中殘留的 postcss.config.mjs)
 */
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};