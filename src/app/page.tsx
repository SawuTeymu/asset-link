
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ADMIN_CREDENTIALS_LIST } from "@/lib/constants";

/**
 * ==========================================
 * 檔案：src/app/page.tsx
 * 狀態：V66.0 旗艦視覺與嚴格語法完全體
 * 物理職責：
 * 1. 視覺完全還原：100% 採用使用者指定之 Material 3 磨砂質感與背景球。
 * 2. 交互邏輯：對齊 V2.6 嚴格邏輯，包含 uid 驗證與廠商狀態過濾。
 * 3. 無障礙修復：為表單元素補齊物理 ID 關聯。
 * ==========================================
 */

// 🚀 1. 定義廠商資料庫回傳強型別 (消滅 ParserError)
interface VendorDbRow {
  廠商名稱: string;
  行政狀態: string;
}

export default function LoginPage() {
  const router = useRouter();

  // --- 狀態管理 (對稱 V2.6) ---
  const [loginType, setLoginType] = useState<"admin" | "vendor" | null>(null);
  const [adminAccount, setAdminAccount] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [vendors, setVendors] = useState<{name: string, status: string}[]>([]);
  const [selectedVendor, setSelectedVendor] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // --- 物理初始化：從 Supabase 拉取廠商清單 (對照 V2.6 邏輯) ---
  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const { data, error } = await supabase
          .from("vendors")
          .select("廠商名稱, 行政狀態")
          .eq("授權啟用開關", true)
          .order("廠商名稱", { ascending: true });

        if (error) throw error;
        
        // 🚀 雙重轉型：抹除 Supabase 的 ParserError
        const typedData = data as unknown as VendorDbRow[] | null;
        
        // 🚀 數據對映：物理校驗
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

  // --- 登入邏輯：管理者物理驗證 (使用 uid) ---
  const handleAdminLogin = () => {
    setErrorMsg("");
    if (!adminAccount.trim() || !adminPassword.trim()) {
      setErrorMsg("請輸入完整的帳號與密碼");
      return;
    }

    setIsLoading(true);
    
    // 物理驗證：精確比對 constants.ts 中的 uid
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
       setErrorMsg("⚠️ 您的帳號已被物理凍結，請聯繫資訊室。");
       return;
    }

    setIsLoading(true);
    sessionStorage.setItem("asset_link_vendor", selectedVendor);
    router.push("/keyin");
  };

  return (
    <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center p-6 font-sans text-[#191c1e] antialiased overflow-hidden">
      
      {/* 🚀 物理背景裝飾 (還原 V2.6 指定效果) */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] mix-blend-multiply"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-secondary/20 rounded-full blur-[100px] mix-blend-multiply"></div>
      </div>

      <div className="relative z-10 w-full max-w-[420px] animate-in fade-in zoom-in-95 duration-700">
        
        {/* 標題區 (還原 rotate-3) */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-primary rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-primary/20 rotate-3 transition-transform hover:rotate-0 duration-500">
            <span className="material-symbols-outlined text-white text-4xl">token</span>
          </div>
          <h1 className="text-3xl font-black tracking-tighter mb-2 text-slate-800">A-L-I-N-K</h1>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">預約裝機/IP申請系統</p>
        </div>

        {/* 登入表單區塊 (還原 bg-white/70 backdrop-blur-3xl) */}
        <div className="bg-white/70 backdrop-blur-3xl rounded-[2.5rem] p-8 shadow-2xl border border-white/50">
          
          {/* 頻道選擇按鈕 */}
          {!loginType && (
            <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
              <button 
                onClick={() => { setLoginType("vendor"); }}
                title="廠商通道"
                className="w-full p-5 rounded-2xl bg-white border-2 border-slate-100 hover:border-primary hover:bg-blue-50/50 transition-all group flex items-center gap-4 text-left shadow-sm active:scale-[0.98]"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-100 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                  <span className="material-symbols-outlined text-slate-500 group-hover:text-primary">storefront</span>
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-lg">廠商預約申請</h3>
                  <p className="text-[10px] font-bold text-slate-400">Vendor Application Portal</p>
                </div>
              </button>

              <button 
                onClick={() => { setLoginType("admin"); }}
                title="管理端入口"
                className="w-full p-5 rounded-2xl bg-white border-2 border-slate-100 hover:border-slate-900 hover:bg-slate-900 transition-all group flex items-center gap-4 text-left shadow-sm active:scale-[0.98]"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-100 group-hover:bg-white/20 flex items-center justify-center transition-colors">
                  <span className="material-symbols-outlined text-slate-500 group-hover:text-white">admin_panel_settings</span>
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-lg group-hover:text-white transition-colors">資訊室管理者</h3>
                  <p className="text-[10px] font-bold text-slate-400 group-hover:text-white/60 transition-colors">Admin Management Hub</p>
                </div>
              </button>
            </div>
          )}

          {/* 錯誤提示 (還原 animate-bounce) */}
          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 text-error rounded-2xl border border-red-100 flex items-start gap-3 animate-bounce">
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
                   title="返回身分選取"
                 >
                   <span className="material-symbols-outlined text-sm">arrow_back</span>
                 </button>
                 <h2 className="text-lg font-black text-slate-800">管理者登入</h2>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="admin-acc-v66" className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">管理帳號</label>
                  <input 
                    id="admin-acc-v66"
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
                  <label htmlFor="admin-pwd-v66" className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">管理密碼</label>
                  <input 
                    id="admin-pwd-v66"
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
                {isLoading ? <span className="material-symbols-outlined animate-spin text-sm">refresh</span> : '確認驗證並登入'}
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
                   title="返回身分選取"
                 >
                   <span className="material-symbols-outlined text-sm">arrow_back</span>
                 </button>
                 <h2 className="text-lg font-black text-slate-800">駐點廠商進入</h2>
              </div>
              <div className="space-y-2">
                <label htmlFor="vendor-sel-v66" className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">廠商名稱 (Vendor ID)</label>
                <div className="relative">
                  <select 
                    id="vendor-sel-v66"
                    value={selectedVendor}
                    onChange={(e) => { setSelectedVendor(e.target.value); }}
                    title="選擇廠商"
                    aria-label="選擇廠商"
                    className="w-full appearance-none bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-700 outline-none focus:border-primary focus:bg-white transition-all shadow-sm"
                  >
                    <option value="" disabled>請選擇您的廠商名稱...</option>
                    {vendors.map(v => (
                      <option key={v.name} value={v.name}>
                        {v.name} {v.status === '停用' || v.status === '停權' ? '(🚫 已封鎖)' : ''}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                </div>
              </div>
              <button 
                onClick={() => { handleVendorLogin(); }}
                disabled={isLoading || vendors.length === 0}
                className="w-full bg-primary text-white rounded-2xl py-4 font-black uppercase tracking-widest hover:bg-primary/90 active:scale-95 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {isLoading ? <span className="material-symbols-outlined animate-spin text-sm">refresh</span> : '進入作業區'}
              </button>
            </div>
          )}

        </div>
        <p className="text-center text-[10px] font-bold text-slate-400 mt-8 uppercase tracking-widest opacity-60">© 2026 ERI Information Tech.</p>
      </div>
    </div>
  );
}

```

