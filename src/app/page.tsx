"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ADMIN_CREDENTIALS_LIST } from "@/lib/constants";

/**
 * ==========================================
 * 檔案：src/app/page.tsx
 * 狀態：V2.9.1 白話專業純淨版 (UX 接地氣優化)
 * 物理職責：
 * 1. 提示詞優化：將太過火的「中樞」改回標準且順耳的「系統」，維持企業級信任感。
 * 2. 效能優化：徹底拔除 Tailwind CDN 腳本，交由全域編譯引擎接管，消滅黃字報警。
 * 3. 邏輯防護：維持 100% 嚴格語法保護與型別對沖。
 * ==========================================
 */

interface VendorDbRow {
  廠商名稱: string;
  行政狀態: string;
}

export default function LoginPage() {
  const router = useRouter();

  // --- 狀態管理 ---
  const [loginType, setLoginType] = useState<"admin" | "vendor" | null>(null);
  const [adminAccount, setAdminAccount] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [vendors, setVendors] = useState<{name: string, status: string}[]>([]);
  const [selectedVendor, setSelectedVendor] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // --- 初始化：從 Supabase 物理抓取廠商名單 ---
  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const { data, error } = await supabase
          .from("vendors")
          .select("廠商名稱, 行政狀態")
          .eq("授權啟用開關", true)
          .order("廠商名稱", { ascending: true });

        if (error) throw error;
        
        const typedData = data as unknown as VendorDbRow[] | null;
        
        const mappedData = (typedData || []).map((v) => ({
          name: String(v.廠商名稱 || ""),
          status: String(v.行政狀態 || "")
        }));
        
        setVendors(mappedData);
      } catch (err: unknown) {
        console.error("廠商名單同步失敗:", err instanceof Error ? err.message : String(err));
      }
    };
    fetchVendors();
  }, []);

  // --- 登入邏輯：多帳戶迴圈物理驗證 ---
  const handleAdminLogin = () => {
    setErrorMsg("");
    if (!adminAccount.trim() || !adminPassword.trim()) {
      setErrorMsg("驗證提示：請輸入完整的帳號與密碼。");
      return;
    }

    setIsLoading(true);
    
    const isValidAdmin = ADMIN_CREDENTIALS_LIST.some(
      (admin) => admin.uid === adminAccount && admin.password === adminPassword
    );

    if (isValidAdmin) {
      sessionStorage.setItem("asset_link_admin_auth", "true");
      router.push("/admin");
    } else {
      setErrorMsg(" 登入拒絕：帳號或密碼驗證失敗，請重新確認。");
      setIsLoading(false);
    }
  };

  // --- 登入邏輯：廠商通道 ---
  const handleVendorLogin = () => {
    setErrorMsg("");
    if (!selectedVendor) {
      setErrorMsg("驗證提示：請先選擇您的授權廠商名稱。");
      return;
    }
    const vendorData = vendors.find(v => v.name === selectedVendor);
    if (vendorData?.status === '停權' || vendorData?.status === '停用') {
       setErrorMsg(" 授權異常：此廠商帳號已暫停使用，請聯繫資訊中心確認。");
       return;
    }

    setIsLoading(true);
    sessionStorage.setItem("asset_link_vendor", selectedVendor);
    router.push("/keyin");
  };

  return (
    <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center p-6 font-[family-name:-apple-system,BlinkMacSystemFont,'SF_Pro_TC','PingFang_TC',system-ui,sans-serif] text-[#191c1e] antialiased">
      
      {/*  物理拔除了 Tailwind CDN，僅保留 Google Material Symbols 字體，確保效能與無報警 */}
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@400;700&display=swap" rel="stylesheet" />

      {/* 物理背景裝飾 */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-primary-fixed-dim/20 rounded-full blur-[120px] mix-blend-multiply"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-secondary-fixed/30 rounded-full blur-[100px] mix-blend-multiply"></div>
      </div>

      <div className="relative z-10 w-full max-w-[420px]">
        {/* 標題區 */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-primary rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-primary/20 rotate-3 transition-transform hover:rotate-0 duration-500">
            <span className="material-symbols-outlined text-white text-4xl">token</span>
          </div>
          {/*  改為最標準且順耳的「系統」 */}
          <h1 className="text-2xl font-black tracking-tight mb-2">ALink 設備裝機與網路申請系統<span className="text-primary"></span></h1>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">ASSET-LINK PORTAL</p>
        </div>

        {/* 登入表單區塊 */}
        <div className="bg-white/70 backdrop-blur-3xl rounded-[2.5rem] p-8 shadow-2xl border border-white/50">
          
          {/* 頻道選擇按鈕 */}
          {!loginType && (
            <div className="space-y-4">
              <button 
                onClick={() => { setLoginType("vendor"); }}
                className="w-full p-5 rounded-2xl bg-white border-2 border-slate-100 hover:border-primary hover:bg-blue-50/50 transition-all group flex items-center gap-4 text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-100 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                  <span className="material-symbols-outlined text-slate-500 group-hover:text-primary">storefront</span>
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-lg">合作廠商作業入口</h3>
                  <p className="text-[10px] font-bold text-slate-400 mt-1">辦理設備裝機預約與網路 IP 申請</p>
                </div>
              </button>

              <button 
                onClick={() => { setLoginType("admin"); }}
                className="w-full p-5 rounded-2xl bg-white border-2 border-slate-100 hover:border-slate-900 hover:bg-slate-900 transition-all group flex items-center gap-4 text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-100 group-hover:bg-white/20 flex items-center justify-center transition-colors">
                  <span className="material-symbols-outlined text-slate-500 group-hover:text-white">admin_panel_settings</span>
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-lg group-hover:text-white transition-colors">資訊中心管理後台</h3>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 group-hover:text-white/60 transition-colors">執行案件核定、VANS 稽核與 NSR 計價</p>
                </div>
              </button>
            </div>
          )}

          {/* 錯誤提示 */}
          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 text-error rounded-2xl border border-red-100 flex items-start gap-3 animate-bounce">
              <span className="material-symbols-outlined text-lg">error</span>
              <p className="text-[11px] font-bold leading-tight pt-0.5">{errorMsg}</p>
            </div>
          )}

          {/* 管理者登入表單 */}
          {loginType === "admin" && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 mb-6">
                 <button 
                   onClick={() => { setLoginType(null); setErrorMsg(""); setAdminPassword(""); setAdminAccount(""); }} 
                   className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-all"
                 >
                   <span className="material-symbols-outlined text-sm">arrow_back</span>
                 </button>
                 <h2 className="text-lg font-black text-slate-800">資訊中心登入</h2>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">管理員帳號 (Admin ID)</label>
                  <input 
                    type="text" 
                    title="管理帳號"
                    aria-label="管理帳號"
                    value={adminAccount}
                    onChange={(e) => { setAdminAccount(e.target.value); }}
                    placeholder="請輸入系統帳號"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-700 outline-none focus:border-slate-900 focus:bg-white transition-all placeholder:text-slate-300"
                    onKeyDown={(e) => { if (e.key === 'Enter') { handleAdminLogin(); } }}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">授權密碼 (Password)</label>
                  <input 
                    type="password" 
                    title="管理密碼"
                    aria-label="管理密碼"
                    value={adminPassword}
                    onChange={(e) => { setAdminPassword(e.target.value); }}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-700 outline-none focus:border-slate-900 focus:bg-white transition-all placeholder:text-slate-300 tracking-widest"
                    onKeyDown={(e) => { if (e.key === 'Enter') { handleAdminLogin(); } }}
                  />
                </div>
              </div>
              <button 
                onClick={() => { handleAdminLogin(); }}
                disabled={isLoading}
                className="w-full bg-slate-900 text-white rounded-2xl py-4 mt-2 font-black tracking-widest hover:bg-slate-800 active:scale-95 transition-all shadow-xl shadow-slate-900/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? <span className="material-symbols-outlined animate-spin text-sm">refresh</span> : ' 驗證並登入'}
              </button>
            </div>
          )}

          {/* 廠商登入表單 */}
          {loginType === "vendor" && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 mb-6">
                 <button 
                   onClick={() => { setLoginType(null); setErrorMsg(""); }} 
                   className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-all"
                 >
                   <span className="material-symbols-outlined text-sm">arrow_back</span>
                 </button>
                 <h2 className="text-lg font-black text-slate-800">廠商報到</h2>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">請選擇您的授權廠商 (Vendor Entity)</label>
                <div className="relative">
                  <select 
                    value={selectedVendor}
                    onChange={(e) => { setSelectedVendor(e.target.value); }}
                    title="選擇廠商"
                    aria-label="選擇廠商"
                    /*  物理修復：加入 bg-none 消滅重疊的預設箭頭，並加入 pr-12 防止文字重疊 */
                    className="w-full appearance-none bg-none pr-12 bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-700 outline-none focus:border-primary focus:bg-white transition-all"
                  >
                    <option value="" disabled>請下拉選取您的所屬單位...</option>
                    {vendors.map(v => (
                      <option key={v.name} value={v.name}>
                        {v.name} {v.status === '停用' || v.status === '停權' ? '( 授權暫停)' : ''}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                </div>
              </div>
              <button 
                onClick={() => { handleVendorLogin(); }}
                disabled={isLoading || vendors.length === 0}
                className="w-full bg-primary text-white rounded-2xl py-4 font-black tracking-widest hover:bg-primary/90 active:scale-95 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? <span className="material-symbols-outlined animate-spin text-sm">refresh</span> : ' 進入作業區'}
              </button>
            </div>
          )}

        </div>
        <p className="text-center text-[10px] font-bold text-slate-400 mt-8">© 2026 ERI Information Tech.</p>
      </div>
    </div>
  );
}