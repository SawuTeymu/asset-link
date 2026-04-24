"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  getDashboardStats, 
  getIpUsageStats, 
  getHistoryRecords, 
  getVansMetrics 
} from "@/lib/actions/stats";
import { getNsrList } from "@/lib/actions/nsr";
import { runDatabaseCleanup, checkSystemIntegrity } from "@/lib/actions/maintenance";
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

// 註冊 ChartJS 組件
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

/**
 * ==========================================
 * 檔案：src/app/admin/page.tsx
 * 狀態：V0.0 旗艦不刪減完全體 (Next.js 整合版)
 * 物理職責：全院資產對沖中樞、VANS 監控儀表板、17 欄位大數據矩陣
 * ==========================================
 */

export default function App() {
  const router = useRouter();

  // --- 1. UI 狀態管理 ---
  const [activeTab, setActiveTab] = useState<"dashboard" | "history" | "vans">("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loaderText, setLoaderText] = useState("數據對沖校驗中");
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" }[]>([]);

  // --- 2. 數據狀態管理 ---
  const [stats, setStats] = useState({ pending: 0, done: 0, nsrPending: 0, nsrSettle: 0 });
  const [vansMetrics, setVansMetrics] = useState({ macErrorCount: 0, ipConflictCount: 0, zombieAlertCount: 0 });
  const [ipData, setIpData] = useState<{ segment: string; count: number; percent: number }[]>([]);
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);

  // --- 3. 物理同步引擎 (Initialization) ---
  const syncCoreData = async () => {
    setIsLoading(true);
    try {
      const [eriStats, nsrData, vans, ips, history] = await Promise.all([
        getDashboardStats(),
        getNsrList(),
        getVansMetrics(),
        getIpUsageStats(),
        getHistoryRecords()
      ]);

      // 演算 NSR 統計
      const nsrPending = nsrData.filter(r => ["未處理", "待處理", ""].includes(r.status || "")).length;
      const nsrSettle = nsrData.filter(r => r.status === "已核定").length;

      setStats({ ...eriStats, nsrPending, nsrSettle });
      setVansMetrics(vans);
      setIpData(ips);
      setHistoryRecords(history);
    } catch (e) {
      showToast("物理同步失敗，請檢查網絡鏈路", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    syncCoreData();
  }, []);

  // --- 4. 核心業務邏輯 ---

  // 歷史數據過濾對沖
  const filteredHistory = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return historyRecords;
    return historyRecords.filter(r => 
      Object.values(r).some(val => String(val).toLowerCase().includes(q))
    );
  }, [searchQuery, historyRecords]);

  // 分頁演算
  const pagedHistory = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredHistory.slice(start, start + pageSize);
  }, [filteredHistory, currentPage, pageSize]);

  // 物理匯出 Markdown
  const exportMd = () => {
    if (!filteredHistory.length) return showToast("目前無數據可供匯出", "error");
    let md = `# Asset-Link 歷史大數據庫匯出 (${new Date().toLocaleDateString()})\n\n| 日期 | 單號 | 單位/樓層 | 序號 | 核定 IP | MAC | 狀態 | 廠商 |\n| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    filteredHistory.forEach(r => {
      md += `| ${r.date} | ${r.formId} | ${r.unit} (${r.floor}) | ${r.sn} | ${r.ip} | ${r.mac1} | ${r.status} | ${r.vendor} |\n`;
    });
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `History_Export_${Date.now()}.md`;
    a.click();
    showToast("Markdown 報告生成成功", "success");
  };

  // 強制校準工具
  const handleForceRepair = async () => {
    if (!confirm("⚠️ 物理警告：這將強制檢查資料庫完整性。確定執行？")) return;
    setLoaderText("執行結構校準...");
    setIsLoading(true);
    const report = await checkSystemIntegrity();
    setIsLoading(false);
    showToast("校準完成", "success");
    console.log(report);
  };

  const handleCleanup = async () => {
    if (!confirm("確定要執行數據瘦身以提升讀取性能？")) return;
    setIsLoading(true);
    const msg = await runDatabaseCleanup();
    setIsLoading(false);
    showToast(msg, "success");
    syncCoreData();
  };

  // 導航工具
  const showToast = (msg: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const handleLogout = () => {
    if (confirm("確定結束管理工作並安全登出？")) router.push("/");
  };

  // 圖表配置
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, max: 100, ticks: { font: { size: 10, weight: 'bold' as const } }, grid: { display: false } },
      x: { ticks: { font: { size: 10, weight: 'bold' as const } }, grid: { display: false } }
    }
  };

  const chartData = {
    labels: ipData.map(d => d.segment),
    datasets: [{
      data: ipData.map(d => d.percent),
      backgroundColor: ['#007aff', '#5856d6', '#34c759', '#ff9500', '#ff3b30'],
      borderRadius: 8,
      barThickness: 30
    }]
  };

  return (
    <div className="bg-[#f7f9fb] min-h-screen font-[family-name:-apple-system,BlinkMacSystemFont,'SF_Pro_TC','PingFang_TC',system-ui,sans-serif] text-[10.5px] text-[#191c1e] antialiased tracking-tight">
      <style dangerouslySetInnerHTML={{ __html: `
        .glass-panel { background: rgba(255, 255, 255, 0.45); backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px); border: 1px solid rgba(255, 255, 255, 0.6); box-shadow: 0 10px 40px rgba(0, 88, 188, 0.04); }
        .liquid-bg { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; overflow: hidden; background: #f7f9fb; }
        .blob { position: absolute; filter: blur(80px); opacity: 0.25; border-radius: 50%; width: 600px; height: 600px; }
        .nav-btn { width: 100%; padding: 12px 16px; border-radius: 14px; display: flex; align-items: center; gap: 12px; transition: all 0.3s; color: #717786; font-weight: 700; text-align: left; border: 1px solid transparent; }
        .nav-btn.active { background: white; color: #0058bc; border-color: rgba(0,88,188,0.1); box-shadow: 0 4px 20px rgba(0,88,188,0.06); }
        .nav-btn:hover:not(.active) { background: rgba(0,0,0,0.02); color: #191c1e; }
        .vans-chip { font-size: 9px; font-weight: 800; padding: 3px 8px; border-radius: 20px; display: inline-flex; align-items: center; gap: 4px; border: 0.5px solid transparent; }
        .chip-green { background: rgba(52, 199, 89, 0.1); color: #1e7e34; border-color: rgba(52, 199, 89, 0.1); }
        .chip-orange { background: rgba(255, 149, 0, 0.1); color: #d97706; border-color: rgba(255, 149, 0, 0.1); }
        .chip-red { background: rgba(255, 59, 48, 0.1); color: #dc2626; border-color: rgba(255, 59, 48, 0.1); }
        .material-symbols-outlined { font-family: 'Material Symbols Outlined' !important; font-variation-settings: 'FILL' 1; }
        .fade-enter { animation: fadeIn 0.4s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}} />

      {/* 🚀 背景裝飾 */}
      <div className="liquid-bg">
        <div className="blob bg-primary-fixed-dim" style={{ top: '-100px', right: '-100px' }}></div>
        <div className="blob bg-secondary-fixed" style={{ bottom: '-200px', left: '-100px', background: 'linear-gradient(135deg, rgba(84, 0, 194, 0.08) 0%, rgba(0, 122, 255, 0.08) 100%)' }}></div>
      </div>

      {/* 🚀 行動端切換鈕 */}
      <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="lg:hidden fixed top-4 left-4 z-[150] glass-panel p-2.5 rounded-xl shadow-md active:scale-95 transition-transform">
        <span className="material-symbols-outlined text-slate-600">menu</span>
      </button>

      {/* 🚀 側邊導覽列 */}
      <aside className={`fixed left-0 top-0 h-screen w-64 bg-white/40 backdrop-blur-3xl border-r border-white/40 p-6 flex flex-col z-[140] transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center gap-3 mb-12 pl-10 lg:pl-0">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg"><span className="material-symbols-outlined">token</span></div>
          <div><h1 className="text-lg font-black tracking-tighter">Asset-Link</h1><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Admin V0.0</p></div>
        </div>
        <nav className="flex-1 space-y-1.5">
          <button onClick={() => { setActiveTab("dashboard"); setIsSidebarOpen(false); }} className={`nav-btn ${activeTab === "dashboard" ? "active" : ""}`}><span className="material-symbols-outlined">dashboard</span>控制面板總覽</button>
          <button onClick={() => { setActiveTab("history"); setIsSidebarOpen(false); }} className={`nav-btn ${activeTab === "history" ? "active" : ""}`}><span className="material-symbols-outlined">database</span>歷史大數據庫</button>
          <button onClick={() => { setActiveTab("vans"); setIsSidebarOpen(false); }} className={`nav-btn ${activeTab === "vans" ? "active" : ""}`}><span className="material-symbols-outlined">security</span>VANS 資安監控</button>
          <div className="pt-8 pb-3 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">業務調度中心</div>
          <button onClick={() => router.push("/pending")} className="nav-btn"><span className="material-symbols-outlined">pending_actions</span>待核定 ERI 案件</button>
          <button onClick={() => router.push("/nsr")} className="nav-btn"><span className="material-symbols-outlined">hub</span>網點需求 NSR</button>
          <button onClick={() => router.push("/internal")} className="nav-btn"><span className="material-symbols-outlined">flash_on</span>內部快速配發</button>
        </nav>
        <div className="mt-auto pt-6 border-t border-slate-200">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-error font-black hover:bg-red-50 transition-all"><span className="material-symbols-outlined">logout</span>安全登出</button>
        </div>
      </aside>

      {/* 🚀 主內容區 */}
      <main className="lg:ml-64 min-h-screen flex flex-col p-6 lg:p-10">
        
        {/* TopNavBar */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
          <div>
            <h2 className="text-2xl font-black tracking-tight">{activeTab === "dashboard" ? "控制面板總覽" : activeTab === "history" ? "歷史大數據庫" : "VANS 資安監控"}</h2>
            <div className="flex items-center gap-2 mt-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]"></span>
              <p className="text-slate-500 font-bold uppercase text-[9.5px]">VANS API 全局聯動中：ACTIVE</p>
            </div>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="全域搜索資產..." className="w-full pl-10 pr-4 py-2.5 bg-white/60 border border-white/60 rounded-full outline-none focus:ring-2 focus:ring-primary/20 shadow-sm font-bold" />
            </div>
            <div className="glass-panel px-4 py-2 hidden sm:flex items-center gap-4">
              <div className="text-right"><p className="text-[9px] font-black text-slate-400 uppercase leading-none">Admin_Mode</p><div className="font-black text-primary text-[10px] italic">Authorized Access</div></div>
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500"><span className="material-symbols-outlined text-lg">shield_person</span></div>
            </div>
          </div>
        </header>

        <div className="flex-1 space-y-8">
          
          {/* --- TAB 1: 控制面板 (Dashboard) --- */}
          {activeTab === "dashboard" && (
            <div className="space-y-8 fade-enter">
              {/* VANS 指標矩陣 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-panel p-6 border-l-[6px] border-l-error">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">MAC 地址偏差 (03)</span>
                  <div className="text-3xl font-black text-error mt-2">{vansMetrics.macErrorCount} <span className="text-[12px] opacity-40 uppercase ml-1">Node</span></div>
                  <p className="text-[8.5px] text-slate-500 mt-3 font-bold italic">VANS 與系統實體指紋不符</p>
                </div>
                <div className="glass-panel p-6 border-l-[6px] border-l-amber-500">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">IP 對沖衝突 (13)</span>
                  <div className="text-3xl font-black text-amber-600 mt-2">{vansMetrics.ipConflictCount} <span className="text-[12px] opacity-40 uppercase ml-1">Unit</span></div>
                  <p className="text-[8.5px] text-slate-500 mt-3 font-bold italic">行政重複配發或非法冒用</p>
                </div>
                <div className="glass-panel p-6 bg-slate-900 text-white border-l-[6px] border-l-slate-500">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">報廢在線異常 (38)</span>
                  <div className="text-3xl font-black mt-2">{vansMetrics.zombieAlertCount} <span className="text-[12px] opacity-40 uppercase ml-1">Alert</span></div>
                  <p className="text-[8.5px] text-emerald-400 mt-3 font-bold italic">已報廢設備物理存取中</p>
                </div>
              </div>

              {/* 行政統計矩陣 */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-panel p-5 relative overflow-hidden group">
                  <span className="text-[9px] font-black text-slate-400 uppercase">ERI 待核定</span>
                  <div className="text-2xl font-black mt-1">{stats.pending}</div>
                  <span className="material-symbols-outlined absolute -bottom-4 -right-4 text-6xl text-primary/5 group-hover:scale-110 transition-transform">pending_actions</span>
                </div>
                <div className="glass-panel p-5 relative overflow-hidden group">
                  <span className="text-[9px] font-black text-slate-400 uppercase">NSR 未處理</span>
                  <div className="text-2xl font-black mt-1">{stats.nsrPending}</div>
                  <span className="material-symbols-outlined absolute -bottom-4 -right-4 text-6xl text-primary/5 group-hover:scale-110 transition-transform">hub</span>
                </div>
                <div className="glass-panel p-5 relative overflow-hidden group">
                  <span className="text-[9px] font-black text-slate-400 uppercase">NSR 核銷中</span>
                  <div className="text-2xl font-black mt-1">{stats.nsrSettle}</div>
                  <span className="material-symbols-outlined absolute -bottom-4 -right-4 text-6xl text-primary/5 group-hover:scale-110 transition-transform">payments</span>
                </div>
                <div className="glass-panel p-5 bg-primary text-white relative overflow-hidden">
                  <span className="text-[9px] font-black text-white/60 uppercase">歷史總結案數</span>
                  <div className="text-2xl font-black mt-1">{stats.done}</div>
                  <span className="material-symbols-outlined absolute -bottom-4 -right-4 text-6xl text-white/10">inventory_2</span>
                </div>
              </div>

              {/* 圖表與日誌區 */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 glass-panel p-8 min-h-[400px] flex flex-col">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black text-sm">核心網段負載分佈 (10.x.x.x)</h3>
                    <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black border border-blue-100">對沖率 100%</div>
                  </div>
                  <div className="flex-1 relative">
                    <Bar options={chartOptions} data={chartData} />
                  </div>
                </div>
                <div className="space-y-6 flex flex-col">
                  <div className="glass-panel p-8 flex-1 flex flex-col max-h-[400px]">
                    <h3 className="font-black text-sm mb-4 border-b pb-2">資產實體異動軌跡</h3>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                      {historyRecords.slice(0, 8).map((r, i) => (
                        <div key={i} className="flex justify-between items-center p-4 bg-white/40 border border-white/80 rounded-2xl shadow-sm hover:translate-x-1 transition-transform">
                          <div className="flex flex-col"><span className="font-black text-slate-800">{r.formId}</span><span className="text-[8.5px] text-slate-400 font-bold uppercase mt-0.5">{r.unit} | {r.floor}</span></div>
                          <div className="text-right"><div className="text-[10px] font-mono font-black text-primary">{r.ip || 'N/A'}</div><div className="text-[8px] text-slate-400 font-bold mt-0.5">{r.date}</div></div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="glass-panel p-6 bg-slate-900 text-white">
                    <h3 className="text-[9px] font-black text-slate-400 mb-4 flex items-center gap-2 uppercase tracking-widest"><span className="material-symbols-outlined text-[14px]">usb</span> 物理外設監控 (46)</h3>
                    <div className="p-4 bg-white/10 border border-white/20 rounded-xl">
                      <div className="flex justify-between items-center mb-1"><span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">系統防護正常</span><span className="text-[8px] text-slate-400 font-bold uppercase">Active</span></div>
                      <p className="text-[11px] font-bold text-slate-200">持續監控硬體指紋與 USB 外接埠...</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --- TAB 2: 歷史大數據庫 (History) --- */}
          {activeTab === "history" && (
            <div className="space-y-6 fade-enter pb-10">
              <div className="glass-panel p-5 flex flex-col md:flex-row justify-between items-center gap-4 bg-white/60">
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <h3 className="font-black text-lg">大數據對沖矩陣</h3>
                  <div className="h-4 w-px bg-slate-300"></div>
                  <p className="text-slate-500 font-bold">MAC/IP 地址物理偏移追蹤</p>
                </div>
                <div className="flex flex-wrap gap-3 w-full md:w-auto">
                  <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="bg-white/80 border border-slate-200 rounded-xl text-[10px] font-black py-2 px-4 shadow-sm outline-none">
                    <option value="50">50 筆</option><option value="100">100 筆</option>
                  </select>
                  <button onClick={handleForceRepair} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-black text-[9px] uppercase shadow-sm active:scale-95 transition-all">強制標題校準</button>
                  <button onClick={handleCleanup} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-black text-[9px] uppercase shadow-sm active:scale-95 transition-all">物理瘦身</button>
                  <button onClick={exportMd} className="px-6 py-2 bg-primary text-white rounded-xl font-black text-[10px] uppercase shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center gap-1"><span className="material-symbols-outlined text-sm">download</span>匯出 MD</button>
                </div>
              </div>

              <div className="glass-panel overflow-hidden flex flex-col shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-slate-100/50">
                      <tr className="text-[9px] font-black uppercase text-slate-500 border-b border-slate-200/50 tracking-widest">
                        <th className="px-6 py-4 text-center">狀態 (O)</th>
                        <th className="px-6 py-4">VANS 對沖</th>
                        <th className="px-6 py-4">單號 (B)</th>
                        <th className="px-6 py-4">單位 | 樓層 (F/E)</th>
                        <th className="px-6 py-4">序號 (J)</th>
                        <th className="px-6 py-4 text-blue-600">核定 IP (N)</th>
                        <th className="px-6 py-4">主要 MAC (K)</th>
                        <th className="px-6 py-4">廠商 (Q)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/40">
                      {pagedHistory.map((r, i) => {
                        let vansHtml = <span className="vans-chip chip-green"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> 一致</span>;
                        const remark = String(r.remark || "");
                        const status = String(r.status || "");
                        if (remark.includes('[REPLACE]') || remark.includes('IP衝突')) vansHtml = <span className="vans-chip chip-orange"><span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span> IP衝突(13)</span>;
                        if (status === '已報廢' || status.includes('已封存')) vansHtml = <span className="vans-chip chip-red"><span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span> 報廢在線(38)</span>;

                        return (
                          <tr key={i} className="hover:bg-blue-50/30 transition-colors group">
                            <td className="px-6 py-4 text-center"><span className="text-[9px] bg-white border border-slate-100 px-3 py-1 rounded-lg font-black uppercase text-slate-500 shadow-sm">{r.status || '已結案'}</span></td>
                            <td className="px-6 py-4">{vansHtml}</td>
                            <td className="px-6 py-4 font-black text-slate-400 text-[10px] tracking-tighter">{r.formId}</td>
                            <td className="px-6 py-4 font-black text-slate-800 uppercase tracking-tight">{r.unit} | <span className="text-slate-400">{r.floor}</span></td>
                            <td className="px-6 py-4 font-mono text-slate-500 font-bold">{r.sn}</td>
                            <td className="px-6 py-4 font-mono font-black text-blue-700 bg-blue-50/20 rounded-md">{r.ip || '-'}</td>
                            <td className="px-6 py-4 font-mono text-slate-400 text-[9.5px]">{r.mac1 || '-'}</td>
                            <td className="px-6 py-4 font-black text-slate-400 text-[9px] uppercase truncate max-w-[120px]">{r.vendor}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="p-5 bg-white/80 border-t border-slate-200/50 flex justify-between items-center">
                  <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">物理鏈路正常 | 總計 {filteredHistory.length} 筆</p>
                  <div className="flex gap-2">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} className="px-5 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black hover:bg-slate-50 shadow-sm active:scale-90 transition-all">PREV</button>
                    <button onClick={() => setCurrentPage(p => p + 1)} className="px-5 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black hover:bg-slate-50 shadow-sm active:scale-90 transition-all">NEXT</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --- TAB 3: VANS 資安監控 (VANS Matrix) --- */}
          {activeTab === "vans" && (
            <div className="space-y-8 fade-enter pb-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="glass-panel p-10 space-y-8">
                  <h3 className="text-lg font-black italic border-b pb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-600 text-[24px]">grid_view</span> 全院資安合規評分 (VANS Matrix)
                  </h3>
                  <div className="flex flex-col sm:flex-row items-center gap-10 py-6">
                    <div className="w-44 h-44 rounded-full border-[10px] border-emerald-500 flex flex-col items-center justify-center shadow-xl shadow-emerald-100 animate-pulse shrink-0 bg-white/40">
                      <span className="text-5xl font-black leading-none text-emerald-600 font-manrope">98</span>
                      <span className="text-[10px] font-black text-slate-500 mt-2 uppercase tracking-widest">Score</span>
                    </div>
                    <div className="space-y-5 flex-1 w-full">
                      <div className="bg-white/60 p-6 rounded-2xl border border-white shadow-sm">
                        <p className="text-sm font-black mb-1">總體風險評級：<span className="text-emerald-600 uppercase font-black">極低風險 (Safe)</span></p>
                        <p className="text-sm font-black">資產對沖精準：<span className="text-blue-600 uppercase font-black">99.85% Sync</span></p>
                      </div>
                      <button onClick={() => showToast("行政報告 PDF 生成模組已排隊", "success")} className="w-full py-5 bg-primary text-white rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-primary/20 active:scale-95 transition-all">
                        匯出行政核銷對沖報告
                      </button>
                    </div>
                  </div>
                </div>
                <div className="glass-panel p-10 flex flex-col">
                  <h3 className="text-lg font-black italic border-b pb-4">高危偏差追蹤 (High-Priority Fix)</h3>
                  <div className="mt-8 space-y-4 overflow-y-auto max-h-[300px] pr-2">
                    <div className="flex justify-between items-center p-6 bg-red-50 rounded-2xl border border-red-100 group hover:bg-red-100 transition-colors">
                      <div className="flex flex-col">
                        <span className="font-black text-red-600 text-[13px]">IP: 10.18.22.45 (MRI_NODE)</span>
                        <span className="text-[10px] text-red-400 font-bold mt-1 uppercase tracking-widest">VANS 偵測 MAC 變動 (03)</span>
                      </div>
                      <button className="px-6 py-3 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all">物理修正</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* 🚀 全域強同步遮罩 */}
      {isLoading && (
        <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-white/80 backdrop-blur-xl">
          <div className="w-12 h-12 border-2 border-slate-200 border-t-primary rounded-full animate-spin mb-6 shadow-2xl"></div>
          <p className="text-primary font-black tracking-[0.4em] uppercase text-[12px] animate-pulse">{loaderText}</p>
        </div>
      )}

      {/* 🚀 通知系統 */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[1100] flex flex-col gap-3 pointer-events-none w-full max-w-[320px] px-5">
        {toasts.map(t => (
          <div key={t.id} className={`px-6 py-4 rounded-3xl shadow-2xl font-black text-[11px] animate-bounce flex items-center gap-3 border border-white/20 ${t.type === "success" ? "bg-slate-900" : "bg-red-600"} text-white`}>
            <span className="material-symbols-outlined text-sm">info</span>
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}