"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ADMIN_CREDENTIALS_LIST } from "@/lib/constants";

/**
 * ==========================================
 * 檔案：src/app/page.tsx
 * 狀態：V61.0 型別對沖修正版 (解決 uid/account 衝突)
 * 物理職責：
 * 1. 視覺中樞：還原 ALink 專屬三色呼吸球背景與毛玻璃卡片。
 * 2. 登入分流：針對管理者 (uid) 與廠商進行身分物理驗證。
 * 3. 🚨 錯誤修復：根據 constants 定義，將 account 修正為 uid。
 * ==========================================
 */

interface VendorDbRow {
  廠商名稱: string;
  行政狀態: string;
}

export default function LoginPage() {
  const router = useRouter();

  // --- 1. UI 與交互狀態 ---
  const [loginType, setLoginType] = useState<"admin" | "vendor" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "error" | "info" }[]>([]);

  // --- 2. 管理者登入狀態 ---
  const [adminAccount, setAdminAccount] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  // --- 3. 廠商登入狀態 ---
  const [vendors, setVendors] = useState<{name: string, status: string}[]>([]);
  const [selectedVendor, setSelectedVendor] = useState("");

  const showToast = useCallback((msg: string, type: "error" | "info" = "info") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // --- 4. 數據拉取：物理掃描廠商清單 ---
  useEffect(() => {
    async function fetchVendors() {
      try {
        const { data, error } = await supabase
          .from("vendors_list")
          .select("廠商名稱, 行政狀態")
          .order("廠商名稱");

        if (error) throw error;
        
        const mapped = (data as unknown as VendorDbRow[]).map(v => ({
          name: v.廠商名稱,
          status: v.行政狀態
        }));
        setVendors(mapped);
      } catch {
        showToast("無法對接廠商數據庫", "error");
      }
    }
    fetchVendors();
  }, [showToast]);

  // --- 5. 核心驗證邏輯 (物理對正) ---
  const handleAdminLogin = async () => {
    if (!adminAccount || !adminPassword) {
      setErrorMsg("物理權限不足：請輸入帳號密碼");
      return;
    }
    setIsLoading(true);
    
    // 🚀 修正：根據型別定義，使用 c.uid 進行比對
    const matched = ADMIN_CREDENTIALS_LIST.find(
      (c) => c.uid === adminAccount && c.password === adminPassword
    );

    if (matched) {
      sessionStorage.setItem("asset_link_admin_auth", "true");
      // 🚀 修正：物件中無 name 屬性，使用 uid 作為名稱標記
      sessionStorage.setItem("asset_link_admin_name", matched.uid);
      router.push("/admin");
    } else {
      setErrorMsg("身分對沖失敗：帳號或密碼錯誤");
      setIsLoading(false);
    }
  };

  const handleVendorLogin = () => {
    if (!selectedVendor) return;
    const vendor = vendors.find(v => v.name === selectedVendor);
    if (vendor?.status === "停用" || vendor?.status === "停權") {
      showToast("該廠商身分已被物理封鎖", "error");
      return;
    }
    setIsLoading(true);
    sessionStorage.setItem("asset_link_vendor", selectedVendor);
    router.push(`/keyin?v=${encodeURIComponent(selectedVendor)}`);
  };

  return (
    <div className="bg-[#f8fafc] min-h-screen flex items-center justify-center font-sans text-slate-900 antialiased overflow-hidden relative p-6">
      
      {/* 🚀 物理視覺守護：全域設計鎖定 */}
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

      {/* 🚀 登入卡片 (毛玻璃) */}
      <main className="w-full max-w-[480px] glass-panel rounded-[3.5rem] p-12 lg:p-16 relative z-10 animate-in fade-in zoom-in-95 duration-700">
        
        {/* Logo 與標題區 */}
        <div className="text-center mb-12">
            <h1 className="text-5xl font-black tracking-tighter bg-gradient-to-br from-blue-700 to-blue-500 bg-clip-text text-transparent neon-text">
                ALink
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] mt-3">全院資產資安對沖系統</p>
        </div>

        {/* 登入分流選擇 */}
        {!loginType ? (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <button 
              onClick={() => setLoginType("admin")}
              title="管理者登入"
              className="w-full group bg-slate-900 text-white rounded-[2rem] p-8 flex items-center justify-between hover:bg-blue-600 transition-all shadow-xl hover:shadow-blue-500/30 active:scale-95"
            >
              <div className="text-left">
                <span className="text-[10px] font-black uppercase text-blue-400 tracking-widest block mb-1">Internal Access</span>
                <span className="text-xl font-black">資訊組管理登入</span>
              </div>
              <span className="material-symbols-outlined text-3xl group-hover:translate-x-2 transition-transform">admin_panel_settings</span>
            </button>

            <button 
              onClick={() => setLoginType("vendor")}
              title="廠商填報入口"
              className="w-full group bg-white border border-slate-100 rounded-[2rem] p-8 flex items-center justify-between hover:border-blue-200 transition-all shadow-lg active:scale-95"
            >
              <div className="text-left">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">External Data</span>
                <span className="text-xl font-black text-slate-800">維護廠商錄入入口</span>
              </div>
              <span className="material-symbols-outlined text-3xl text-slate-300 group-hover:text-blue-500 transition-colors">precision_manufacturing</span>
            </button>
          </div>
        ) : (
          <div className="animate-in fade-in duration-500">
            <button 
              onClick={() => { setLoginType(null); setErrorMsg(""); }}
              className="flex items-center gap-2 text-slate-400 font-black text-xs uppercase tracking-widest mb-8 hover:text-blue-600 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span> 返回身分選取
            </button>

            {/* A. 管理者登入表單 */}
            {loginType === "admin" && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="admin-acc" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">管理者帳號 (UID)</label>
                  <input 
                    id="admin-acc"
                    title="管理帳號"
                    aria-label="管理帳號"
                    type="text" 
                    value={adminAccount} 
                    onChange={e => setAdminAccount(e.target.value)}
                    placeholder="請輸入管理帳號" 
                    className="login-input"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="admin-pwd" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">驗證密碼</label>
                  <input 
                    id="admin-pwd"
                    title="驗證密碼"
                    aria-label="驗證密碼"
                    type="password" 
                    value={adminPassword}
                    onChange={e => setAdminPassword(e.target.value)}
                    placeholder="••••••••" 
                    className="login-input"
                  />
                </div>
                {errorMsg && <p className="text-red-500 text-xs font-black text-center animate-bounce">{errorMsg}</p>}
                <button 
                  onClick={handleAdminLogin}
                  disabled={isLoading}
                  className="w-full bg-blue-600 text-white rounded-[2rem] py-5 font-black uppercase tracking-[0.3em] shadow-2xl shadow-blue-500/30 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  {isLoading ? <span className="material-symbols-outlined animate-spin">refresh</span> : '物理驗證並進入中樞'}
                </button>
              </div>
            )}

            {/* B. 廠商登入表單 */}
            {loginType === "vendor" && (
              <div className="space-y-8">
                <div className="space-y-3">
                  <label htmlFor="vendor-select" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">選取廠商身分</label>
                  <div className="relative">
                    <select 
                      id="vendor-select"
                      title="廠商名稱選取"
                      aria-label="廠商名稱選取"
                      value={selectedVendor}
                      onChange={e => setSelectedVendor(e.target.value)}
                      className="login-input appearance-none pr-12"
                    >
                      <option value="" disabled>請選擇您的廠商名稱...</option>
                      {vendors.map(v => (
                        <option key={v.name} value={v.name} disabled={v.status === '停用' || v.status === '停權'}>
                          {v.name} {v.status === '停用' || v.status === '停權' ? '(🚫 已封鎖)' : ''}
                        </option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none">expand_more</span>
                  </div>
                </div>
                <button 
                  onClick={handleVendorLogin}
                  disabled={isLoading || !selectedVendor}
                  className="w-full bg-slate-900 text-white rounded-[2rem] py-5 font-black uppercase tracking-[0.3em] shadow-xl hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-30"
                >
                  {isLoading ? <span className="material-symbols-outlined animate-spin">refresh</span> : '身分對沖並進入'}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 頁尾版權 */}
      <footer className="fixed bottom-10 text-center z-10">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] mb-1">
          Asset-Link Cyber Protection Unit
        </p>
        <p className="text-[9px] font-bold text-slate-400">
          © 2026 中國醫藥大學附設醫院 資訊室 物理對沖監製
        </p>
      </footer>

      {/* 🚀 全域強同步遮罩 */}
      {isLoading && (
        <div className="fixed inset-0 z-[3000] flex flex-col items-center justify-center bg-white/80 backdrop-blur-2xl">
          <div className="w-20 h-20 border-[8px] border-slate-100 border-t-blue-600 rounded-full animate-spin mb-8 shadow-2xl"></div>
          <p className="text-blue-600 font-black tracking-[0.8em] uppercase text-xs animate-pulse">權限矩陣物理對正中...</p>
        </div>
      )}

      {/* 🚀 通知氣泡 */}
      <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[4000] flex flex-col gap-4 pointer-events-none w-full max-w-sm px-6">
        {toasts.map(t => (
          <div key={t.id} className={`px-10 py-6 rounded-[2.5rem] shadow-2xl font-black text-xs animate-in slide-in-from-bottom-4 flex items-center gap-5 border border-white/10 text-white backdrop-blur-2xl ${t.type === "error" ? "bg-red-600/90" : "bg-slate-900/90"}`}>
            <span className="material-symbols-outlined text-2xl">{t.type === 'error' ? 'report' : 'info'}</span>
            <span className="tracking-[0.15em]">{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}