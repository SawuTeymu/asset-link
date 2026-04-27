"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ADMIN_CREDENTIALS_LIST } from "@/lib/constants";

/**
 * ==========================================
 * 檔案：src/app/page.tsx
 * 狀態：V65.0 旗艦視覺與技術完全體 (對照 V2.6 嚴格版邏輯)
 * 物理職責：
 * 1. 視覺中樞：還原 ALink 專屬呼吸球背景、毛玻璃卡片與霓虹效果。
 * 2. 登入分流：執行管理者 (uid) 與廠商的身分物理驗證。
 * 3. 技術防護：100% 保留強型別轉型與 0 ESLint 抑制指令。
 * 4. 無障礙修復：符合 axe/forms 物理 ID 關聯規範。
 * ==========================================
 */

// 🚀 1. 定義廠商資料庫回傳強型別 (消滅 ParserError)
interface VendorDbRow {
  廠商名稱: string;
  行政狀態: string;
}

export default function LoginPage() {
  const router = useRouter();

  // --- 1. UI 與交互核心狀態 ---
  const [loginType, setLoginType] = useState<"admin" | "vendor" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "error" | "info" | "success" }[]>([]);

  // --- 2. 管理者與廠商數據狀態 ---
  const [adminAccount, setAdminAccount] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [vendors, setVendors] = useState<{name: string, status: string}[]>([]);
  const [selectedVendor, setSelectedVendor] = useState("");

  const showToast = useCallback((msg: string, type: "error" | "info" | "success" = "info") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // --- 3. 初始化：從 Supabase 物理抓取廠商名單 (對照 V2.6 邏輯) ---
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
        showToast("雲端數據庫同步異常", "error");
      }
    };
    fetchVendors();
  }, [showToast]);

  // --- 4. 登入邏輯：多帳戶迴圈物理驗證 ---
  const handleAdminLogin = () => {
    setErrorMsg("");
    if (!adminAccount.trim() || !adminPassword.trim()) {
      setErrorMsg("物理權限不足：請輸入帳號密碼");
      return;
    }

    setIsLoading(true);
    
    // 物理驗證：精確比對 constants.ts 中的 uid 欄位
    const matchedAdmin = ADMIN_CREDENTIALS_LIST.find(
      (admin) => admin.uid === adminAccount && admin.password === adminPassword
    );

    if (matchedAdmin) {
      sessionStorage.setItem("asset_link_admin_auth", "true");
      sessionStorage.setItem("asset_link_admin_name", matchedAdmin.uid);
      router.push("/admin");
    } else {
      setErrorMsg("🚫 驗證失敗：帳號或密碼錯誤。");
      setIsLoading(false);
    }
  };

  // --- 5. 登入邏輯：廠商通道 ---
  const handleVendorLogin = () => {
    setErrorMsg("");
    if (!selectedVendor) {
      setErrorMsg("請選擇您的廠商名稱");
      return;
    }
    const vendorData = vendors.find(v => v.name === selectedVendor);
    if (vendorData?.status === '停權' || vendorData?.status === '停用') {
       setErrorMsg("⚠️ 您的帳號已被物理封鎖，請聯繫資訊室。");
       showToast("廠商身分受限", "error");
       return;
    }

    setIsLoading(true);
    sessionStorage.setItem("asset_link_vendor", selectedVendor);
    router.push(`/keyin?v=${encodeURIComponent(selectedVendor)}`);
  };

  return (
    <div className="bg-[#f8fafc] min-h-screen flex items-center justify-center font-sans text-slate-900 antialiased overflow-hidden relative p-6">
      
      {/* 🚀 物理視覺還原：全域設計鎖定 */}
      <style dangerouslySetInnerHTML={{ __html: `
        .glass-panel { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(25px); border: 1px solid rgba(255, 255, 255, 0.8); box-shadow: 0 20px 50px -15px rgba(0,0,0,0.08); }
        .login-input { width: 100%; background: rgba(241, 245, 249, 0.6); border: 2px solid transparent; border-radius: 1.25rem; padding: 16px 20px; font-weight: 700; transition: all 0.3s; outline: none; }
        .login-input:focus { background: white; border-color: #2563eb; box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1); }
        .neon-text { text-shadow: 0 0 10px rgba(37, 99, 235, 0.2); }
      `}} />

      {/* 🚀 ALink 旗艦呼吸背景球 */}
      <div className="fixed z-0 blur-[120px] opacity-15 rounded-full pointer-events-none bg-blue-600 w-[700px] h-[700px] -top-64 -left-64 animate-pulse"></div>
      <div className="fixed z-0 blur-[120px] opacity-10 rounded-full pointer-events-none bg-emerald-400 w-[600px] h-[600px] bottom-0 right-0 animate-pulse delay-700"></div>
      <div className="fixed z-0 blur-[100px] opacity-10 rounded-full pointer-events-none bg-indigo-500 w-[400px] h-[400px] top-1/2 left-1/2 -translate-x-1/2 animate-bounce duration-[10s]"></div>

      {/* 🚀 登入中樞卡片 */}
      <main className="w-full max-w-[460px] glass-panel rounded-[3.5rem] p-12 lg:p-16 relative z-10 animate-in fade-in zoom-in-95 duration-700">
        
        {/* Logo 與標題 */}
        <div className="text-center mb-12">
            <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-500/20 rotate-3 hover:rotate-0 transition-transform duration-500">
                <span className="material-symbols-outlined text-white text-4xl">token</span>
            </div>
            <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-br from-blue-700 to-blue-500 bg-clip-text text-transparent neon-text">
                ALink
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] mt-3">預約裝機與 IP 申請中樞</p>
        </div>

        {/* 頻道選擇按鈕 */}
        {!loginType ? (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <button 
              onClick={() => setLoginType("vendor")}
              title="廠商預約申請入口"
              className="w-full group bg-white border border-slate-100 rounded-[2rem] p-6 flex items-center justify-between hover:border-blue-200 transition-all shadow-lg active:scale-95"
            >
              <div className="flex items-center gap-5 text-left">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                  <span className="material-symbols-outlined text-3xl">storefront</span>
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-lg">廠商預約申請</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Vendor Portal</p>
                </div>
              </div>
            </button>

            <button 
              onClick={() => setLoginType("admin")}
              title="資訊室管理者登入"
              className="w-full group bg-slate-900 text-white rounded-[2rem] p-6 flex items-center justify-between hover:bg-blue-600 transition-all shadow-xl active:scale-95"
            >
              <div className="flex items-center gap-5 text-left">
                <div className="w-14 h-14 rounded-2xl bg-white/10 text-white/50 flex items-center justify-center group-hover:bg-white group-hover:text-blue-600 transition-all">
                  <span className="material-symbols-outlined text-3xl">admin_panel_settings</span>
                </div>
                <div>
                  <h3 className="font-black text-white text-lg">資訊室管理者</h3>
                  <p className="text-[10px] font-bold text-white/40 uppercase">Management Hub</p>
                </div>
              </div>
            </button>
          </div>
        ) : (
          <div className="animate-in fade-in duration-500">
            <button 
              onClick={() => { setLoginType(null); setErrorMsg(""); setAdminPassword(""); setAdminAccount(""); }}
              className="flex items-center gap-2 text-slate-400 font-black text-xs uppercase tracking-widest mb-8 hover:text-blue-600 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span> 返回身分選取
            </button>

            {/* A. 管理者登入表單 (Axe Fix) */}
            {loginType === "admin" && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="admin-id-login" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">管理者帳號 (UID)</label>
                  <input 
                    id="admin-id-login"
                    title="管理帳號"
                    aria-label="管理帳號"
                    type="text" 
                    value={adminAccount} 
                    onChange={e => setAdminAccount(e.target.value)}
                    placeholder="請輸入帳號" 
                    className="login-input"
                    onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="admin-pwd-login" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">驗證密碼</label>
                  <input 
                    id="admin-pwd-login"
                    title="驗證密碼"
                    aria-label="驗證密碼"
                    type="password" 
                    value={adminPassword}
                    onChange={e => setAdminPassword(e.target.value)}
                    placeholder="••••••••" 
                    className="login-input"
                    onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
                  />
                </div>
                {errorMsg && <p className="text-red-500 text-xs font-black text-center animate-bounce">{errorMsg}</p>}
                <button 
                  onClick={handleAdminLogin}
                  disabled={isLoading}
                  className="w-full bg-blue-600 text-white rounded-[2rem] py-5 font-black uppercase tracking-[0.3em] shadow-2xl shadow-blue-500/30 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  {isLoading ? <span className="material-symbols-outlined animate-spin">refresh</span> : '進入行政管理中樞'}
                </button>
              </div>
            )}

            {/* B. 廠商登入表單 (Axe Fix) */}
            {loginType === "vendor" && (
              <div className="space-y-8">
                <div className="space-y-3">
                  <label htmlFor="vendor-select-login" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">選取駐點廠商</label>
                  <div className="relative">
                    <select 
                      id="vendor-select-login"
                      title="廠商名稱選取"
                      aria-label="廠商名稱選取"
                      value={selectedVendor}
                      onChange={e => setSelectedVendor(e.target.value)}
                      className="login-input appearance-none pr-12"
                    >
                      <option value="" disabled>
                        {vendors.length === 0 ? "正在物理掃描數據庫..." : "請選擇您的廠商名稱..."}
                      </option>
                      {vendors.map(v => (
                        <option key={v.name} value={v.name}>
                          {v.name} {v.status === '停用' || v.status === '停權' ? '(🚫 已停用)' : ''}
                        </option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none">expand_more</span>
                  </div>
                </div>
                {errorMsg && <p className="text-red-500 text-xs font-black text-center">{errorMsg}</p>}
                <button 
                  onClick={handleVendorLogin}
                  disabled={isLoading || vendors.length === 0}
                  className="w-full bg-slate-900 text-white rounded-[2rem] py-5 font-black uppercase tracking-[0.3em] shadow-xl hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-3"
                >
                  {isLoading ? <span className="material-symbols-outlined animate-spin">refresh</span> : '進入作業區'}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="fixed bottom-10 text-center z-10">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] mb-1">Asset-Link Cyber Protection Unit</p>
        <p className="text-[9px] font-bold text-slate-400">© 2026 中國醫藥大學附設醫院 資訊室 物理監製</p>
      </footer>

      {/* 🚀 全域強同步遮罩 */}
      {isLoading && (
        <div className="fixed inset-0 z-[3000] flex flex-col items-center justify-center bg-white/80 backdrop-blur-2xl">
          <div className="w-20 h-20 border-[8px] border-slate-100 border-t-blue-600 rounded-full animate-spin mb-8 shadow-2xl"></div>
          <p className="text-blue-600 font-black tracking-[0.8em] uppercase text-xs animate-pulse neon-text">身分權限物理對正中...</p>
        </div>
      )}

      {/* 🚀 通知氣泡 */}
      <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[4000] flex flex-col gap-4 pointer-events-none w-full max-w-sm px-6">
        {toasts.map(t => (
          <div key={t.id} className={`px-10 py-6 rounded-[2.5rem] shadow-2xl font-black text-xs animate-in slide-in-from-bottom-4 flex items-center gap-5 border border-white/10 text-white backdrop-blur-2xl ${t.type === "error" ? "bg-red-600/90" : t.type === "success" ? "bg-emerald-600/90" : "bg-slate-900/90"}`}>
            <span className="material-symbols-outlined text-2xl">{t.type === 'error' ? 'report' : t.type === 'success' ? 'verified' : 'info'}</span>
            <span className="tracking-[0.15em]">{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}