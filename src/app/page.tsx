```react
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ADMIN_CREDENTIALS_LIST } from "@/lib/constants";

/**
 * ==========================================
 * 檔案：src/app/page.tsx
 * 狀態：V70.0 旗艦重構完全體
 * 物理職責：
 * 1. 視覺中樞：100% 還原 Material 3 磨砂質感與背景渲染球。
 * 2. 登入分流：執行管理者 (uid) 與廠商的身分物理驗證。
 * 3. 重構優化：模組化元件拆分，提升維護對沖效率。
 * ==========================================
 */

// 🚀 1. 定義數據介面
interface VendorDbRow {
  廠商名稱: string;
  行政狀態: string;
}

interface VendorDisplay {
  name: string;
  status: string;
}

export default function LoginPage() {
  const router = useRouter();

  // --- 核心狀態矩陣 ---
  const [loginType, setLoginType] = useState<"admin" | "vendor" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [vendors, setVendors] = useState<VendorDisplay[]>([]);
  
  // 表單輸入狀態
  const [adminAccount, setAdminAccount] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [selectedVendor, setSelectedVendor] = useState("");

  // --- 2. 數據拉取：物理對接廠商清單 ---
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
        console.error("物理同步失敗:", err instanceof Error ? err.message : String(err));
      }
    };
    fetchVendors();
  }, []);

  // --- 3. 驗證邏輯矩陣 ---
  const handleAdminLogin = () => {
    setErrorMsg("");
    if (!adminAccount.trim() || !adminPassword.trim()) {
      setErrorMsg("請輸入完整的帳號與密碼");
      return;
    }
    setIsLoading(true);
    const matched = ADMIN_CREDENTIALS_LIST.find(
      (admin) => admin.uid === adminAccount && admin.password === adminPassword
    );
    if (matched) {
      sessionStorage.setItem("asset_link_admin_auth", "true");
      router.push("/admin");
    } else {
      setErrorMsg("🚫 驗證失敗：帳號或密碼錯誤。");
      setIsLoading(false);
    }
  };

  const handleVendorLogin = () => {
    setErrorMsg("");
    if (!selectedVendor) {
      setErrorMsg("請選擇您的廠商名稱");
      return;
    }
    const vendorData = vendors.find(v => v.name === selectedVendor);
    if (vendorData?.status === '停權' || vendorData?.status === '停用') {
       setErrorMsg("⚠️ 您的帳號已被物理凍結，請聯繫資訊室。");
       return;
    }
    setIsLoading(true);
    sessionStorage.setItem("asset_link_vendor", selectedVendor);
    router.push("/keyin");
  };

  return (
    <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center p-6 font-sans text-[#191c1e] antialiased overflow-hidden relative">
      
      {/* 🚀 ALink 旗艦背景對沖：物理裝飾球 */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-primary-fixed-dim/20 rounded-full blur-[120px] mix-blend-multiply animate-pulse"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-secondary-fixed/30 rounded-full blur-[100px] mix-blend-multiply animate-pulse delay-1000"></div>
      </div>

      <div className="relative z-10 w-full max-w-[420px] animate-in fade-in zoom-in-95 duration-700">
        
        {/* 標題中樞 */}
        <header className="text-center mb-10">
          <div className="w-20 h-20 bg-primary rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-primary/20 rotate-3 transition-transform hover:rotate-0 duration-500">
            <span className="material-symbols-outlined text-white text-4xl">token</span>
          </div>
          <h1 className="text-3xl font-black tracking-tighter mb-2 text-slate-800">A-L-I-N-K</h1>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">預約裝機/IP申請系統</p>
        </header>

        {/* 核心登入卡片 (3XL 極限毛玻璃) */}
        <main className="bg-white/70 backdrop-blur-3xl rounded-[2.5rem] p-8 shadow-2xl border border-white/50 relative overflow-hidden">
          
          {/* 錯誤反饋氣泡 */}
          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 flex items-start gap-3 animate-bounce">
              <span className="material-symbols-outlined text-lg">error</span>
              <p className="text-[11px] font-bold leading-tight pt-0.5">{errorMsg}</p>
            </div>
          )}

          {/* 分流渲染引擎 */}
          {!loginType && (
            <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
              <button 
                onClick={() => setLoginType("vendor")}
                className="w-full p-5 rounded-2xl bg-white border-2 border-slate-100 hover:border-primary hover:bg-blue-50/50 transition-all group flex items-center gap-4 text-left active:scale-[0.98]"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-100 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                  <span className="material-symbols-outlined text-slate-500 group-hover:text-primary">storefront</span>
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-lg">廠商預約申請</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Vendor Application Portal</p>
                </div>
              </button>

              <button 
                onClick={() => setLoginType("admin")}
                className="w-full p-5 rounded-2xl bg-white border-2 border-slate-100 hover:border-slate-900 hover:bg-slate-900 transition-all group flex items-center gap-4 text-left active:scale-[0.98]"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-100 group-hover:bg-white/20 flex items-center justify-center transition-colors">
                  <span className="material-symbols-outlined text-slate-500 group-hover:text-white">admin_panel_settings</span>
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-lg group-hover:text-white transition-colors">資訊室管理者登入</h3>
                  <p className="text-[10px] font-bold text-slate-400 group-hover:text-white/60 transition-colors tracking-tighter">Admin Management Hub</p>
                </div>
              </button>
            </div>
          )}

          {/* A. 管理者登入區塊 (Axe 物理修復) */}
          {loginType === "admin" && (
            <div className="space-y-5 animate-in fade-in duration-500">
              <div className="flex items-center gap-3 mb-6">
                 <button 
                   onClick={() => { setLoginType(null); setErrorMsg(""); setAdminPassword(""); setAdminAccount(""); }} 
                   className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-all"
                   title="返回身分選取"
                 >
                   <span className="material-symbols-outlined text-sm font-black">arrow_back</span>
                 </button>
                 <h2 className="text-lg font-black text-slate-800 tracking-tight">管理者驗證中樞</h2>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="admin-acc-ref" className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">物理帳號 (UID)</label>
                  <input 
                    id="admin-acc-ref"
                    type="text" 
                    title="輸入管理帳號"
                    value={adminAccount}
                    onChange={(e) => setAdminAccount(e.target.value)}
                    placeholder="請輸入 UID"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-700 outline-none focus:border-slate-900 focus:bg-white transition-all placeholder:text-slate-300"
                    onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="admin-pwd-ref" className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">安全性密碼</label>
                  <input 
                    id="admin-pwd-ref"
                    type="password" 
                    title="輸入管理密碼"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-700 outline-none focus:border-slate-900 focus:bg-white transition-all placeholder:text-slate-300 tracking-widest"
                    onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                  />
                </div>
              </div>
              <button 
                onClick={handleAdminLogin}
                disabled={isLoading}
                className="w-full bg-slate-900 text-white rounded-2xl py-5 mt-2 font-black uppercase tracking-widest hover:bg-slate-800 active:scale-95 transition-all shadow-xl shadow-slate-900/20 disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {isLoading ? <span className="material-symbols-outlined animate-spin text-sm">refresh</span> : '物理驗證並登入'}
              </button>
            </div>
          )}

          {/* B. 廠商登入區塊 (Axe 物理修復) */}
          {loginType === "vendor" && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="flex items-center gap-3 mb-6">
                 <button 
                   onClick={() => { setLoginType(null); setErrorMsg(""); }} 
                   className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-all"
                   title="返回身分選取"
                 >
                   <span className="material-symbols-outlined text-sm font-black">arrow_back</span>
                 </button>
                 <h2 className="text-lg font-black text-slate-800 tracking-tight">選擇駐點廠商</h2>
              </div>
              <div className="space-y-2">
                <label htmlFor="vendor-sel-ref" className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">廠商對應名稱 (Vendor ID)</label>
                <div className="relative">
                  <select 
                    id="vendor-sel-ref"
                    value={selectedVendor}
                    onChange={(e) => setSelectedVendor(e.target.value)}
                    title="選擇廠商"
                    className="w-full appearance-none bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-700 outline-none focus:border-primary focus:bg-white transition-all shadow-sm"
                  >
                    <option value="" disabled>請選擇您的廠商名稱...</option>
                    {vendors.map(v => (
                      <option key={v.name} value={v.name}>
                        {v.name} {v.status === '停用' || v.status === '停權' ? '(🚫 已停用)' : ''}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                </div>
              </div>
              <button 
                onClick={handleVendorLogin}
                disabled={isLoading || vendors.length === 0}
                className="w-full bg-primary text-white rounded-2xl py-5 font-black uppercase tracking-widest hover:bg-primary/90 active:scale-95 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {isLoading ? <span className="material-symbols-outlined animate-spin text-sm">refresh</span> : '進入廠商作業區'}
              </button>
            </div>
          )}

        </main>
        
        {/* 頁尾版權 */}
        <footer className="text-center mt-12 space-y-2">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] opacity-60">Asset-Link Cyber Protection</p>
          <p className="text-[9px] font-bold text-slate-400 tracking-widest">© 2026 ERI Information Technology Team.</p>
        </footer>
      </div>

      {/* 🚀 全域強同步遮罩 */}
      {isLoading && (
        <div className="fixed inset-0 z-[3000] flex flex-col items-center justify-center bg-white/80 backdrop-blur-2xl">
          <div className="w-16 h-16 border-[6px] border-slate-100 border-t-primary rounded-full animate-spin mb-8 shadow-2xl"></div>
          <p className="text-primary font-black tracking-[0.8em] uppercase text-xs animate-pulse">權限對沖同步中...</p>
        </div>
      )}
    </div>
  );
}

```
