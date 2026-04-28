"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { approveAsset, rejectAsset } from "@/lib/actions/assets";

// 🚀 引入旗艦級佈局組件
import AdminSidebar from "@/components/layout/AdminSidebar";
import TopNavbar from "@/components/layout/TopNavbar";

/**
 * ==========================================
 * 檔案：src/app/pending/page.tsx
 * 狀態：V122.0 旗艦編譯守護版 (解決 Axe 報警)
 * 物理職責：
 * 1. 行政簽核：執行 ERI 核定對沖，傳遞完整 4 個引數 (id, ip, mac, sn)。
 * 2. 視覺守護：鎖定 3XL 毛玻璃、三色背景呼吸球、Neon 霓虹特效。
 * 3. 無障礙對正：採用隨機雜湊 Unique ID 徹底解決 Duplicate ID 碰撞。
 * ==========================================
 */

export default function PendingPage() {
  const router = useRouter();

  // --- 1. 核心數據與 UI 狀態矩陣 (100% 寫回) ---
  const [pendingList, setPendingList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loaderText, setLoaderText] = useState("行政對沖同步中...");
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" }[]>([]);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // --- 2. 初始化：物理拉取數據 (0 簡化) ---
  const fetchPending = useCallback(async () => {
    const isAuth = sessionStorage.getItem("asset_link_admin_auth");
    if (!isAuth) { router.push("/"); return; }
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from("assets_pending").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setPendingList(data || []);
    } catch {
      showToast("雲端對沖同步異常", "error");
    } finally { setIsLoading(false); }
  }, [router, showToast]);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  // --- 3. 物理簽核對沖邏輯 (Fix TS2554) ---
  const handleApprove = async (item: any) => {
    setIsProcessing(true);
    setLoaderText("執行行政核定對沖...");
    try {
      // 🚀 物理編譯修正：傳入完整 4 個引數 (id, ip, mac, sn)
      await approveAsset(
        item.id, 
        item.核定ip || "", 
        item.主要mac || "", 
        item.產品序號 || item.sn || ""
      );
      showToast("✅ 行政核定成功，資產已寫入歸檔庫");
      fetchPending();
    } catch (err: any) {
      showToast(err.message || "核定失敗：技術參數對正異常", "error");
    } finally { setIsProcessing(false); }
  };

  const handleReject = async (item: any) => {
    if (!confirm("物理警告：確定要退回此單？")) return;
    setIsProcessing(true);
    try {
      await rejectAsset(item.id, "資訊室行政物理退回");
      showToast("🚫 案件已退回", "error");
      fetchPending();
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="bg-[#f8fafc] min-h-screen flex text-slate-900 font-sans antialiased overflow-x-hidden relative">
      <style dangerouslySetInnerHTML={{ __html: `
        .glass-panel { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(30px); border: 1px solid rgba(255, 255, 255, 0.8); box-shadow: 0 15px 50px -15px rgba(0,0,0,0.05); }
        .pending-card { transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); border: 2px solid transparent; }
        .pending-card:hover { transform: translateY(-12px); background: white; border-color: #2563eb; }
        .metadata-badge { background: rgba(241, 245, 249, 0.8); padding: 6px 14px; border-radius: 12px; font-size: 11px; font-weight: 900; color: #64748b; text-transform: uppercase; }
        .tech-box { background: rgba(248, 250, 252, 0.6); padding: 18px; border-radius: 2rem; border: 1px solid #edf2f7; transition: all 0.3s; }
        .neon-text { text-shadow: 0 0 15px rgba(37, 99, 235, 0.2); }
      `}} />

      {/* 🚀 背景渲染 */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[900px] h-[900px] bg-blue-600 rounded-full blur-[130px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[800px] h-[800px] bg-emerald-500 rounded-full blur-[130px] animate-pulse delay-700"></div>
      </div>

      <AdminSidebar currentRoute="/pending" isOpen={isSidebarOpen} onLogout={() => router.push("/")} />

      <div className="flex-1 flex flex-col relative z-10">
        <TopNavbar title="ERI 資產行政核定中樞" onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} />

        <main className="p-6 lg:p-12 max-w-[1600px] mx-auto w-full mt-6">
          <header className="glass-panel p-12 rounded-[3.5rem] border border-white flex justify-between items-end mb-12 animate-in fade-in duration-700">
             <div><h1 className="text-4xl font-black text-slate-800 tracking-tighter neon-text uppercase">待核定資產矩陣</h1></div>
             <div className="text-right flex items-center gap-5">
                <span className="text-8xl font-black text-blue-600 tracking-tighter">{pendingList.length}</span>
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">案待核定</span>
             </div>
          </header>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 pb-20">
             {pendingList.map((item, idx) => (
                 <section key={`eri-v122-card-${item.id}-${idx}`} className="glass-panel p-10 rounded-[4rem] pending-card group relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-2.5 h-full bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex justify-between items-start mb-10">
                       <div className="space-y-4">
                          <div className="flex gap-2">
                             <span className="metadata-badge text-blue-600 bg-blue-50">{item.棟別} 棟</span>
                             <span className="metadata-badge">{item.樓層}F</span>
                             <span className="metadata-badge">{item.廠商名稱}</span>
                          </div>
                          <h2 className="text-3xl font-black text-slate-800 tracking-tight">{item.使用單位}</h2>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
                       <div className="tech-box"><span className="text-[9px] font-black text-slate-400 uppercase">類型</span><p className="font-bold text-[13px] text-slate-700 truncate">{item.設備類型}</p></div>
                       <div className="tech-box"><span className="text-[9px] font-black text-slate-400 uppercase">型號</span><p className="font-bold text-[13px] text-slate-700 truncate">{item.品牌型號}</p></div>
                       <div className="tech-box !border-blue-100 bg-blue-50/30"><span className="text-[9px] font-black text-blue-600 uppercase">IP</span><p className="font-black text-[14px] text-blue-600 font-mono tracking-tight">{item.核定ip}</p></div>
                       <div className="tech-box !border-red-100 bg-red-50/30"><span className="text-[9px] font-black text-red-500 uppercase">MAC</span><p className="font-black text-[12px] text-red-500 font-mono truncate">{item.主要mac}</p></div>
                    </div>

                    <div className="flex items-center justify-between pt-8 border-t border-slate-100">
                       <span className="text-xs font-black text-slate-400">填報人：{item.填報人 || "系統對正"}</span>
                       <div className="flex gap-4">
                          {/* 🚀 物理 GUID 隨機對沖解決 Axe Duplicate ID */}
                          <button 
                            id={`eri-rej-v122-${idx}-${Math.random().toString(36).substr(2, 5)}`}
                            title={`退回單號 ${item.id}`}
                            onClick={() => handleReject(item)}
                            className="w-16 h-16 rounded-3xl bg-white border border-red-100 text-red-300 hover:text-red-600 flex items-center justify-center active:scale-90 shadow-sm"
                          >
                             <span className="material-symbols-outlined text-3xl">close</span>
                          </button>
                          <button 
                            id={`eri-app-v122-${idx}-${Math.random().toString(36).substr(2, 5)}`}
                            title={`核定單號 ${item.id}`}
                            onClick={() => handleApprove(item)}
                            className="px-14 py-5 bg-blue-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center gap-4"
                          >
                             <span className="material-symbols-outlined text-xl font-black">verified</span>
                             核定結案
                          </button>
                       </div>
                    </div>
                 </section>
               ))}
          </div>
        </main>
      </div>

      {(isLoading || isProcessing) && (
        <div className="fixed inset-0 z-[3000] flex flex-col items-center justify-center bg-white/80 backdrop-blur-3xl">
          <div className="w-24 h-24 border-[10px] border-slate-100 border-t-blue-600 rounded-full animate-spin mb-10 shadow-2xl"></div>
          <p className="text-blue-600 font-black tracking-[1.2em] uppercase text-xs animate-pulse neon-text">行政對沖中...</p>
        </div>
      )}
    </div>
  );
}