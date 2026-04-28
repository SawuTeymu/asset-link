"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// --- 🚀 引入後端 Server Actions (100% 保留) ---
import { 
  getDashboardStats, 
  getIpUsageStats, 
  getHistoryRecords, 
  getVansMetrics 
} from "@/lib/actions/stats";
import { getNsrList } from "@/lib/actions/nsr";
import { getAllUsers } from "@/lib/actions/users";

// --- 🚀 圖表引擎 (Chart.js) ---
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

/**
 * ==========================================
 * 檔案：src/app/admin/page.tsx
 * 狀態：V300.2 Medical M3 (結構修復版)
 * 修復項目：修正 TS17002 結尾標記缺失問題，確保 JSX 樹完整。
 * ==========================================
 */

interface UserRecord { id: string; username: string; account: string; status: boolean; updatedAt: string; }
interface VansMetrics { macErrorCount: number; ipConflictCount: number; zombieAlertCount: number; lastAuditAt?: string; }

export default function AdminDashboard() {
  const router = useRouter();
  const vansInputRef = useRef<HTMLInputElement>(null);

  // --- 1. 核心數據矩陣狀態 (100% 保留) ---
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
      
      {/* 🚀 物理脫離：定義動畫與圖示類別，消除 no-inline-styles 報警 */}
      <style dangerouslySetInnerHTML={{ __html: `
        .clinical-glass { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.3); }
        .zebra-glass tr:nth-child(even) { background: rgba(255, 255, 255, 0.4); }
        .zebra-glass tr:nth-child(odd) { background: rgba(255, 255, 255, 0.1); }
        .neon-glow { box-shadow: 0 0 15px rgba(0, 99, 152, 0.3); }
        .icon-fill { font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
        .breathing-sphere { filter: blur(60px); opacity: 0.4; animation: breathe 8s infinite ease-in-out; }
        .delay-2s { animation-delay: -2s; }
        .delay-4s { animation-delay: -4s; }
        @keyframes breathe {
          0%, 100% { transform: scale(1) translate(0, 0); opacity: 0.3; }
          50% { transform: scale(1.2) translate(20px, -20px); opacity: 0.5; }
        }
      `}} />

      <div className="absolute inset-0 overflow-hidden -z-10 bg-[radial-gradient(circle_at_50%_50%,_#eaedff_0%,_#faf8ff_100%)]">
        <div className="breathing-sphere absolute top-[-10%] left-[-5%] w-[500px] h-[500px] bg-primary-fixed-dim rounded-full"></div>
        <div className="breathing-sphere absolute bottom-[-15%] right-[-5%] w-[600px] h-[600px] bg-secondary-fixed rounded-full delay-2s"></div>
        <div className="breathing-sphere absolute top-[20%] right-[15%] w-[300px] h-[300px] bg-tertiary-fixed-dim rounded-full delay-4s"></div>
      </div>

      <aside className="fixed left-0 top-0 flex flex-col p-4 gap-4 h-screen w-64 border-r border-white/20 clinical-glass shadow-xl shadow-sky-900/10 z-50">
        <div className="flex items-center gap-3 px-2 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg">
            <span className="material-symbols-outlined icon-fill">hub</span>
          </div>
          <div>
            <h1 className="text-lg font-black text-sky-800 leading-none">中樞管理</h1>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-1">臨床結案系統</p>
          </div>
        </div>
        <nav className="flex-1 flex flex-col gap-1">
          <button onClick={() => setActiveTab("dashboard")} className={`flex w-full items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'dashboard' ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20' : 'text-slate-600 hover:bg-white/40 hover:translate-x-1'}`}>
            <span className="material-symbols-outlined">dashboard</span>
            <span className="font-label-lg">首頁概覽</span>
          </button>
          <button onClick={() => router.push("/pending")} className="flex w-full items-center gap-3 px-4 py-3 text-slate-600 hover:bg-white/40 hover:translate-x-1 transition-all rounded-lg">
            <span className="material-symbols-outlined">assignment_ind</span>
            <span className="font-label-lg">行政審核 (ERI)</span>
          </button>
          <button onClick={() => setActiveTab("history")} className={`flex w-full items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'history' ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20' : 'text-slate-600 hover:bg-white/40 hover:translate-x-1'}`}>
            <span className="material-symbols-outlined">inventory_2</span>
            <span className="font-label-lg">資產歷史庫</span>
          </button>
          <button onClick={() => setActiveTab("vans")} className={`flex w-full items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'vans' ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20' : 'text-slate-600 hover:bg-white/40 hover:translate-x-1'}`}>
            <span className="material-symbols-outlined">lan</span>
            <span className="font-label-lg">VANS 安全稽核</span>
          </button>
        </nav>
        <button onClick={() => router.push("/internal")} className="mt-auto mb-4 mx-2 flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-xl font-label-lg shadow-md active:scale-95 transition-all">
          <span className="material-symbols-outlined">add</span>
          內部直通建檔
        </button>
      </aside>

      <main className="ml-64 w-full min-h-screen flex flex-col relative z-10">
        <header className="sticky top-0 z-40 bg-white/60 backdrop-blur-xl border-b border-white/20 shadow-sm px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold tracking-tight text-sky-700">結案中樞</h2>
            <div className="h-6 w-[1px] bg-slate-200"></div>
            <span className="text-sky-700 border-b-2 border-sky-600 font-label-lg px-1">實時看板</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative group">
              <input className="bg-surface-container-low border-none rounded-full px-10 py-2 text-sm w-64 focus:ring-2 focus:ring-primary/20 transition-all outline-none" placeholder="搜尋案件或人員..." type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
            </div>
            <div className="flex items-center gap-3">
              <button className="material-symbols-outlined text-slate-500 hover:bg-sky-50/50 rounded-full p-2">notifications</button>
              <button onClick={() => router.push("/")} className="material-symbols-outlined text-slate-500 hover:bg-sky-50/50 rounded-full p-2">logout</button>
              <img alt="Admin" className="w-10 h-10 rounded-full border-2 border-primary/20 object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA9i3KZ3gOVwTg_12TYCP3Xo-yYxedIFBUYC69ojloiAVpIP81jzkjENe8p69zLuZmk9sUd8EBNajbNmYPvMLqBH0G0TUVPHxAui1BMQXnfa83cgK4ItNm2X6ggEaA6-MahbS0wLm-cwRcgD0M9b4jKsHcpzrhvh_SqZcKeEweDsarIZXUdTE6hgLM1IV5hp7lh_nMJoFwaT-I0n2KeUxcTzxWiBwXmj0Zul66XTZ_nw-eM6-MbJSHzJpsiOtlnsP_M9h_IXHSDxn4" />
            </div>
          </div>
        </header>

        <div className="p-8 max-w-[1440px] mx-auto w-full flex-1">
          {activeTab === 'dashboard' && (
            <div className="animate-in fade-in duration-500">
              <div className="grid grid-cols-12 gap-6 mb-8">
                <div className="col-span-8 clinical-glass rounded-3xl p-8 flex flex-col justify-between min-h-[400px]">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">System Live</span>
                      <h3 className="text-3xl font-headline-lg mt-4 text-on-surface">中樞營運概況</h3>
                      <p className="text-on-surface-variant mt-2 font-body-lg">目前有 {stats.pending} 個結案程序正在同步進行。</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-6 mt-12">
                    <div className="p-6 rounded-2xl bg-white/40 border border-white/50">
                      <p className="text-label-sm text-slate-500 uppercase">歸檔總數</p>
                      <span className="text-4xl font-headline-lg text-primary">{stats.done.toLocaleString()}</span>
                    </div>
                    <div className="p-6 rounded-2xl bg-white/40 border border-white/50">
                      <p className="text-label-sm text-slate-500 uppercase">待請款 (NSR)</p>
                      <span className="text-4xl font-headline-lg text-primary">{stats.nsrSettle}</span>
                    </div>
                    <div className="p-6 rounded-2xl bg-white/40 border border-white/50">
                      <p className="text-label-sm text-slate-500 uppercase">網路健康度</p>
                      <span className="text-4xl font-headline-lg text-emerald-600">99.8%</span>
                    </div>
                  </div>
                </div>

                <div className="col-span-4 clinical-glass rounded-3xl p-8 bg-slate-900/5 flex flex-col justify-between">
                  <h4 className="text-headline-sm text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">router</span> IP 接入監控
                  </h4>
                  <div className="relative my-8">
                    <div className="w-full bg-white/80 border-2 border-primary/30 rounded-2xl px-6 py-8 text-4xl font-mono font-black text-primary flex items-center justify-center neon-glow">
                      {maxIpPercent}%
                    </div>
                    <label className="absolute -top-3 left-4 bg-white px-2 text-xs font-bold text-primary rounded">MAX USAGE</label>
                  </div>
                  <button onClick={() => setActiveTab('vans')} className="w-full py-4 bg-primary text-white rounded-2xl font-headline-sm shadow-xl active:scale-95 transition-all">啟動 VANS 稽核</button>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-4 clinical-glass rounded-3xl p-6 flex flex-col">
                  <h4 className="font-headline-sm text-on-surface mb-6">網段物理負荷</h4>
                  <div className="flex-1 w-full h-[300px] relative">
                    <Bar options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 }, x: { grid: { display: false } } } }} data={{ labels: ipData.map(d => d.segment), datasets: [{ label: '%', data: ipData.map(d => d.percent), backgroundColor: '#006194', borderRadius: 4 }] }} />
                  </div>
                </div>
                <div className="col-span-8 clinical-glass rounded-3xl p-6 overflow-auto">
                   <h4 className="font-headline-sm text-on-surface mb-6">最近核發案件 (歸檔庫)</h4>
                   <table className="w-full text-left zebra-glass">
                      <thead>
                        <tr className="text-slate-400 text-xs uppercase border-b border-slate-100/50">
                          <th className="p-4">設備標記</th><th className="p-4">供應商</th><th className="p-4">核定 IP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyRecords.slice(0, 5).map((record, idx) => (
                          <tr key={idx}>
                            <td className="p-4 font-bold">{record.設備名稱標記 || '未知'}</td>
                            <td className="p-4">{record.同步來源 || '內部人員'}</td>
                            <td className="p-4 font-mono text-primary font-bold">{record.核定ip}</td>
                          </tr>
                        ))}
                      </tbody>
                   </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'vans' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
              <div className="clinical-glass p-10 border-l-4 border-l-primary flex flex-col md:flex-row justify-between items-center gap-6 rounded-3xl shadow-sm">
                <div>
                  <h2 className="text-3xl font-headline-lg text-on-surface tracking-tight flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-4xl icon-fill">security</span> VANS 實體對沖
                  </h2>
                  <p className="text-sm text-slate-500 mt-2">匯入 CSV 執行全網對沖與資安軌跡存檔。</p>
                </div>
                <div className="flex gap-4">
                  <input id="v300-vans-input" type="file" accept=".csv" ref={vansInputRef} onChange={handleVansUpload} className="hidden" aria-label="CSV上傳" title="VANS CSV" />
                  <button onClick={() => vansInputRef.current?.click()} className="px-6 py-3 bg-white border border-slate-200 text-primary rounded-xl font-bold text-xs hover:bg-slate-50">注入 CSV</button>
                  {vansData.length > 0 && <button onClick={handleSaveAudit} disabled={isSaving} className="px-8 py-3 bg-primary text-white rounded-xl font-bold text-xs shadow-md">物理存入資料庫</button>}
                </div>
              </div>
              {vansData.length > 0 && (
                <div className="clinical-glass rounded-3xl overflow-hidden shadow-sm">
                  <table className="w-full text-left zebra-glass font-mono text-sm">
                    <thead><tr className="border-b border-slate-200/50"><th className="p-4 text-xs font-bold text-slate-500">類型</th><th className="p-4 text-xs font-bold text-slate-500">IP</th><th className="p-4 text-xs font-bold text-slate-500">說明</th></tr></thead>
                    <tbody>{vansConflicts.map((c, i) => (<tr key={i}><td className="p-4"><span className="px-3 py-1 rounded-md text-[10px] font-black bg-red-100 text-red-600">{c.type}</span></td><td className="p-4 text-primary font-bold">{c.ip}</td><td className="p-4 italic text-slate-500">{c.desc}</td></tr>))}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {(isLoading || isSaving) && (
        <div className="fixed inset-0 z-[5000] flex flex-col items-center justify-center bg-white/60 backdrop-blur-md">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
}