"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";

// --- 🚀 後端 Server Actions (物理數據對沖來源) ---
// 1. stats.ts -> 處理 assets (待核定) 與 historical_assets (歷史大數據)
import { 
  getDashboardStats, 
  getIpUsageStats, 
  getHistoryRecords, 
  getVansMetrics 
} from "@/lib/actions/stats";
// 2. nsr.ts -> 處理 nsr_records (16 欄位網點需求)
import { getNsrList } from "@/lib/actions/nsr";
// 3. seeder.ts -> 執行測試數據投放
import { runSystemSeed } from "@/lib/actions/seeder";

// --- 🚀 模組化 UI 組件 (DRY 重構) ---
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
 * 狀態：V3.2 旗艦不刪減版 (消除所有 ESLint unused 與 any 報警)
 * 物理職責：全院資產對沖中樞、VANS 資安儀表板、數據源對位
 * ==========================================
 */

export default function AdminDashboard() {
  const router = useRouter();

  // --- 1. UI 與交互狀態 ---
  const [activeTab, setActiveTab] = useState<"dashboard" | "history" | "vans">("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loaderText, setLoaderText] = useState("驗證管理權限...");
  const [searchQuery, setSearchQuery] = useState("");
  
  // 🚀 修復 no-unused-vars: 移除未使用的 setPageSize，保留狀態
  const [pageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" }[]>([]);

  // --- 2. 核心大數據狀態 ---
  const [stats, setStats] = useState({ pending: 0, done: 0, nsrPending: 0, nsrSettle: 0 });
  const [vansMetrics, setVansMetrics] = useState({ macErrorCount: 0, ipConflictCount: 0, zombieAlertCount: 0 });
  const [ipData, setIpData] = useState<{ segment: string; count: number; percent: number }[]>([]);
  const [historyRecords, setHistoryRecords] = useState<Record<string, unknown>[]>([]);

  // --- 3. 物理工具：通知系統 ---
  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // --- 4. 數據對沖核心 (Data Synchronization Logic) ---
  const syncCoreData = useCallback(async () => {
    // A. Session 守衛
    const isAuth = sessionStorage.getItem("asset_link_admin_auth");
    if (!isAuth) {
      router.push("/");
      return;
    }

    setIsLoading(true);
    setLoaderText("Supabase 實時數據對沖中...");

    try {
      // 🚀 物理並行抓取：一次打通三張資料表
      const [eriStats, nsrData, vans, ips, history] = await Promise.all([
        getDashboardStats(), // 來源: public.assets (pending) & public.historical_assets (done)
        getNsrList(),        // 來源: public.nsr_records (全量)
        getVansMetrics(),    // 來源: public.historical_assets (remark/status 欄位資安解析)
        getIpUsageStats(),   // 來源: public.historical_assets (ip 欄位分布)
        getHistoryRecords()  // 來源: public.historical_assets (status='已結案' 前100筆)
      ]);

      // 客戶端二次演算 NSR 狀態 (對應 NSR 16 欄 M 欄位)
      // 🚀 修復 no-explicit-any: 替換為 Record<string, unknown>
      const nsrPending = nsrData.filter((r: Record<string, unknown>) => ["未處理", "待處理", ""].includes(String(r.status || "").trim())).length;
      const nsrSettle = nsrData.filter((r: Record<string, unknown>) => String(r.status || "").trim() === "已核定").length;

      setStats({ ...eriStats, nsrPending, nsrSettle });
      setVansMetrics(vans);
      setIpData(ips);
      setHistoryRecords(history);
    } catch (err: unknown) {
      showToast("物理鏈路中斷：請確認資料庫 Table 名稱是否正確", "error");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [router, showToast]);

  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(() => { if (mounted) syncCoreData(); }, 0);
    return () => { mounted = false; clearTimeout(timer); };
  }, [syncCoreData]);

  // --- 5. 行政動作處理 ---
  const handleSeed = async () => {
    if (!confirm("⚠️ 確定要向資料庫投放測試種子並活化儀表板嗎？")) return;
    setIsLoading(true);
    setLoaderText("種子數據投放中...");
    try {
      const res = await runSystemSeed();
      showToast(res.message, res.success ? "success" : "error");
      if (res.success) syncCoreData();
    } catch (e: unknown) {
      // 🚀 修復 no-unused-vars: 物理印出錯誤日誌，確保 e 被調用
      console.error("【種子投放異常】:", e);
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

  // 數據矩陣過濾與分頁
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
  }, [filteredHistory, currentPage, pageSize]);

  const chartData = {
    labels: ipData.map(d => d.segment),
    datasets: [{
      data: ipData.map(d => d.percent),
      backgroundColor: ['#0058bc', '#5856d6', '#34c759', '#ff9500', '#ff3b30'],
      borderRadius: 12,
      barThickness: 32
    }]
  };

  return (
    <div className="bg-[#f7f9fb] min-h-screen font-[family-name:-apple-system,BlinkMacSystemFont,system-ui,sans-serif] text-[10.5px] text-[#191c1e] antialiased tracking-tight">
      <style dangerouslySetInnerHTML={{ __html: `
        .glass-panel { background: rgba(255, 255, 255, 0.45); backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px); border: 1px solid rgba(255, 255, 255, 0.6); box-shadow: 0 10px 40px rgba(0, 88, 188, 0.04); }
        .material-symbols-outlined { font-family: 'Material Symbols Outlined' !important; font-variation-settings: 'FILL' 1; }
      `}} />

      {/* 🚀 模組化側邊欄 */}
      <AdminSidebar currentRoute="/admin" isOpen={isSidebarOpen} onLogout={handleLogout} />

      <main className="lg:ml-64 min-h-screen flex flex-col p-6 lg:p-10">
        
        {/* 🚀 模組化頂部導覽列 */}
        <TopNavbar 
          title={activeTab === "dashboard" ? "系統概覽面板" : activeTab === "history" ? "資產對沖矩陣" : "VANS 安全稽核"}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        {/* --- 視圖 A: Dashboard (數據對沖中樞) --- */}
        {activeTab === "dashboard" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             {/* VANS 指標卡片 (來源: historical_assets.remark 解析) */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-panel p-6 border-l-[6px] border-l-error">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">MAC 地址偏差 (03)</span>
                  <div className="text-3xl font-black text-error mt-2">{vansMetrics.macErrorCount}</div>
                </div>
                <div className="glass-panel p-6 border-l-[6px] border-l-amber-500">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">IP 對沖衝突 (13)</span>
                  <div className="text-3xl font-black text-amber-600 mt-2">{vansMetrics.ipConflictCount}</div>
                </div>
                <div className="glass-panel p-6 bg-slate-900 text-white border-l-[6px] border-l-slate-500">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">報廢在線異常 (38)</span>
                  <div className="text-3xl font-black mt-2">{vansMetrics.zombieAlertCount}</div>
                </div>
             </div>

             {/* 行政統計卡片 (來源: assets & nsr_records & historical_assets) */}
             <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="glass-panel p-6"><span className="text-[9px] font-black text-slate-400 uppercase">ERI 待核定</span><div className="text-2xl font-black text-slate-800 mt-2">{stats.pending}</div></div>
                <div className="glass-panel p-6"><span className="text-[9px] font-black text-slate-400 uppercase">NSR 未處理</span><div className="text-2xl font-black text-slate-800 mt-2">{stats.nsrPending}</div></div>
                <div className="glass-panel p-6"><span className="text-[9px] font-black text-slate-400 uppercase">NSR 核銷中</span><div className="text-2xl font-black text-slate-800 mt-2">{stats.nsrSettle}</div></div>
                <div className="glass-panel p-6 bg-primary text-white shadow-xl shadow-primary/20"><span className="text-[9px] font-black text-blue-200 uppercase tracking-widest">歷史總結案數</span><div className="text-2xl font-black mt-2">{stats.done.toLocaleString()}</div></div>
             </div>
             
             {/* 10.x 負載圖表 (來源: historical_assets.ip) */}
             <div className="glass-panel p-8 min-h-[400px] flex flex-col">
                <h3 className="font-black text-sm mb-6 uppercase tracking-widest text-slate-400">10.x 核心網段負載分佈 (%)</h3>
                <div className="flex-1 relative">
                  <Bar 
                    options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } }} 
                    data={chartData} 
                  />
                </div>
             </div>
          </div>
        )}

        {/* --- 視圖 B: History (全量歷史矩陣) --- */}
        {activeTab === "history" && (
           <div className="space-y-6 animate-in fade-in duration-500">
              <div className="glass-panel overflow-hidden rounded-[2rem]">
                <div className="overflow-x-auto">
                  <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-slate-50/50">
                      <tr className="text-[9px] font-black uppercase text-slate-500 border-b">
                        <th className="px-6 py-4">狀態</th><th className="px-6 py-4">結案單號</th><th className="px-6 py-4">單位 | 樓層</th>
                        <th className="px-6 py-4">設備序號</th><th className="px-6 py-4 text-blue-600">核定 IP</th><th className="px-6 py-4">來源廠商</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pagedHistory.map((r, i) => (
                        <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                          <td className="px-6 py-4"><span className="px-2 py-1 rounded bg-emerald-50 text-emerald-600 font-black text-[9px] uppercase">{String(r.status || '已結案')}</span></td>
                          <td className="px-6 py-4 font-black text-slate-400">{String(r.formId || '-')}</td>
                          <td className="px-6 py-4 font-black text-slate-700">{String(r.unit || '-')} <span className="text-slate-300 ml-1">({String(r.floor || '-')})</span></td>
                          <td className="px-6 py-4 font-mono font-bold text-slate-500">{String(r.sn || '-')}</td>
                          <td className="px-6 py-4 font-mono font-black text-blue-700">{String(r.ip || '-')}</td>
                          <td className="px-6 py-4 font-black text-slate-400 text-[9px] uppercase">{String(r.vendor || '-')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-4 border-t flex justify-between items-center bg-white/50">
                   <p className="font-bold text-slate-400 uppercase tracking-widest">對沖歷史總量: {filteredHistory.length} 筆</p>
                   <div className="flex gap-2">
                      <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="px-4 py-1.5 bg-white border rounded-lg font-black active:scale-90 transition-all hover:bg-slate-50 shadow-sm">PREV</button>
                      <button onClick={() => setCurrentPage(p => p + 1)} className="px-4 py-1.5 bg-white border rounded-lg font-black active:scale-90 transition-all hover:bg-slate-50 shadow-sm">NEXT</button>
                   </div>
                </div>
              </div>
           </div>
        )}

        {/* --- 視圖 C: VANS (資安與 API 實測報告) --- */}
        {activeTab === "vans" && (
           <div className="space-y-6 animate-in fade-in duration-500 pb-12">
              <VansCoreMetrics metrics={vansMetrics} />
              <VansReport />
           </div>
        )}
      </main>

      {/* 🚀 底部浮動視圖切換器 */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[130] bg-slate-900/90 backdrop-blur-xl p-2 rounded-full shadow-2xl border border-white/10 flex gap-1">
        <button onClick={() => setActiveTab("dashboard")} className={`px-4 py-2 rounded-full font-black text-[10px] uppercase transition-all ${activeTab === "dashboard" ? "bg-white text-slate-900" : "text-slate-400 hover:text-white"}`}>總覽</button>
        <button onClick={() => setActiveTab("history")} className={`px-4 py-2 rounded-full font-black text-[10px] uppercase transition-all ${activeTab === "history" ? "bg-white text-slate-900" : "text-slate-400 hover:text-white"}`}>大數據</button>
        <button onClick={() => setActiveTab("vans")} className={`px-4 py-2 rounded-full font-black text-[10px] uppercase transition-all ${activeTab === "vans" ? "bg-blue-500 text-white shadow-lg shadow-blue-500/50" : "text-slate-400 hover:text-white"}`}>VANS</button>
      </div>

      {/* 全域同步遮罩 */}
      {isLoading && (
        <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-white/80 backdrop-blur-xl">
          <div className="w-12 h-12 border-2 border-slate-200 border-t-primary rounded-full animate-spin mb-6 shadow-2xl"></div>
          <p className="text-primary font-black tracking-[0.4em] uppercase text-[12px] animate-pulse">{loaderText}</p>
        </div>
      )}

      {/* 通用通知系統 */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[1100] flex flex-col gap-3 pointer-events-none w-full max-w-[320px] px-5">
        {toasts.map(t => (
          <div key={t.id} className={`px-6 py-4 rounded-3xl shadow-2xl font-black text-[11px] animate-bounce flex items-center gap-3 border border-white/20 ${t.type === "success" ? "bg-slate-900" : "bg-red-600"} text-white`}>
            <span className="material-symbols-outlined text-sm">info</span>
            <span>{t.msg}</span>
          </div>
        ))}
      </div>

      {/* 🚀 隱藏動作觸發區 (供管理員手動投放測試資料) */}
      <div className="hidden">
        <button onClick={handleSeed}>投放測試資料</button>
      </div>
    </div>
  );
}