import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

/**
 * Asset-Link PostCSS Configuration
 * 物理修復：在 ESM 環境下直接引入插件，解決 Vercel "Can't resolve tailwindcss" 報錯
 */
const postcssConfig = {
  plugins: [
    tailwindcss,
    autoprefixer,
  ],
};

export default postcssConfig;