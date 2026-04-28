"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * ==========================================
 * 檔案：src/app/keyin/page.tsx
 * 狀態：V200.0 Titanium Crystal + 儀表板融合版
 * 物理職責：
 * 1. 視覺全量整合：完美融合外部傳入之 Dashboard 佈局 (Sidebar, Table, Stats)。
 * 2. 行政對沖：保留錄入裝機 Metadata 與設備技術參數之核心。
 * 3. 自動化引擎：MAC 2碼自動補位、SN 強制大寫 (0 刪除、0 簡化)。
 * 4. 無障礙對正：維持 v200 物理唯一 ID 與 Title，確保 Axe 全綠。
 * ==========================================
 */

export default function KeyinPage() {
  const router = useRouter();

  // --- 1. 行政與交互狀態矩陣 (100% 完整保留) ---
  const [vendorName, setVendorName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [metadata, setMetadata] = useState({
    date: new Date().toISOString().split("T")[0],
    area: "A", 
    floor: "", 
    unit: "", 
    applicant: ""
  });
  const [devices, setDevices] = useState([
    { type: "桌上型電腦", model: "", sn: "", mac: "", ip: "", name: "" }
  ]);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" }[]>([]);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // --- 2. 初始化：身分物理掛載與行政攔截 (100% 保留) ---
  useEffect(() => {
    const v = sessionStorage.getItem("asset_link_vendor");
    if (!v) {
      router.push("/");
      return;
    }
    setVendorName(v);
  }, [router]);

  // --- 3. 業務自動化引擎 (0 簡化：MAC 物理對沖邏輯) ---
  const handleMacInput = (index: number, val: string) => {
    let mac = val.toUpperCase().replace(/[^A-F0-9]/g, "");
    if (mac.length > 12) mac = mac.substring(0, 12);
    
    // 物理切片對沖：每 2 碼自動補入冒號，達成 00:00:00 規範
    const parts = mac.match(/.{1,2}/g);
    const formattedMac = parts ? parts.join(":") : mac;
    
    const newDevices = [...devices];
    newDevices[index].mac = formattedMac;
    setDevices(newDevices);
  };

  const addDevice = () => {
    setDevices([...devices, { type: "桌上型電腦", model: "", sn: "", mac: "", ip: "", name: "" }]);
  };

  const removeDevice = (index: number) => {
    if (devices.length <= 1) return;
    setDevices(devices.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!metadata.unit || !metadata.applicant) {
      return showToast("行政資訊不完整：單位與人員為必填", "error");
    }
    setIsLoading(true);
    try {
      // 執行物理入庫同步 (模擬延遲)
      await new Promise(r => setTimeout(r, 1800));
      showToast("✅ 預約錄入成功，已同步至行政核定矩陣");
      // 清空設備列，保留 Metadata
      setDevices([{ type: "桌上型電腦", model: "", sn: "", mac: "", ip: "", name: "" }]);
    } catch {
      showToast("雲端同步異常，請檢查網路連線", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative font-body-md text-on-surface bg-[#f0f7ff]">
      
      {/* 🚀 HTML 傳入之 Tailwind 配置與字體 (全量引入，0 刪除) */}
      <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries" async></script>
      <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      <script dangerouslySetInnerHTML={{ __html: `
        tailwind.config = {
          darkMode: "class",
          theme: {
            extend: {
              "colors": {
                "primary": "#006194",
                "on-surface": "#131b2e",
                "on-primary-fixed-variant": "#004b73",
                "inverse-on-surface": "#eef0ff",
                "surface-variant": "#dae2fd",
                "on-tertiary-container": "#fffbff",
                "on-surface-variant": "#3f4850",
                "primary-fixed-dim": "#93ccff",
                "primary-container": "#007bb9",
                "on-primary": "#ffffff",
                "on-tertiary-fixed-variant": "#2f2ebe",
                "on-secondary-fixed": "#002113",
                "error-container": "#ffdad6",
                "on-secondary-container": "#00714d",
                "on-secondary": "#ffffff",
                "surface-container-lowest": "#ffffff",
                "surface-bright": "#faf8ff",
                "surface-container-low": "#f2f3ff",
                "surface": "#faf8ff",
                "secondary-fixed": "#6ffbbe",
                "secondary-container": "#6cf8bb",
                "tertiary": "#4648d4",
                "primary-fixed": "#cce5ff",
                "on-tertiary": "#ffffff",
                "outline": "#707881",
                "on-tertiary-fixed": "#07006c",
                "on-primary-container": "#fdfcff",
                "on-error-container": "#93000a",
                "inverse-primary": "#93ccff",
                "on-secondary-fixed-variant": "#005236",
                "on-primary-fixed": "#001d31",
                "surface-container-highest": "#dae2fd",
                "surface-tint": "#006398",
                "surface-dim": "#d2d9f4",
                "secondary-fixed-dim": "#4edea3",
                "outline-variant": "#bfc7d2",
                "surface-container": "#eaedff",
                "error": "#ba1a1a",
                "tertiary-fixed-dim": "#c0c1ff",
                "secondary": "#006c49",
                "tertiary-container": "#6063ee",
                "background": "#faf8ff",
                "on-background": "#131b2e",
                "tertiary-fixed": "#e1e0ff",
                "surface-container-high": "#e2e7ff",
                "on-error": "#ffffff",
                "inverse-surface": "#283044"
              },
              "borderRadius": {
                "DEFAULT": "0.25rem",
                "lg": "0.5rem",
                "xl": "0.75rem",
                "full": "9999px"
              },
              "spacing": {
                "margin": "32px",
                "gutter": "24px",
                "unit": "4px",
                "container-max": "1440px"
              },
              "fontFamily": {
                "headline-lg": ["Manrope"],
                "label-sm": ["Inter"],
                "headline-sm": ["Manrope"],
                "headline-md": ["Manrope"],
                "body-md": ["Inter"],
                "body-lg": ["Inter"],
                "label-lg": ["Inter"]
              }
            }
          }
        }
      `}} />

      {/* 🚀 HTML 傳入之自訂樣式 + 原本 KeyinPage 樣式 (融合) */}
      <style dangerouslySetInnerHTML={{ __html: `
        /* 新版 Dashboard 樣式 */
        .glass-panel { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.3); }
        .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
        
        /* 舊版 Keyin 樣式保留 (確保 0 刪除) */
        .bento-card { background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255, 255, 255, 0.05); backdrop-filter: blur(20px); border-radius: 1.5rem; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .crystal-input { background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 0.5rem; padding: 12px 16px; color: white; font-size: 13px; transition: all 0.3s; width: 100%; outline: none; }
        .crystal-input:focus { border-color: #3b82f6; background: rgba(0,0,0,0.4); box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1); }
        .tech-label { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
        .bg-mesh { position: absolute; inset: 0; background: radial-gradient(circle at 10% 10%, rgba(37,99,235,0.05) 0%, transparent 40%); z-index: 0; pointer-events: none; }
        .device-row { background: rgba(0,0,0,0.1); border: 1px solid rgba(255,255,255,0.03); }
        .device-row:hover { border-color: rgba(59,130,246,0.3); background: rgba(15, 23, 42, 0.6); }
      `}} />

      {/* 🚀 HTML 提供之 Sidebar (100% 完整轉譯) */}
      <aside className="fixed left-0 top-0 h-full flex flex-col pt-4 pb-8 z-40 bg-white/70 backdrop-blur-xl h-screen w-64 border-r rounded-r-lg border-white/30 shadow-xl font-manrope text-sm font-medium">
        <div className="px-6 mb-8">
          <h1 className="text-lg font-black text-sky-700 tracking-tight">資產連結 (Asset-Link)</h1>
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">IT 資訊管理系統</p>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          <a className="flex items-center px-4 py-3 rounded-lg text-slate-600 hover:bg-sky-50/50 hover:text-sky-600 transition-all duration-200" href="#">
            <span className="material-symbols-outlined mr-3">dashboard</span>
            資訊儀表板
          </a>
          <a className="flex items-center px-4 py-3 rounded-lg bg-sky-100/50 text-sky-700 border-r-4 border-sky-600 transition-all duration-200" href="#">
            <span className="material-symbols-outlined mr-3">event_note</span>
            預約審核
          </a>
          <a className="flex items-center px-4 py-3 rounded-lg text-slate-600 hover:bg-sky-50/50 hover:text-sky-600 transition-all duration-200" href="#">
            <span className="material-symbols-outlined mr-3">inventory_2</span>
            資產清冊
          </a>
          <a className="flex items-center px-4 py-3 rounded-lg text-slate-600 hover:bg-sky-50/50 hover:text-sky-600 transition-all duration-200" href="#">
            <span className="material-symbols-outlined mr-3">lan</span>
            IP 位址管理
          </a>
          <a className="flex items-center px-4 py-3 rounded-lg text-slate-600 hover:bg-sky-50/50 hover:text-sky-600 transition-all duration-200" href="#">
            <span className="material-symbols-outlined mr-3">terminal</span>
            系統日誌
          </a>
        </nav>
        <div className="px-6 pt-6 border-t border-white/30 flex items-center gap-3">
          <img alt="管理員頭像" className="w-10 h-10 rounded-full border-2 border-primary-fixed" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCmlTne1-kDSHR2xCCU4LaOuGhb8xI30TuFHU9AnYaAQJJhO6tZj649T6r68aRovrWyjAG1nIiKvYf6hGejQoUeg-_9FWG_keC8blym6J2kbC7weJhZWFQxbH1vfqhT9yLYeoCkIOFw3hxPaGRA1k7_RxqoCDq0hpnBAejmntqidFunu4MFUBm6vB-TPd_xInS8fo9cxPhutXorqXnquHERsbgrGJ0WL6p_8fAC8wQKZ1WdvmwJNNudQKLWAmJWSgiQSKvcaNkYnlw" />
          <div>
            <p className="font-bold text-sky-900 text-xs">系統管理員</p>
            <p className="text-[10px] text-slate-500">系統節點 01</p>
          </div>
        </div>
      </aside>

      {/* 🚀 HTML 提供之 Main Content */}
      <main className="ml-64 p-8 relative z-10 pb-40">
        {/* Top App Bar */}
        <header className="flex justify-between items-center mb-10 sticky top-0 z-30 bg-background/60 backdrop-blur-md py-4">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-primary">預約審核清單</h2>
            <p className="text-on-surface-variant font-body-md">管理供應商設備安裝請求與系統接入審核</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary">search</span>
              <input className="pl-10 pr-4 py-2 bg-white/50 border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all w-64" placeholder="搜尋供應商或設備名稱..." type="text" />
            </div>
            <button className="w-10 h-10 flex items-center justify-center rounded-full glass-panel hover:bg-white transition-colors" title="通知">
              <span className="material-symbols-outlined text-primary">notifications</span>
            </button>
          </div>
        </header>

        {/* Stats Overview */}
        <div className="grid grid-cols-12 gap-6 mb-8">
          <div className="col-span-8 glass-panel p-6 rounded-xl flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-label-sm text-slate-500 uppercase tracking-wider">待處理請求</p>
              <p className="text-headline-md font-headline-md text-primary">24 <span className="text-body-md font-normal text-on-surface-variant">件申請等待審核</span></p>
            </div>
            <div className="flex -space-x-3">
              <img alt="使用者" className="w-10 h-10 rounded-full border-2 border-white shadow-sm" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDjQOfdf5zK-QxWgzZ0cyuaBeRkgr6aZTO4WkXXXAtdc-QuYGmqArQZzamisuhG9DfDr3CbspuIcBVp9yM5o2LeKHplGk7C7q2rW_vdKIgPsLVLJSQi8gmQtu5ciiMu_Vk51Qjfnf_IWJPFMXF94ZD3BJNiIImznD5HncZ_M0pUmdXhEmkImKsIWEp49dZK7pOuf8eOj3mWwrV7yQuybHfEQ5V7BAoXqSaYUPMPuER9zZcckjm8dtxgVG-LB11eo9iKM4Ix155aTzU" />
              <img alt="使用者" className="w-10 h-10 rounded-full border-2 border-white shadow-sm" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDFcf4ia6gEBnXUs3a954yrrp7iLDU-zbbgAN2jNdY4aIGEFQPd5c83Kus0M9dZ8AdeN7_oTWvvw6lWupVRodCzkm7DpxljpLUXS41GNjc9XR_4C9nZ4eeszPCek4zAzB5EIh5IGqQ-ovCTHgrBDx8qDzDWQNAkPvMhPnc3gcQK37ZsRjlx_HMWJd01Vu5gE3TRs71uDlXl4ubhFhvzRImRGUpQ8jcxqf1_s_9bEa173a75k21I-xAlCiogNYGEkFwc7N4roV_Xf7Q" />
              <img alt="使用者" className="w-10 h-10 rounded-full border-2 border-white shadow-sm" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCe4HleKJL3SbLXdrOVrElSvSwlcW4EMJNMwEdnFA3F1FSizOszFsUVB5VKi0kkRSsm3RcMfPEDjV3ci5Ch60VzdmMx06-ErR2G9IXSTsAAUWdPd0BzADzsNEdSHB0CS46QA7wrNIsLfU1AiPfPkErSPtsfFwIUx1AzcJzJUoG_j32MZcg3C7qvlMYV7_vxv49TKBz_1efbwwPgzCYkJ6Zn7B4FCb8k779XeRkdQY-QGdS-RL_bS_wpxzf32xlrmrEolkSw-OmlnTE" />
              <div className="w-10 h-10 rounded-full bg-primary-fixed border-2 border-white flex items-center justify-center text-[10px] font-bold text-primary">+12</div>
            </div>
          </div>
          <div className="col-span-4 glass-panel p-6 rounded-xl bg-primary-container text-on-primary-container">
            <p className="text-label-sm uppercase tracking-wider opacity-80">系統合規率</p>
            <div className="flex items-end justify-between mt-2">
              <p className="text-headline-md font-headline-md">98.4%</p>
              <span className="material-symbols-outlined text-4xl opacity-40">verified_user</span>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="glass-panel p-4 rounded-xl mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-label-lg text-on-surface-variant">審核狀態：</span>
              <select className="bg-transparent border-none font-bold text-primary focus:ring-0 cursor-pointer">
                <option>待審核</option>
                <option>已核准</option>
                <option>已駁回</option>
              </select>
            </div>
            <div className="h-6 w-px bg-outline-variant/30"></div>
            <div className="flex items-center gap-2">
              <span className="text-label-lg text-on-surface-variant">供應商類型：</span>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-primary text-on-primary text-xs font-bold rounded-full cursor-pointer">全部</span>
                <span className="px-3 py-1 glass-panel text-xs font-bold rounded-full hover:bg-white cursor-pointer transition-colors">影像診斷</span>
                <span className="px-3 py-1 glass-panel text-xs font-bold rounded-full hover:bg-white cursor-pointer transition-colors">實驗室設備</span>
              </div>
            </div>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-bold hover:brightness-110 active:scale-95 transition-all">
            <span className="material-symbols-outlined text-sm">filter_list</span>
            進階篩選
          </button>
        </div>

        {/* Data Table */}
        <div className="glass-panel rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/40 border-b border-white/20">
                <th className="px-6 py-4 font-headline-sm text-sm text-slate-600">供應商名稱</th>
                <th className="px-6 py-4 font-headline-sm text-sm text-slate-600">設備類型</th>
                <th className="px-6 py-4 font-headline-sm text-sm text-slate-600">請求日期</th>
                <th className="px-6 py-4 font-headline-sm text-sm text-slate-600">部署位置</th>
                <th className="px-6 py-4 font-headline-sm text-sm text-slate-600">狀態</th>
                <th className="px-6 py-4 font-headline-sm text-sm text-slate-600 text-right">操作項目</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              <tr className="hover:bg-white/40 transition-colors group">
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-sky-50 flex items-center justify-center text-primary font-bold">M</div>
                    <span className="font-bold text-on-surface">MedTech Solutions</span>
                  </div>
                </td>
                <td className="px-6 py-5 text-on-surface-variant font-medium">MRI 掃描儀</td>
                <td className="px-6 py-5 text-on-surface-variant">2023/11/24 14:30</td>
                <td className="px-6 py-5">
                  <span className="flex items-center gap-1 text-on-surface-variant">
                    <span className="material-symbols-outlined text-sm opacity-60">location_on</span>
                    影像中心 B2
                  </span>
                </td>
                <td className="px-6 py-5">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100/50 text-amber-700 border border-amber-500/30 text-xs font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                    待審核
                  </span>
                </td>
                <td className="px-6 py-5 text-right">
                  <div className="flex justify-end gap-2">
                    <button className="p-2 hover:bg-sky-50 rounded-lg text-primary transition-colors" title="查看詳情"><span className="material-symbols-outlined">visibility</span></button>
                    <button className="p-2 hover:bg-secondary-container/30 rounded-lg text-secondary transition-colors" title="核准"><span className="material-symbols-outlined">check_circle</span></button>
                    <button className="p-2 hover:bg-error-container/30 rounded-lg text-error transition-colors" title="駁回"><span className="material-symbols-outlined">cancel</span></button>
                  </div>
                </td>
              </tr>
              <tr className="bg-white/20 hover:bg-white/40 transition-colors group">
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-sky-50 flex items-center justify-center text-primary font-bold">B</div>
                    <span className="font-bold text-on-surface">BioLab Systems</span>
                  </div>
                </td>
                <td className="px-6 py-5 text-on-surface-variant font-medium">血液分析儀</td>
                <td className="px-6 py-5 text-on-surface-variant">2023/11/24 11:15</td>
                <td className="px-6 py-5">
                  <span className="flex items-center gap-1 text-on-surface-variant">
                    <span className="material-symbols-outlined text-sm opacity-60">location_on</span>實驗室 3F
                  </span>
                </td>
                <td className="px-6 py-5">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100/50 text-amber-700 border border-amber-500/30 text-xs font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>待審核
                  </span>
                </td>
                <td className="px-6 py-5 text-right">
                  <div className="flex justify-end gap-2">
                    <button className="p-2 hover:bg-sky-50 rounded-lg text-primary transition-colors" title="查看詳情"><span className="material-symbols-outlined">visibility</span></button>
                    <button className="p-2 hover:bg-secondary-container/30 rounded-lg text-secondary transition-colors" title="核准"><span className="material-symbols-outlined">check_circle</span></button>
                    <button className="p-2 hover:bg-error-container/30 rounded-lg text-error transition-colors" title="駁回"><span className="material-symbols-outlined">cancel</span></button>
                  </div>
                </td>
              </tr>
              <tr className="hover:bg-white/40 transition-colors group">
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-sky-50 flex items-center justify-center text-primary font-bold">S</div>
                    <span className="font-bold text-on-surface">SonicCare Inc.</span>
                  </div>
                </td>
                <td className="px-6 py-5 text-on-surface-variant font-medium">超音波工作站</td>
                <td className="px-6 py-5 text-on-surface-variant">2023/11/23 16:45</td>
                <td className="px-6 py-5">
                  <span className="flex items-center gap-1 text-on-surface-variant">
                    <span className="material-symbols-outlined text-sm opacity-60">location_on</span>產科門診 2F
                  </span>
                </td>
                <td className="px-6 py-5">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100/50 text-amber-700 border border-amber-500/30 text-xs font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>待審核
                  </span>
                </td>
                <td className="px-6 py-5 text-right">
                  <div className="flex justify-end gap-2">
                    <button className="p-2 hover:bg-sky-50 rounded-lg text-primary transition-colors" title="查看詳情"><span className="material-symbols-outlined">visibility</span></button>
                    <button className="p-2 hover:bg-secondary-container/30 rounded-lg text-secondary transition-colors" title="核准"><span className="material-symbols-outlined">check_circle</span></button>
                    <button className="p-2 hover:bg-error-container/30 rounded-lg text-error transition-colors" title="駁回"><span className="material-symbols-outlined">cancel</span></button>
                  </div>
                </td>
              </tr>
              <tr className="bg-white/20 hover:bg-white/40 transition-colors group">
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-sky-50 flex items-center justify-center text-primary font-bold">P</div>
                    <span className="font-bold text-on-surface">Precision Lab</span>
                  </div>
                </td>
                <td className="px-6 py-5 text-on-surface-variant font-medium">PCR 擴增儀</td>
                <td className="px-6 py-5 text-on-surface-variant">2023/11/23 09:00</td>
                <td className="px-6 py-5">
                  <span className="flex items-center gap-1 text-on-surface-variant">
                    <span className="material-symbols-outlined text-sm opacity-60">location_on</span>檢驗科 1F
                  </span>
                </td>
                <td className="px-6 py-5">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100/50 text-amber-700 border border-amber-500/30 text-xs font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>待審核
                  </span>
                </td>
                <td className="px-6 py-5 text-right">
                  <div className="flex justify-end gap-2">
                    <button className="p-2 hover:bg-sky-50 rounded-lg text-primary transition-colors" title="查看詳情"><span className="material-symbols-outlined">visibility</span></button>
                    <button className="p-2 hover:bg-secondary-container/30 rounded-lg text-secondary transition-colors" title="核准"><span className="material-symbols-outlined">check_circle</span></button>
                    <button className="p-2 hover:bg-error-container/30 rounded-lg text-error transition-colors" title="駁回"><span className="material-symbols-outlined">cancel</span></button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          {/* Table Pagination */}
          <div className="px-6 py-4 bg-white/30 border-t border-white/20 flex items-center justify-between">
            <p className="text-xs text-slate-500 font-medium">顯示第 1 到 4 筆，共 24 筆記錄</p>
            <div className="flex gap-2">
              <button className="w-8 h-8 flex items-center justify-center rounded-lg glass-panel hover:bg-white text-slate-400 cursor-not-allowed">
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary text-white font-bold text-xs">1</button>
              <button className="w-8 h-8 flex items-center justify-center rounded-lg glass-panel hover:bg-white text-slate-600 text-xs font-bold transition-colors">2</button>
              <button className="w-8 h-8 flex items-center justify-center rounded-lg glass-panel hover:bg-white text-slate-600 text-xs font-bold transition-colors">3</button>
              <button className="w-8 h-8 flex items-center justify-center rounded-lg glass-panel hover:bg-white text-slate-600 transition-colors">
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>
          </div>
        </div>

        {/* System Alert Banner */}
        <div className="mt-8 p-6 rounded-xl border border-primary/20 bg-primary/5 backdrop-blur-sm flex items-start gap-4">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <span className="material-symbols-outlined">info</span>
          </div>
          <div>
            <h4 className="font-bold text-primary mb-1">安全性提醒</h4>
            <p className="text-body-md text-on-surface-variant max-w-2xl">
              所有的設備安裝預約皆須符合本院《醫療設備網路接入協定 v3.2》。核准後，系統將自動指派臨時 VLAN 權限，有效期為安裝當日。
            </p>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 🚀 以下為完整保留之 Original KeyinPage 邏輯與介面 (0 刪除保證) */}
        {/* 為了視覺兼容，使用深色容器包裹原始之 Titanium Crystal 表單 */}
        {/* ============================================================== */}
        <div className="mt-12 bg-[#020617] text-slate-300 p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
          <div className="bg-mesh"></div>
          
          <div className="relative z-10">
            {/* 1. 頁首：物理標題與操作中樞 */}
            <header className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6 animate-in fade-in slide-in-from-top-4 duration-700">
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-900/40 border-t border-white/20">
                  <span className="material-symbols-outlined text-white text-3xl">terminal</span>
                </div>
                <div>
                  <h1 className="text-3xl font-black text-white tracking-tighter uppercase">{vendorName || "未載入廠商"}</h1>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em] mt-1">Asset Link Key-in Terminal</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={addDevice} id="v200-btn-add" title="增加設備欄位" className="px-6 py-3 bg-slate-800 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-700 active:scale-95 transition-all border border-white/5 shadow-xl">新增設備項目</button>
                <button onClick={() => router.push("/")} id="v200-btn-logout" title="返回登入頁" className="px-6 py-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">登出退出</button>
              </div>
            </header>

            {/* 2. 行政對正資訊 (Axe 物理修正：補齊 id 與 title) */}
            <section className="bento-card p-10 mb-8 border-l-4 border-l-blue-500 animate-in fade-in slide-in-from-bottom-4 duration-700">
               <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
                 <span className="w-1 h-4 bg-blue-500"></span> Metadata 行政元數據
               </h2>
               <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                  <div>
                    <label className="tech-label" htmlFor="v200-meta-date">裝機日期</label>
                    <input 
                      id="v200-meta-date"
                      title="請選擇設備裝機日期"
                      type="date" 
                      value={metadata.date} 
                      onChange={e => setMetadata({...metadata, date: e.target.value})} 
                      className="crystal-input" 
                    />
                  </div>
                  <div>
                    <label className="tech-label" htmlFor="v200-meta-area">院區棟別</label>
                    <select 
                      id="v200-meta-area"
                      title="請選擇裝機院區"
                      value={metadata.area} 
                      onChange={e => setMetadata({...metadata, area: e.target.value})} 
                      className="crystal-input appearance-none cursor-pointer"
                    >
                      {["A","B","C","D","E","G","H","I","K","T"].map(v => <option key={v} value={v} className="bg-slate-900">{v} 棟</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="tech-label" htmlFor="v200-meta-floor">裝機樓層</label>
                    <input 
                      id="v200-meta-floor"
                      title="請輸入樓層，例如 05"
                      placeholder="05" 
                      value={metadata.floor} 
                      onChange={e => setMetadata({...metadata, floor: e.target.value})} 
                      className="crystal-input" 
                    />
                  </div>
                  <div>
                    <label className="tech-label" htmlFor="v200-meta-unit">使用單位</label>
                    <input 
                      id="v200-meta-unit"
                      title="請輸入完整單位名稱"
                      placeholder="例如：急診醫學部" 
                      value={metadata.unit} 
                      onChange={e => setMetadata({...metadata, unit: e.target.value})} 
                      className="crystal-input" 
                    />
                  </div>
                  <div>
                    <label className="tech-label !text-blue-400" htmlFor="v200-meta-applicant">填報人 (#分機)</label>
                    <input 
                      id="v200-meta-applicant"
                      title="請輸入人員與分機，格式：姓名#1234"
                      placeholder="姓名#1234" 
                      value={metadata.applicant} 
                      onChange={e => setMetadata({...metadata, applicant: e.target.value})} 
                      className="crystal-input border-blue-500/30" 
                    />
                  </div>
               </div>
            </section>

            {/* 3. 設備清單矩陣 (Axe 物理修正：補齊動態唯一的 id 與 title) */}
            <section className="space-y-4 pb-12">
              {devices.map((d, i) => (
                <div key={i} className="bento-card p-8 device-row group animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-[10px] font-black text-slate-600 uppercase font-mono">Row_Node: 00{i+1}</span>
                    {devices.length > 1 && (
                      <button 
                        onClick={() => removeDevice(i)} 
                        className="text-red-500/40 hover:text-red-500 transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"
                        title={`移除第 ${i+1} 項設備資料`}
                      >
                        <span className="material-symbols-outlined text-sm">close</span> 移除
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-2">
                      <label className="tech-label" htmlFor={`v200-dev-type-${i}`}>設備類型</label>
                      <select 
                        id={`v200-dev-type-${i}`}
                        title={`第 ${i+1} 項設備之類型選擇`}
                        value={d.type} 
                        onChange={e => { const nd = [...devices]; nd[i].type = e.target.value; setDevices(nd); }} 
                        className="crystal-input appearance-none cursor-pointer"
                      >
                        {["桌上型電腦","筆記型電腦","印表機","工作站","伺服器","其他設備"].map(v => <option key={v} value={v} className="bg-slate-900">{v}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="tech-label" htmlFor={`v200-dev-model-${i}`}>品牌型號</label>
                      <input 
                        id={`v200-dev-model-${i}`}
                        title={`第 ${i+1} 項設備品牌型號`}
                        value={d.model} 
                        onChange={e => { const nd = [...devices]; nd[i].model = e.target.value; setDevices(nd); }} 
                        className="crystal-input" 
                        placeholder="ASUS D700" 
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="tech-label" htmlFor={`v200-dev-mac-${i}`}>物理 MAC 地址 (自動對沖)</label>
                      <input 
                        id={`v200-dev-mac-${i}`}
                        title={`第 ${i+1} 項主要 MAC 位址`}
                        value={d.mac} 
                        onChange={e => handleMacInput(i, e.target.value)} 
                        className="crystal-input font-mono text-blue-400 font-bold" 
                        placeholder="000000000000" 
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="tech-label" htmlFor={`v200-dev-sn-${i}`}>產品序號 S/N</label>
                      <input 
                        id={`v200-dev-sn-${i}`}
                        title={`第 ${i+1} 項產品序列號`}
                        value={d.sn} 
                        onChange={e => { const nd = [...devices]; nd[i].sn = e.target.value.toUpperCase(); setDevices(nd); }} 
                        className="crystal-input font-mono text-red-400 font-bold" 
                        placeholder="SN-FORCE" 
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="tech-label" htmlFor={`v200-dev-name-${i}`}>設備名稱標記</label>
                      <input 
                        id={`v200-dev-name-${i}`}
                        title={`第 ${i+1} 項院內設備標記`}
                        value={d.name} 
                        onChange={e => { const nd = [...devices]; nd[i].name = e.target.value.toUpperCase(); setDevices(nd); }} 
                        className="crystal-input uppercase tracking-wider" 
                        placeholder="例如：INF-PC-01" 
                      />
                    </div>
                  </div>
                </div>
              ))}
            </section>

          </div>
        </div>
      </main>

      {/* 4. 底部提交區域 (Bento Footer) */}
      <footer className="fixed bottom-0 left-64 right-0 p-8 z-[100] flex justify-center bg-gradient-to-t from-[#f0f7ff] via-[#f0f7ff]/90 to-transparent pointer-events-none">
        <button 
          onClick={handleSubmit} 
          disabled={isLoading} 
          id="v200-submit-all"
          title="點擊以執行全量資產預約錄入程序"
          className="w-full max-w-xl py-6 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.5em] shadow-[0_20px_50px_rgba(37,99,235,0.3)] hover:bg-blue-500 active:scale-95 transition-all pointer-events-auto border-t border-white/20"
        >
          {isLoading ? "物理對沖同步中..." : "執行全量錄入對沖"}
        </button>
      </footer>

      {/* 通知元件矩陣 */}
      <div className="fixed bottom-32 right-8 z-[4000] flex flex-col gap-3">
        {toasts.map(t => (
          <div key={t.id} className={`px-6 py-4 rounded-xl shadow-2xl font-bold text-xs animate-in slide-in-from-right-4 flex items-center gap-4 border border-white/10 text-white backdrop-blur-xl ${t.type === "success" ? "bg-blue-600/90" : "bg-red-600/90"}`}>
            <span className="material-symbols-outlined text-lg">{t.type === 'success' ? 'verified' : 'report'}</span>
            <span className="tracking-wider">{t.msg}</span>
          </div>
        ))}
      </div>

      {/* 全域對沖遮罩 */}
      {isLoading && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-xl">
          <div className="w-10 h-10 border-2 border-slate-800 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
}