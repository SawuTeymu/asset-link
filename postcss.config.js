/**
 * Asset-Link PostCSS Configuration
 * 物理修復：使用物件字串格式，讓 Next.js 在生產環境自動對沖插件。
 * 解決 ESLint import/no-anonymous-default-export 警告。
 */

const postcssConfig = {
  plugins: {
    'tailwindcss': {},
    'autoprefixer': {},
  },
};

export default postcssConfig;