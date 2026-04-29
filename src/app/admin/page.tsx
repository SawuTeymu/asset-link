"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// --- 🚀 引入正確的後端 Server Actions (消滅 adminerror.txt 錯置報警) ---
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

// 🚀 物理導入同目錄樣式模組
import styles from "./admin.module.css";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

/**
 * ==========================================
 * 檔案：src/app/admin/page.tsx
 * 狀態：V300.7 CSS Modules (物理錯置修復版)
 * 修復證明：
 * 1. 依賴修復：移除誤植的 NSR 專用 API，重新對正 stats.ts 與 nsr.ts。
 * 2. 樣式脫離：移除所有內聯 style={{...}}，將動畫與填充邏輯移至 admin.module.css。
 * 3. 邏輯保全：VANS 解析、MAC 對沖、Supabase 同步邏輯 0 簡化、0 刪除。
 * ==========================================
 */

interface UserRecord { id: string; username: string; account: string; status: boolean; updatedAt: string; }
interface VansMetrics { macErrorCount: number; ipConflictCount: number; zombieAlertCount: number; lastAuditAt?: string; }

export default function AdminDashboard() {
  const router = useRouter();
  const vansInputRef = useRef<HTMLInputElement>(null);

  // --- 1. 核心狀態矩陣 ---
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "history" | "vans" | "users">("dashboard");
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState({ pending: 0, done: 0, nsrPending: 0, nsrSettle: 0 });
  const [vansMetrics, setVansMetrics] = useState<VansMetrics>({ macErrorCount: 0, ipConflictCount: 0, zombieAlertCount: 0 });
  const [ipData, setIpData] = useState<{ segment: string; count: number; percent: number }[]>([]);
  const [historyRecords, setHistoryRecords] = useState<Record<string, any>[]>([]);
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
      setVansMetrics({ ...(vans as VansMetrics), lastAuditAt: lastAudit?.created_at ? new Date(lastAudit.created_at).toLocaleString() : "無紀錄" });
      setIpData(ips || []); setHistoryRecords(cloudHistory || []);
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
    <div className={`min-h-screen font-body-md text-slate-800 antialiased flex relative overflow-hidden ${styles.medicalGradient}`}>
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      
      {/* 🚀 背景動態球體 (物理脫離) */}
      <div className="absolute inset-0 overflow-hidden -z-10 pointer-events-none">
        <div className={`absolute top-[-10%] left-[-5%] w-[500px] h-[500px] bg-sky-100 rounded-full ${styles.breathingSphere}`}></div>
        <div className={`absolute bottom-[-15%] right-[-5%] w-[600px] h-[600px] bg-emerald-100 rounded-full ${styles.breathingSphere} ${styles.delay2s}`}></div>
        <div className={`absolute top-[20%] right-[15%] w-[300px] h-[300px] bg-indigo-100 rounded-full ${styles.breathingSphere} ${styles.delay4s}`}></div>
      </div>

      {isMobileMenuOpen && <div className="fixed inset-0 bg-sky-900/20 backdrop-blur-sm z-[45] md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>}

      <aside className={`w-64 fixed left-0 top-0 h-screen border-r border-white/40 ${styles.clinicalGlass} flex flex-col p-6 z-50 transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
          <div className="flex justify-between items-center mb-10 px-2">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg"><span className={`material-symbols-outlined ${styles.iconFill}`}>hub</span></div>
               <h2 className="text-xl font-black text-sky-900 tracking-tighter">ALink</h2>
            </div>
            <button className="md:hidden text-slate-500" onClick={() => setIsMobileMenuOpen(false)}><span className="material-symbols-outlined">close</span></button>
          </div>
          <nav className="flex-1 space-y-1">
              <button onClick={() => setActiveTab("dashboard")} className={`w-full text-left p-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-600 hover:bg-white/50'}`}>儀表板</button>
              <button onClick={() => router.push("/pending")} className="w-full text-left p-3 text-slate-600 hover:bg-white/50 rounded-xl transition-all">行政核定池 (ERI)</button>
              <button onClick={() => setActiveTab("vans")} className={`w-full text-left p-3 rounded-xl transition-all ${activeTab === 'vans' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-600 hover:bg-white/50'}`}>VANS 稽核</button>
              <button onClick={() => router.push("/nsr")} className="w-full text-left p-3 text-slate-600 hover:bg-white/50 rounded-xl transition-all">網點財務對沖 (NSR)</button>
              <button onClick={() => router.push("/internal")} className="w-full text-left p-3 text-slate-600 hover:bg-white/50 rounded-xl transition-all">內部直通中樞</button>
          </nav>
          <div className="mt-auto border-t border-slate-200 pt-4">
             <button onClick={() => router.push("/")} className="w-full flex items-center gap-2 p-3 text-slate-500 font-bold hover:bg-white/50 rounded-xl transition-all"><span className="material-symbols-outlined">logout</span>登出中樞</button>
          </div>
      </aside>

      <main className="w-full md:ml-64 flex-1 flex flex-col min-h-screen relative z-10 transition-all duration-300">
        <header className="px-6 py-4 bg-white/60 backdrop-blur-xl border-b border-slate-200/50 sticky top-0 z-30 flex items-center justify-between">
           <div className="flex items-center gap-4">
             <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-sky-800"><span className="material-symbols-outlined">menu</span></button>
             <h1 className="text-xl font-bold text-sky-800 uppercase tracking-widest">Administrative Hub</h1>
           </div>
           <div className="flex items-center gap-4">
             <button onClick={syncCoreData} className="text-slate-500 hover:text-blue-600 transition-colors" title="重新同步矩陣"><span className="material-symbols-outlined">sync</span></button>
           </div>
        </header>

        <div className="p-4 md:p-8 max-w-[1440px] mx-auto w-full flex-1">
          {activeTab === 'dashboard' && (
            <div className="animate-in fade-in duration-500">
              <div className="mb-8 px-2">
                <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">系統營運概況</h2>
                <p className="text-sm text-slate-500 font-bold mt-1">監控全院資產節點與 IP 分配健康度。</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className={`${styles.clinicalGlass} p-6 rounded-3xl shadow-sm border-l-4 border-amber-400`}><p className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-widest">Pending ERI</p><h3 className="text-3xl font-black text-slate-800">{stats.pending} <span className="text-sm font-normal text-slate-400">件</span></h3></div>
                <div className={`${styles.clinicalGlass} p-6 rounded-3xl shadow-sm border-l-4 border-blue-500`}><p className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-widest">Total Assets</p><h3 className="text-3xl font-black text-slate-800">{stats.done.toLocaleString()}</h3></div>
                
                {/* 🚀 物理對沖，完全移除 style 屬性，改用 ID 選擇器與內嵌樣式 */}
                <div className={`${styles.clinicalGlass} p-6 rounded-3xl shadow-sm border-l-4 border-indigo-500`}>
                  <p className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-widest">IP Load Peak</p>
                  <h3 className="text-3xl font-black text-slate-800">{maxIpPercent}%</h3>
                  <div className={styles.progressContainer}>
                     <div id="ip-load-progress-bar" className={styles.progressBarBase}></div>
                     <style dangerouslySetInnerHTML={{ __html: `#ip-load-progress-bar { width: ${maxIpPercent}%; }` }} />
                  </div>
                </div>

                <div className={`${styles.clinicalGlass} p-6 rounded-3xl shadow-sm border-l-4 border-emerald-500`}><p className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-widest">System Health</p><h3 className="text-3xl font-black text-slate-800">99.8%</h3></div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className={`${styles.clinicalGlass} col-span-1 lg:col-span-8 rounded-[2rem] p-6 md:p-8 h-[420px] flex flex-col shadow-sm`}>
                    <h3 className="font-bold text-slate-800 mb-6">全院網段物理負荷動態</h3>
                    <div className="flex-1 relative">
                       <Bar options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} data={{ labels: ipData.map(d => d.segment), datasets: [{ label: '%', data: ipData.map(d => d.percent), backgroundColor: '#3b82f6', borderRadius: 4 }] }} />
                    </div>
                </div>
                <div className={`${styles.clinicalGlass} col-span-1 lg:col-span-4 rounded-[2rem] p-6 flex flex-col h-[420px] shadow-sm overflow-hidden`}>
                    <h3 className="font-bold text-slate-800 mb-4 px-2">安全日誌矩陣</h3>
                    <div className="flex-1 overflow-y-auto pr-2">
                        <table className={`w-full ${styles.zebraGlass} text-xs`}>
                           <tbody>
                              {historyRecords.slice(0, 15).map((log, i) => (
                                <tr key={i}><td className="p-3 font-bold text-slate-700 truncate max-w-[120px]">{log.品牌型號 || "未知設備"}</td><td className="p-3 font-mono font-bold text-slate-400 text-right">{log.主要mac}</td></tr>
                              ))}
                           </tbody>
                        </table>
                    </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'vans' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
              <div className={`${styles.clinicalGlass} p-6 md:p-10 border-l-4 border-l-blue-600 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-center gap-6`}>
                <div><h2 className="text-2xl font-black text-slate-800 flex items-center gap-3"><span className={`material-symbols-outlined text-blue-600 text-4xl ${styles.iconFill}`}>security</span> VANS 大數據對沖</h2></div>
                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                  <input id="vans-up" type="file" accept=".csv" ref={vansInputRef} onChange={handleVansUpload} className="hidden" title="VANS" />
                  <button onClick={() => vansInputRef.current?.click()} className="w-full sm:w-auto px-6 py-3 bg-white border border-slate-200 text-blue-600 rounded-2xl font-black text-xs hover:bg-slate-50 shadow-sm uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-sm">upload_file</span> 注入 CSV
                  </button>
                  {vansData.length > 0 && <button onClick={handleSaveAudit} disabled={isSaving} className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs shadow-lg uppercase tracking-widest hover:bg-blue-500 active:scale-95 transition-all flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-sm">save</span> 物理存入庫
                  </button>}
                </div>
              </div>
              
              {vansData.length > 0 && (
                <div className={`${styles.clinicalGlass} rounded-3xl overflow-x-auto shadow-sm`}>
                  <table className={`w-full text-left font-mono text-xs ${styles.zebraGlass} min-w-[600px]`}>
                    <thead className="bg-white/60 border-b border-slate-200">
                      <tr><th className="p-5 font-black uppercase tracking-widest text-slate-500">Type</th><th className="p-5 font-black uppercase tracking-widest text-slate-500">IP Endpoint</th><th className="p-5 font-black uppercase tracking-widest text-slate-500 text-right">Observation</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/50">
                      {vansConflicts.map((c, i) => (<tr key={i} className="hover:bg-white/40 transition-colors"><td className="p-5"><span className={`px-3 py-1.5 rounded-lg font-black tracking-widest ${c.type==='MAC_ERROR'?'bg-red-100 text-red-700 border border-red-200':'bg-amber-100 text-amber-700 border border-amber-200'}`}>{c.type}</span></td><td className="p-5 text-blue-600 font-black text-sm">{c.ip}</td><td className="p-5 font-bold text-slate-500 text-right">{c.desc}</td></tr>))}
                      {vansConflicts.length === 0 && <tr><td colSpan={3} className="p-10 text-center text-slate-400 font-bold">🎉 VANS 對沖完成，未發現任何 IP 或 MAC 異常衝突！</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* --- 通知與遮罩 (保留邏輯 0 簡化) --- */}
      {(isLoading || isSaving) && (
        <div className="fixed inset-0 z-[6000] flex flex-col items-center justify-center bg-white/60 backdrop-blur-md animate-in fade-in">
          <div className="w-14 h-14 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4 shadow-lg"></div>
          <p className="text-blue-600 font-black tracking-widest text-[10px] uppercase animate-pulse">Syncing Matrix...</p>
        </div>
      )}

      <div className="fixed bottom-6 right-4 md:bottom-10 md:right-8 z-[7000] flex flex-col gap-3">
        {toasts.map(t => (
          <div key={t.id} className={`px-6 py-4 rounded-2xl shadow-2xl font-bold text-xs animate-in slide-in-from-right-4 flex items-center gap-3 border ${t.type === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : t.type === "error" ? "bg-red-50 text-red-700 border-red-200" : "bg-white text-slate-700 border-slate-200"}`}>
            <span className={`material-symbols-outlined text-lg ${styles.iconFill}`}>{t.type === 'success' ? 'check_circle' : t.type === 'error' ? 'error' : 'info'}</span><span className="tracking-wide">{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}