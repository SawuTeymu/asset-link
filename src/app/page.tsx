"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ADMIN_CREDENTIALS_LIST } from "@/lib/constants";

/**
 * ==========================================
 * 檔案：src/app/page.tsx
<<<<<<< HEAD
 * 狀態：V120.0 旗艦整合完全體 (0 簡化、0 刪除)
 * 物理職責：
 * 1. 視覺中樞：還原 Material 3 磨砂質感、背景呼吸球、Neon 霓虹特效。
 * 2. 登入分流：執行管理者 (UID) 與廠商的身分物理驗證與權限對沖。
 * 3. 無障礙對正：物理修復 Axe select-name 診斷報警。
 * ==========================================
 */

=======
 * 狀態：V71.0 物理配色與邏輯終極版 (對照 V2.6 邏輯)
 * 物理職責：
 * 1. 視覺中樞：還原指定之 Material 3 磨砂質感、背景球與配色。
 * 2. 交互邏輯：鎖定 uid 驗證與授權開關物理過濾。
 * 3. 編譯守衛：確保 ES Module 標準導出，消滅 Vercel 模組錯誤。
 * ==========================================
 */

// 🚀 1. 定義廠商數據對沖強型別
>>>>>>> 343ef506a372a62943f501b890d13e8ef487d9de
interface VendorDbRow {
  廠商名稱: string;
  行政狀態: string;
}

export default function LoginPage() {
  const router = useRouter();

<<<<<<< HEAD
  // --- 1. 核心狀態矩陣 ---
  const [loginType, setLoginType] = useState<"admin" | "vendor" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
=======
  // --- 核心狀態 (對照 V2.6 物理參數) ---
  const [loginType, setLoginType] = useState<"admin" | "vendor" | null>(null);
>>>>>>> 343ef506a372a62943f501b890d13e8ef487d9de
  const [adminAccount, setAdminAccount] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [vendors, setVendors] = useState<{name: string, status: string}[]>([]);
  const [selectedVendor, setSelectedVendor] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

<<<<<<< HEAD
  // --- 2. 初始化：物理同步廠商名單 ---
=======
  // --- 2. 初始化：從 Supabase 物理同步廠商名單 (對照 V2.6 邏輯) ---
>>>>>>> 343ef506a372a62943f501b890d13e8ef487d9de
  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const { data, error } = await supabase
          .from("vendors")
          .select("廠商名稱, 行政狀態")
          .eq("授權啟用開關", true)
          .order("廠商名稱", { ascending: true });
        
        if (error) throw error;
        
<<<<<<< HEAD
        const typedData = data as unknown as VendorDbRow[] | null;
=======
        // 🚀 雙重轉型物理對正：抹除 Supabase ParserError
        const typedData = data as unknown as VendorDbRow[] | null;
        
>>>>>>> 343ef506a372a62943f501b890d13e8ef487d9de
        const mappedData = (typedData || []).map((v) => ({
          name: String(v.廠商名稱 || ""),
          status: String(v.行政狀態 || "")
        }));
        setVendors(mappedData);
<<<<<<< HEAD
      } catch (err) {
        console.error("雲端數據物理同步失敗:", err);
=======
      } catch (err: unknown) {
        console.error("廠商名單同步失敗:", err instanceof Error ? err.message : String(err));
>>>>>>> 343ef506a372a62943f501b890d13e8ef487d9de
      }
    };
    fetchVendors();
  }, []);

<<<<<<< HEAD
  // --- 3. 管理端物理簽核登入 ---
  const handleAdminLogin = () => {
    setErrorMsg("");
    if (!adminAccount.trim() || !adminPassword.trim()) {
      setErrorMsg("物理權限不足：請輸入完整的 UID 與密碼");
=======
  // --- 3. 驗證邏輯：管理者與廠商通道對沖 ---
  const handleAdminLogin = () => {
    setErrorMsg("");
    if (!adminAccount.trim() || !adminPassword.trim()) {
      setErrorMsg("物理權限不足：請輸入完整的帳號密碼");
>>>>>>> 343ef506a372a62943f501b890d13e8ef487d9de
      return;
    }
    setIsLoading(true);
    
<<<<<<< HEAD
    const matched = ADMIN_CREDENTIALS_LIST.find(
      (admin) => admin.uid === adminAccount && admin.password === adminPassword
    );

    if (matched) {
      sessionStorage.setItem("asset_link_admin_auth", "true");
      sessionStorage.setItem("asset_link_admin_name", matched.uid);
=======
    // 物理驗證：精確比對 constants.ts 中的 uid 欄位
    const isValidAdmin = ADMIN_CREDENTIALS_LIST.some(
      (admin) => admin.uid === adminAccount && admin.password === adminPassword
    );

    if (isValidAdmin) {
      sessionStorage.setItem("asset_link_admin_auth", "true");
>>>>>>> 343ef506a372a62943f501b890d13e8ef487d9de
      router.push("/admin");
    } else {
      setErrorMsg("🚫 物理驗證失敗：帳號或密碼錯誤。");
      setIsLoading(false);
    }
  };

<<<<<<< HEAD
  // --- 4. 廠商端作業區進入對沖 ---
=======
>>>>>>> 343ef506a372a62943f501b890d13e8ef487d9de
  const handleVendorLogin = () => {
    if (!selectedVendor) return;
    
    const vendorData = vendors.find(v => v.name === selectedVendor);
    // 物理狀態攔截
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
      
<<<<<<< HEAD
      {/* 🚀 ALink 旗艦級物理呼吸背景球 */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[100px] animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[130px] animate-bounce duration-[15s]"></div>
      </div>

      <div className="relative z-10 w-full max-w-[440px] animate-in fade-in zoom-in-95 duration-700">
        
        {/* 標題與標誌：還原 rotate-3 動效 */}
        <header className="text-center mb-12">
          <div className="w-24 h-24 bg-blue-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-500 shadow-blue-600/20">
            <span className="material-symbols-outlined text-white text-5xl">token</span>
          </div>
          <h1 className="text-4xl font-black tracking-tighter mb-3 text-slate-800 uppercase">A-L-I-N-K</h1>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">預約裝機 / IP 申請對沖系統</p>
        </header>

        <main className="bg-white/70 backdrop-blur-3xl rounded-[3rem] p-10 shadow-2xl border border-white/60 relative overflow-hidden">
          
          {/* 報錯訊息區域：物理動態 */}
          {errorMsg && (
            <div className="mb-8 p-5 bg-red-50 text-red-600 rounded-2xl border border-red-100 flex items-start gap-4 animate-bounce">
              <span className="material-symbols-outlined text-xl">error_outline</span>
              <p className="text-xs font-black leading-relaxed">{errorMsg}</p>
            </div>
          )}

          {!loginType ? (
            <div className="space-y-5 animate-in slide-in-from-bottom-6 duration-500">
              <button 
                onClick={() => setLoginType("vendor")} 
                id="v120-branch-vendor"
                title="進入廠商預約申請入口"
                className="w-full p-6 rounded-[1.75rem] bg-white border-2 border-slate-100 hover:border-blue-600 hover:bg-blue-50/30 transition-all group flex items-center gap-5 text-left active:scale-[0.97]"
              >
                <div className="w-14 h-14 rounded-2xl bg-slate-100 group-hover:bg-blue-600/10 flex items-center justify-center text-slate-400 group-hover:text-blue-600 transition-colors">
                  <span className="material-symbols-outlined text-3xl">storefront</span>
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-xl tracking-tight">廠商預約申請</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Vendor Application Portal</p>
=======
      {/* 🚀 指定物理視覺：還原背景裝飾球配色 */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-primary-fixed-dim/20 rounded-full blur-[120px] mix-blend-multiply"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-secondary-fixed/30 rounded-full blur-[100px] mix-blend-multiply"></div>
      </div>

      <div className="relative z-10 w-full max-w-[420px] animate-in fade-in zoom-in-95 duration-700">
        
        {/* 標題區 (還原 rotate-3) */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-primary rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-primary/20 rotate-3 transition-transform hover:rotate-0 duration-500">
            <span className="material-symbols-outlined text-white text-4xl">token</span>
          </div>
          <h1 className="text-3xl font-black tracking-tighter mb-2">A-L-I-N-K</h1>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">預約裝機/IP申請系統</p>
        </div>

        {/* 登入表單區塊 (還原 3XL 磨砂質感) */}
        <div className="bg-white/70 backdrop-blur-3xl rounded-[2.5rem] p-8 shadow-2xl border border-white/50 relative overflow-hidden">
          
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
                  <p className="text-[10px] font-bold text-slate-400">Vendor Application Portal</p>
>>>>>>> 343ef506a372a62943f501b890d13e8ef487d9de
                </div>
              </button>

              <button 
<<<<<<< HEAD
                onClick={() => setLoginType("admin")} 
                id="v120-branch-admin"
                title="進入資訊室管理者中樞"
                className="w-full p-6 rounded-[1.75rem] bg-white border-2 border-slate-100 hover:border-slate-900 hover:bg-slate-900 transition-all group flex items-center gap-5 text-left active:scale-[0.97]"
              >
                <div className="w-14 h-14 rounded-2xl bg-slate-100 group-hover:bg-white/20 flex items-center justify-center text-slate-400 group-hover:text-white transition-colors">
                  <span className="material-symbols-outlined text-3xl">admin_panel_settings</span>
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-xl tracking-tight group-hover:text-white transition-colors">資訊室管理者</h3>
                  <p className="text-[10px] font-bold text-slate-400 group-hover:text-white/60 transition-colors tracking-widest mt-0.5">Admin Management Hub</p>
                </div>
              </button>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-500">
              <button 
                onClick={() => { setLoginType(null); setErrorMsg(""); }} 
                className="flex items-center gap-2 text-slate-400 font-black text-xs uppercase tracking-widest mb-6 hover:text-blue-600 transition-colors group"
              >
                <span className="material-symbols-outlined text-sm group-hover:-translate-x-1 transition-transform">arrow_back</span> 返回
              </button>

              {loginType === "admin" ? (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4" htmlFor="adminAccountInput">管理者識別 UID</label>
                    <input id="adminAccountInput" type="text" placeholder="UID" value={adminAccount} onChange={e => setAdminAccount(e.target.value)} className="w-full bg-slate-50/50 border-2 border-slate-100 rounded-2xl px-6 py-5 font-bold text-slate-700 outline-none focus:border-slate-900 focus:bg-white transition-all shadow-inner" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4" htmlFor="adminPasswordInput">物理安全密碼</label>
                    <input id="adminPasswordInput" type="password" placeholder="••••••••" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} className="w-full bg-slate-50/50 border-2 border-slate-100 rounded-2xl px-6 py-5 font-bold text-slate-700 outline-none focus:border-slate-900 focus:bg-white transition-all tracking-widest shadow-inner" />
                  </div>
                  <button onClick={handleAdminLogin} className="w-full bg-slate-900 text-white rounded-[1.5rem] py-5 mt-4 font-black uppercase tracking-[0.3em] hover:bg-slate-800 active:scale-95 shadow-xl shadow-slate-900/20 transition-all text-xs">執行身分對沖登入</button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4" htmlFor="vendorSelectInput">選取作業廠商名稱</label>
                    <div className="relative">
                      {/* 🚀 物理修正 Axe：補齊 ID 與 Title 以消滅報警 */}
                      <select 
                        id="vendorSelectInput" 
                        title="請選擇您的廠商名稱以進行錄入作業"
                        value={selectedVendor} 
                        onChange={e => setSelectedVendor(e.target.value)} 
                        className="w-full appearance-none bg-slate-50/50 border-2 border-slate-100 rounded-2xl px-6 py-5 font-black text-slate-700 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-inner cursor-pointer"
                      >
                        <option value="" disabled>請選擇您的廠商名稱...</option>
                        {vendors.map(v => (
                          <option key={v.name} value={v.name}>
                            {v.name} {v.status === '停用' ? '(🚫 已物理停用)' : ''}
                          </option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-blue-600 transition-colors">expand_more</span>
                    </div>
                  </div>
                  <button 
                    onClick={handleVendorLogin} 
                    className="w-full bg-blue-600 text-white rounded-[1.5rem] py-5 font-black uppercase tracking-[0.3em] hover:bg-blue-700 active:scale-95 shadow-xl shadow-blue-600/30 transition-all text-xs flex items-center justify-center gap-4 group"
                  >
                    <span className="material-symbols-outlined text-xl group-hover:rotate-12 transition-transform">verified_user</span>
                    進入作業區對正
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
        
        <footer className="text-center mt-12 opacity-30">
          <p className="text-[9px] font-black uppercase tracking-[0.5em] text-slate-400">Ver 120.0 Flagship Sync Enterprise</p>
        </footer>
      </div>

      {/* --- 全域同步強遮罩 --- */}
      {isLoading && (
        <div className="fixed inset-0 z-[5000] flex flex-col items-center justify-center bg-white/80 backdrop-blur-3xl">
          <div className="w-20 h-20 border-[8px] border-slate-100 border-t-blue-600 rounded-full animate-spin mb-8 shadow-2xl"></div>
          <p className="text-blue-600 font-black tracking-[1em] uppercase text-[10px] animate-pulse">身分物理對沖中...</p>
=======
                onClick={() => setLoginType("admin")}
                className="w-full p-5 rounded-2xl bg-white border-2 border-slate-100 hover:border-slate-900 hover:bg-slate-900 transition-all group flex items-center gap-4 text-left active:scale-[0.98]"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-100 group-hover:bg-white/20 flex items-center justify-center transition-colors">
                  <span className="material-symbols-outlined text-slate-500 group-hover:text-white">admin_panel_settings</span>
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-lg group-hover:text-white transition-colors">資訊室管理者登入</h3>
                  <p className="text-[10px] font-bold text-slate-400 group-hover:text-white/60 transition-colors">Admin Management Hub</p>
                </div>
              </button>
            </div>
          )}

          {/* 錯誤反饋 (還原 animate-bounce) */}
          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 flex items-start gap-3 animate-bounce">
              <span className="material-symbols-outlined text-lg">error</span>
              <p className="text-[11px] font-bold leading-tight pt-0.5">{errorMsg}</p>
            </div>
          )}

          {/* 管理者登入表單 (Axe 修復) */}
          {loginType === "admin" && (
            <div className="space-y-5 animate-in fade-in duration-500">
              <div className="flex items-center gap-3 mb-6">
                 <button 
                   onClick={() => { setLoginType(null); setErrorMsg(""); setAdminPassword(""); setAdminAccount(""); }} 
                   className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-all"
                   title="返回"
                 >
                   <span className="material-symbols-outlined text-sm">arrow_back</span>
                 </button>
                 <h2 className="text-lg font-black text-slate-800">管理者登入</h2>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="admin-id-login-v71" className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">管理帳號</label>
                  <input 
                    id="admin-id-login-v71"
                    type="text" 
                    title="管理帳號"
                    value={adminAccount}
                    onChange={(e) => setAdminAccount(e.target.value)}
                    placeholder="請輸入帳號"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-700 outline-none focus:border-slate-900 focus:bg-white transition-all placeholder:text-slate-300"
                    onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="admin-pwd-login-v71" className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">管理密碼</label>
                  <input 
                    id="admin-pwd-login-v71"
                    type="password" 
                    title="管理密碼"
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
                className="w-full bg-slate-900 text-white rounded-2xl py-4 mt-2 font-black uppercase tracking-widest hover:bg-slate-800 active:scale-95 transition-all shadow-xl shadow-slate-900/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? <span className="material-symbols-outlined animate-spin text-sm">refresh</span> : '登入系統'}
              </button>
            </div>
          )}

          {/* 廠商登入表單 (Axe 修復) */}
          {loginType === "vendor" && (
            <div className="space-y-5 animate-in fade-in duration-500">
              <div className="flex items-center gap-3 mb-6">
                 <button 
                   onClick={() => { setLoginType(null); setErrorMsg(""); }} 
                   className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-all"
                   title="返回"
                 >
                   <span className="material-symbols-outlined text-sm">arrow_back</span>
                 </button>
                 <h2 className="text-lg font-black text-slate-800">選擇駐點廠商</h2>
              </div>
              <div className="space-y-2">
                <label htmlFor="vendor-select-login-v71" className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">廠商名稱 (Vendor ID)</label>
                <div className="relative">
                  <select 
                    id="vendor-select-login-v71"
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
                className="w-full bg-primary text-white rounded-2xl py-4 font-black uppercase tracking-widest hover:bg-primary/90 active:scale-95 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {isLoading ? <span className="material-symbols-outlined animate-spin text-sm">refresh</span> : '進入作業區'}
              </button>
            </div>
          )}

        </div>
        <footer className="text-center mt-12">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] opacity-60">Asset-Link Cyber Protection</p>
            <p className="text-[9px] font-bold text-slate-300 mt-1 tracking-widest">© 2026 ERI Information Technology Team.</p>
        </footer>
      </div>

      {/* 🚀 全域強同步遮罩 */}
      {isLoading && (
        <div className="fixed inset-0 z-[3000] flex flex-col items-center justify-center bg-white/80 backdrop-blur-2xl">
          <div className="w-16 h-16 border-[6px] border-slate-100 border-t-primary rounded-full animate-spin mb-8 shadow-2xl"></div>
          <p className="text-primary font-black tracking-[0.8em] uppercase text-xs animate-pulse">權限矩陣對沖中...</p>
>>>>>>> 343ef506a372a62943f501b890d13e8ef487d9de
        </div>
      )}
    </div>
  );
}

