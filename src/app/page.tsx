"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ADMIN_CREDENTIALS_LIST } from "@/lib/constants";

/**
 * ==========================================
 * 檔案：src/app/page.tsx
 * 狀態：V200.0 Titanium Crystal 重設計版
 * 視覺變更：拔除呼吸球，導入高熵深色網格。
 * 物理職責：登入分流、管理者 UID 驗證、廠商物理攔截。
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
        const { data } = await supabase.from("vendors").select("廠商名稱, 行政狀態").eq("授權啟用開關", true).order("廠商名稱", { ascending: true });
        const mappedData = (data as unknown as VendorDbRow[] || []).map((v) => ({
          name: String(v.廠商名稱 || ""),
          status: String(v.行政狀態 || "")
        }));
        setVendors(mappedData);
      } catch (err) { console.error("物理同步失敗:", err); }
    };
    fetchVendors();
  }, []);

  const handleAdminLogin = () => {
    setErrorMsg("");
    if (!adminAccount.trim() || !adminPassword.trim()) { setErrorMsg("物理權限缺失：請輸入帳密"); return; }
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
    if (vData?.status === '停權' || vData?.status === '停用') { setErrorMsg("⚠️ 帳號已被物理封鎖。"); return; }
    setIsLoading(true);
    sessionStorage.setItem("asset_link_vendor", selectedVendor);
    router.push("/keyin");
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 font-sans text-slate-300 antialiased overflow-hidden relative">
      
      {/* 🚀 拔除呼吸球，改用靜態高質感 Mesh */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(30,41,59,0.5),rgba(2,6,23,1))]"></div>
        <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.1),transparent_50%)]"></div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .login-card { background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); backdrop-filter: blur(24px); box-shadow: 0 50px 100px -20px rgba(0,0,0,0.5); }
        .crystal-input { background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 0.75rem; padding: 16px 20px; color: white; transition: all 0.3s; }
        .crystal-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1); outline: none; }
        .btn-titanium { background: linear-gradient(to bottom, #1e293b, #0f172a); border: 1px solid rgba(255,255,255,0.1); transition: all 0.3s; }
        .btn-titanium:hover { border-color: #3b82f6; color: white; transform: translateY(-2px); }
        .btn-blue { background: linear-gradient(135deg, #3b82f6, #2563eb); border-top: 1px solid rgba(255,255,255,0.3); }
      `}} />

      <div className="relative z-10 w-full max-w-[440px] animate-in fade-in zoom-in-95 duration-1000">
        <header className="text-center mb-12">
          <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-[0_0_40px_rgba(37,99,235,0.3)]">
            <span className="material-symbols-outlined text-white text-4xl">security</span>
          </div>
          <h1 className="text-4xl font-black tracking-[0.2em] text-white">ALINK</h1>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em] mt-3">Advanced Asset Node Linker</p>
        </header>

        <main className="login-card rounded-[2.5rem] p-10 relative overflow-hidden">
          {errorMsg && (
            <div className="mb-8 p-4 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-[11px] font-bold flex items-center gap-3 animate-in slide-in-from-top-2">
              <span className="material-symbols-outlined text-sm">report</span> {errorMsg}
            </div>
          )}

          {!loginType ? (
            <div className="space-y-4">
              <button onClick={() => setLoginType("vendor")} className="w-full p-6 rounded-2xl btn-titanium flex items-center gap-5 text-left group">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform"><span className="material-symbols-outlined">storefront</span></div>
                <div><h3 className="font-bold text-slate-100">廠商申請端</h3><p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Vendor Entry</p></div>
              </button>
              <button onClick={() => setLoginType("admin")} className="w-full p-6 rounded-2xl btn-titanium flex items-center gap-5 text-left group">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform"><span className="material-symbols-outlined">admin_panel_settings</span></div>
                <div><h3 className="font-bold text-slate-100">行政管理端</h3><p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Administrator</p></div>
              </button>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in">
              <button onClick={() => { setLoginType(null); setErrorMsg(""); }} className="flex items-center gap-2 text-slate-500 text-[10px] font-black uppercase hover:text-white transition-colors"><span className="material-symbols-outlined text-sm">arrow_back</span> Back</button>
              
              {loginType === "admin" ? (
                <div className="space-y-4">
                  <input id="v200-uid" type="text" placeholder="UID" value={adminAccount} onChange={e => setAdminAccount(e.target.value)} className="crystal-input w-full" />
                  <input id="v200-pwd" type="password" placeholder="PASSWORD" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} className="crystal-input w-full tracking-widest" />
                  <button onClick={handleAdminLogin} className="w-full btn-blue text-white rounded-xl py-4 mt-2 font-black text-xs uppercase tracking-[0.3em] shadow-xl shadow-blue-950/50 active:scale-95 transition-all">執行權限對沖</button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="relative">
                    <select 
                      id="v200-vendor-sel" 
                      title="Select Vendor"
                      value={selectedVendor} 
                      onChange={e => setSelectedVendor(e.target.value)} 
                      className="crystal-input w-full appearance-none cursor-pointer"
                    >
                      <option value="" disabled>請選擇廠商名稱...</option>
                      {vendors.map(v => <option key={v.name} value={v.name} className="bg-slate-900">{v.name}</option>)}
                    </select>
                    <span className="material-symbols-outlined absolute right-5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none">expand_more</span>
                  </div>
                  <button onClick={handleVendorLogin} className="w-full btn-blue text-white rounded-xl py-4 font-black text-xs uppercase tracking-[0.3em] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3">
                    <span className="material-symbols-outlined text-sm">verified</span> 進入作業區
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}