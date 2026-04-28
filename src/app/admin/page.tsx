"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// --- 🚀 引入後端 Server Actions (保留) ---
import { 
  getDashboardStats, 
  getIpUsageStats, 
  getHistoryRecords, 
  getVansMetrics 
} from "@/lib/actions/stats";
import { getNsrList } from "@/lib/actions/nsr";
import { getAllUsers } from "@/lib/actions/users";

// --- 🚀 引入佈局 ---
import AdminSidebar from "@/components/layout/AdminSidebar";
import TopNavbar from "@/components/layout/TopNavbar";

// --- 🚀 圖表引擎 (保留) ---
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

/**
 * ==========================================
 * 檔案：src/app/admin/page.tsx
 * 狀態：V200.0 Titanium Crystal 重設計版
 * 物理職責：行政中樞、VANS 大數據解析 (0 簡化)、持久化稽核紀錄。
 * ==========================================
 */

interface UserRecord { id: string; username: string; account: string; status: boolean; updatedAt: string; }
interface VansMetrics { macErrorCount: number; ipConflictCount: number; zombieAlertCount: number; lastAuditAt?: string; }

export default function AdminDashboard() {
  const router = useRouter();
  const vansInputRef = useRef<HTMLInputElement>(null);

  // --- 1. 核心狀態 (100% 保留) ---
  const [activeTab, setActiveTab] = useState<"dashboard" | "history" | "vans" | "users">("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ pending: 0, done: 0, nsrPending: 0, nsrSettle: 0 });
  const [vansMetrics, setVansMetrics] = useState<VansMetrics>({ macErrorCount: 0, ipConflictCount: 0, zombieAlertCount: 0 });
  const [ipData, setIpData] = useState<{ segment: string; count: number; percent: number }[]>([]);
  const [historyRecords, setHistoryRecords] = useState<Record<string, any>[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [vansData, setVansData] = useState<any[]>([]);
  const [vansConflicts, setVansConflicts] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // --- 2. 數據對沖邏輯 (100% 保留) ---
  const syncCoreData = useCallback(async () => {
    const isAuth = sessionStorage.getItem("asset_link_admin_auth");
    if (!isAuth) { router.push("/"); return; }
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
      setVansMetrics({ ...(vans as VansMetrics), lastAuditAt: lastAudit?.created_at ? new Date(lastAudit.created_at).toLocaleString() : "無紀錄" });
      setIpData(ips || []); setUsers(dbUsers as UserRecord[] || []); setHistoryRecords(cloudHistory || []);
    } finally { setIsLoading(false); }
  }, [router]);

  useEffect(() => { syncCoreData(); }, [syncCoreData]);

  const handleVansUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
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
          if(aMac && vMac && aMac !== vMac) { mErr++; conflictsList.push({ type: 'MAC_ERROR', ip: vIp, vansName: v['名稱'], assetMac: aMac, desc: "MAC 物理偏差" }); }
          if (String(matched.行政備註 || "").includes("汰換") && vStatus === "在線") { zAmb++; conflictsList.push({ type: 'ZOMBIE', ip: vIp, vansName: v['名稱'], assetMac: aMac, desc: "報廢設備非法上線" }); }
        } else if (vStatus === "在線") { iCon++; conflictsList.push({ type: 'IP_CONFLICT', ip: vIp, vansName: v['名稱'], assetMac: "無紀錄", desc: "黑戶 IP 佔用" }); }
      });
      setVansMetrics(prev => ({ ...prev, macErrorCount: mErr, ipConflictCount: iCon, zombieAlertCount: zAmb }));
      setVansConflicts(conflictsList); setIsLoading(false);
    };
    reader.readAsText(file);
  };

  const handleSaveAudit = async () => {
    if (vansConflicts.length === 0) return;
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
      syncCoreData();
    } finally { setIsSaving(false); }
  };

  return (
    <div className="bg-[#020617] min-h-screen text-slate-300 font-sans antialiased overflow-x-hidden relative">
      <style dangerouslySetInnerHTML={{ __html: `
        .bento-card { background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255, 255, 255, 0.05); backdrop-filter: blur(20px); border-radius: 1.5rem; }
        .stat-glow { text-shadow: 0 0 20px rgba(59, 130, 246, 0.3); }
        .user-table th { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.15em; padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .user-table td { padding: 16px; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.02); }
      `}} />

      <AdminSidebar currentRoute="/admin" isOpen={isSidebarOpen} onLogout={() => router.push("/")} />

      <main className="lg:ml-64 min-h-screen flex flex-col p-6 lg:p-8 relative z-10">
        <TopNavbar title="行政對沖矩陣總署" onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} />

        {activeTab === "dashboard" && (
          <div className="space-y-6 mt-8 animate-in fade-in duration-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bento-card p-8 border-l-4 border-l-red-500">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">MAC 物理偏差</span>
                <div className="text-6xl font-black text-white mt-2 font-mono stat-glow">{vansMetrics.macErrorCount}</div>
              </div>
              <div className="bento-card p-8 border-l-4 border-l-amber-500">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">黑戶 IP 佔用</span>
                <div className="text-6xl font-black text-white mt-2 font-mono stat-glow">{vansMetrics.ipConflictCount}</div>
              </div>
              <div className="bento-card p-8 bg-slate-900/50">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">上次稽核存檔時間</span>
                <div className="text-sm font-bold text-slate-300 mt-6 tracking-tight">{vansMetrics.lastAuditAt}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { l: "ERI 待核定", v: stats.pending, c: "text-blue-400" },
                { l: "NSR 未處理", v: stats.nsrPending, c: "text-slate-400" },
                { l: "NSR 待核銷", v: stats.nsrSettle, c: "text-emerald-400" },
                { l: "結案歸檔總額", v: stats.done.toLocaleString(), c: "text-white" }
              ].map((s, i) => (
                <div key={i} className="bento-card p-6 text-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{s.l}</span>
                  <div className={`text-3xl font-black mt-2 ${s.c}`}>{s.v}</div>
                </div>
              ))}
            </div>

            <div className="bento-card p-10 h-[500px] flex flex-col">
               <h3 className="text-xs font-black uppercase text-slate-500 mb-8 tracking-[0.3em]">全院網段物理負荷監控</h3>
               <div className="flex-1"><Bar options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.03)' } }, x: { grid: { display: false } } } }} data={{ labels: ipData.map(d => d.segment), datasets: [{ label: '%', data: ipData.map(d => d.percent), backgroundColor: '#3b82f6', borderRadius: 8 }] }} /></div>
            </div>
          </div>
        )}

        {activeTab === "vans" && (
          <div className="space-y-6 mt-8">
            <div className="bento-card p-10 border-l-4 border-l-blue-600 flex flex-col md:flex-row justify-between items-center gap-6">
              <div><h2 className="text-2xl font-bold text-white tracking-tight">VANS 物理稽核</h2><p className="text-xs text-slate-500 mt-2">匯入 CSV 執行全網對沖與資安軌跡存檔。</p></div>
              <div className="flex gap-4">
                <input type="file" accept=".csv" ref={vansInputRef} onChange={handleVansUpload} className="hidden" />
                <button onClick={() => vansInputRef.current?.click()} className="px-8 py-3 bg-slate-800 text-white rounded-xl font-bold text-[11px] uppercase tracking-widest hover:bg-slate-700">注入 CSV</button>
                {vansData.length > 0 && <button onClick={handleSaveAudit} disabled={isSaving} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold text-[11px] uppercase tracking-widest hover:brightness-110">物理存入資料庫</button>}
              </div>
            </div>

            {vansData.length > 0 && (
              <div className="bento-card overflow-hidden">
                <table className="w-full text-left user-table font-mono">
                  <thead><tr>{["類型", "核定 IP", "VANS 識別", "判定說明"].map(h => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>{vansConflicts.map((c, i) => (
                    <tr key={i} className="hover:bg-white/5 transition-colors text-xs">
                      <td><span className={`px-3 py-1 rounded-full text-[9px] font-black ${c.type==='MAC_ERROR'?'bg-red-500/10 text-red-400':'bg-amber-500/10 text-amber-400'}`}>{c.type}</span></td>
                      <td className="text-blue-400 font-bold">{c.ip}</td>
                      <td>{c.vansName}</td>
                      <td className="italic text-slate-500">{c.desc}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 底部 Tab 導航 */}
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] bg-slate-900/80 backdrop-blur-3xl p-2 rounded-2xl border border-white/5 flex gap-1 shadow-2xl">
          {[
            { id: "dashboard", l: "行政總覽" }, { id: "history", l: "歷史歷史庫" }, { id: "vans", l: "VANS 稽核" }, { id: "users", l: "權限矩陣" }
          ].map(b => (
            <button key={b.id} onClick={() => setActiveTab(b.id as any)} className={`px-8 py-3 rounded-xl font-bold text-[11px] uppercase tracking-widest transition-all ${activeTab === b.id ? "bg-white text-slate-950" : "text-slate-500 hover:text-white"}`}>{b.l}</button>
          ))}
        </div>
      </main>

      {isLoading && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-xl">
          <div className="w-10 h-10 border-2 border-slate-800 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
}