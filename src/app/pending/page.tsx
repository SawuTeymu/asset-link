"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { approveAsset, rejectAsset } from "@/lib/actions/assets";

// 🚀 引入佈局組件 (鈦金水晶規格)
import AdminSidebar from "@/components/layout/AdminSidebar";
import TopNavbar from "@/components/layout/TopNavbar";

/**
 * ==========================================
 * 檔案：src/app/pending/page.tsx
 * 狀態：V200.0 Titanium Crystal (繁體中文完整版)
 * 物理職責：
 * 1. 行政簽核：執行 ERI 核定對沖，精確傳遞 [id, ip, mac, sn] 4引數。
 * 2. 視覺守護：鎖定 3XL 磨砂、深石板網格背景、0 呼吸球殘留。
 * 3. 無障礙對正：採用隨機雜湊唯一 ID 徹底解決 Axe 重複 ID 報警。
 * ==========================================
 */

export default function PendingPage() {
  const router = useRouter();

  // --- 1. 核心數據與 UI 狀態矩陣 (100% 保留) ---
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

  // --- 2. 初始化：物理拉取待核定庫 ---
  const fetchPending = useCallback(async () => {
    const isAuth = sessionStorage.getItem("asset_link_admin_auth");
    if (isAuth !== "true") {
      router.push("/");
      return;
    }
    
    setIsLoading(true);
    try {
      // 物理讀取 assets_pending 暫存表
      const { data, error } = await supabase
        .from("assets_pending")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPendingList(data || []);
    } catch (err) {
      showToast("雲端對沖異常，物理連線中斷", "error");
    } finally {
      setIsLoading(false);
    }
  }, [router, showToast]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  // --- 3. 物理簽核對沖邏輯 (0 刪除：對正 4 引數) ---
  const handleApprove = async (item: any) => {
    setIsProcessing(true);
    setLoaderText("執行行政核定對沖...");
    try {
      // 🚀 物理對正：傳入後端定義的完整 4 個引數 (id, ip, mac, sn)
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
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (item: any) => {
    if (!confirm("物理警告：確定要退回此單？暫存資料將被即刻物理銷毀。")) return;
    setIsProcessing(true);
    try {
      await rejectAsset(item.id, "資訊室管理員物理退回");
      showToast("🚫 案件已退回，物理暫存已抹除", "error");
      fetchPending();
    } catch {
      showToast("退件執行異常", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-[#020617] min-h-screen flex text-slate-300 antialiased overflow-x-hidden relative selection:bg-blue-500/30">
      
      {/* 🚀 Titanium Crystal 視覺樣式表 */}
      <style dangerouslySetInnerHTML={{ __html: `
        .bento-card { background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255, 255, 255, 0.05); backdrop-filter: blur(20px); border-radius: 1.5rem; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
        .module-card:hover { border-color: rgba(59, 130, 246, 0.3); background: rgba(15, 23, 42, 0.6); transform: translateY(-4px); }
        .tech-box { background: rgba(0, 0, 0, 0.3); padding: 16px; border-radius: 1rem; border: 1px solid rgba(255, 255, 255, 0.03); }
        .status-badge { padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 900; background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2); text-transform: uppercase; }
        .bg-mesh { position: fixed; inset: 0; background: radial-gradient(circle at 10% 10%, rgba(37,99,235,0.05) 0%, transparent 40%); z-index: 0; pointer-events: none; }
      `}} />

      <div className="bg-mesh"></div>

      <AdminSidebar currentRoute="/pending" isOpen={isSidebarOpen} onLogout={() => router.push("/")} />

      <div className="flex-1 flex flex-col relative z-10">
        <TopNavbar title="ERI 資產行政核定中樞" onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} />

        <main className="p-6 lg:p-8 max-w-[1600px] mx-auto w-full mt-4">
          
          <header className="flex justify-between items-end mb-10 px-4 animate-in fade-in duration-700">
             <div>
                <h1 className="text-3xl font-black text-white tracking-tighter uppercase">待核定矩陣</h1>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.4em] mt-2">行政核定池 (驗證緩衝區)</p>
             </div>
             <div className="text-right">
                <span className="text-6xl font-black text-blue-500 font-mono tracking-tighter">{pendingList.length}</span>
                <span className="text-[10px] font-black text-slate-500 ml-3 uppercase">件待簽核</span>
             </div>
          </header>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-1000">
             {pendingList.length === 0 ? (
               <div className="col-span-full bento-card p-24 text-center border-dashed border-2 border-white/5">
                  <span className="material-symbols-outlined text-6xl text-slate-800 mb-4">verified_user</span>
                  <p className="text-slate-600 font-black tracking-widest uppercase text-xs">目前無待簽核資產數據</p>
               </div>
             ) : (
               pendingList.map((item, idx) => (
                 <section key={`eri-v200-${item.id}-${idx}`} className="bento-card module-card p-8 group relative overflow-hidden">
                    <div className="flex justify-between items-start mb-8">
                       <div className="space-y-4">
                          <div className="flex items-center gap-3">
                             <span className="status-badge">{item.棟別 || 'A'} 棟</span>
                             <span className="status-badge">{item.樓層 || '00'}F</span>
                             <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{item.廠商名稱 || '內部直通'}</span>
                          </div>
                          <h2 className="text-2xl font-bold text-slate-100 tracking-tight">{item.使用單位 || '未知裝機單位'}</h2>
                       </div>
                       <div className="text-right font-mono text-[10px] text-slate-600">裝機日期: {item.裝機日期 || 'N/A'}</div>
                    </div>

                    {/* 物理技術參數矩陣 (100% 歸位) */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                       <div className="tech-box">
                          <span className="text-[9px] font-black text-slate-500 block mb-1 uppercase">設備規格</span>
                          <p className="text-xs font-bold text-slate-300 truncate">{item.設備類型}</p>
                       </div>
                       <div className="tech-box">
                          <span className="text-[9px] font-black text-slate-500 block mb-1 uppercase">品牌型號</span>
                          <p className="text-xs font-bold text-slate-300 truncate">{item.品牌型號}</p>
                       </div>
                       <div className="tech-box !border-blue-500/20">
                          <span className="text-[9px] font-black text-blue-500 block mb-1 uppercase">核定 IP</span>
                          <p className="text-xs font-black text-blue-400 font-mono tracking-tight">{item.核定ip}</p>
                       </div>
                       <div className="tech-box !border-red-500/20">
                          <span className="text-[9px] font-black text-red-500 block mb-1 uppercase">主要 MAC</span>
                          <p className="text-xs font-black text-red-400 font-mono truncate">{item.主要mac}</p>
                       </div>
                    </div>

                    <div className="flex items-center justify-between pt-6 border-t border-white/5">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-600"><span className="material-symbols-outlined text-sm">person</span></div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">填報人：{item.填報人 || item.applicant || "系統自動對正"}</span>
                       </div>
                       
                       <div className="flex gap-3">
                          {/* 🚀 物理修復 Axe：採用動態雜湊 ID 解決 Duplicate ID */}
                          <button 
                            id={`eri-v200-rej-${idx}-${item.id}-${Math.random().toString(36).substr(2, 4)}`}
                            title={`拒絕並物理退回：${item.id}`}
                            onClick={() => handleReject(item)}
                            className="w-12 h-12 rounded-xl bg-red-500/5 text-red-500 border border-red-500/10 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center active:scale-90"
                          >
                             <span className="material-symbols-outlined">close</span>
                          </button>
                          <button 
                            id={`eri-v200-app-${idx}-${item.id}-${Math.random().toString(36).substr(2, 4)}`}
                            title={`執行行政核定與同步：${item.id}`}
                            onClick={() => handleApprove(item)}
                            className="px-10 py-3 bg-white text-slate-950 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-blue-50 active:scale-95 transition-all flex items-center gap-3 shadow-xl shadow-white/5"
                          >
                             <span className="material-symbols-outlined text-sm">verified</span> 核定結案
                          </button>
                       </div>
                    </div>
                 </section>
               ))
             )}
          </div>
        </main>
      </div>

      {/* --- 全域強同步遮罩 --- */}
      {(isLoading || isProcessing) && (
        <div className="fixed inset-0 z-[3000] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="w-12 h-12 border-2 border-slate-800 border-t-blue-500 rounded-full animate-spin mb-4 shadow-blue-500/20"></div>
          <p className="text-blue-500 font-black tracking-[0.4em] uppercase text-[10px] animate-pulse">行政對正同步中...</p>
        </div>
      )}

      {/* --- 物理通知系統 --- */}
      <div className="fixed bottom-24 right-8 z-[4000] flex flex-col gap-3">
        {toasts.map(t => (
          <div key={t.id} className={`px-6 py-4 rounded-xl shadow-2xl font-bold text-xs animate-in slide-in-from-right-4 flex items-center gap-4 border border-white/10 text-white backdrop-blur-xl ${t.type === "success" ? "bg-blue-600/90" : "bg-red-600/90"}`}>
            <span className="material-symbols-outlined text-lg">{t.type === 'success' ? 'done_all' : 'report'}</span>
            <span className="tracking-wider">{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}