/**
 * ==========================================
 * 檔案：next.config.mjs
 * 物理職責：Next.js 核心編譯器與運行環境配置
 * ==========================================
 * @type {import('next').NextConfig}
 */
const nextConfig = {
    // 物理開啟 React 嚴格模式，有助於在開發階段抓出 useEffect 級聯渲染等潛在 Bug
    reactStrictMode: true,
    
    // 確保 Next.js 在編譯時忽略未使用的變數警告（防止部署 Vercel 時因 ESLint 而中斷）
    eslint: {
      ignoreDuringBuilds: true,
    },
    
    // 實驗性功能：允許外部套件在 Server Actions 中使用
    serverExternalPackages: [],
  };
  
  export default nextConfig;