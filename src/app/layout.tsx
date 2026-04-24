import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#f7f9fb",
};

export const metadata: Metadata = {
  title: "裝機預約管理系統 | Asset-Link V0.0",
  description: "Asset-Link Internal Core.",
  appleWebApp: {
    capable: true,
    title: "Asset-Link",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Inter:wght@400;600;800&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body-md text-on-background selection:bg-primary-fixed antialiased">
        {children}
      </body>
    </html>
  );
}