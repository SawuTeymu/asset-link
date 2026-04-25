import type { Metadata } from "next";
import "./globals.css";

/**
 * ==========================================
 * 檔案：src/app/layout.tsx
 * 物理職責：全域字體注入、Material Symbols 圖示掛載、SEO 元數據配置
 * 狀態：V0.0 旗艦不刪減版本
 * ==========================================
 */

export const metadata: Metadata = {
  title: "Asset-Link V0.0 | 醫院資產管理系統",
  description: "ERI / NSR 雙軌自動化對沖中樞",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <head>
        {/* 🚀 物理注入 Google Material Symbols (全系統 Icons 唯一來源) */}
        {/* 使用 display=block 確保圖示在載入期間不會造成排版抖動 */}
        <link 
          rel="stylesheet" 
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=block" 
        />
      </head>
      <body className="antialiased font-sans">
        {/* children 將會渲染各個分頁 (page.tsx) 的內容 */}
        {children}
      </body>
    </html>
  );
}