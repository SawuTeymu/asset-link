"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ADMIN_CREDENTIALS_LIST } from "@/lib/constants";

/**
 * ==========================================
 * 檔案：src/app/page.tsx
 * 狀態：V300.1 Medical M3 (無內聯樣式版)
 * 修復項目：移除 inline style，將動畫延遲移至 CSS 類別。
 * ==========================================
 */

interface VendorDbRow {
  廠商名稱: string;
  行政狀態: string;
}

export default function LoginPage() {
  const router = useRouter();
  
  const [loginType, setLoginType] = useState<"admin" | "vendor" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [adminAccount, setAdminAccount] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [vendors, setVendors] = useState<{name: string, status: string}[]>([]);
  const [selectedVendor, setSelectedVendor] = useState("");

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
        console.error("物理同步失敗:", err); 
      }
    };
    fetchVendors();
  }, []);

  const handleAdminLogin = () => {
    setErrorMsg("");
    if (!adminAccount.trim() || !adminPassword.trim()) { 
      setErrorMsg("物理權限缺失：請輸入帳號與密碼"); 
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

  const handleVendorLogin = () => {
    if (!selectedVendor) return;
    const vData = vendors.find(v => v.name === selectedVendor);
    if (vData?.status === '停權' || vData?.status === '停用') { 
      setErrorMsg("⚠️ 帳號已被物理封鎖，請聯繫管理員。"); 
      return; 
    }
    setIsLoading(true);
    sessionStorage.setItem("asset_link_vendor", selectedVendor);
    router.push("/keyin");
  };

  return (
    <div className="bg-surface text-on-surface font-body-md overflow-hidden min-h-screen flex flex-col relative antialiased">
      <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries" async></script>
      <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Inter:wght@400;600&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      
      <style dangerouslySetInnerHTML={{ __html: `
        .glass-card { backdrop-filter: blur(20px); background: rgba(255, 255, 255, 0.6); border: 1px solid rgba(255, 255, 255, 0.3); }
        .breathing-sphere { filter: blur(60px); opacity: 0.4; animation: breathe 8s infinite ease-in-out; }
        .delay-2s { animation-delay: -2s; }
        .delay-4s { animation-delay: -4s; }
        @keyframes breathe {
          0%, 100% { transform: scale(1) translate(0, 0); opacity: 0.3; }
          50% { transform: scale(1.2) translate(20px, -20px); opacity: 0.5; }
        }
      `}} />

      <div className="absolute inset-0 overflow-hidden -z-10 bg-[radial-gradient(circle_at_50%_50%,_#eaedff_0%,_#faf8ff_100%)]">
        <div className="breathing-sphere absolute top-[-10%] left-[-5%] w-[500px] h-[500px] bg-primary-fixed-dim rounded-full"></div>
        {/* 🚀 修復：使用 .delay-2s 類別取代 inline style */}
        <div className="breathing-sphere absolute bottom-[-15%] right-[-5%] w-[600px] h-[600px] bg-secondary-fixed rounded-full delay-2s"></div>
        {/* 🚀 修復：使用 .delay-4s 類別取代 inline style */}
        <div className="breathing-sphere absolute top-[20%] right-[15%] w-[300px] h-[300px] bg-tertiary-fixed-dim rounded-full delay-4s"></div>
      </div>

      <main className="flex-grow flex items-center justify-center p-6 relative z-10">
        <div className="glass-card w-full max-w-[900px] rounded-xl shadow-xl overflow-hidden flex flex-col md:flex-row min-h-[560px]">
          <div className="w-full md:w-5/12 p-10 flex flex-col justify-between bg-primary-container text-on-primary-container relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-8">
                <span className="material-symbols-outlined text-[40px]">hub</span>
                <h1 className="font-headline-md text-headline-md tracking-tight">資產聯網 Asset-Link</h1>
              </div>
              <h2 className="font-headline-sm text-headline-sm mb-4">醫療設備與資產管理一站式平台</h2>
              <p className="font-body-md text-body-md opacity-90 leading-relaxed">提供精確的資產監測、維修預約與合規管理，確保醫療服務不中斷。</p>
            </div>
            <div className="absolute inset-0 opacity-20 pointer-events-none">
              <img alt="Clinical IT" className="w-full h-full object-cover grayscale" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBUm3hItJ5QqXUWmrbdy-L2JotITHnHayPR1lHnH7VzGR4IMQGq16Nu_vuqe-DHSW79g-Xz4wIwS8_fUaWxrEYBIzpyhRR1bAgBMAcjqGImue3jmXaOUDwQzF2MBHBVQY_GAfdGtJFRM6hM3AtRr2Sk8vPBMO11fUHjzKclb0f4DisIcDj42tP-aa3JzIfWbGvLcIWdUxT0dbh_pHB9d74DombvpUJYHlso-KNTqERxTip0wBIYQ6XXvMk13J8PA21EESJO6aI4D4Q" />
            </div>
          </div>

          <div className="w-full md:w-7/12 p-10 flex flex-col justify-center bg-white/40">
            {errorMsg && (
              <div className="mb-6 p-4 bg-error-container text-error border border-error/20 rounded-lg text-label-sm font-bold flex items-center gap-3 animate-in slide-in-from-top-2">
                <span className="material-symbols-outlined text-sm">report</span> {errorMsg}
              </div>
            )}

            {!loginType ? (
              <div className="space-y-6">
                <div className="mb-10 text-center md:text-left">
                  <h3 className="font-headline-md text-headline-md text-on-surface mb-2">歡迎使用</h3>
                  <p className="text-on-surface-variant font-body-md">請選擇您的使用者類型以開始作業</p>
                </div>
                <button onClick={() => setLoginType("vendor")} className="w-full group flex items-center p-6 rounded-lg border-2 border-transparent bg-white shadow-sm hover:border-primary hover:shadow-md transition-all duration-300 text-left">
                  <div className="w-14 h-14 rounded-full bg-secondary-container flex items-center justify-center mr-6 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-on-secondary-container text-2xl">calendar_add_on</span>
                  </div>
                  <div className="flex-grow">
                    <div className="font-headline-sm text-headline-sm text-on-surface">廠商預約申請</div>
                    <div className="font-body-md text-body-md text-on-surface-variant">提交設備進場維護、展示或安裝申請</div>
                  </div>
                </button>
                <button onClick={() => setLoginType("admin")} className="w-full group flex items-center p-6 rounded-lg border-2 border-transparent bg-white shadow-sm hover:border-primary hover:shadow-md transition-all duration-300 text-left">
                  <div className="w-14 h-14 rounded-full bg-primary-fixed flex items-center justify-center mr-6 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-on-primary-fixed text-2xl">admin_panel_settings</span>
                  </div>
                  <div className="flex-grow">
                    <div className="font-headline-sm text-headline-sm text-on-surface">資訊室管理者登入</div>
                    <div className="font-body-md text-body-md text-on-surface-variant">院內人員管理介面、資產審核與系統監控</div>
                  </div>
                </button>
              </div>
            ) : (
              <div className="animate-in fade-in">
                <button onClick={() => { setLoginType(null); setErrorMsg(""); }} className="mb-6 flex items-center gap-2 text-label-sm text-outline hover:text-primary transition-colors font-bold uppercase tracking-widest">
                  <span className="material-symbols-outlined text-sm">arrow_back</span> 返回
                </button>
                {loginType === "admin" ? (
                  <div className="space-y-5">
                    <input type="text" placeholder="Administrator ID" value={adminAccount} onChange={e => setAdminAccount(e.target.value)} className="w-full border border-outline-variant rounded-lg px-4 py-3 outline-none focus:ring-1 focus:ring-primary" />
                    <input type="password" placeholder="Password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} className="w-full border border-outline-variant rounded-lg px-4 py-3 outline-none focus:ring-1 focus:ring-primary" />
                    <button onClick={handleAdminLogin} disabled={isLoading} className="w-full bg-primary text-white rounded-lg py-4 font-bold shadow-md hover:brightness-110 active:scale-95 transition-all">執行權限登入</button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <select title="廠商選單" value={selectedVendor} onChange={e => setSelectedVendor(e.target.value)} className="w-full border border-outline-variant rounded-lg px-4 py-4 outline-none focus:ring-1 focus:ring-primary cursor-pointer appearance-none bg-white">
                      <option value="" disabled>請選擇廠商名稱...</option>
                      {vendors.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                    </select>
                    <button onClick={handleVendorLogin} disabled={isLoading} className="w-full bg-primary text-white rounded-lg py-4 font-bold shadow-md hover:brightness-110 active:scale-95 transition-all">進入作業區</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="p-8 w-full flex flex-col md:flex-row items-center justify-between font-label-sm text-label-sm text-on-surface-variant/60 relative z-10">
        <div className="flex gap-6 mb-4 md:mb-0">
          <a className="hover:text-primary transition-colors" href="#">隱私權規範</a>
          <a className="hover:text-primary transition-colors" href="#">使用者服務條款</a>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-slate-200 px-2 py-1 rounded">M3.300.1-Stable</span>
          <span>© 2026 Asset-Link IT Solutions.</span>
        </div>
      </footer>
    </div>
  );
}