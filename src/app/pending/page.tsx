"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { approveAsset, rejectAsset } from "@/lib/actions/assets";

/**
 * ==========================================
 * 檔案：src/app/pending/page.tsx
 * 狀態：V300.4 Medical M3 (RWD 手機模式完美版)
 * 物理職責：
 * 1. 響應式升級：Bento Grid RWD 適配 (1欄 -> 2欄 -> 3欄)，動態側邊欄遮罩。
 * 2. 邏輯 0 刪除：保留 ERI 簽核對正 4 引數、Session 驗證與退回邏輯。
 * 3. 語法對正：修復 class -> className，隨機 ID 對位防止 Axe 衝突。
 * ==========================================
 */

export default function PendingPage() {
  const router = useRouter();

  // 🚀 手機側邊欄狀態
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // --- 1. 核心數據與 UI 狀態矩陣 (100% 完整保留) ---
  const [pendingList, setPendingList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loaderText, setLoaderText] = useState("行政同步中...");
  const [searchQuery, setSearchQuery] = useState("");
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" }[]>([]);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const fetchPending = useCallback(async () => {
    const isAuth = sessionStorage.getItem("asset_link_admin_auth");
    if (isAuth !== "true") { router.push("/"); return; }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from("assets_pending").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setPendingList(data || []);
    } catch { showToast("連線中斷", "error"); }
    finally { setIsLoading(false); }
  }, [router, showToast]);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  // --- 3. 物理簽核對沖邏輯 (0 刪除：對正 4 引數) ---
  const handleApprove = async (item: any) => {
    setIsProcessing(true); setLoaderText("核定中...");
    try {
      // 🚀 物理對正：傳入完整 4 個引數 [id, ip, mac, sn]
      await approveAsset(item.id, item.核定ip || "", item.主要mac || "", item.產品序號 || item.sn || "");
      showToast("行政核定成功，已歸檔", "success"); fetchPending();
    } catch { showToast("核定失敗：請檢查網路或參數", "error"); }
    finally { setIsProcessing(false); }
  };

  const handleReject = async (item: any) => {
    if (!confirm("確定要物理退回此申請單？退回後資料將被銷毀。")) return;
    setIsProcessing(true);
    try {
      await rejectAsset(item.id, "資訊室管理員退回");
      showToast("案件已退回刪除", "error"); fetchPending();
    } catch { showToast("退件失敗", "error"); }
    finally { setIsProcessing(false); }
  };

  return (
    <div className="bg-[#faf8ff] text-slate-800 font-body-md antialiased min-h-screen flex relative overflow-x-hidden">
      
      <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries" async></script>
      <style dangerouslySetInnerHTML={{ __html: `
        .clinical-glass { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.4); box-shadow: 0 4px 20px rgba(0,0,0,0.03); }
        .inner-glow { box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.5); }
        .bg-gradient-custom { background: radial-gradient(at 0% 0%, #e0f2fe 0%, transparent 50%), radial-gradient(at 100% 100%, #cce5ff 0%, transparent 50%), #faf8ff; background-attachment: fixed; }
        .icon-fill { font-variation-settings: 'FILL' 1; }
      `}} />

      <div className="bg-gradient-custom min-h-screen w-full fixed inset-0 -z-10"></div>

      {/* 🚀 手機版遮罩 */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-sky-900/20 backdrop-blur-sm z-[45] md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* --- RWD SideNavBar --- */}
      <aside className={`w-64 fixed left-0 top-0 z-50 h-screen border-r border-white/40 bg-white/70 backdrop-blur-2xl flex flex-col py-6 px-4 gap-2 transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
          <div className="flex items-center justify-between mb-8 px-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                <span className="material-symbols-outlined icon-fill">medical_services</span>
              </div>
              <div>
                <h2 className="text-lg font-black text-sky-800 leading-tight">ERI 行政</h2>
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-1">臨床行政入口</p>
              </div>
            </div>
            <button className="md:hidden text-slate-500" onClick={() => setIsMobileMenuOpen(false)}><span className="material-symbols-outlined">close</span></button>
          </div>

          <button onClick={() => router.push("/keyin")} className="mb-6 w-full py-3 px-4 bg-white border border-slate-200 text-blue-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all active:scale-95 shadow-sm">
            <span className="material-symbols-outlined text-sm">add_circle</span> 切換廠商端錄入
          </button>

          <nav className="flex-1 space-y-2">
              <button onClick={() => router.push("/admin")} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-white/40 rounded-lg font-bold transition-all">
                <span className="material-symbols-outlined">dashboard</span> 首頁儀表板
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-3 bg-blue-600 text-white rounded-lg shadow-md font-bold">
                <span className="material-symbols-outlined icon-fill">grid_view</span> 待核定矩陣
              </button>
              <button onClick={() => router.push("/nsr")} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-white/40 rounded-lg font-bold transition-all">
                <span className="material-symbols-outlined">payments</span> 網點財務對沖
              </button>
              <button onClick={() => router.push("/internal")} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-white/40 rounded-lg font-bold transition-all">
                <span className="material-symbols-outlined">lan</span> 內部直通對沖
              </button>
          </nav>
      </aside>

      {/* --- Main Content (RWD ml-0 to md:ml-64) --- */}
      <main className="w-full md:ml-64 flex-1 flex flex-col min-h-screen">
        
        <header className="sticky top-0 z-30 w-full bg-white/70 backdrop-blur-lg border-b border-slate-200/50 shadow-sm px-4 md:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-sky-800 p-1"><span className="material-symbols-outlined">menu</span></button>
            <h1 className="text-lg md:text-xl font-bold tracking-tight text-sky-800">ERI 待核定中樞</h1>
          </div>
          <div className="flex items-center gap-3 md:gap-6">
            <div className="hidden md:flex relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
              <input className="bg-white/60 border border-slate-200 rounded-full py-1.5 pl-10 pr-4 text-sm w-64 focus:ring-2 focus:ring-blue-500/20 outline-none" placeholder="搜尋案件或廠商..." type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <button className="text-slate-500 hover:text-blue-600"><span className="material-symbols-outlined">notifications</span></button>
            <img alt="Admin" className="w-8 h-8 rounded-full border border-slate-200 object-cover hidden sm:block" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCjnnKa9P0sn-QHd5TXaWA6ZQ3UlERSV9JDDoo3KoVp82-Jg5JGDRSezHjTqCk2zAhshNuoCFF1LjPxs5Ga8SrG-h0j3M--6-TKKpm_t_4Z4bcuO0O9Cqx2WZkY41WTRnpLmYxIVxi9Rxg1RmOrCafBWU6Ih_tAq0wKaWeydD1qscgH16_R8VhI-afZk3r1b4xSThxzF9OcXsV4dxtS6XF_ewrqanhOawWNheubclKK6jbmUtUgOenWS43Zfu16Ble9OskcH2qxgDs" />
          </div>
        </header>

        <div className="p-4 md:p-8 w-full max-w-[1440px] mx-auto flex-1">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 md:mb-8 animate-in fade-in duration-700">
            <div>
              <div className="flex items-center gap-2 text-blue-600 font-bold mb-1"><span className="material-symbols-outlined text-sm">folder_open</span><span className="text-xs tracking-widest uppercase">系統代碼 V300.4</span></div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-800">待核定案件矩陣</h2>
              <p className="text-sm text-slate-500 mt-1">目前共有 {pendingList.length} 件資產預約核定事項等待處理</p>
            </div>
            <div className="flex gap-2">
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 shadow-sm text-sm"><span className="material-symbols-outlined text-sm">filter_list</span> 篩選</button>
            </div>
          </div>

          {/* 🚀 Bento Grid RWD 適配 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 animate-in slide-in-from-bottom-8 duration-1000">
             
             {/* 核心統計卡片 */}
             <div className="clinical-glass rounded-2xl p-6 inner-glow relative shadow-sm col-span-1 sm:col-span-2 lg:col-span-1">
                <div className="absolute -right-8 -top-8 w-32 h-32 bg-blue-100/50 rounded-full blur-2xl"></div>
                <div className="relative z-10 space-y-4">
                  <h3 className="font-bold text-sky-900 mb-4">狀態實時統計</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-end"><span className="text-sm text-slate-600 font-bold">已處理</span><span className="text-xl font-black text-emerald-600">82%</span></div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 w-[82%]"></div></div>
                    <div className="flex justify-between pt-2 border-t border-slate-200"><span className="text-sm text-slate-600 font-bold">目前待辦</span><span className="text-sm font-black text-blue-600">{pendingList.length} 件</span></div>
                  </div>
                </div>
             </div>

             {/* 動態渲染待核定案件 */}
             {pendingList.length === 0 ? (
                <div className="sm:col-span-2 clinical-glass rounded-2xl p-12 flex flex-col items-center justify-center text-slate-400 border-dashed border-2">
                    <span className="material-symbols-outlined text-5xl mb-4 text-emerald-400">task_alt</span>
                    <p className="font-bold text-slate-600">目前無待核定資產，系統已淨空</p>
                </div>
             ) : (
                pendingList.map((item, idx) => (
                  <div key={`eri-${item.id}`} className="clinical-glass rounded-2xl p-5 md:p-6 inner-glow flex flex-col justify-between hover:shadow-xl transition-all hover:-translate-y-1 bg-white/40 group">
                    <div className="space-y-4 md:space-y-5">
                      <div className="flex justify-between items-start">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${idx === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                          {idx === 0 ? 'Urgent Priority' : 'Normal Priority'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono truncate max-w-[100px]">{item.id}</span>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">來源廠商 / 使用單位</label>
                        <p className="font-black text-lg text-slate-800 leading-tight group-hover:text-blue-600 transition-colors">{item.廠商名稱 || "內部直通"}</p>
                        <p className="text-sm font-bold text-sky-700 mt-1 truncate">{item.使用單位}</p>
                      </div>
                      <div className="p-3 bg-white/60 rounded-xl border border-slate-200">
                        <label className="text-[10px] font-black text-slate-500 block mb-2 uppercase">網路核定參數</label>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center"><span className="text-[10px] text-slate-500 font-bold">核定 IP</span><code className="text-sm font-black text-blue-600 font-mono">{item.核定ip}</code></div>
                          <div className="flex justify-between items-center"><span className="text-[10px] text-slate-500 font-bold">規格</span><span className="text-[11px] font-bold text-slate-700 truncate max-w-[100px]">{item.設備類型}</span></div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-6 flex gap-2">
                      <button 
                        id={`rej-${idx}-${Math.random().toString(36).substr(2, 4)}`}
                        onClick={() => handleReject(item)}
                        className="flex-1 py-2 rounded-lg border border-red-200 bg-red-50 text-red-600 font-bold text-xs hover:bg-red-100 transition-all"
                      >
                        退回
                      </button>
                      <button 
                        id={`app-${idx}-${Math.random().toString(36).substr(2, 4)}`}
                        onClick={() => handleApprove(item)}
                        className="flex-[2] py-2 rounded-lg bg-emerald-600 text-white font-bold text-xs shadow-md hover:bg-emerald-500 active:scale-95 transition-all flex items-center justify-center gap-1"
                      >
                        <span className="material-symbols-outlined text-sm icon-fill">verified</span>
                        核定結案
                      </button>
                    </div>
                  </div>
                ))
             )}
          </div>
        </div>
      </main>

      {/* --- 全域強同步遮罩 --- */}
      {(isLoading || isProcessing) && (
        <div className="fixed inset-0 z-[6000] flex flex-col items-center justify-center bg-white/60 backdrop-blur-md">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4 shadow-sm"></div>
          <p className="text-blue-600 font-black tracking-widest text-[10px] uppercase animate-pulse">{loaderText}</p>
        </div>
      )}

      {/* --- 物理通知系統 --- */}
      <div className="fixed bottom-6 right-4 md:bottom-10 md:right-8 z-[7000] flex flex-col gap-3">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 md:px-6 py-3 rounded-xl shadow-lg font-bold text-xs animate-in slide-in-from-right-4 flex items-center gap-2 border ${t.type === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
            <span className="material-symbols-outlined text-base icon-fill">{t.type === 'success' ? 'check_circle' : 'error'}</span>
            <span className="tracking-wide">{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}