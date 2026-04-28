"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { approveAsset, rejectAsset } from "@/lib/actions/assets";

// 🚀 引入佈局
import AdminSidebar from "@/components/layout/AdminSidebar";
import TopNavbar from "@/components/layout/TopNavbar";

/**
 * ==========================================
 * 檔案：src/app/pending/page.tsx
 * 狀態：V200.0 Titanium Crystal 重設計版
 * 視覺變更：拔除過度磨砂感，改為技術模組風格卡片。
 * 物理職責：簽核對沖、物理 GUID 隨機 ID (Axe Fix)、參數補完。
 * ==========================================
 */

export default function PendingPage() {
  const router = useRouter();

  // --- 1. 數據狀態 (100% 保留) ---
  const [pendingList, setPendingList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" }[]>([]);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const fetchPending = useCallback(async () => {
    const isAuth = sessionStorage.getItem("asset_link_admin_auth");
    if (!isAuth) { router.push("/"); return; }
    setIsLoading(true);
    try {
      const { data } = await supabase.from("assets_pending").select("*").order("created_at", { ascending: false });
      setPendingList(data || []);
    } finally { setIsLoading(false); }
  }, [router]);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  const handleApprove = async (item: any) => {
    setIsProcessing(true);
    try {
      await approveAsset(item.id, item.核定ip || "", item.主要mac || "", item.產品序號 || item.sn || "");
      showToast("✅ 行政核定成功");
      fetchPending();
    } catch (err: any) { showToast("核定失敗", "error"); }
    finally { setIsProcessing(false); }
  };

  return (
    <div className="bg-[#020617] min-h-screen flex text-slate-300 antialiased overflow-x-hidden relative">
      
      <style dangerouslySetInnerHTML={{ __html: `
        .module-card { background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 1.5rem; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
        .module-card:hover { border-color: rgba(59, 130, 246, 0.3); background: rgba(15, 23, 42, 0.6); transform: scale(1.01); }
        .tech-box { background: rgba(0, 0, 0, 0.3); padding: 16px; border-radius: 1rem; border: 1px solid rgba(255, 255, 255, 0.03); }
        .status-badge { padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 900; background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2); }
      `}} />

      <AdminSidebar currentRoute="/pending" isOpen={isSidebarOpen} onLogout={() => router.push("/")} />

      <div className="flex-1 flex flex-col relative z-10">
        <TopNavbar title="ERI 待核定行政中樞" onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} />

        <main className="p-6 lg:p-8 max-w-[1600px] mx-auto w-full mt-4">
          
          <header className="flex justify-between items-end mb-10 px-4">
             <div>
                <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Pending Matrix</h1>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.4em] mt-2">Administrative Verification Pool</p>
             </div>
             <div className="text-right">
                <span className="text-6xl font-black text-blue-500 font-mono">{pendingList.length}</span>
                <span className="text-[10px] font-black text-slate-500 ml-3 uppercase">Queued</span>
             </div>
          </header>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-20">
             {pendingList.map((item, idx) => (
                 <section key={`eri-v200-${item.id}-${idx}`} className="module-card p-8 group relative overflow-hidden">
                    <div className="flex justify-between items-start mb-8">
                       <div className="space-y-4">
                          <div className="flex items-center gap-3">
                             <span className="status-badge">{item.棟別} 棟</span>
                             <span className="status-badge">{item.樓層}F</span>
                             <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{item.廠商名稱}</span>
                          </div>
                          <h2 className="text-2xl font-bold text-slate-100 tracking-tight">{item.使用單位}</h2>
                       </div>
                       <div className="text-right font-mono text-[10px] text-slate-600">REQ_DATE: {item.裝機日期}</div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                       <div className="tech-box"><span className="text-[9px] font-black text-slate-500 block mb-1">TYPE</span><p className="text-xs font-bold text-slate-300">{item.設備類型}</p></div>
                       <div className="tech-box"><span className="text-[9px] font-black text-slate-500 block mb-1">MODEL</span><p className="text-xs font-bold text-slate-300 truncate">{item.品牌型號}</p></div>
                       <div className="tech-box !border-blue-500/20"><span className="text-[9px] font-black text-blue-500 block mb-1">IP_ADDR</span><p className="text-xs font-black text-blue-400 font-mono">{item.核定ip}</p></div>
                       <div className="tech-box !border-red-500/20"><span className="text-[9px] font-black text-red-500 block mb-1">MAC_ADDR</span><p className="text-xs font-black text-red-400 font-mono truncate">{item.主要mac}</p></div>
                    </div>

                    <div className="flex items-center justify-between pt-6 border-t border-white/5">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500"><span className="material-symbols-outlined text-sm">person</span></div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase">{item.填報人 || "SYS_AUTO"}</span>
                       </div>
                       
                       <div className="flex gap-3">
                          {/* 🚀 物理隨機 ID 修復 Axe 衝突 */}
                          <button 
                            id={`rej-${idx}-${Math.random().toString(36).substr(2,4)}`}
                            onClick={() => { if(confirm("物理退件？")) rejectAsset(item.id, "資訊室退件").then(fetchPending); }}
                            className="w-12 h-12 rounded-xl bg-red-500/5 text-red-500 border border-red-500/10 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center active:scale-90"
                          >
                             <span className="material-symbols-outlined">close</span>
                          </button>
                          <button 
                            id={`app-${idx}-${Math.random().toString(36).substr(2,4)}`}
                            onClick={() => handleApprove(item)}
                            className="px-10 py-3 bg-white text-slate-950 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-blue-50 active:scale-95 transition-all flex items-center gap-3"
                          >
                             <span className="material-symbols-outlined text-sm">verified</span> 核定結案
                          </button>
                       </div>
                    </div>
                 </section>
               ))}
          </div>
        </main>
      </div>

      {(isLoading || isProcessing) && (
        <div className="fixed inset-0 z-[3000] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="w-12 h-12 border-2 border-slate-800 border-t-blue-500 rounded-full animate-spin mb-4"></div>
          <p className="text-blue-500 font-black text-[10px] uppercase tracking-[0.4em] animate-pulse">Syncing Matrix...</p>
        </div>
      )}
    </div>
  );
}