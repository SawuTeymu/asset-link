"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

// --- 🚀 後端 Server Actions ---
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
 * 狀態：V41.0 終極還原與無障礙修復版
 * 物理職責：
 * 1. UI 全數還原：毛玻璃、動畫、漸層發光背景。
 * 2. VANS 實體對沖：支援 CSV 直接匯入。
 * 3. 🚨 Axe Forms 修復：所有 input 具備 title, aria-label, 與明確的 htmlFor 對應。
 * ==========================================
 */

interface UserRecord {
  id: string; username: string; account: string; email: string;
  org: string; status: boolean; role: string; createdAt: string; updatedAt: string;
}

interface NsrRawRecord { 處理狀態?: string; [key: string]: unknown; }

interface PolicyData {
  pwd_min_len?: number; account_lock_sec?: number; idle_logout_min?: number;
  pwd_min_days?: number; pwd_max_days?: number;
}

interface VansMetrics { macErrorCount: number; ipConflictCount: number; zombieAlertCount: number; }

export default function AdminDashboard() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const vansInputRef = useRef<HTMLInputElement>(null);

  // --- 1. UI 與交互核心狀態 ---
  const [activeTab, setActiveTab] = useState<"dashboard" | "history" | "vans" | "users">("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // --- 2. 數據對沖矩陣 ---
  const [stats, setStats] = useState({ pending: 0, done: 0, nsrPending: 0, nsrSettle: 0 });
  const [vansMetrics, setVansMetrics] = useState<VansMetrics>({ macErrorCount: 0, ipConflictCount: 0, zombieAlertCount: 0 });
  const [ipData, setIpData] = useState<{ segment: string; count: number; percent: number }[]>([]);
  const [historyRecords, setHistoryRecords] = useState<Record<string, unknown>[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" | "info" }[]>([]);

  // --- 3. 彈窗與 CSV 狀態 ---
  const [isCsvParsing, setIsCsvParsing] = useState(false);
  const [isUserEditOpen, setIsUserEditOpen] = useState(false);
  const [isPolicyOpen, setIsPolicyOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [policyData, setPolicyData] = useState<PolicyData | null>(null);

  // --- 4. VANS 專屬解析狀態 ---
  const [vansData, setVansData] = useState<any[]>([]);
  const [vansConflicts, setVansConflicts] = useState<any[]>([]);

  const showToast = useCallback((msg: string, type: "success" | "error" | "info" = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // --- 核心同步 ---
  const syncCoreData = useCallback(async () => {
    const isAuth = sessionStorage.getItem("asset_link_admin_auth");
    if (!isAuth) { router.push("/"); return; }
    try {
      const [eriStats, nsrData, vans, ips, dbUsers, policy, cloudHistory] = await Promise.all([
        getDashboardStats(), getNsrList(), getVansMetrics(), getIpUsageStats(),
        getAllUsers(), getSystemPolicy(), getHistoryRecords()
      ]);

      const nsrTyped = nsrData as NsrRawRecord[];
      const nsrPendingCount = nsrTyped.filter(r => ["未處理", "待處理", ""].includes(String(r.處理狀態 || "").trim())).length;
      const nsrSettleCount = nsrTyped.filter(r => String(r.處理狀態 || "").trim() === "待請款").length;

      setStats({ ...eriStats, nsrPending: nsrPendingCount, nsrSettle: nsrSettleCount });
      setVansMetrics(vans as VansMetrics);
      setIpData(ips);
      setUsers(dbUsers as UserRecord[]);
      setPolicyData(policy as PolicyData);
      setHistoryRecords(cloudHistory as Record<string, unknown>[]);
    } catch {
      showToast("雲端連線異常", "error");
    } finally { setIsLoading(false); }
  }, [router, showToast]);

  useEffect(() => { syncCoreData(); }, [syncCoreData]);

  // --- VANS 大數據解析引擎 (針對 vans全用戶.csv) ---
  const handleVansUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCsvParsing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/^\uFEFF/, ''));
        const parsed = lines.slice(1).filter(l => l.trim() !== "").map(line => {
          const values = line.split(',');
          const entry: Record<string, string> = {};
          headers.forEach((h, i) => { entry[h] = values[i]?.trim() || ""; });
          return entry;
        });

        setVansData(parsed);

        // 進行物理對沖分析
        let macErrors = 0;
        let ipConflicts = 0;
        let zombies = 0;
        const conflictsList: any[] = [];

        parsed.forEach(v => {
           const vIp = v['內網 IP 位址'];
           const vMac = v['MAC 地址']?.toUpperCase().replace(/-/g, ':');
           const vStatus = v['在線'];
           const vName = v['名稱'];

           if(!vIp) return;

           // 1. 在 historyRecords 中尋找相同 IP
           const matchedAsset = historyRecords.find(r => r.核定ip === vIp);
           if(matchedAsset) {
              const aMac = String(matchedAsset.主要mac || "").toUpperCase();
              
              // 2. 檢測 MAC 偏差
              if(aMac && vMac && aMac !== vMac) {
                  macErrors++;
                  conflictsList.push({
                      type: 'MAC_ERROR',
                      ip: vIp,
                      vansName: vName,
                      assetName: matchedAsset.設備名稱標記 || "無標記",
                      vansMac: vMac,
                      assetMac: aMac,
                      desc: "MAC 物理位置不吻合"
                  });
              }

              // 3. 檢測殭屍設備 (歷史紀錄為汰換，但在 VANS 顯示在線)
              const remark = String(matchedAsset.行政備註 || "");
              if (remark.includes("汰換") && vStatus === "在線") {
                  zombies++;
                  conflictsList.push({
                      type: 'ZOMBIE',
                      ip: vIp,
                      vansName: vName,
                      assetName: matchedAsset.設備名稱標記 || "無標記",
                      vansMac: vMac,
                      assetMac: aMac,
                      desc: "已汰換設備卻仍處於在線狀態"
                  });
              }
           } else {
              // 在歷史庫找不到，但在 VANS 裡有，且在線 -> 未註冊的黑戶 IP 佔用
              if (vStatus === "在線") {
                  ipConflicts++;
                  conflictsList.push({
                      type: 'IP_CONFLICT',
                      ip: vIp,
                      vansName: vName,
                      assetName: "未註冊設備",
                      vansMac: vMac,
                      assetMac: "無紀錄",
                      desc: "未註冊設備佔用院內網段"
                  });
              }
           }
        });

        setVansMetrics({ macErrorCount: macErrors, ipConflictCount: ipConflicts, zombieAlertCount: zombies });
        setVansConflicts(conflictsList);
        showToast(`VANS 物理對沖完成！發現 ${conflictsList.length} 筆資安異常`, "info");
      } catch (err) {
        showToast("VANS 數據解析失敗", "error");
      } finally {
        setIsCsvParsing(false);
      }
    };
    reader.readAsText(file);
  };

  // --- 行政維護動作 ---
  const handleUserUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      await upsertUser({
        id: editingUser?.id, username: fd.get("username") as string,
        account: fd.get("account") as string, email: fd.get("email") as string,
        status: editingUser?.status ?? true
      });
      showToast("使用者資料更新成功");
      setIsUserEditOpen(false);
      await syncCoreData();
    } catch { showToast("資料入庫失敗", "error"); } finally { setIsLoading(false); }
  };

  const toggleStatus = async (id: string) => {
    const target = users.find(u => u.id === id);
    if (!target) return;
    try {
      await upsertUser({ ...target, status: !target.status });
      setUsers(prev => prev.map(u => u.id === id ? { ...u, status: !u.status } : u));
      showToast("狀態同步成功", "success");
    } catch { showToast("狀態更新異常", "error"); }
  };

  const deleteUser = async (id: string) => {
    if (!confirm("確定抹除此帳號？")) return;
    setIsLoading(true);
    try {
      await deleteUserRecord(id);
      showToast("帳號已抹除", "success");
      await syncCoreData();
    } catch { showToast("抹除失敗", "error"); } finally { setIsLoading(false); }
  };

  // --- 數據過濾計算 ---
  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return users.filter(u => u.username?.toLowerCase().includes(q) || u.account?.toLowerCase().includes(q));
  }, [searchQuery, users]);

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
      backgroundColor: ['#3b82f6', '#6366f1', '#10b981', '#f59e0b', '#ef4444'],
      borderRadius: 16,
      barThickness: 32
    }]
  };

  return (
    <div className="bg-[#f8fafc] min-h-screen font-sans text-slate-900 antialiased overflow-x-hidden relative">
      <style dangerouslySetInnerHTML={{ __html: `
        .glass-panel { background: rgba(255, 255, 255, 0.75); backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.8); box-shadow: 0 10px 40px -10px rgba(0,0,0,0.05); }
        .user-table th { background: #f1f5f9; border-bottom: 2px solid #e2e8f0; color: #475569; font-size: 11px; font-weight: 900; text-align: center; text-transform: uppercase; letter-spacing: 0.05em; padding: 16px; }
        .user-row { transition: all 0.2s ease; border-bottom: 1px solid #f1f5f9; text-align: center; }
        .user-row:hover { background: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.02); transform: translateY(-1px); }
        .toggle-switch { width: 44px; height: 24px; background: #cbd5e1; border-radius: 12px; position: relative; cursor: pointer; transition: 0.3s; }
        .toggle-switch.active { background: #10b981; }
        .toggle-knob { width: 20px; height: 20px; background: white; border-radius: 50%; position: absolute; top: 2px; left: 2px; transition: 0.3s cubic-bezier(0.4, 0.0, 0.2, 1); box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .toggle-switch.active .toggle-knob { left: 22px; }
      `}} />

      {/* V5.1 原始發光漸層背景 (強烈科技感) */}
      <div className="fixed z-0 blur-[120px] opacity-20 rounded-full pointer-events-none bg-blue-600 w-[600px] h-[600px] -top-48 -left-48 animate-pulse"></div>
      <div className="fixed z-0 blur-[120px] opacity-15 rounded-full pointer-events-none bg-emerald-500 w-[500px] h-[500px] bottom-0 right-0 animate-pulse delay-700"></div>

      <AdminSidebar currentRoute="/admin" isOpen={isSidebarOpen} onLogout={() => router.push("/")} />

      <main className="lg:ml-64 min-h-screen flex flex-col p-6 lg:p-10 relative z-10">
        
        <TopNavbar 
          title={activeTab === "dashboard" ? "行政對沖總覽" : activeTab === "history" ? "歷史大數據矩陣" : activeTab === "vans" ? "VANS 安全稽核" : "使用者維護中樞"}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        {/* ========================================================= */}
        {/* 視圖 A: Dashboard (核心儀表板) */}
        {/* ========================================================= */}
        {activeTab === "dashboard" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-panel p-8 rounded-[2rem] border-l-[6px] border-l-red-500 hover:shadow-xl transition-shadow">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span> MAC 地址偏差</span>
                   <div className="text-5xl font-black text-red-600 mt-3 tracking-tighter">{vansMetrics.macErrorCount}</div>
                </div>
                <div className="glass-panel p-8 rounded-[2rem] border-l-[6px] border-l-amber-500 hover:shadow-xl transition-shadow">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">IP 網域黑戶衝突</span>
                   <div className="text-5xl font-black text-amber-500 mt-3 tracking-tighter">{vansMetrics.ipConflictCount}</div>
                </div>
                <div className="glass-panel p-8 rounded-[2rem] bg-slate-900 text-white hover:shadow-2xl transition-shadow shadow-xl shadow-slate-900/20">
                   <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">報廢殭屍上線</span>
                   <div className="text-5xl font-black mt-3 tracking-tighter">{vansMetrics.zombieAlertCount}</div>
                </div>
             </div>

             <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="glass-panel p-6 rounded-[2rem] text-center hover:bg-white transition-colors"><span className="text-[10px] font-black text-slate-400 uppercase">ERI 待核定</span><div className="text-3xl font-black text-blue-600 mt-2">{stats.pending}</div></div>
                <div className="glass-panel p-6 rounded-[2rem] text-center hover:bg-white transition-colors"><span className="text-[10px] font-black text-slate-400 uppercase">NSR 未處理</span><div className="text-3xl font-black text-slate-700 mt-2">{stats.nsrPending}</div></div>
                <div className="glass-panel p-6 rounded-[2rem] text-center hover:bg-white transition-colors"><span className="text-[10px] font-black text-slate-400 uppercase">NSR 待核銷</span><div className="text-3xl font-black text-emerald-600 mt-2">{stats.nsrSettle}</div></div>
                <div className="glass-panel p-6 rounded-[2rem] text-center bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-xl shadow-blue-500/30"><span className="text-[10px] font-black uppercase text-blue-200">歷史結案總歸檔</span><div className="text-3xl font-black mt-2">{stats.done.toLocaleString()}</div></div>
             </div>

             <div className="glass-panel p-10 rounded-[2.5rem] min-h-[450px] flex flex-col border border-white">
                <h3 className="font-black text-sm uppercase tracking-widest text-slate-500 mb-8 flex items-center gap-3">
                   <span className="material-symbols-outlined text-blue-600 text-2xl">ssid_chart</span> 全院網段物理負荷分佈矩陣
                </h3>
                <div className="flex-1 relative w-full h-full">
                    <Bar options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } }} data={chartData} />
                </div>
             </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 視圖 B: History (歷史大數據庫) */}
        {/* ========================================================= */}
        {activeTab === "history" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex flex-wrap items-center justify-between gap-4 glass-panel p-8 rounded-[2rem] bg-white/90">
                    <div>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight">歷史結案大數據庫</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Cloud Archive Matrix</p>
                    </div>
                </div>

                <div className="glass-panel overflow-hidden rounded-[2.5rem] bg-white border border-white shadow-2xl shadow-slate-200/50">
                    <div className="bg-slate-50/80 px-8 py-5 border-b border-slate-100 flex justify-between items-center">
                        <span className="text-xs font-black text-blue-600 uppercase tracking-widest">
                            雲端歸檔預覽 (載入前 100 筆)
                        </span>
                    </div>
                    <div className="overflow-x-auto max-h-[65vh]">
                        <table className="w-full text-left user-table">
                            <thead className="sticky top-0 z-20 backdrop-blur-xl bg-slate-50/90">
                                <tr>
                                    {["項次", "結案單號", "裝機日期", "使用單位", "主要MAC", "核定IP", "品牌型號"].map(h => <th key={h} className="whitespace-nowrap">{h}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCloudHistory.map((r: Record<string, unknown>, i: number) => (
                                    <tr key={i} className="user-row text-[12px] font-bold text-slate-600 hover:bg-blue-50/30">
                                        <td className="p-5">{i + 1}</td>
                                        <td className="p-5 font-black text-slate-800">{String(r.結案單號 || r.id || "")}</td>
                                        <td className="p-5 text-slate-400">{String(r.裝機日期 || "")}</td>
                                        <td className="p-5">{String(r.使用單位 || "")}</td>
                                        <td className="p-5 font-mono text-[10.5px] text-slate-500 bg-slate-50 rounded-lg">{String(r.主要mac || "")}</td>
                                        <td className="p-5 font-mono text-blue-600 font-black">{String(r.核定ip || "")}</td>
                                        <td className="p-5">{String(r.品牌型號 || "")}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {/* ========================================================= */}
        {/* 視圖 C: VANS 安全稽核 */}
        {/* ========================================================= */}
        {activeTab === "vans" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="glass-panel p-10 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6 border-l-[8px] border-l-blue-600 bg-white/95">
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            <span className="material-symbols-outlined text-4xl text-blue-600">admin_panel_settings</span> VANS 實體防撞與資安對沖
                        </h2>
                        <p className="text-sm font-bold text-slate-500 mt-2">請匯入 VANS 匯出的 `vans全用戶.csv`，系統將自動比對歷史歸檔之 IP 與 MAC，揪出潛在威脅。</p>
                    </div>
                    <div className="flex gap-4">
                        {/* 🚀 Axe Form 修復：補齊 title 與 aria-label */}
                        <input id="vansFileInput" title="匯入 VANS 報表" aria-label="匯入 VANS 報表" type="file" accept=".csv" ref={vansInputRef} onChange={handleVansUpload} className="hidden" />
                        <button onClick={() => vansInputRef.current?.click()} className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl hover:bg-blue-600 hover:shadow-blue-500/40 transition-all active:scale-95 flex items-center gap-3">
                            <span className="material-symbols-outlined">upload_file</span> 匯入 VANS 報表
                        </button>
                        {vansData.length > 0 && (
                            <button onClick={() => { setVansData([]); setVansConflicts([]); }} className="px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm uppercase hover:bg-red-50 hover:text-red-500 transition-all">
                                清空對沖結果
                            </button>
                        )}
                    </div>
                </div>

                {/* VANS 對沖結果展示 */}
                {vansData.length > 0 && (
                    <div className="space-y-8 animate-in slide-in-from-bottom-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="glass-panel p-6 rounded-3xl border border-white flex flex-col items-center justify-center text-center">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">掃描總設備數</span>
                                <span className="text-4xl font-black text-blue-600 mt-2">{vansData.length}</span>
                            </div>
                            <div className="glass-panel p-6 rounded-3xl border border-red-100 bg-red-50/50 flex flex-col items-center justify-center text-center">
                                <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">MAC 物理不吻合</span>
                                <span className="text-4xl font-black text-red-600 mt-2">{vansMetrics.macErrorCount}</span>
                            </div>
                            <div className="glass-panel p-6 rounded-3xl border border-amber-100 bg-amber-50/50 flex flex-col items-center justify-center text-center">
                                <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">黑戶 IP 佔用</span>
                                <span className="text-4xl font-black text-amber-600 mt-2">{vansMetrics.ipConflictCount}</span>
                            </div>
                            <div className="glass-panel p-6 rounded-3xl bg-slate-900 text-white flex flex-col items-center justify-center text-center shadow-xl">
                                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">報廢殭屍上線</span>
                                <span className="text-4xl font-black text-white mt-2">{vansMetrics.zombieAlertCount}</span>
                            </div>
                        </div>

                        <div className="glass-panel rounded-[2.5rem] overflow-hidden bg-white shadow-2xl">
                            <div className="bg-slate-50/80 px-8 py-5 border-b border-slate-100 flex justify-between items-center">
                                <span className="text-sm font-black text-slate-800 flex items-center gap-2"><span className="material-symbols-outlined text-red-500">warning</span> 實體驗證異常清單</span>
                                <span className="text-xs font-bold px-3 py-1 bg-red-100 text-red-600 rounded-full uppercase tracking-widest">共 {vansConflicts.length} 筆異常</span>
                            </div>
                            
                            {vansConflicts.length === 0 ? (
                                <div className="p-20 text-center">
                                    <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-500 mb-4"><span className="material-symbols-outlined text-4xl">verified_user</span></div>
                                    <h4 className="text-xl font-black text-slate-800">網段完美對沖</h4>
                                    <p className="text-sm font-bold text-slate-500 mt-2">太棒了！目前的 VANS 數據與歷史庫紀錄 100% 吻合，無任何資安異常。</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto max-h-[60vh]">
                                    <table className="w-full text-left user-table">
                                        <thead className="sticky top-0 z-20 backdrop-blur-xl bg-slate-50/90">
                                            <tr>
                                                <th className="w-32">異常類型</th>
                                                <th>核定 IP 位址</th>
                                                <th>VANS 設備名稱</th>
                                                <th>系統登記名稱</th>
                                                <th>VANS MAC (實體)</th>
                                                <th>登記 MAC (雲端)</th>
                                                <th>資安判定說明</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {vansConflicts.map((c, i) => (
                                                <tr key={i} className="user-row text-[12px] font-bold text-slate-600 hover:bg-slate-50">
                                                    <td className="p-5">
                                                        <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-white ${c.type === 'MAC_ERROR' ? 'bg-red-500 shadow-lg shadow-red-200' : c.type === 'IP_CONFLICT' ? 'bg-amber-500 shadow-lg shadow-amber-200' : 'bg-slate-800 shadow-lg'}`}>
                                                            {c.type === 'MAC_ERROR' ? 'MAC 偏差' : c.type === 'IP_CONFLICT' ? '黑戶佔用' : '殭屍上線'}
                                                        </span>
                                                    </td>
                                                    <td className="p-5 font-mono text-blue-600 font-black text-sm">{c.ip}</td>
                                                    <td className="p-5">{c.vansName}</td>
                                                    <td className="p-5">{c.assetName}</td>
                                                    <td className="p-5 font-mono text-[11px] text-red-500 bg-red-50/50 rounded-md">{c.vansMac}</td>
                                                    <td className="p-5 font-mono text-[11px] text-emerald-600 bg-emerald-50/50 rounded-md">{c.assetMac}</td>
                                                    <td className="p-5 text-slate-400">{c.desc}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* ========================================================= */}
        {/* 視圖 D: 使用者管理 */}
        {/* ========================================================= */}
        {activeTab === "users" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
             <div className="flex flex-wrap items-center justify-between gap-4 glass-panel p-6 rounded-[2rem] bg-white/95 shadow-sm">
                <div className="flex items-center gap-3">
                   <button onClick={syncCoreData} className="px-6 py-3 bg-[#40c4ff] text-white rounded-xl font-black text-xs flex items-center gap-2 shadow-lg shadow-[#40c4ff]/30 hover:scale-105 transition-all"><span className="material-symbols-outlined text-[18px]">refresh</span> 強制同步</button>
                   <button onClick={() => setIsPolicyOpen(true)} className="px-6 py-3 bg-[#ffb300] text-white rounded-xl font-black text-xs flex items-center gap-2 shadow-lg shadow-[#ffb300]/30 hover:scale-105 transition-all"><span className="material-symbols-outlined text-[18px]">security</span> 安全政策</button>
                   <button onClick={() => { setEditingUser(null); setIsUserEditOpen(true); }} className="px-6 py-3 bg-[#10b981] text-white rounded-xl font-black text-xs flex items-center gap-2 shadow-lg shadow-[#10b981]/30 hover:scale-105 transition-all"><span className="material-symbols-outlined text-[18px]">person_add</span> 新增帳號</button>
                </div>
                <div className="relative">
                   {/* 🚀 Axe Form 修復：加入標籤連動與 title */}
                   <label htmlFor="adminUniqueGlobalUserSearch" className="sr-only">搜尋帳號</label>
                   <input id="adminUniqueGlobalUserSearch" title="搜尋帳號" aria-label="搜尋帳號" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="名稱、帳號搜尋..." className="pl-12 pr-6 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold w-72 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner" />
                   <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
                </div>
             </div>

             <div className="glass-panel overflow-hidden rounded-[2.5rem] bg-white shadow-2xl shadow-slate-200/60">
                <div className="overflow-x-auto">
                   <table className="w-full text-left user-table">
                      <thead className="bg-slate-50/80">
                         <tr>
                            <th className="w-16">身分</th>
                            <th className="w-16">項次</th>
                            <th className="text-left">使用者名稱</th>
                            <th className="text-left">帳號</th>
                            <th className="text-left">建立時間</th>
                            <th>狀態</th>
                            <th>操作 Action</th>
                         </tr>
                      </thead>
                      <tbody>
                         {filteredUsers.map((u, i) => (
                            <tr key={u.id} className="user-row text-[13px] font-bold text-slate-600">
                               <td className="p-5"><button title="切換身分" className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"><span className="material-symbols-outlined text-[20px]">swap_horiz</span></button></td>
                               <td className="p-5 text-slate-400">{i + 1}</td>
                               <td className="p-5 text-left font-black text-slate-800 text-sm">{u.username}</td>
                               <td className="p-5 text-left text-slate-500 font-mono tracking-wider">{u.account}</td>
                               <td className="p-5 text-left text-slate-400 font-mono text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                               <td className="p-5">
                                  <div className="flex items-center justify-center gap-3">
                                     <span className={`text-[10px] font-black uppercase tracking-widest ${u.status ? 'text-emerald-500' : 'text-slate-400'}`}>{u.status ? '已啟用' : '停用中'}</span>
                                     <div onClick={() => toggleStatus(u.id)} className={`toggle-switch ${u.status ? 'active' : ''}`}><div className="toggle-knob"></div></div>
                                  </div>
                               </td>
                               <td className="p-5">
                                  <div className="flex justify-center gap-2">
                                     <button onClick={() => { setEditingUser(u); setIsUserEditOpen(true); }} className="px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg font-black text-xs transition-all border border-blue-100">編輯</button>
                                     <button onClick={() => deleteUser(u.id)} className="px-4 py-2 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-lg font-black text-xs transition-all border border-red-100">刪除</button>
                                  </div>
                               </td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
                <div className="p-6 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
                   <p className="text-xs font-black text-slate-400 uppercase tracking-widest">共 {filteredUsers.length} 筆註冊帳戶</p>
                </div>
             </div>
          </div>
        )}
      </main>

      {/* ========================================================= */}
      {/* 🚀 彈窗區塊 */}
      {/* ========================================================= */}
      
      {/* 彈窗 A: 編輯使用者 */}
      {isUserEditOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl animate-in zoom-in-95 border-t-[10px] border-t-blue-500 overflow-hidden relative">
              <div className="px-10 py-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                 <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                    <span className="material-symbols-outlined text-blue-600 text-3xl">account_circle</span> {editingUser ? '編輯管理帳號' : '新增系統帳號'}
                 </h2>
                 <button onClick={() => setIsUserEditOpen(false)} className="w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-red-500 flex items-center justify-center shadow-sm transition-all"><span className="material-symbols-outlined">close</span></button>
              </div>
              <form onSubmit={handleUserUpdate} className="p-10 space-y-6">
                 {/* 🚀 Axe Form 修復：將 label 與 input 用 id 和 htmlFor 強制物理關聯 */}
                 <div className="space-y-2">
                    <label htmlFor="user-account-edit" className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1"><span className="text-red-500">*</span>登入帳號</label>
                    <input id="user-account-edit" name="account" title="登入帳號" aria-label="登入帳號" defaultValue={editingUser?.account} required className="w-full border-none bg-slate-50 rounded-2xl px-5 py-4 font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none shadow-inner text-sm" placeholder="ID / 員工編號" />
                 </div>
                 <div className="space-y-2">
                    <label htmlFor="user-username-edit" className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">顯示名稱</label>
                    <input id="user-username-edit" name="username" title="顯示名稱" aria-label="顯示名稱" defaultValue={editingUser?.username} className="w-full border-none bg-slate-50 rounded-2xl px-5 py-4 font-bold focus:ring-2 focus:ring-blue-500 outline-none shadow-inner text-sm" placeholder="中文全名" />
                 </div>
                 <div className="space-y-2">
                    <label htmlFor="user-email-edit" className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">電子信箱</label>
                    <input id="user-email-edit" name="email" type="email" title="電子信箱" aria-label="電子信箱" defaultValue={editingUser?.email} className="w-full border-none bg-slate-50 rounded-2xl px-5 py-4 font-bold focus:ring-2 focus:ring-blue-500 outline-none shadow-inner text-sm" placeholder="user@domain.com" />
                 </div>
                 <div className="pt-8 mt-4 border-t border-slate-100 flex gap-4">
                    <button type="button" onClick={() => setIsUserEditOpen(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">取消</button>
                    <button type="submit" className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/30 active:scale-95 transition-all">確認儲存並寫入資料庫</button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* 🚀 底部浮動分頁切換器 */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[130] bg-slate-900/80 backdrop-blur-2xl p-2.5 rounded-full shadow-2xl border border-white/10 flex gap-1.5 animate-in slide-in-from-bottom-10 duration-700">
        <button onClick={() => setActiveTab("dashboard")} className={`px-6 py-3 rounded-full font-black text-[11px] uppercase tracking-widest transition-all duration-300 ${activeTab === "dashboard" ? "bg-white text-slate-900 shadow-xl scale-105" : "text-slate-400 hover:text-white"}`}>總覽</button>
        <button onClick={() => setActiveTab("history")} className={`px-6 py-3 rounded-full font-black text-[11px] uppercase tracking-widest transition-all duration-300 ${activeTab === "history" ? "bg-white text-slate-900 shadow-xl scale-105" : "text-slate-400 hover:text-white"}`}>歷史庫</button>
        <button onClick={() => setActiveTab("vans")} className={`px-6 py-3 rounded-full font-black text-[11px] uppercase tracking-widest transition-all duration-300 ${activeTab === "vans" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/50 scale-105" : "text-slate-400 hover:text-white"}`}>VANS 稽核</button>
        <button onClick={() => setActiveTab("users")} className={`px-6 py-3 rounded-full font-black text-[11px] uppercase tracking-widest transition-all duration-300 ${activeTab === "users" ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/50 scale-105" : "text-slate-400 hover:text-white"}`}>帳號權限</button>
      </div>

      {/* 🚀 全域讀取遮罩 */}
      {(isLoading || isCsvParsing) && (
        <div className="fixed inset-0 z-[3000] flex flex-col items-center justify-center bg-white/80 backdrop-blur-xl animate-in fade-in">
          <div className="w-20 h-20 border-[6px] border-slate-100 border-t-blue-600 rounded-full animate-spin mb-8 shadow-2xl"></div>
          <p className="text-blue-600 font-black tracking-[0.5em] uppercase text-sm animate-pulse">
            {isCsvParsing ? "VANS 大數據物理對沖解析中..." : "全院數據物理對沖同步中..."}
          </p>
        </div>
      )}

      {/* 🚀 物理通知氣泡 */}
      <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[4000] flex flex-col gap-3 pointer-events-none w-full max-w-sm px-5">
        {toasts.map(t => (
          <div key={t.id} className={`px-8 py-5 rounded-[2rem] shadow-2xl font-black text-[12px] animate-in slide-in-from-bottom-4 flex items-center gap-4 border border-white/10 text-white backdrop-blur-xl ${t.type === "success" ? "bg-emerald-600/95" : t.type === "error" ? "bg-red-600/95" : "bg-slate-900/95"}`}>
            <span className="material-symbols-outlined text-xl">{t.type === 'success' ? 'verified' : t.type === 'error' ? 'error' : 'info'}</span>
            <span className="tracking-widest">{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}