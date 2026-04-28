"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ADMIN_CREDENTIALS_LIST } from "@/lib/constants";

/**
 * ==========================================
 * 檔案：src/app/page.tsx
 * 狀態：V300.4 Light Medical M3 (明亮寬敞旗艦版)
 * 物理職責：
 * 1. 視覺優化：嚴格遵守「不要深色」，回歸明亮醫療漸層，並將容器擴展至 1200px 消除擁擠感。
 * 2. 邏輯 0 刪除：保留所有登入分流、身分驗證、廠商「停權/停用」狀態攔截。
 * 3. 物理脫離：維持內聯樣式淨空，將所有 style 轉譯為 CSS 類別，確保編譯全綠。
 * ==========================================
 */

interface VendorDbRow {
  廠商名稱: string;
  行政狀態: string;
}

export default function LoginPage() {
  const router = useRouter();
  
  // --- 1. 核心邏輯狀態 (100% 完整保留) ---
  const [loginType, setLoginType] = useState<"admin" | "vendor" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [adminAccount, setAdminAccount] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [vendors, setVendors] = useState<{name: string, status: string}[]>([]);
  const [selectedVendor, setSelectedVendor] = useState("");

  // --- 2. 初始化：廠商清單與狀態對沖 (100% 保留) ---
  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const { data } = await supabase
          .from("vendors")
          .select("廠商名稱, 行政狀態")
          .eq("授權啟用開關", true)
          .order("廠商名稱", { ascending: true });
          
        const mappedData = (data as unknown as VendorDbRow[] || []).map((v) => ({
          name: String(v.廠商名稱 || ""),
          status: String(v.行政狀態 || "")
        }));
        setVendors(mappedData);
      } catch (err) { 
        console.error("物理連線異常:", err); 
      }
    };
    fetchVendors();
  }, []);

  // --- 3. 管理端登入對沖 (100% 完整保留) ---
  const handleAdminLogin = () => {
    setErrorMsg("");
    if (!adminAccount.trim() || !adminPassword.trim()) { 
      setErrorMsg("物理權限缺失：請輸入完整帳號與密碼"); 
      return; 
    }
    setIsLoading(true);
    const matched = ADMIN_CREDENTIALS_LIST.find(a => a.uid === adminAccount && a.password === adminPassword);
    if (matched) {
      sessionStorage.setItem("asset_link_admin_auth", "true");
      sessionStorage.setItem("asset_link_admin_name", matched.uid);
      router.push("/admin");
    } else {
      setErrorMsg("🚫 驗證失敗：物理特徵不符。");
      setIsLoading(false);
    }
  };

  // --- 4. 廠商端登入對沖 (100% 完整保留) ---
  const handleVendorLogin = () => {
    if (!selectedVendor) return;
    const vData = vendors.find(v => v.name === selectedVendor);
    // 物理狀態攔截引擎
    if (vData?.status === '停權' || vData?.status === '停用') { 
      setErrorMsg("⚠️ 帳號已被物理封鎖，請聯繫系統管理員。"); 
      return; 
    }
    setIsLoading(true);
    sessionStorage.setItem("asset_link_vendor", selectedVendor);
    router.push("/keyin");
  };

  return (
    <div className="bg-[#faf8ff] text-slate-800 font-body-md overflow-hidden min-h-screen flex flex-col relative antialiased selection:bg-sky-200">
      
      {/* 🚀 M3 Tailwind 全量配置 (明亮色系) */}
      <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries" async></script>
      <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Inter:wght@400;500;600;700&family=Material+Symbols+Outlined:wght@300;400;700&display=swap" rel="stylesheet" />
      <script dangerouslySetInnerHTML={{ __html: `
        tailwind.config = {
          darkMode: "class",
          theme: {
            extend: {
              "colors": {
                "primary": "#006194",
                "on-primary": "#ffffff",
                "primary-container": "#007bb9",
                "on-primary-container": "#ffffff",
                "surface": "#faf8ff",
                "on-surface": "#131b2e",
                "surface-variant": "#dae2fd",
                "on-surface-variant": "#3f4850",
                "outline": "#707881",
                "error": "#ba1a1a",
                "error-container": "#ffdad6",
                "on-error-container": "#93000a"
              },
              "fontFamily": {
                "headline-md": ["Manrope"],
                "body-md": ["Inter"]
              }
            }
          }
        }
      `}} />

      {/* 🚀 物理樣式：明亮系毛玻璃，極大化通透感與留白 */}
      <style dangerouslySetInnerHTML={{ __html: `
        .clinical-glass {
          backdrop-filter: blur(24px);
          background: rgba(255, 255, 255, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.5);
          box-shadow: 0 25px 50px -12px rgba(2, 132, 199, 0.1);
        }
        .breathing-sphere {
          filter: blur(100px);
          opacity: 0.5;
          animation: breathe 12s infinite ease-in-out;
        }
        .delay-2s { animation-delay: -2s; }
        .delay-4s { animation-delay: -4s; }
        .icon-fill { font-variation-settings: 'FILL' 1; }
        @keyframes breathe {
          0%, 100% { transform: scale(1) translate(0, 0); opacity: 0.4; }
          50% { transform: scale(1.1) translate(40px, -40px); opacity: 0.6; }
        }
        .medical-gradient-light {
          background: radial-gradient(circle at top right, #e0f2fe 0%, #faf8ff 100%);
        }
      `}} />

      {/* --- 背景發光球體 (明亮清爽色調，推向邊緣以釋放中心空間) --- */}
      <div className="absolute inset-0 overflow-hidden -z-10 medical-gradient-light">
        <div className="breathing-sphere absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-sky-200 rounded-full"></div>
        <div className="breathing-sphere absolute bottom-[-20%] right-[-10%] w-[800px] h-[800px] bg-emerald-100 rounded-full delay-2s"></div>
        <div className="breathing-sphere absolute top-[30%] right-[20%] w-[500px] h-[500px] bg-indigo-100 rounded-full delay-4s"></div>
      </div>

      {/* --- 寬敞版主要登入畫布 --- */}
      <main className="flex-grow flex items-center justify-center p-4 sm:p-8 relative z-10">
        <div className="clinical-glass w-full max-w-[1200px] rounded-[2.5rem] overflow-hidden flex flex-col md:flex-row min-h-[650px] animate-in zoom-in-95 duration-1000">
          
          {/* --- 品牌區塊 (加大 Padding 釋放空間) --- */}
          <div className="w-full md:w-1/2 p-12 lg:p-20 flex flex-col justify-between bg-primary-container relative overflow-hidden">
            <div className="relative z-10 mt-4">
              <div className="flex items-center gap-5 mb-12">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-sky-900/20">
                   <span className="material-symbols-outlined text-primary text-4xl icon-fill">hub</span>
                </div>
                <h1 className="font-headline-md text-3xl lg:text-4xl font-black text-white tracking-tighter">資產聯網<br/>Asset-Link</h1>
              </div>
              <h2 className="text-2xl font-bold text-white mb-6 leading-tight">醫療設備維運與<br/>資產結案中樞</h2>
              <p className="text-base text-sky-100 leading-relaxed font-medium max-w-sm">
                物理對沖與資安稽核一站式平台，確保全院醫療數據鏈結之完整性與合規。
              </p>
            </div>

            <div className="relative z-10 mb-4 mt-16">
              <div className="flex items-center gap-3 mb-4">
                <span className="material-symbols-outlined text-sky-200 text-base icon-fill">verified_user</span>
                <span className="text-xs font-black text-sky-100 uppercase tracking-[0.3em]">Hospital Enterprise</span>
              </div>
              <div className="h-1.5 w-20 bg-sky-300/30 rounded-full overflow-hidden">
                <div className="h-full w-1/2 bg-white rounded-full"></div>
              </div>
            </div>

            {/* 物理裝飾背景 */}
            <div className="absolute inset-0 opacity-20 pointer-events-none mix-blend-overlay">
              <img alt="Medical IT" className="w-full h-full object-cover grayscale" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBUm3hItJ5QqXUWmrbdy-L2JotITHnHayPR1lHnH7VzGR4IMQGq16Nu_vuqe-DHSW79g-Xz4wIwS8_fUaWxrEYBIzpyhRR1bAgBMAcjqGImue3jmXaOUDwQzF2MBHBVQY_GAfdGtJFRM6hM3AtRr2Sk8vPBMO11fUHjzKclb0f4DisIcDj42tP-aa3JzIfWbGvLcIWdUxT0dbh_pHB9d74DombvpUJYHlso-KNTqERxTip0wBIYQ6XXvMk13J8PA21EESJO6aI4D4Q" />
            </div>
          </div>

          {/* --- 操作區塊 (大幅提升留白，對稱 1/2 佈局，明亮清爽) --- */}
          <div className="w-full md:w-1/2 p-12 lg:p-20 flex flex-col justify-center bg-white/40">
            
            {/* 錯誤反饋氣泡 */}
            {errorMsg && (
              <div className="mb-8 p-5 bg-red-50 text-red-600 border border-red-200 rounded-2xl text-sm font-bold flex items-center gap-4 animate-in slide-in-from-top-4 shadow-sm shadow-red-900/5">
                <span className="material-symbols-outlined text-xl icon-fill">report</span> {errorMsg}
              </div>
            )}

            {!loginType ? (
              <div className="animate-in fade-in duration-700 w-full max-w-md mx-auto">
                <div className="mb-14 text-center md:text-left">
                  <h3 className="text-4xl font-black text-sky-900 mb-4 tracking-tighter">系統登入</h3>
                  <p className="text-slate-500 text-base font-medium">請物理選取您的權限類型以開始對沖</p>
                </div>
                
                <div className="space-y-6">
                  {/* 路徑 A: 廠商端 */}
                  <button onClick={() => setLoginType("vendor")} className="w-full group flex items-center p-6 rounded-2xl border border-slate-200 bg-white/60 hover:bg-white hover:border-primary/40 hover:shadow-md transition-all duration-300 text-left shadow-sm">
                    <div className="w-16 h-16 rounded-2xl bg-sky-50 flex items-center justify-center mr-6 group-hover:scale-110 transition-transform">
                      <span className="material-symbols-outlined text-primary text-3xl icon-fill">calendar_add_on</span>
                    </div>
                    <div className="flex-grow">
                      <div className="font-bold text-xl text-slate-800 mb-1 group-hover:text-primary transition-colors">廠商預約錄入</div>
                      <div className="text-sm text-slate-500 font-medium">提交設備進場與裝機預約</div>
                    </div>
                    <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors ml-4">chevron_right</span>
                  </button>

                  {/* 路徑 B: 管理端 */}
                  <button onClick={() => setLoginType("admin")} className="w-full group flex items-center p-6 rounded-2xl border border-slate-200 bg-white/60 hover:bg-white hover:border-primary/40 hover:shadow-md transition-all duration-300 text-left shadow-sm">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mr-6 group-hover:scale-110 transition-transform">
                      <span className="material-symbols-outlined text-emerald-600 text-3xl icon-fill">admin_panel_settings</span>
                    </div>
                    <div className="flex-grow">
                      <div className="font-bold text-xl text-slate-800 mb-1 group-hover:text-primary transition-colors">資訊室管理者</div>
                      <div className="text-sm text-slate-500 font-medium">資產核定、稽核與系統日誌</div>
                    </div>
                    <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors ml-4">chevron_right</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500 w-full max-w-md mx-auto">
                <button onClick={() => { setLoginType(null); setErrorMsg(""); }} className="mb-12 flex items-center gap-2 text-sm font-black text-slate-500 hover:text-primary transition-colors uppercase tracking-widest">
                  <span className="material-symbols-outlined text-base">arrow_back</span>
                  返回選單
                </button>
                
                {loginType === "admin" ? (
                  <div className="space-y-8">
                    <div>
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-3 px-1">Administrator UID</label>
                      <input 
                        type="text" 
                        placeholder="請輸入系統管理帳號" 
                        value={adminAccount} 
                        onChange={e => setAdminAccount(e.target.value)} 
                        className="w-full bg-white/80 border border-slate-200 rounded-2xl px-6 py-5 font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-lg shadow-sm" 
                      />
                    </div>
                    <div>
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-3 px-1">Passphrase</label>
                      <input 
                        type="password" 
                        placeholder="••••••••" 
                        value={adminPassword} 
                        onChange={e => setAdminPassword(e.target.value)} 
                        className="w-full bg-white/80 border border-slate-200 rounded-2xl px-6 py-5 font-bold text-slate-800 tracking-[0.3em] placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-lg shadow-sm" 
                      />
                    </div>
                    <button 
                      onClick={handleAdminLogin} 
                      disabled={isLoading}
                      className="w-full bg-primary text-white rounded-2xl py-6 mt-6 font-black text-sm uppercase tracking-[0.3em] shadow-lg shadow-primary/30 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      {isLoading ? "驗證同步中..." : "執行權限登入"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-10">
                    <div>
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-4 px-1">Authorized Vendor Matrix</label>
                      <div className="relative">
                        <select 
                          title="廠商物理選單"
                          value={selectedVendor} 
                          onChange={e => setSelectedVendor(e.target.value)} 
                          className="w-full bg-white/80 border border-slate-200 rounded-2xl px-6 py-5 font-bold text-slate-800 appearance-none cursor-pointer focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-lg shadow-sm"
                        >
                          <option value="" disabled className="text-slate-400">請展開並選取您的廠商標記...</option>
                          {vendors.map(v => <option key={v.name} value={v.name} className="text-slate-800 py-2">{v.name}</option>)}
                        </select>
                        <span className="material-symbols-outlined absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-2xl">expand_more</span>
                      </div>
                    </div>
                    <button 
                      onClick={handleVendorLogin} 
                      disabled={isLoading || !selectedVendor}
                      className="w-full bg-emerald-600 text-white rounded-2xl py-6 font-black text-sm uppercase tracking-[0.3em] shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-30"
                    >
                      <span className="material-symbols-outlined text-xl icon-fill">verified</span>
                      進入預約作業區
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* --- 頁尾資訊 --- */}
      <footer className="px-10 py-8 w-full flex flex-col md:flex-row items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-widest relative z-10 border-t border-slate-200/50">
        <div className="flex gap-8 mb-4 md:mb-0">
          <a className="hover:text-primary transition-colors" href="#">Privacy Protocol</a>
          <a className="hover:text-primary transition-colors" href="#">Legal Compliance</a>
        </div>
        <div className="flex items-center gap-4">
          <span className="bg-white/60 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 shadow-sm">Node M3.300.4-Light</span>
          <span>© 2026 Asset-Link Medical IT.</span>
        </div>
      </footer>
    </div>
  );
}