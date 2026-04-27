"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ADMIN_CREDENTIALS_LIST } from "@/lib/constants";

/**
 * ==========================================
 * 檔案：src/app/page.tsx
 * 狀態：V2.6 嚴格語法防護版 (移除冗餘 eslint-disable)
 * 物理職責：
 * 1. 執行登入分流與本地密碼驗證。
 * 2. 維持 100% 嚴格語法保護，並消除未使用之抑制指令。
 * ==========================================
 */

// 🚀 1. 定義廠商資料庫回傳強型別 (消滅 ParserError)
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
        
        // 🚀 雙重轉型：抹除 Supabase 的 ParserError，強制套用正確中文介面
        const typedData = data as unknown as VendorDbRow[] | null;
        
        // 🚀 數據對映：現在 v 具備強型別，不再觸發 TS2345
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
      setErrorMsg("請輸入完整的帳號與密碼");
      return;
    }

    setIsLoading(true);
    
    // 物理驗證：比對 constants.ts 中的帳密陣列
    const isValidAdmin = ADMIN_CREDENTIALS_LIST.some(
      (admin) => admin.uid === adminAccount && admin.password === adminPassword
    );

    if (isValidAdmin) {
      sessionStorage.setItem("asset_link_admin_auth", "true");
      router.push("/admin");
    } else {
      setErrorMsg("🚫 驗證失敗：帳號或密碼錯誤。");
      setIsLoading(false);
    }
  };

  // --- 登入邏輯：廠商通道 ---
  const handleVendorLogin = () => {
    setErrorMsg("");
    if (!selectedVendor) {
      setErrorMsg("請選擇您的廠商名稱");
      return;
    }
    const vendorData = vendors.find(v => v.name === selectedVendor);
    if (vendorData?.status === '停權' || vendorData?.status === '停用') {
       setErrorMsg("⚠️ 您的帳號已被凍結，請聯繫資訊室。");
       return;
    }

    setIsLoading(true);
    sessionStorage.setItem("asset_link_vendor", selectedVendor);
    router.push("/keyin");
  };

  return (
    <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center p-6 font-[family-name:-apple-system,BlinkMacSystemFont,'SF_Pro_TC','PingFang_TC',system-ui,sans-serif] text-[#191c1e] antialiased">
      
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
          <h1 className="text-3xl font-black tracking-tighter mb-2">A-L-I-N-K <span className="text-primary">V0.0</span></h1>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">預約裝機/IP申請系統</p>
        </div>

        {/* 登入表單區塊 */}
        <div className="bg-white/70 backdrop-blur-3xl rounded-[2.5rem] p-8 shadow-2xl border border-white/50">
          
          {/* 頻道選擇按鈕 */}
          {!loginType && (
            <div className="space-y-4">
              {/* 🚀 防護點：確保事件回傳具備大括號，消滅 unused-expressions */}
              <button 
                onClick={() => { setLoginType("vendor"); }}
                className="w-full p-5 rounded-2xl bg-white border-2 border-slate-100 hover:border-primary hover:bg-blue-50/50 transition-all group flex items-center gap-4 text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-100 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                  <span className="material-symbols-outlined text-slate-500 group-hover:text-primary">storefront</span>
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-lg">廠商預約申請入口</h3>
                  <p className="text-[10px] font-bold text-slate-400">Vendor Application Portal</p>
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
                  <h3 className="font-black text-slate-800 text-lg group-hover:text-white transition-colors">資訊室管理者登入</h3>
                  <p className="text-[10px] font-bold text-slate-400 group-hover:text-white/60 transition-colors">Admin Management Hub</p>
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
                 <h2 className="text-lg font-black text-slate-800">管理者登入</h2>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">管理帳號</label>
                  <input 
                    type="text" 
                    title="管理帳號"
                    aria-label="管理帳號"
                    value={adminAccount}
                    onChange={(e) => { setAdminAccount(e.target.value); }}
                    placeholder="請輸入帳號"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-700 outline-none focus:border-slate-900 focus:bg-white transition-all placeholder:text-slate-300"
                    onKeyDown={(e) => { if (e.key === 'Enter') { handleAdminLogin(); } }}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">管理密碼</label>
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
                className="w-full bg-slate-900 text-white rounded-2xl py-4 mt-2 font-black uppercase tracking-widest hover:bg-slate-800 active:scale-95 transition-all shadow-xl shadow-slate-900/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? <span className="material-symbols-outlined animate-spin text-sm">refresh</span> : '登入系統'}
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
                 <h2 className="text-lg font-black text-slate-800">選擇駐點廠商</h2>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">廠商名稱 (Vendor ID)</label>
                <div className="relative">
                  <select 
                    value={selectedVendor}
                    onChange={(e) => { setSelectedVendor(e.target.value); }}
                    title="選擇廠商"
                    aria-label="選擇廠商"
                    className="w-full appearance-none bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-700 outline-none focus:border-primary focus:bg-white transition-all"
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
                onClick={() => { handleVendorLogin(); }}
                disabled={isLoading || vendors.length === 0}
                className="w-full bg-primary text-white rounded-2xl py-4 font-black uppercase tracking-widest hover:bg-primary/90 active:scale-95 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? <span className="material-symbols-outlined animate-spin text-sm">refresh</span> : '進入作業區'}
              </button>
            </div>
          )}

        </div>
        <p className="text-center text-[10px] font-bold text-slate-400 mt-8">© 2026 ERI Information Tech.</p>
      </div>
    </div>
  );
}