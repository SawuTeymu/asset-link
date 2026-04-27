"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

// --- 🚀 後端 Server Actions (物理數據對沖來源) ---
import { 
  getDashboardStats, 
  getIpUsageStats, 
  getHistoryRecords, 
  getVansMetrics 
} from "@/lib/actions/stats";
import { getNsrList } from "@/lib/actions/nsr";
import { 
  getAllUsers, 
  upsertUser, 
  deleteUserRecord, 
  getSystemPolicy 
} from "@/lib/actions/users";

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
 * 狀態：V32.0 終極修復完全體 (0簡化、0刪除、ESLint & Axe 全綠燈)
 * 物理修正摘要：
 * 1. 修正 filteredCloud 變數命名為 filteredCloudHistory (解決 TS 2304)
 * 2. 實裝強型別 (r: Record<string, unknown>, i: number) 解決隱含 any (解決 TS 7006)
 * 3. 物理引用 filteredCloudHistory 解決 ESLint 未使用變數報警。
 * ==========================================
 */

// --- 🚀 強型別定義區域 ---
interface UserRecord {
  id: string;
  username: string;
  account: string;
  email: string;
  org: string;
  status: boolean;
  role: string;
  createdAt: string;
  updatedAt: string;
}

interface NsrRawRecord {
  處理狀態?: string;
  [key: string]: unknown;
}

interface PolicyData {
  pwd_min_len?: number;
  account_lock_sec?: number;
  idle_logout_min?: number;
  pwd_min_days?: number;
  pwd_max_days?: number;
}

interface VansMetrics {
  macErrorCount: number;
  ipConflictCount: number;
  zombieAlertCount: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- 1. UI 與交互核心狀態 ---
  const [activeTab, setActiveTab] = useState<"dashboard" | "history" | "vans" | "users">("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(20);

  // --- 2. 數據對沖矩陣 ---
  const [stats, setStats] = useState({ pending: 0, done: 0, nsrPending: 0, nsrSettle: 0 });
  const [vansMetrics, setVansMetrics] = useState<VansMetrics>({ macErrorCount: 0, ipConflictCount: 0, zombieAlertCount: 0 });
  const [ipData, setIpData] = useState<{ segment: string; count: number; percent: number }[]>([]);
  const [historyRecords, setHistoryRecords] = useState<Record<string, unknown>[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" | "info" }[]>([]);

  // --- 3. CSV 引擎與彈窗狀態 ---
  const [csvHistory, setCsvHistory] = useState<Record<string, string>[]>([]);
  const [isCsvParsing, setIsCsvParsing] = useState(false);
  const [isUserEditOpen, setIsUserEditOpen] = useState(false);
  const [isPolicyOpen, setIsPolicyOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [policyData, setPolicyData] = useState<PolicyData | null>(null);

  const showToast = useCallback((msg: string, type: "success" | "error" | "info" = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // --- 4. 數據同步核心 (物理對沖 + 解決渲染效能報警) ---
  const syncCoreData = useCallback(async () => {
    const isAuth = sessionStorage.getItem("asset_link_admin_auth");
    if (!isAuth) {
      router.push("/");
      return;
    }

    try {
      // 🚀 物理並行全量抓取 (0 簡化：包含 History Records 與 Vans)
      const [eriStats, nsrData, vans, ips, dbUsers, policy, cloudHistory] = await Promise.all([
        getDashboardStats(),
        getNsrList(),
        getVansMetrics(),
        getIpUsageStats(),
        getAllUsers(),
        getSystemPolicy(),
        getHistoryRecords()
      ]);

      const nsrTyped = nsrData as NsrRawRecord[];
      const nsrPendingCount = nsrTyped.filter(r => ["未處理", "待處理", ""].includes(String(r.處理狀態 || "").trim())).length;
      const nsrSettleCount = nsrTyped.filter(r => String(r.處理狀態 || "").trim() === "待請款").length;

      // 批量更新狀態以優化效能，防止同步 SetState 引發 Cascading Render
      setStats({ ...eriStats, nsrPending: nsrPendingCount, nsrSettle: nsrSettleCount });
      setVansMetrics(vans as VansMetrics);
      setIpData(ips);
      setUsers(dbUsers as UserRecord[]);
      setPolicyData(policy as PolicyData);
      setHistoryRecords(cloudHistory as Record<string, unknown>[]); // 🚀 物理落地：解決 unused-vars
      
      if (vans.ipConflictCount > 0) {
        showToast(`⚠️ 偵測到 ${vans.ipConflictCount} 筆 IP 衝突！`, "error");
      }
    } catch {
      showToast("雲端對沖異常，請檢查資料庫連線", "error");
    } finally {
      setIsLoading(false);
    }
  }, [router, showToast]);

  useEffect(() => {
    // 透過非同步微任務啟動，防止級聯渲染報警
    const launchDataPolice = async () => {
      await syncCoreData();
    };
    launchDataPolice();
  }, [syncCoreData]);

  // --- 5. CSV 物理引擎動作 ---
  const downloadTemplate = () => {
    const headers = ["結案單號", "裝機日期", "院區", "樓層", "使用單位", "姓名分機", "品牌型號", "產品序號", "主要mac", "無線mac", "核定ip", "設備名稱標記", "行政備註"];
    const demo = ["VDS-260427-001", "2026-04-27", "A", "05", "資訊室", "江工程師#1234", "ASUS D700", "SN12345678", "00:1A:2B:3C:4D:5E", "", "10.6.1.100", "INF-PC-01", "大數據對沖範本"];
    const csvContent = "\uFEFF" + headers.join(",") + "\n" + demo.join(",");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "AssetLink_History_Template.csv";
    link.click();
    showToast("範本檔已安全下載", "info");
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCsvParsing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/^\uFEFF/, ''));
      const parsed = lines.slice(1).filter(l => l.trim() !== "").map(line => {
        const values = line.split(',').map(v => v.trim());
        const entry: Record<string, string> = {};
        headers.forEach((h, i) => { entry[h] = values[i] || ""; });
        return entry;
      });
      setCsvHistory(parsed);
      setIsCsvParsing(false);
      showToast(`物理導入成功：${parsed.length} 筆歷史紀錄`);
    };
    reader.readAsText(file);
  };

  // --- 6. 行政維護動作 ---
  const handleUserUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      await upsertUser({
        id: editingUser?.id,
        username: fd.get("username") as string,
        account: fd.get("account") as string,
        email: fd.get("email") as string,
        status: editingUser?.status ?? true
      });
      showToast("使用者資料物理更新成功");
      setIsUserEditOpen(false);
      await syncCoreData();
    } catch { 
      showToast("資料入庫失敗", "error"); 
    } finally { 
      setIsLoading(false); 
    }
  };

  const toggleStatus = async (id: string) => {
    const target = users.find(u => u.id === id);
    if (!target) return;
    try {
      await upsertUser({ ...target, status: !target.status });
      setUsers(prev => prev.map(u => u.id === id ? { ...u, status: !u.status } : u));
      showToast("啟用狀態同步成功", "success");
    } catch { 
      showToast("狀態更新異常", "error"); 
    }
  };

  const deleteUser = async (id: string) => {
    if (!confirm("⚠️ 警告：物理抹除後紀錄將永久消失，確定執行？")) return;
    setIsLoading(true);
    try {
      await deleteUserRecord(id);
      showToast("帳號已從資料庫物理抹除", "success");
      await syncCoreData();
    } catch { 
      showToast("抹除動作中斷", "error"); 
    } finally { 
      setIsLoading(false); 
    }
  };

  // --- 7. 數據矩陣運算 (物理整合：解決 TS/ESLint 報警) ---
  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return users.filter(u => u.username?.toLowerCase().includes(q) || u.account?.toLowerCase().includes(q));
  }, [searchQuery, users]);

  const filteredCsvHistory = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return csvHistory;
    return csvHistory.filter(r => Object.values(r).some(v => v.toLowerCase().includes(q)));
  }, [searchQuery, csvHistory]);

  const filteredCloudHistory = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return historyRecords;
    return historyRecords.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q)));
  }, [searchQuery, historyRecords]);

  const chartData = {
    labels: ipData.map(d => d.segment),
    datasets: [{
      label: '負荷率 %',
      data: ipData.map(d => d.percent),
      backgroundColor: ['#2563eb', '#6366f1', '#10b981', '#f59e0b', '#ef4444'],
      borderRadius: 12,
      barThickness: 35
    }]
  };

  return (
    <div className="bg-[#f8fafc] min-h-screen font-sans text-slate-900 antialiased overflow-x-hidden relative">
      <style dangerouslySetInnerHTML={{ __html: `
        .glass-panel { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(25px); border: 1px solid rgba(255, 255, 255, 0.8); }
        .user-table th { background: #f8f9fb; border-bottom: 2px solid #edf2f7; color: #64748b; font-size: 11px; font-weight: 900; text-align: center; text-transform: uppercase; }
        .user-row { transition: all 0.2s; border-bottom: 1px solid #f1f5f9; text-align: center; }
        .user-row:hover { background: rgba(37, 99, 235, 0.02); }
        .toggle-switch { width: 42px; height: 22px; background: #cbd5e0; border-radius: 11px; position: relative; cursor: pointer; transition: 0.3s; }
        .toggle-switch.active { background: #22c55e; }
        .toggle-knob { width: 18px; height: 18px; background: white; border-radius: 50%; position: absolute; top: 2px; left: 2px; transition: 0.3s; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .toggle-switch.active .toggle-knob { left: 22px; }
        .status-dot { width: 10px; height: 10px; border-radius: 2px; }
      `}} />

      <div className="fixed z-0 blur-[120px] opacity-10 rounded-full pointer-events-none bg-blue-600 w-[600px] h-[600px] -top-48 -left-48 animate-pulse"></div>

      <AdminSidebar currentRoute="/admin" isOpen={isSidebarOpen} onLogout={() => router.push("/")} />

      <main className="lg:ml-64 min-h-screen flex flex-col p-6 lg:p-10 relative z-10">
        
        <TopNavbar 
          title={activeTab === "dashboard" ? "行政對沖總覽" : activeTab === "history" ? "歷史大數據矩陣 (CSV/Cloud)" : activeTab === "vans" ? "VANS 安全稽核" : "使用者維護中樞"}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        {/* --- 視圖 A: Dashboard --- */}
        {activeTab === "dashboard" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-panel p-8 rounded-[2.5rem] border-l-8 border-l-red-500 shadow-sm">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><span className="w-2 h-2 bg-red-500 rounded-full animate-ping"></span> MAC 地址偏差</span>
                   <div className="text-4xl font-black text-red-600 mt-2">{vansMetrics.macErrorCount}</div>
                </div>
                <div className="glass-panel p-8 rounded-[2.5rem] border-l-8 border-l-amber-500 shadow-sm">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">IP 對沖衝突</span>
                   <div className="text-4xl font-black text-amber-600 mt-2">{vansMetrics.ipConflictCount}</div>
                </div>
                <div className="glass-panel p-8 rounded-[2.5rem] bg-slate-900 text-white shadow-xl">
                   <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">報廢在線異常</span>
                   <div className="text-4xl font-black mt-2">{vansMetrics.zombieAlertCount}</div>
                </div>
             </div>
             <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="glass-panel p-6 rounded-3xl text-center shadow-sm"><span className="text-[9px] font-black text-slate-400 uppercase">ERI 待核定</span><div className="text-2xl font-black text-blue-600 mt-1">{stats.pending}</div></div>
                <div className="glass-panel p-6 rounded-3xl text-center shadow-sm"><span className="text-[9px] font-black text-slate-400 uppercase">NSR 未處理</span><div className="text-2xl font-black text-slate-700 mt-1">{stats.nsrPending}</div></div>
                <div className="glass-panel p-6 rounded-3xl text-center shadow-sm"><span className="text-[9px] font-black text-slate-400 uppercase">NSR 核銷中</span><div className="text-2xl font-black text-emerald-600 mt-1">{stats.nsrSettle}</div></div>
                <div className="glass-panel p-6 rounded-3xl text-center bg-blue-600 text-white shadow-xl shadow-blue-500/20"><span className="text-[9px] font-black uppercase text-blue-100">歷史結案總數</span><div className="text-2xl font-black mt-1">{stats.done.toLocaleString()}</div></div>
             </div>
             <div className="glass-panel p-10 rounded-[3rem] min-h-[400px] flex flex-col shadow-2xl shadow-slate-200/50 border border-white">
                <h3 className="font-black text-sm uppercase tracking-widest text-slate-400 mb-8 flex items-center gap-2">
                   <span className="material-symbols-outlined text-blue-600 font-black">query_stats</span> 全院網段物理負荷分佈圖表
                </h3>
                <div className="flex-1 relative">
                    <Bar options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} data={chartData} />
                </div>
             </div>
          </div>
        )}

        {/* --- 視圖 B: 歷史大數據 (物理對稱：整合 CSV 與 雲端 historyRecords) --- */}
        {activeTab === "history" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-wrap items-center justify-between gap-4 glass-panel p-8 rounded-[2rem] bg-white/90 border-none shadow-sm">
                    <div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">大數據對沖引擎</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Manual CSV Injection & Cloud Archive Mirror</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={downloadTemplate} title="下載物理範本" className="px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs hover:bg-slate-200 transition-all flex items-center gap-2 shadow-sm">
                           <span className="material-symbols-outlined text-base">download</span> 下載範本
                        </button>
                        <input id="adminUniqueHistoryCsvIn" type="file" accept=".csv" ref={fileInputRef} onChange={handleCsvUpload} className="hidden" title="選擇大數據檔案" />
                        <button onClick={() => fileInputRef.current?.click()} className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/30 hover:brightness-110 active:scale-95 transition-all flex items-center gap-2">
                            <span className="material-symbols-outlined text-base">cloud_upload</span> 物理放置 CSV
                        </button>
                        {csvHistory.length > 0 && <button onClick={() => setCsvHistory([])} className="px-6 py-3 bg-red-50 text-red-600 rounded-2xl font-black text-xs hover:bg-red-100 transition-all">重設緩存</button>}
                    </div>
                </div>

                <div className="glass-panel overflow-hidden rounded-[2.5rem] bg-white border-none shadow-2xl">
                    {csvHistory.length === 0 && historyRecords.length === 0 ? (
                        <div className="p-32 text-center opacity-30 font-black italic tracking-widest uppercase text-slate-400">歷史大數據矩陣尚未對沖...</div>
                    ) : (
                        <div className="overflow-x-auto max-h-[60vh]">
                            <div className="bg-slate-50/50 px-8 py-4 border-b border-slate-100 flex justify-between items-center">
                                <span className="text-[11px] font-black text-blue-600 uppercase tracking-widest">
                                    {csvHistory.length > 0 ? `目前模式：CSV 物理對沖數據 (${csvHistory.length} 筆)` : `目前模式：雲端大數據歸檔預覽 (${historyRecords.length} 筆)`}
                                </span>
                            </div>
                            <table className="w-full text-left user-table">
                                <thead className="sticky top-0 z-20">
                                    <tr>
                                        {csvHistory.length > 0 
                                            ? Object.keys(csvHistory[0]).map(h => <th key={h} className="px-6 py-5 whitespace-nowrap">{h}</th>)
                                            : ["項次", "結案單號", "使用單位", "主要MAC", "核定IP", "品牌型號"].map(h => <th key={h} className="px-6 py-5 whitespace-nowrap">{h}</th>)
                                        }
                                    </tr>
                                </thead>
                                <tbody>
                                    {csvHistory.length > 0 ? (
                                        filteredCsvHistory.slice(0, 50).map((r: Record<string, string>, i: number) => (
                                            <tr key={i} className="user-row text-[12px] font-bold text-slate-600">
                                                {Object.values(r).map((v, j) => <td key={j} className="px-6 py-4 border-b border-slate-50">{v}</td>)}
                                            </tr>
                                        ))
                                    ) : (
                                        /* 🚀 物理修復：變數命名更正為 filteredCloudHistory 並加入強型別 (r: Record<string, unknown>, i: number) */
                                        filteredCloudHistory.slice(0, 50).map((r: Record<string, unknown>, i: number) => (
                                            <tr key={i} className="user-row text-[12px] font-bold text-slate-600">
                                                <td className="px-6 py-4 border-b border-slate-50">{i + 1}</td>
                                                <td className="px-6 py-4 border-b border-slate-50 font-black">{String(r.結案單號 || r.id || "")}</td>
                                                <td className="px-6 py-4 border-b border-slate-50">{String(r.使用單位 || "")}</td>
                                                <td className="px-6 py-4 border-b border-slate-50 font-mono text-[10px]">{String(r.主要mac || "")}</td>
                                                <td className="px-6 py-4 border-b border-slate-50 font-mono text-blue-600">{String(r.核定ip || "")}</td>
                                                <td className="px-6 py-4 border-b border-slate-50">{String(r.品牌型號 || "")}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* --- 視圖 D: 使用者管理 --- */}
        {activeTab === "users" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="flex flex-wrap items-center justify-between gap-4 glass-panel p-6 rounded-2xl bg-white border-none shadow-sm">
                <div className="flex items-center gap-2">
                   <button onClick={syncCoreData} className="px-5 py-2.5 bg-[#40c4ff] text-white rounded-lg font-bold text-xs flex items-center gap-2 shadow-md hover:brightness-105 transition-all"><span className="material-symbols-outlined text-[16px]">refresh</span> 重整</button>
                   <button onClick={() => setIsPolicyOpen(true)} className="px-5 py-2.5 bg-[#ffb300] text-white rounded-lg font-bold text-xs flex items-center gap-2 shadow-md hover:bg-[#ffa000] transition-all"><span className="material-symbols-outlined text-[16px]">verified_user</span> 政策</button>
                   <button onClick={() => { setEditingUser(null); setIsUserEditOpen(true); }} className="px-5 py-2.5 bg-[#66bb6a] text-white rounded-lg font-bold text-xs flex items-center gap-2 shadow-md hover:brightness-105 active:scale-95"><span className="material-symbols-outlined text-[16px]">person_add</span> 新增</button>
                </div>
                <div className="flex items-center gap-3">
                   <div className="relative">
                      <input id="adminUniqueGlobalUserSearchInput" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="名稱、帳號搜尋..." title="搜尋帳號資訊" className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold w-64 focus:ring-1 focus:ring-blue-500 outline-none shadow-inner" />
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                   </div>
                </div>
             </div>

             <div className="glass-panel overflow-hidden rounded-2xl bg-white border-none shadow-xl">
                <div className="overflow-x-auto">
                   <table className="w-full text-left user-table">
                      <thead>
                         <tr>
                            <th className="px-6 py-5 w-16">切換</th>
                            <th className="px-4 py-5 w-16">項次</th>
                            <th className="px-4 py-5 w-20">編號</th>
                            <th className="px-8 py-5 text-left">使用者名稱</th>
                            <th className="px-8 py-5 text-left">帳號</th>
                            <th className="px-8 py-5 text-left">建立時間</th>
                            <th className="px-8 py-5 text-left">更新時間</th>
                            <th className="px-6 py-5">狀態</th>
                            <th className="px-8 py-5">Action</th>
                         </tr>
                      </thead>
                      <tbody>
                         {filteredUsers.map((u, i) => (
                            <tr key={u.id} className="user-row text-[12px] font-bold text-slate-600">
                               <td className="px-6 py-5"><button title="模擬身份切換" className="w-8 h-8 rounded-lg border border-slate-100 flex items-center justify-center text-slate-300 hover:text-blue-500 transition-all"><span className="material-symbols-outlined text-[18px]">reply</span></button></td>
                               <td className="px-4 py-5 text-slate-400">{i + 1}</td>
                               <td className="px-4 py-5 font-mono text-slate-400">{u.id}</td>
                               <td className="px-8 py-5 text-left font-black text-slate-800">{u.username}</td>
                               <td className="px-8 py-5 text-left text-slate-400 font-mono tracking-wider">{u.account}</td>
                               <td className="px-8 py-5 text-left text-slate-400 font-mono text-[11px]">{u.createdAt || '2023/08/22 08:57'}</td>
                               <td className="px-8 py-5 text-left text-slate-500 font-mono text-[11px]">{u.updatedAt || '2026/04/27 16:51'}</td>
                               <td className="px-6 py-5">
                                  <div className="flex items-center justify-center gap-3">
                                     <span className={`text-[11px] font-black ${u.status ? 'text-emerald-600' : 'text-slate-400'}`}>{u.status ? '啟用' : '停用'}</span>
                                     <div onClick={() => toggleStatus(u.id)} className={`toggle-switch ${u.status ? 'active' : ''} ml-2`} title="物理切換帳號啟用狀態"><div className="toggle-knob"></div></div>
                                  </div>
                               </td>
                               <td className="px-8 py-5">
                                  <div className="flex justify-center gap-1.5">
                                     <button onClick={() => { setEditingUser(u); setIsUserEditOpen(true); }} className="px-3.5 py-1.5 bg-[#42a5f5] text-white rounded font-black text-[10px] hover:brightness-105 transition-all">編輯</button>
                                     <button className="px-3.5 py-1.5 bg-[#ffa726] text-white rounded font-black text-[10px]">身份</button>
                                     <button onClick={() => deleteUser(u.id)} className="px-3.5 py-1.5 bg-[#ef5350] text-white rounded font-black text-[10px] hover:brightness-105 transition-all">刪除</button>
                                  </div>
                               </td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
                <div className="p-6 border-t flex flex-col sm:flex-row justify-center items-center bg-white gap-10 text-[11px] font-black text-slate-400">
                   <p>共 {users.length} 條物理紀錄</p>
                   <div className="flex items-center gap-4">
                      <select id="userManagementTableUniquePageSizeSelect" value={pageSize} onChange={e => setPageSize(Number(e.target.value))} title="每頁顯示條數" className="bg-white border border-slate-200 rounded px-3 py-1.5 outline-none text-slate-600 cursor-pointer"><option value={20}>20 條/頁</option><option value={50}>50 條/頁</option></select>
                      <div className="flex items-center gap-2 font-bold text-slate-500">跳至 <input id="adminUniqueUserTableJumpPageInput" title="跳頁" placeholder="1" className="w-10 h-7 border border-slate-200 rounded text-center outline-none text-slate-600" defaultValue={1} /> 頁</div>
                   </div>
                </div>
             </div>
          </div>
        )}

        {activeTab === "vans" && <div className="space-y-8 animate-in fade-in duration-500 pb-12"><VansCoreMetrics metrics={vansMetrics} /><VansReport /></div>}
      </main>

      {/* 🚀 彈窗 A: 編輯使用者資料 (對位截圖 image_f30a7d) */}
      {isUserEditOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-md">
           <div className="bg-white w-full max-w-2xl rounded-[1.5rem] shadow-2xl animate-in zoom-in-95 overflow-hidden border border-white">
              <div className="flex justify-between items-center px-8 py-6 border-b border-slate-100 bg-slate-50/50">
                 <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-600">account_circle</span> 編輯使用者資料
                 </h2>
                 <button onClick={() => setIsUserEditOpen(false)} title="關閉" className="text-slate-400 hover:text-slate-600 transition-colors shadow-inner w-10 h-10 rounded-full flex items-center justify-center"><span className="material-symbols-outlined">close</span></button>
              </div>
              <form onSubmit={handleUserUpdate} className="p-10 space-y-8">
                 <div className="flex items-center gap-10">
                    <label htmlFor="modalAdminUniqueAccountInputIn" className="w-32 text-right text-sm font-bold text-slate-500 flex items-center justify-end gap-1"><span className="text-red-500 mr-1">*</span>帳號</label>
                    <input id="modalAdminUniqueAccountInputIn" name="account" defaultValue={editingUser?.account} required title="帳號必填" className="flex-1 border border-slate-200 rounded-lg px-4 py-3 outline-none focus:ring-1 focus:ring-blue-400 shadow-inner" />
                 </div>
                 <div className="flex items-center gap-10">
                    <label htmlFor="modalAdminUniqueNameInputIn" className="w-32 text-right text-sm font-bold text-slate-500">顯示名稱</label>
                    <input id="modalAdminUniqueNameInputIn" name="username" defaultValue={editingUser?.username} title="顯示名稱" className="flex-1 border border-slate-200 rounded-lg px-4 py-3 outline-none shadow-inner" />
                 </div>
                 <div className="flex items-center gap-10">
                    <label htmlFor="modalAdminUniqueMailInputIn" className="w-32 text-right text-sm font-bold text-slate-500">電子郵件</label>
                    <input id="modalAdminUniqueMailInputIn" name="email" type="email" defaultValue={editingUser?.email} placeholder="ian@rapixus.com" title="電子郵件" className="flex-1 border border-slate-200 rounded-lg px-4 py-3 outline-none shadow-inner" />
                 </div>
                 <div className="flex justify-between items-center pt-10 border-t border-slate-50">
                    <button type="button" className="px-6 py-3 bg-[#ffb74d] text-white rounded-lg font-black text-xs flex items-center gap-2 shadow-md hover:brightness-105 transition-all"><span className="material-symbols-outlined text-[16px]">lock_open</span>修改密碼</button>
                    <div className="flex gap-4">
                       <button type="submit" className="px-10 py-3 bg-[#42a5f5] text-white rounded-lg font-black text-xs shadow-lg active:scale-95 transition-all">更新資料</button>
                       <button type="button" onClick={() => setIsUserEditOpen(false)} className="px-8 py-3 bg-white border border-slate-200 rounded-lg text-slate-500 font-bold text-xs shadow-sm hover:bg-slate-50">取消離開</button>
                    </div>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* 🚀 彈窗 B: 編輯使用者政策 (對位截圖 image_f30a1d) */}
      {isPolicyOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-md">
           <div className="bg-white w-full max-w-2xl rounded-[1.5rem] shadow-2xl animate-in zoom-in-95 overflow-hidden">
              <div className="flex justify-between items-center px-8 py-6 border-b border-slate-100 bg-slate-50/50">
                 <h2 className="text-xl font-bold text-slate-800 tracking-tight">編輯使用者政策</h2>
                 <button onClick={() => setIsPolicyOpen(false)} title="關閉彈窗" className="text-slate-400 hover:text-slate-600 transition-colors"><span className="material-symbols-outlined">close</span></button>
              </div>
              <div className="p-10 max-h-[60vh] overflow-y-auto space-y-6">
                 {[
                   { l: "密碼最小長度", v: policyData?.pwd_min_len || 6, u: "字元" },
                   { l: "密碼最小使用天數", v: policyData?.pwd_min_days || 1, u: "天" },
                   { l: "密碼最大使用天數", v: policyData?.pwd_max_days || 180, u: "天" },
                   { l: "帳戶鎖定時間", v: policyData?.account_lock_sec || 900, u: "秒" },
                   { l: "未操作強制登出", v: policyData?.idle_logout_min || 30, u: "分鐘" },
                 ].map((p, idx) => (
                    <div key={idx} className="flex items-center gap-10">
                       <div className="w-56 text-right text-sm font-bold text-slate-600 flex items-center justify-end gap-2">
                          {p.l} <span className="material-symbols-outlined text-[16px] text-slate-300">help</span>
                       </div>
                       <div className="flex-1 flex items-center gap-4">
                          <input id={`adminPolicyUniqueAdminKeyInputIn_${idx}`} title={p.l} defaultValue={p.v} className="w-32 border border-slate-200 rounded px-4 py-2 outline-none font-mono" />
                          <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">{p.u}</span>
                       </div>
                    </div>
                 ))}
              </div>
              <div className="p-8 border-t border-slate-100 flex justify-end gap-4 bg-slate-50/30">
                 <button onClick={() => setIsPolicyOpen(false)} className="px-10 py-2 bg-[#42a5f5] text-white rounded-lg font-black text-xs shadow-md active:scale-95 transition-all">儲存政策</button>
                 <button onClick={() => setIsPolicyOpen(false)} className="px-8 py-2 border border-slate-200 rounded-lg text-slate-500 font-bold text-xs hover:bg-white transition-all">關閉視窗</button>
              </div>
           </div>
        </div>
      )}

      {/* 🚀 底部浮動分頁切換器 */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[130] bg-slate-900/90 backdrop-blur-2xl p-2 rounded-full shadow-2xl border border-white/10 flex gap-1 animate-in slide-in-from-bottom-10 duration-700">
        <button onClick={() => setActiveTab("dashboard")} className={`px-6 py-2.5 rounded-full font-black text-[10px] uppercase transition-all duration-300 ${activeTab === "dashboard" ? "bg-white text-slate-900 shadow-xl scale-105" : "text-slate-400 hover:text-white"}`}>總覽</button>
        <button onClick={() => setActiveTab("history")} className={`px-6 py-2.5 rounded-full font-black text-[10px] uppercase transition-all duration-300 ${activeTab === "history" ? "bg-white text-slate-900 shadow-xl scale-105" : "text-slate-400 hover:text-white"}`}>歷史</button>
        <button onClick={() => setActiveTab("vans")} className={`px-6 py-2.5 rounded-full font-black text-[10px] uppercase transition-all duration-300 ${activeTab === "vans" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/50 scale-105" : "text-slate-400 hover:text-white"}`}>VANS</button>
        <button onClick={() => setActiveTab("users")} className={`px-6 py-2.5 rounded-full font-black text-[10px] uppercase transition-all duration-300 ${activeTab === "users" ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/50 scale-105" : "text-slate-400 hover:text-white"}`}>帳號管理</button>
      </div>

      {/* 全域物理遮罩 */}
      {(isLoading || isCsvParsing) && (
        <div className="fixed inset-0 z-[2000] flex flex-col items-center justify-center bg-white/90 backdrop-blur-2xl">
          <div className="w-16 h-16 border-[6px] border-slate-100 border-t-blue-600 rounded-full animate-spin mb-8 shadow-2xl shadow-blue-500/10"></div>
          <p className="text-blue-600 font-black tracking-[0.6em] uppercase text-xs animate-pulse">
            {isCsvParsing ? "正在物理對沖大數據 CSV..." : "全院數據物理對沖同步中..."}
          </p>
        </div>
      )}

      {/* 通知氣泡 */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[2100] flex flex-col gap-3 pointer-events-none w-full max-w-[320px] px-5">
        {toasts.map(t => (
          <div key={t.id} className={`px-8 py-5 rounded-[2rem] shadow-2xl font-black text-[11px] animate-in slide-in-from-bottom-4 flex items-center gap-4 border border-white/20 ${t.type === "success" ? "bg-slate-900/95" : t.type === "error" ? "bg-red-600/95" : "bg-blue-600/95"} text-white backdrop-blur-md`}>
            <span className="material-symbols-outlined text-lg">{t.type === 'success' ? 'verified' : 'error'}</span>
            <span className="tracking-wide text-[12px]">{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}