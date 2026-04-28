"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

import { getDashboardStats, getIpUsageStats, getHistoryRecords, getVansMetrics } from "@/lib/actions/stats";
import { getNsrList } from "@/lib/actions/nsr";
import { getAllUsers } from "@/lib/actions/users";

import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

/**
 * ==========================================
 * 檔案：src/app/admin/page.tsx
 * 狀態：V300.3 Medical M3 (RWD 手機模式版)
 * ==========================================
 */

interface UserRecord { id: string; username: string; account: string; status: boolean; updatedAt: string; }
interface VansMetrics { macErrorCount: number; ipConflictCount: number; zombieAlertCount: number; lastAuditAt?: string; }

export default function AdminDashboard() {
  const router = useRouter();
  const vansInputRef = useRef<HTMLInputElement>(null);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // 🚀 手機側邊欄狀態
  const [activeTab, setActiveTab] = useState<"dashboard" | "history" | "vans" | "users">("dashboard");
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState({ pending: 0, done: 0, nsrPending: 0, nsrSettle: 0 });
  const [vansMetrics, setVansMetrics] = useState<VansMetrics>({ macErrorCount: 0, ipConflictCount: 0, zombieAlertCount: 0 });
  const [ipData, setIpData] = useState<{ segment: string; count: number; percent: number }[]>([]);
  const [historyRecords, setHistoryRecords] = useState<Record<string, any>[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [vansData, setVansData] = useState<any[]>([]);
  const [vansConflicts, setVansConflicts] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" | "info" }[]>([]);

  const showToast = useCallback((msg: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const syncCoreData = useCallback(async () => {
    const isAuth = sessionStorage.getItem("asset_link_admin_auth");
    if (isAuth !== "true") { router.push("/"); return; }
    setIsLoading(true);
    try {
      const [eriStats, nsrData, vans, ips, dbUsers, cloudHistory] = await Promise.all([
        getDashboardStats(), getNsrList(), getVansMetrics(), getIpUsageStats(), getAllUsers(), getHistoryRecords()
      ]);
      const nsrTyped = (nsrData || []) as any[];
      const { data: lastAudit } = await supabase.from("vans_audit_logs").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle();

      setStats({ 
        ...eriStats, 
        nsrPending: nsrTyped.filter(r => ["未處理", "待處理", ""].includes(String(r.處理狀態 || "").trim())).length,
        nsrSettle: nsrTyped.filter(r => String(r.處理狀態 || "").trim() === "待請款").length
      });
      setVansMetrics({ ...(vans as VansMetrics), lastAuditAt: lastAudit?.created_at ? new Date(lastAudit.created_at).toLocaleString() : "尚無持久化紀錄" });
      setIpData(ips || []); setUsers(dbUsers as UserRecord[] || []); setHistoryRecords(cloudHistory || []);
    } finally { setIsLoading(false); }
  }, [router]);

  useEffect(() => { syncCoreData(); }, [syncCoreData]);

  const handleVansUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setIsLoading(true);
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
        let mErr = 0, iCon = 0, zAmb = 0; const conflictsList: any[] = [];
        parsed.forEach(v => {
          const vIp = v['內網 IP 位址']; const vMac = v['MAC 地址']?.toUpperCase().replace(/-/g, ':'); const vStatus = v['在線'];
          if(!vIp) return;
          const matched = historyRecords.find(r => r.核定ip === vIp);
          if(matched) {
            const aMac = String(matched.主要mac || "").toUpperCase();
            if(aMac && vMac && aMac !== vMac) { mErr++; conflictsList.push({ type: 'MAC_ERROR', ip: vIp, vansName: v['名稱'], assetMac: aMac, desc: "MAC 物理位置不吻合" }); }
            if (String(matched.行政備註 || "").includes("汰換") && vStatus === "在線") { zAmb++; conflictsList.push({ type: 'ZOMBIE', ip: vIp, vansName: v['名稱'], assetMac: aMac, desc: "報廢設備非法連網" }); }
          } else if (vStatus === "在線") { iCon++; conflictsList.push({ type: 'IP_CONFLICT', ip: vIp, vansName: v['名稱'], assetMac: "無紀錄", desc: "黑戶 IP 佔用網段" }); }
        });
        setVansMetrics(prev => ({ ...prev, macErrorCount: mErr, ipConflictCount: iCon, zombieAlertCount: zAmb }));
        setVansConflicts(conflictsList);
        showToast("大數據物理對沖完成", "info");
      } catch { showToast("CSV 解析異常", "error"); }
      finally { setIsLoading(false); }
    };
    reader.readAsText(file);
  };

  const handleSaveAudit = async () => {
    if (vansConflicts.length === 0 && vansData.length === 0) return;
    setIsSaving(true);
    try {
      await supabase.from("vans_audit_logs").insert([{
        admin_name: sessionStorage.getItem("asset_link_admin_name") || "System",
        total_scanned: vansData.length,
        mac_errors: vansMetrics.macErrorCount,
        ip_conflicts: vansMetrics.ipConflictCount,
        zombies: vansMetrics.zombieAlertCount,
        conflict_data: vansConflicts
      }]);
      showToast("✅ 資安稽核歷史已持久化存檔", "success");
      syncCoreData();
    } finally { setIsSaving(false); }
  };

  const maxIpPercent = ipData.length > 0 ? Math.max(...ipData.map(d => d.percent)) : 85;

  return (
    <div className="medical-gradient min-h-screen font-body-md text-on-surface antialiased flex relative overflow-hidden">
      <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries" async></script>
      <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: `
        .clinical-glass { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.3); }
        .zebra-glass tr:nth-child(even) { background: rgba(255, 255, 255, 0.4); }
        .zebra-glass tr:nth-child(odd) { background: rgba(255, 255, 255, 0.1); }
        .neon-glow { box-shadow: 0 0 15px rgba(0, 99, 152, 0.3); }
        .icon-fill { font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
        .medical-gradient { background: radial-gradient(circle at top right, #e0f2fe 0%, #faf8ff 100%); }
      `}} />

      {/* 🚀 手機版遮罩 */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-sky-900/20 backdrop-blur-sm z-[45] md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* 🚀 側邊欄 (支援手機動態開關) */}
      <aside className={`fixed left-0 top-0 flex flex-col p-4 gap-4 h-screen w-64 border-r border-white/20 clinical-glass shadow-xl shadow-sky-900/10 z-50 transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="flex items-center justify-between px-2 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg">
              <span className="material-symbols-outlined icon-fill">hub</span>
            </div>
            <div>
              <h1 className="text-lg font-black text-sky-800 leading-none">中樞管理</h1>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-1">臨床結案系統</p>
            </div>
          </div>
          {/* 手機版關閉按鈕 */}
          <button className="md:hidden text-slate-500" onClick={() => setIsMobileMenuOpen(false)}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <nav className="flex-1 flex flex-col gap-1">
          <button onClick={() => { setActiveTab("dashboard"); setIsMobileMenuOpen(false); }} className={`flex w-full items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'dashboard' ? 'bg-sky-600 text-white shadow-lg' : 'text-slate-600 hover:bg-white/40'}`}>
            <span className="material-symbols-outlined">dashboard</span> <span className="font-bold text-sm">首頁概覽</span>
          </button>
          <button onClick={() => router.push("/pending")} className="flex w-full items-center gap-3 px-4 py-3 text-slate-600 hover:bg-white/40 transition-all rounded-lg">
            <span className="material-symbols-outlined">assignment_ind</span> <span className="font-bold text-sm">行政審核 (ERI)</span>
          </button>
          <button onClick={() => { setActiveTab("vans"); setIsMobileMenuOpen(false); }} className={`flex w-full items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'vans' ? 'bg-sky-600 text-white shadow-lg' : 'text-slate-600 hover:bg-white/40'}`}>
            <span className="material-symbols-outlined">lan</span> <span className="font-bold text-sm">VANS 安全稽核</span>
          </button>
        </nav>
        <button onClick={() => router.push("/internal")} className="mt-auto mb-4 mx-2 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-md active:scale-95 transition-all text-sm">
          <span className="material-symbols-outlined text-sm">add</span> 內部直通建檔
        </button>
      </aside>

      {/* 🚀 主畫布 (適應手機版 ml-0) */}
      <main className="w-full md:ml-64 min-h-screen flex flex-col relative z-10 transition-all duration-300">
        
        {/* TopAppBar */}
        <header className="sticky top-0 z-40 bg-white/60 backdrop-blur-xl border-b border-white/20 shadow-sm px-4 md:px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            {/* 🚀 手機漢堡選單 */}
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-sky-800 p-1">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <h2 className="text-lg md:text-xl font-bold tracking-tight text-sky-700">結案中樞</h2>
            <div className="hidden md:block h-6 w-[1px] bg-slate-200"></div>
            <span className="hidden md:inline text-sky-700 border-b-2 border-sky-600 font-bold px-1 py-1 text-sm">實時儀表板</span>
          </div>
          <div className="flex items-center gap-3 md:gap-6">
            <div className="hidden md:flex relative group">
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 pr-4 py-1.5 bg-white/50 border-none rounded-full text-xs w-64 focus:ring-2 focus:ring-blue-500/20 outline-none" placeholder="搜尋資產或 IP..." type="text" />
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
            </div>
            <button className="material-symbols-outlined text-slate-500 hover:text-blue-600">notifications</button>
            <button className="material-symbols-outlined text-slate-500 hover:text-blue-600" onClick={() => router.push("/")}>logout</button>
            <img alt="Admin" className="hidden sm:block w-8 h-8 rounded-full border-2 border-blue-500/20 object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA9i3KZ3gOVwTg_12TYCP3Xo-yYxedIFBUYC69ojloiAVpIP81jzkjENe8p69zLuZmk9sUd8EBNajbNmYPvMLqBH0G0TUVPHxAui1BMQXnfa83cgK4ItNm2X6ggEaA6-MahbS0wLm-cwRcgD0M9b4jKsHcpzrhvh_SqZcKeEweDsarIZXUdTE6hgLM1IV5hp7lh_nMJoFwaT-I0n2KeUxcTzxWiBwXmj0Zul66XTZ_nw-eM6-MbJSHzJpsiOtlnsP_M9h_IXHSDxn4" />
          </div>
        </header>

        <section className="p-4 md:p-8 max-w-[1440px] w-full mx-auto flex-1">
          
          {activeTab === 'dashboard' && (
            <div className="animate-in fade-in duration-500">
              <div className="mb-6 md:mb-8">
                <h2 className="text-2xl md:text-3xl font-black text-slate-800">系統儀表板</h2>
                <p className="text-sm text-slate-500 mt-1">監控全院 IT 資產、IP 分配及系統健康狀況。</p>
              </div>

              {/* 🚀 RWD Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
                <div className="clinical-glass p-5 md:p-6 rounded-2xl shadow-sm border-l-4 border-amber-400 flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-amber-600 bg-amber-100/50 px-2 py-1 rounded">待處理 (ERI)</span>
                    <span className="material-symbols-outlined text-amber-500 text-xl">pending_actions</span>
                  </div>
                  <h3 className="text-3xl font-black text-slate-800 mt-2">{stats.pending} <span className="text-sm font-normal text-slate-400">件</span></h3>
                </div>
                <div className="clinical-glass p-5 md:p-6 rounded-2xl shadow-sm border-l-4 border-blue-500 flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-blue-600 bg-blue-100/50 px-2 py-1 rounded">歸檔總數</span>
                    <span className="material-symbols-outlined text-blue-500 text-xl">devices</span>
                  </div>
                  <h3 className="text-3xl font-black text-slate-800 mt-2">{stats.done.toLocaleString()} <span className="text-sm font-normal text-slate-400">台</span></h3>
                </div>
                <div className="clinical-glass p-5 md:p-6 rounded-2xl shadow-sm border-l-4 border-indigo-500 flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-100/50 px-2 py-1 rounded">IP 峰值負載</span>
                    <span className="material-symbols-outlined text-indigo-500 text-xl">lan</span>
                  </div>
                  <h3 className="text-3xl font-black text-slate-800 mt-2">{maxIpPercent}%</h3>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2"><div className="bg-indigo-500 h-full rounded-full" style={{ width: `${maxIpPercent}%` }}></div></div>
                </div>
                <div className="clinical-glass p-5 md:p-6 rounded-2xl shadow-sm border-l-4 border-emerald-500 flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-100/50 px-2 py-1 rounded">系統健康度</span>
                    <span className="material-symbols-outlined text-emerald-500 text-xl">health_and_safety</span>
                  </div>
                  <h3 className="text-3xl font-black text-slate-800 mt-2">99.8%</h3>
                </div>
              </div>

              {/* 🚀 RWD Chart & Table */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
                <div className="col-span-1 lg:col-span-8 clinical-glass rounded-2xl p-5 md:p-8 overflow-hidden h-[350px] md:h-[420px] flex flex-col">
                  <div className="mb-4">
                    <h3 className="text-lg md:text-xl font-bold text-slate-800">網段物理負荷</h3>
                    <p className="text-xs text-slate-500">各子網段實時分配狀況</p>
                  </div>
                  <div className="flex-1 w-full relative">
                     <Bar options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 }, x: { grid: { display: false } } } }} data={{ labels: ipData.map(d => d.segment), datasets: [{ label: '%', data: ipData.map(d => d.percent), backgroundColor: '#3b82f6', borderRadius: 4 }] }} />
                  </div>
                </div>

                <div className="col-span-1 lg:col-span-4 clinical-glass rounded-2xl p-5 md:p-6 flex flex-col h-[420px]">
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-slate-800">安全日誌</h3>
                    <p className="text-xs text-slate-500">實時登入與 IP 分配紀錄</p>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <table className="w-full zebra-glass">
                      <thead className="bg-slate-50/50 text-[10px] uppercase text-slate-500">
                        <tr><th className="px-3 py-2 text-left">事件紀錄</th><th className="px-3 py-2 text-right">狀態</th></tr>
                      </thead>
                      <tbody>
                        {historyRecords.slice(0, 6).map((log, i) => (
                          <tr key={i}>
                            <td className="px-3 py-3">
                              <p className="font-bold text-xs text-slate-700 truncate max-w-[120px]">{log.品牌型號}</p>
                              <p className="text-[10px] font-mono text-slate-500">{log.主要mac}</p>
                            </td>
                            <td className="px-3 py-3 text-right"><span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">已儲存</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'vans' && (
            <div className="space-y-4 md:space-y-6 animate-in slide-in-from-bottom-4 duration-500">
              <div className="clinical-glass p-6 md:p-10 border-l-4 border-l-blue-600 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 md:gap-6 rounded-2xl shadow-sm">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-600 text-2xl md:text-3xl">security</span> VANS 安全稽核
                  </h2>
                  <p className="text-xs text-slate-500 mt-2">匯入 vans全用戶.csv 執行全網對沖與軌跡存檔。</p>
                </div>
                <div className="flex flex-wrap gap-3 w-full lg:w-auto">
                  <input id="v300-vans" type="file" accept=".csv" ref={vansInputRef} onChange={handleVansUpload} className="hidden" />
                  <button onClick={() => vansInputRef.current?.click()} className="flex-1 lg:flex-none px-6 py-2.5 bg-white border border-slate-200 text-blue-600 rounded-lg font-bold text-xs shadow-sm flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-sm">upload_file</span> 注入 CSV
                  </button>
                  {vansData.length > 0 && (
                    <button onClick={handleSaveAudit} disabled={isSaving} className="flex-1 lg:flex-none px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold text-xs shadow-md flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-sm">{isSaving ? 'sync' : 'save'}</span> 物理存入庫
                    </button>
                  )}
                </div>
              </div>

              {vansData.length > 0 && (
                <div className="clinical-glass rounded-2xl overflow-hidden shadow-sm">
                  {/* 🚀 手機版自動橫向滑動 */}
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-left zebra-glass font-mono text-sm min-w-[600px]">
                      <thead>
                        <tr className="border-b border-slate-200/50 bg-white/50">
                          <th className="px-4 md:px-6 py-3 text-xs font-bold text-slate-500">衝突類型</th>
                          <th className="px-4 md:px-6 py-3 text-xs font-bold text-slate-500">核定 IP</th>
                          <th className="px-4 md:px-6 py-3 text-xs font-bold text-slate-500">VANS 識別名稱</th>
                          <th className="px-4 md:px-6 py-3 text-xs font-bold text-slate-500 text-right">判定說明</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vansConflicts.map((c, i) => (
                          <tr key={i}>
                            <td className="px-4 md:px-6 py-4"><span className={`px-2 py-1 rounded text-[10px] font-black ${c.type==='MAC_ERROR'?'bg-red-100 text-red-600':'bg-amber-100 text-amber-600'}`}>{c.type}</span></td>
                            <td className="px-4 md:px-6 py-4 text-blue-600 font-bold">{c.ip}</td>
                            <td className="px-4 md:px-6 py-4 text-slate-700 truncate max-w-[150px]">{c.vansName}</td>
                            <td className="px-4 md:px-6 py-4 text-slate-500 text-right text-xs">{c.desc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* --- 全域強同步遮罩 --- */}
      {(isLoading || isSaving) && (
        <div className="fixed inset-0 z-[6000] flex flex-col items-center justify-center bg-white/60 backdrop-blur-md">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
          <p className="text-blue-600 font-bold text-[10px] uppercase tracking-widest animate-pulse">Syncing...</p>
        </div>
      )}

      {/* --- 物理通知氣泡 --- */}
      <div className="fixed bottom-6 right-4 md:bottom-10 md:right-8 z-[7000] flex flex-col gap-3">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 md:px-6 py-3 md:py-4 rounded-xl shadow-xl font-bold text-xs animate-in slide-in-from-right-4 flex items-center gap-3 border ${t.type === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
            <span className="material-symbols-outlined text-base">{t.type === 'success' ? 'check_circle' : 'error'}</span>
            <span className="tracking-wide">{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}