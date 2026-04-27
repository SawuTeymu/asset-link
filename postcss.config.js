/**
 * Asset-Link PostCSS Configuration
 * 物理修復：使用物件字串格式，讓 Next.js 自動加載插件。
 * 解決 "must be provided as a string" 報錯。
 * 修正 ESLint import/no-anonymous-default-export 警告。
 */

const postcssConfig = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default postcssConfig;