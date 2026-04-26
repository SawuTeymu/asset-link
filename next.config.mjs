/** @type {import('next').NextConfig} */

/**
 * ==========================================
 * 檔案：next.config.mjs
 * 物理職責：設定 Next.js 編譯行為
 * 狀態：已徹底刪除引起報錯的 `eslint` 鍵值，符合最新官方規範。
 * ==========================================
 */

const nextConfig = {
  // 指定輸出模式為獨立封裝 (適用於 Docker/Vercel)
  output: 'standalone',
  
  // 繞過外部圖片優化，防止因來源圖床無回應導致的渲染卡頓
  images: {
    unoptimized: true,
  }
};

export default nextConfig;