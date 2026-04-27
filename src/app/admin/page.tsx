"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";

// --- 🚀 後端 Server Actions (物理數據對沖來源) ---
// 1. stats.ts -> 處理 assets (進行中) 與 historical_assets (歷史大數據)
import { 
  getDashboardStats, 
  getIpUsageStats, 
  getHistoryRecords, 
  getVansMetrics 
} from "@/lib/actions/stats";
// 2. nsr.ts -> 處理 nsr_records (網點需求數據)
import { getNsrList } from "@/lib/actions/nsr";
// 3. seeder.ts -> 執行系統種子投放
import { runSystemSeed } from "@/lib/actions/seeder";

// --- 🚀 旗艦級 UI 組件 ---
import AdminSidebar from "@/components/layout/AdminSidebar";
import TopNavbar from "@/components/layout/TopNavbar";
import VansCoreMetrics from "@/components/VansCoreMetrics";
import VansReport from "@/components/VansReport";

// --- 🚀 圖表引擎 (Chart.js) ---
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

/**
 * ==========================================
 * 檔案：src/app/admin/page.tsx
 * 狀態：V7.5 旗艦完全體 (數據警察 + 財務會計模式)
 * 物理職責：
 * 1. 數據警察：即時監控 VANS 指標（MAC/IP/報廢異常）。
 * 2. 財務會計：網點(NSR)核銷狀態對沖與歷史結案統計。
 * 3. 跨表對位：打通 assets、nsr_records 與 historical_assets 三大資料表。
 * ==========================================
 */

export default function AdminDashboard() {
  const router = useRouter();

  // --- 1. UI 與交互狀態管理 ---
  const [activeTab, setActiveTab] = useState<"dashboard" | "history" | "vans">("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loaderText, setLoaderText] = useState("驗證管理權限中...");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50; // 物理分頁大小

  // --- 2. 核心大數據對沖狀態 ---
  const [stats, setStats] = useState({ pending: 0, done: 0, nsrPending: 0, nsrSettle: 0 });
  const [vansMetrics, setVansMetrics] = useState({ macErrorCount: 0, ipConflictCount: 0, zombieAlertCount: 0 });
  const [ipData, setIpData] = useState<{ segment: string; count: number; percent: number }[]>([]);
  const [historyRecords, setHistoryRecords] = useState<Record<string, unknown>[]>([]);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" }[]>([]);

  // --- 3. 通知系統 ---
  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // --- 4. 核心數據對沖邏輯 (Data Sync Logic) ---
  const syncCoreData = useCallback(async () => {
    // A. 身分安全守衛
    const isAuth = sessionStorage.getItem("asset_link_admin_auth");
    if (!isAuth) {
      router.push("/");
      return;
    }

    setIsLoading(true);
    setLoaderText("進行全院資產物理對沖...");

    try {
      // 🚀 物理並行調用：一次打通所有數據鏈路
      const [eriStats, nsrData, vans, ips, history] = await Promise.all([
        getDashboardStats(), // 讀取 assets 與 historical_assets 基礎計數
        getNsrList(),        // 讀取 nsr_records (16 欄位網點紀錄)
        getVansMetrics(),    // 解析 VANS 異常指標 (MAC/IP 衝突)
        getIpUsageStats(),   // 統計 IP 網段分佈
        getHistoryRecords()  // 獲取前 100 筆歷史大數據紀錄
      ]);

      // 財務會計邏輯：精準對沖 NSR 處理狀態 (M 欄位)
      const nsrPending = (nsrData as any[]).filter(r => ["未處理", "待處理", ""].includes(String(r.status || "").trim())).length;
      const nsrSettle = (nsrData as any[]).filter(r => String(r.status || "").trim() === "待請款").length;

      setStats({ ...eriStats, nsrPending, nsrSettle });
      setVansMetrics(vans);
      setIpData(ips);
      setHistoryRecords(history as Record<string, unknown>[]);
    } catch (err: unknown) {
      showToast("數據鏈路異常：請確認資料庫 Table 名稱對位", "error");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [router, showToast]);

  useEffect(() => {
    syncCoreData();
  }, [syncCoreData]);

  // --- 5. 行政動作處理 ---
  const handleSeed = async () => {
    if (!confirm("⚠️ 確定要投放測試種子數據並物理活化儀表板嗎？")) return;
    setIsLoading(true);
    setLoaderText("種子數據投放中...");
    try {
      const res = await runSystemSeed();
      showToast(res.message, res.success ? "success" : "error");
      if (res.success) syncCoreData();
    } catch (e: unknown) {
      showToast("投放失敗", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    if (confirm("確定結束管理工作並安全登出？")) {
      sessionStorage.removeItem("asset_link_admin_auth");
      router.push("/");
    }
  };

  // --- 6. 數據矩陣過濾與分頁邏輯 ---
  const filteredHistory = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return historyRecords;
    return historyRecords.filter(r => 
      Object.values(r).some(val => String(val).toLowerCase().includes(q))
    );
  }, [searchQuery, historyRecords]);

  const pagedHistory = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredHistory.slice(start, start + pageSize);
  }, [filteredHistory, currentPage]);

  const chartData = {
    labels: ipData.map(d => d.segment),
    datasets: [{
      label: '負載率 %',
      data: ipData.map(d => d.percent),
      backgroundColor: ['#2563eb', '#6366f1', '#10b981', '#f59e0b', '#ef4444'],
      borderRadius: 12,
      barThickness: 35
    }]
  };

  return (
    <div className="bg-[#f8fafc] min-h-screen font-sans text-slate-900 antialiased overflow-x-hidden relative">
      <style dangerouslySetInnerHTML={{ __html: `
        .glass-panel { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.8); shadow-sm; }
        .stat-card { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .stat-card:hover { transform: translateY(-4px); box-shadow: 0 20px 40px rgba(0,0,0,0.05); }
      `}} />

      {/* 🚀 背景發光球還原 */}
      <div className="fixed z-0 blur-[120px] opacity-10 rounded-full pointer-events-none bg-blue-600 w-[600px] h-[600px] -top-48 -left-48 animate-pulse"></div>
      <div className="fixed z-0 blur-[120px] opacity-10 rounded-full pointer-events-none bg-emerald-400 w-[500px] h-[500px] bottom-0 -right-48 animate-pulse"></div>

      {/* 🚀 側邊導航 */}
      <AdminSidebar currentRoute="/admin" isOpen={isSidebarOpen} onLogout={handleLogout} />

      <main className="lg:ml-64 min-h-screen flex flex-col p-6 lg:p-10 relative z-10">
        
        {/* 🚀 頂部控制列 */}
        <TopNavbar 
          title={activeTab === "dashboard" ? "資產對沖總覽" : activeTab === "history" ? "大數據歷史矩陣" : "VANS 安全稽核報告"}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        {/* --- 視圖 A: Dashboard (數據警察與計價統計) --- */}
        {activeTab === "dashboard" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             
             {/* 數據警察區：VANS 指標卡片 */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-panel p-8 rounded-[2.5rem] border-l-8 border-l-red-500 stat-card">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">MAC 地址偏差 (03)</span>
                  <div className="text-4xl font-black text-red-600 mt-2">{vansMetrics.macErrorCount}</div>
                </div>
                <div className="glass-panel p-8 rounded-[2.5rem] border-l-8 border-l-amber-500 stat-card">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">IP 對沖衝突 (13)</span>
                  <div className="text-4xl font-black text-amber-600 mt-2">{vansMetrics.ipConflictCount}</div>
                </div>
                <div className="glass-panel p-8 rounded-[2.5rem] bg-slate-900 text-white stat-card">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-emerald-400">報廢在線異常 (38)</span>
                  <div className="text-4xl font-black mt-2">{vansMetrics.zombieAlertCount}</div>
                </div>
             </div>

             {/* 財務會計區：行政核銷統計 */}
             <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="glass-panel p-6 rounded-3xl text-center stat-card">
                  <span className="text-[9px] font-black text-slate-400 uppercase">ERI 待核定</span>
                  <div className="text-2xl font-black text-blue-600 mt-1">{stats.pending}</div>
                </div>
                <div className="glass-panel p-6 rounded-3xl text-center stat-card">
                  <span className="text-[9px] font-black text-slate-400 uppercase">NSR 未處理</span>
                  <div className="text-2xl font-black text-slate-700 mt-1">{stats.nsrPending}</div>
                </div>
                <div className="glass-panel p-6 rounded-3xl text-center stat-card">
                  <span className="text-[9px] font-black text-slate-400 uppercase">NSR 核銷中</span>
                  <div className="text-2xl font-black text-emerald-600 mt-1">{stats.nsrSettle}</div>
                </div>
                <div className="glass-panel p-6 rounded-3xl text-center bg-blue-600 text-white stat-card shadow-xl shadow-blue-500/20">
                  <span className="text-[9px] font-black uppercase text-blue-100">歷史結案總數</span>
                  <div className="text-2xl font-black mt-1">{stats.done.toLocaleString()}</div>
                </div>
             </div>
             
             {/* IP 負載物理分析圖 */}
             <div className="glass-panel p-10 rounded-[3rem] min-h-[450px] flex flex-col shadow-2xl shadow-slate-200/50">
                <div className="flex justify-between items-center mb-10">
                   <h3 className="font-black text-sm uppercase tracking-widest text-slate-500 flex items-center gap-2">
                     <span className="material-symbols-outlined text-blue-600">query_stats</span> 10.x 核心網段負載分佈 (%)
                   </h3>
                   <div className="text-[10px] font-bold text-slate-400">數據來源：歷史大數據庫對沖</div>
                </div>
                <div className="flex-1 relative">
                  <Bar 
                    options={{ 
                      responsive: true, 
                      maintainAspectRatio: false, 
                      plugins: { legend: { display: false } }, 
                      scales: { 
                        y: { beginAtZero: true, max: 100, ticks: { font: { size: 10, weight: 'bold' } } },
                        x: { ticks: { font: { size: 10, weight: 'bold' } } }
                      } 
                    }} 
                    data={chartData} 
                  />
                </div>
             </div>
          </div>
        )}

        {/* --- 視圖 B: History (全資料歷史矩陣) --- */}
        {activeTab === "history" && (
           <div className="space-y-6 animate-in fade-in duration-500">
              <div className="glass-panel overflow-hidden rounded-[2.5rem] shadow-xl border-none">
                <div className="overflow-x-auto">
                  <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-slate-50">
                      <tr className="text-[10px] font-black uppercase text-slate-400 border-b">
                        <th className="px-8 py-5">狀態標記</th>
                        <th className="px-8 py-5">結案單號</th>
                        <th className="px-8 py-5">使用單位與樓層</th>
                        <th className="px-8 py-5">設備序號 S/N</th>
                        <th className="px-8 py-5 text-blue-600">核定配發 IP</th>
                        <th className="px-8 py-5">來源廠商</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pagedHistory.map((r, i) => (
                        <tr key={i} className="hover:bg-blue-50/50 transition-colors group">
                          <td className="px-8 py-5">
                            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 font-black text-[9px] uppercase tracking-widest">
                              {String(r.status || '已結案')}
                            </span>
                          </td>
                          <td className="px-8 py-5 font-mono text-xs font-bold text-slate-400">{String(r.formId || '-')}</td>
                          <td className="px-8 py-5 font-black text-slate-700">
                            {String(r.unit || '-')} <span className="text-slate-300 ml-1 font-bold">({String(r.floor || '-')})</span>
                          </td>
                          <td className="px-8 py-5 font-mono font-black text-slate-500 group-hover:text-blue-600 transition-colors">{String(r.sn || '-')}</td>
                          <td className="px-8 py-5 font-mono font-black text-blue-700 text-sm tracking-tighter">{String(r.ip || '-')}</td>
                          <td className="px-8 py-5 font-black text-slate-400 text-[9px] uppercase tracking-tighter">{String(r.vendor || '-')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-6 border-t flex justify-between items-center bg-white">
                   <p className="font-black text-slate-400 uppercase tracking-widest text-[9px]">物理對沖總量: {filteredHistory.length} 筆資料</p>
                   <div className="flex gap-2">
                      <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="px-6 py-2 bg-slate-50 border border-slate-200 rounded-xl font-black text-[10px] active:scale-95 transition-all hover:bg-white shadow-sm">上一頁</button>
                      <button onClick={() => setCurrentPage(p => p + 1)} className="px-6 py-2 bg-slate-50 border border-slate-200 rounded-xl font-black text-[10px] active:scale-95 transition-all hover:bg-white shadow-sm">下一頁</button>
                   </div>
                </div>
              </div>
           </div>
        )}

        {/* --- 視圖 C: VANS (資安與 API 對沖報告) --- */}
        {activeTab === "vans" && (
           <div className="space-y-8 animate-in fade-in duration-500 pb-12">
              <VansCoreMetrics metrics={vansMetrics} />
              <VansReport />
           </div>
        )}
      </main>

      {/* 🚀 底部浮動視圖切換器 */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[130] bg-slate-900/90 backdrop-blur-2xl p-2 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/10 flex gap-1 animate-in slide-in-from-bottom-10 duration-700">
        <button onClick={() => setActiveTab("dashboard")} className={`px-6 py-2.5 rounded-full font-black text-[10px] uppercase transition-all duration-300 ${activeTab === "dashboard" ? "bg-white text-slate-900 shadow-xl" : "text-slate-400 hover:text-white"}`}>對沖總覽</button>
        <button onClick={() => setActiveTab("history")} className={`px-6 py-2.5 rounded-full font-black text-[10px] uppercase transition-all duration-300 ${activeTab === "history" ? "bg-white text-slate-900 shadow-xl" : "text-slate-400 hover:text-white"}`}>矩陣歷史</button>
        <button onClick={() => setActiveTab("vans")} className={`px-6 py-2.5 rounded-full font-black text-[10px] uppercase transition-all duration-300 ${activeTab === "vans" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/50" : "text-slate-400 hover:text-white"}`}>VANS 稽核</button>
      </div>

      {/* 全域同步遮罩 */}
      {isLoading && (
        <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-white/90 backdrop-blur-2xl">
          <div className="w-16 h-16 border-[6px] border-slate-100 border-t-blue-600 rounded-full animate-spin mb-8 shadow-2xl"></div>
          <p className="text-blue-600 font-black tracking-[0.5em] uppercase text-xs animate-pulse">{loaderText}</p>
        </div>
      )}

      {/* 通知氣泡 */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[1100] flex flex-col gap-3 pointer-events-none w-full max-w-[320px] px-5">
        {toasts.map(t => (
          <div key={t.id} className={`px-8 py-5 rounded-[2rem] shadow-2xl font-black text-[11px] animate-in slide-in-from-bottom-4 flex items-center gap-4 border border-white/20 ${t.type === "success" ? "bg-slate-900/95" : "bg-red-600/95"} text-white backdrop-blur-md`}>
            <span className="material-symbols-outlined text-lg">{t.type === 'success' ? 'verified' : 'error'}</span>
            <span className="tracking-wide">{t.msg}</span>
          </div>
        ))}
      </div>

      {/* 🚀 隱藏開發者工具：種子投放 */}
      <div className="fixed top-6 right-6 opacity-0 hover:opacity-100 transition-opacity z-[200]">
        <button onClick={handleSeed} className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 hover:bg-blue-600 hover:text-white transition-all shadow-inner">
          <span className="material-symbols-outlined text-sm">database</span>
        </button>
      </div>
    </div>
  );
}