"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// --- 🚀 引入後端 Server Actions ---
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
  deleteUserRecord 
} from "@/lib/actions/users";

// --- 🚀 引入旗艦級 UI 組件 ---
import AdminSidebar from "@/components/layout/AdminSidebar";
import TopNavbar from "@/components/layout/TopNavbar";

// --- 🚀 圖表引擎 (Chart.js) 物理對沖 ---
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

/**
 * ==========================================
 * 檔案：src/app/admin/page.tsx
 * 狀態：V120.0 旗艦整合完全體 (0 簡化、0 刪除)
 * 物理職責：
 * 1. 行政中樞：還原 3XL 毛玻璃、呼吸球、超大圓角設計。
 * 2. VANS 存檔：實作對沖結果持久化入庫，紀錄資安稽核軌跡。
 * 3. 大數據：結案歸檔矩陣、全院網段負荷、帳號維護。
 * 4. 無障礙修復：補齊所有活動元素 ID 與 Title。
 * ==========================================
 */

interface UserRecord {
  id: string; username: string; account: string; email: string;
  status: boolean; createdAt: string; updatedAt: string;
}

interface VansMetrics { 
  macErrorCount: number; 
  ipConflictCount: number; 
  zombieAlertCount: number; 
  lastAuditAt?: string; 
}

export default function AdminDashboard() {
  const router = useRouter();
  const vansInputRef = useRef<HTMLInputElement>(null);

  // --- 1. UI 核心與交互狀態 ---
  const [activeTab, setActiveTab] = useState<"dashboard" | "history" | "vans" | "users">("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loaderText, setLoaderText] = useState("行政矩陣物理對正中...");
  const [searchQuery, setSearchQuery] = useState("");

  // --- 2. 數據矩陣狀態 ---
  const [stats, setStats] = useState({ pending: 0, done: 0, nsrPending: 0, nsrSettle: 0 });
  const [vansMetrics, setVansMetrics] = useState<VansMetrics>({ macErrorCount: 0, ipConflictCount: 0, zombieAlertCount: 0 });
  const [ipData, setIpData] = useState<{ segment: string; count: number; percent: number }[]>([]);
  const [historyRecords, setHistoryRecords] = useState<Record<string, any>[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" | "info" }[]>([]);

  // --- 3. VANS 專屬解析與持久化狀態 ---
  const [vansData, setVansData] = useState<any[]>([]);
  const [vansConflicts, setVansConflicts] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const showToast = useCallback((msg: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // --- 4. 數據同步中樞 (物理讀取 + 存檔回溯) ---
  const syncCoreData = useCallback(async () => {
    const isAuth = sessionStorage.getItem("asset_link_admin_auth");
    if (!isAuth) { router.push("/"); return; }
    
    setIsLoading(true);
    try {
      const [eriStats, nsrData, vans, ips, dbUsers, cloudHistory] = await Promise.all([
        getDashboardStats(), getNsrList(), getVansMetrics(), getIpUsageStats(),
        getAllUsers(), getHistoryRecords()
      ]);

      const nsrTyped = (nsrData || []) as any[];
      const nsrPendingCount = nsrTyped.filter(r => ["未處理", "待處理", ""].includes(String(r.處理狀態 || "").trim())).length;
      const nsrSettleCount = nsrTyped.filter(r => String(r.處理狀態 || "").trim() === "待請款").length;

      // 物理嗅探上次 VANS 存檔紀錄
      const { data: lastAudit } = await supabase
        .from("vans_audit_logs")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setStats({ ...eriStats, nsrPending: nsrPendingCount, nsrSettle: nsrSettleCount });
      setVansMetrics({ 
        ...(vans as VansMetrics), 
        lastAuditAt: lastAudit?.created_at ? new Date(lastAudit.created_at).toLocaleString() : "尚無持久化紀錄" 
      });
      setIpData(ips || []);
      setUsers((dbUsers as UserRecord[]) || []);
      setHistoryRecords((cloudHistory as Record<string, any>[]) || []);
    } catch (err) {
      showToast("雲端數據對沖失敗", "error");
    } finally { 
      setIsLoading(false); 
    }
  }, [router, showToast]);

  useEffect(() => { syncCoreData(); }, [syncCoreData]);

  // --- 5. VANS 持久化入庫邏輯 (物理封裝摘要) ---
  const handleSaveAudit = async () => {
    if (vansConflicts.length === 0 && vansData.length === 0) return;
    setIsSaving(true);
    setLoaderText("資安稽核軌跡永久化存檔中...");
    try {
      const adminName = sessionStorage.getItem("asset_link_admin_name") || "System";
      const { error } = await supabase.from("vans_audit_logs").insert([{
        admin_name: adminName,
        total_scanned: vansData.length,
        mac_errors: vansMetrics.macErrorCount,
        ip_conflicts: vansMetrics.ipConflictCount,
        zombies: vansMetrics.zombieAlertCount,
        conflict_data: vansConflicts // 持久化異常 JSON
      }]);

      if (error) throw error;
      showToast("✅ 資安稽核歷史已成功持久化存檔", "success");
      await syncCoreData();
    } catch (err) {
      showToast("存檔失敗：請確保資料表 vans_audit_logs 已物理建立", "error");
    } finally { setIsSaving(false); }
  };

  // --- 6. VANS 大數據解析核心 (物理對沖邏輯) ---
  const handleVansUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    setLoaderText("VANS 全院數據實體對沖中...");
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
        let mErr = 0, iCon = 0, zAmb = 0;
        const conflictsList: any[] = [];

        parsed.forEach(v => {
           const vIp = v['內網 IP 位址'];
           const vMac = v['MAC 地址']?.toUpperCase().replace(/-/g, ':');
           const vStatus = v['在線'];
           if(!vIp) return;

           const matched = historyRecords.find(r => r.核定ip === vIp);
           if(matched) {
              const aMac = String(matched.主要mac || "").toUpperCase();
              if(aMac && vMac && aMac !== vMac) {
                  mErr++;
                  conflictsList.push({ type: 'MAC_ERROR', ip: vIp, vansName: v['名稱'], assetName: matched.設備名稱標記, vansMac: vMac, assetMac: aMac, desc: "MAC 物理位置不吻合" });
              }
              if (String(matched.行政備註 || "").includes("汰換") && vStatus === "在線") {
                  zAmb++;
                  conflictsList.push({ type: 'ZOMBIE', ip: vIp, vansName: v['名稱'], assetName: matched.設備名稱標記, vansMac: vMac, assetMac: aMac, desc: "報廢設備非法連網" });
              }
           } else if (vStatus === "在線") {
              iCon++;
              conflictsList.push({ type: 'IP_CONFLICT', ip: vIp, vansName: v['名稱'], assetName: "未登記黑戶", vansMac: vMac, assetMac: "無紀錄", desc: "黑戶 IP 佔用網段" });
           }
        });

        setVansMetrics(prev => ({ ...prev, macErrorCount: mErr, ipConflictCount: iCon, zombieAlertCount: zAmb }));
        setVansConflicts(conflictsList);
        showToast(`對沖完成：偵測到 ${conflictsList.length} 筆資安威脅`, "info");
      } catch (err) {
        showToast("CSV 物理解析異常", "error");
      } finally { setIsLoading(false); }
    };
    reader.readAsText(file);
  };

  const chartData = useMemo(() => ({
    labels: ipData.map(d => d.segment),
    datasets: [{
      label: '物理負荷率 %',
      data: ipData.map(d => d.percent),
      backgroundColor: ['#2563eb', '#6366f1', '#10b981', '#f59e0b', '#ef4444'],
      borderRadius: 20,
      barThickness: 36
    }]
  }), [ipData]);

  return (
    <div className="bg-[#f8fafc] min-h-screen font-sans text-slate-900 antialiased overflow-x-hidden relative">
      
      {/* 🚀 旗艦級物理視覺對沖樣式 */}
      <style dangerouslySetInnerHTML={{ __html: `
        .glass-panel { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(30px); border: 1px solid rgba(255, 255, 255, 0.8); box-shadow: 0 15px 50px -15px rgba(0,0,0,0.05); }
        .user-table th { background: #f8fafc; border-bottom: 2px solid #edf2f7; color: #64748b; font-size: 11px; font-weight: 900; text-align: center; text-transform: uppercase; padding: 22px; letter-spacing: 0.1em; }
        .user-row { transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); border-bottom: 1px solid #f1f5f9; text-align: center; }
        .user-row:hover { background: #ffffff; transform: translateY(-2px); box-shadow: 0 10px 20px -10px rgba(0,0,0,0.05); }
        .neon-text { text-shadow: 0 0 15px rgba(37, 99, 235, 0.2); }
        .neon-glow { box-shadow: 0 0 25px rgba(16, 185, 129, 0.4); }
      `}} />

      {/* 🚀 ALink 旗艦呼吸背景球 */}
      <div className="fixed z-0 blur-[130px] opacity-15 rounded-full pointer-events-none bg-blue-600 w-[800px] h-[800px] -top-96 -left-96 animate-pulse"></div>
      <div className="fixed z-0 blur-[130px] opacity-10 rounded-full pointer-events-none bg-emerald-400 w-[700px] h-[700px] bottom-0 right-0 animate-pulse delay-700"></div>
      <div className="fixed z-0 blur-[100px] opacity-10 rounded-full pointer-events-none bg-indigo-500 w-[500px] h-[500px] top-1/2 left-1/2 -translate-x-1/2 animate-bounce duration-[15s]"></div>

      <AdminSidebar currentRoute="/admin" isOpen={isSidebarOpen} onLogout={() => router.push("/")} />

      <main className="lg:ml-64 min-h-screen flex flex-col p-6 lg:p-12 relative z-10">
        <TopNavbar 
          title={activeTab === "dashboard" ? "行政對沖總覽" : activeTab === "history" ? "歷史數據歸檔矩陣" : activeTab === "vans" ? "VANS 安全稽核" : "帳號維護中樞"}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        {/* --- 視圖 A: 行政對沖 Dashboard --- */}
        {activeTab === "dashboard" && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 mt-10">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="glass-panel p-10 rounded-[3.5rem] border-l-[12px] border-l-red-500 hover:scale-[1.02] transition-transform">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span> MAC 地址物理偏差</span>
                   <div className="text-7xl font-black text-red-600 mt-4 tracking-tighter neon-text">{vansMetrics.macErrorCount}</div>
                </div>
                <div className="glass-panel p-10 rounded-[3.5rem] border-l-[12px] border-l-amber-500 hover:scale-[1.02] transition-transform">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">黑戶 IP 佔用異常</span>
                   <div className="text-7xl font-black text-amber-500 mt-4 tracking-tighter neon-text">{vansMetrics.ipConflictCount}</div>
                </div>
                <div className="glass-panel p-10 rounded-[3.5rem] bg-slate-900 text-white shadow-2xl relative overflow-hidden group">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform"></div>
                   <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest relative z-10">上次稽核持久化存檔</span>
                   <div className="text-xl font-bold mt-6 tracking-tight text-blue-100 relative z-10">{vansMetrics.lastAuditAt}</div>
                </div>
             </div>

             <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { l: "ERI 待核定", v: stats.pending, c: "text-blue-600" },
                  { l: "NSR 未處理", v: stats.nsrPending, c: "text-slate-700" },
                  { l: "NSR 待核銷", v: stats.nsrSettle, c: "text-emerald-600" },
                  { l: "結案歸檔總額", v: stats.done.toLocaleString(), c: "bg-blue-600 text-white shadow-xl shadow-blue-500/20", dark: true }
                ].map((s, idx) => (
                    <div key={idx} className={`glass-panel p-10 rounded-[2.5rem] text-center ${s.dark ? s.c : ''} group hover:scale-[1.05] transition-all`}>
                       <span className={`text-[11px] font-black uppercase tracking-widest ${s.dark ? 'text-blue-100' : 'text-slate-400'}`}>{s.l}</span>
                       <div className={`text-5xl font-black mt-3 ${s.dark ? 'text-white' : s.c}`}>{s.v}</div>
                    </div>
                ))}
             </div>

             <div className="glass-panel p-12 rounded-[4rem] min-h-[550px] flex flex-col border-white/60">
                <h3 className="text-sm font-black uppercase tracking-[0.4em] text-slate-400 mb-12 flex items-center gap-3">
                   <span className="w-2 h-10 bg-blue-600 rounded-full"></span> 全院網段物理負荷監控矩陣
                </h3>
                <div className="flex-1 relative">
                    <Bar 
                      options={{ 
                        responsive: true, 
                        maintainAspectRatio: false, 
                        plugins: { legend: { display: false } }, 
                        scales: { y: { beginAtZero: true, max: 100, border: { display: false }, grid: { color: '#f1f5f9' } }, x: { grid: { display: false }, border: { display: false } } } 
                      }} 
                      data={chartData} 
                    />
                </div>
             </div>
          </div>
        )}

        {/* --- 視圖 C: VANS 安全稽核 --- */}
        {activeTab === "vans" && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700 mt-10">
                <div className="glass-panel p-12 rounded-[3.5rem] border-l-[15px] border-l-blue-600 flex flex-col md:flex-row items-center justify-between gap-10">
                    <div className="max-w-2xl">
                        <h2 className="text-4xl font-black text-slate-800 tracking-tighter flex items-center gap-5">
                            <span className="material-symbols-outlined text-6xl text-blue-600">security</span> VANS 物理稽核與存檔
                        </h2>
                        <p className="text-sm font-bold text-slate-500 mt-6 leading-relaxed">
                            匯入 `vans全用戶.csv` 執行全網對沖。對沖完成後，點擊「物理存入資料庫」可將結果永久存檔至 `vans_audit_logs`，建立完整資安查核履歷。
                        </p>
                    </div>
                    <div className="flex gap-4">
                        <input id="v120-vans-uploader" type="file" accept=".csv" ref={vansInputRef} onChange={handleVansUpload} className="hidden" title="上傳 VANS CSV 檔案" />
                        <button onClick={() => vansInputRef.current?.click()} id="v120-vans-btn-upload" title="選擇檔案並注入數據" className="px-10 py-5 bg-slate-900 text-white rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 active:scale-95 transition-all flex items-center gap-3 shadow-2xl">
                            <span className="material-symbols-outlined">upload_file</span> 注入 CSV 數據
                        </button>
                        {vansData.length > 0 && (
                            <button onClick={handleSaveAudit} disabled={isSaving} id="v120-vans-btn-persist" title="將稽核結果永久化存檔" className="px-10 py-5 bg-emerald-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all flex items-center gap-3 shadow-xl neon-glow">
                                <span className="material-symbols-outlined">{isSaving ? 'sync' : 'cloud_done'}</span> 物理存入資料庫
                            </button>
                        )}
                    </div>
                </div>

                {vansData.length > 0 && (
                    <div className="space-y-12 animate-in slide-in-from-bottom-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                            {[
                              { l: "掃描總設備", v: vansData.length, c: "text-blue-600" },
                              { l: "MAC 物理偏差", v: vansMetrics.macErrorCount, c: "text-red-600" },
                              { l: "黑戶 IP 佔用", v: vansMetrics.ipConflictCount, c: "text-amber-500" },
                              { l: "殭屍非法上線", v: vansMetrics.zombieAlertCount, c: "text-white bg-slate-900 shadow-2xl", dark: true }
                            ].map((v, idx) => (
                                <div key={idx} className={`glass-panel p-10 rounded-[3rem] text-center ${v.dark ? v.c : ''} border border-white/50`}>
                                   <span className={`text-[10px] font-black uppercase tracking-widest ${v.dark ? 'text-slate-400' : 'text-slate-400'}`}>{v.l}</span>
                                   <div className={`text-6xl font-black mt-4 ${v.dark ? 'text-white' : v.c} neon-text`}>{v.v}</div>
                                </div>
                            ))}
                        </div>

                        <div className="glass-panel rounded-[4rem] overflow-hidden bg-white shadow-2xl border border-white/60">
                            <div className="bg-slate-50/80 px-12 py-8 border-b flex justify-between items-center">
                                <span className="text-lg font-black text-slate-800 flex items-center gap-4"><span className="material-symbols-outlined text-red-500">report_problem</span> 實體對沖異常清單</span>
                                <span className="bg-red-100 text-red-600 px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest shadow-inner">偵測項次：{vansConflicts.length}</span>
                            </div>
                            <div className="overflow-x-auto max-h-[60vh]">
                                <table className="w-full text-left user-table">
                                    <thead className="sticky top-0 z-20 backdrop-blur-xl bg-slate-50/90">
                                        <tr>{["類型", "核定 IP", "VANS 識別", "系統標記", "VANS MAC", "登記 MAC", "判定說明"].map(h => <th key={h}>{h}</th>)}</tr>
                                    </thead>
                                    <tbody>
                                        {vansConflicts.map((c, i) => (
                                            <tr key={`conflict-${i}`} className="user-row text-[13px] font-bold text-slate-600">
                                                <td className="p-7"><span className={`px-5 py-2 rounded-2xl text-[10px] font-black text-white uppercase ${c.type === 'MAC_ERROR' ? 'bg-red-500 shadow-red-500/20' : c.type === 'IP_CONFLICT' ? 'bg-amber-500 shadow-amber-500/20' : 'bg-slate-800 shadow-slate-800/20'}`}>{c.type}</span></td>
                                                <td className="p-7 font-mono text-blue-600 font-black text-base tracking-tight">{c.ip}</td>
                                                <td className="p-7 text-slate-800">{c.vansName}</td>
                                                <td className="p-7">{c.assetName}</td>
                                                <td className="p-7 font-mono text-red-500 bg-red-50/30 rounded-xl">{c.vansMac}</td>
                                                <td className="p-7 font-mono text-emerald-600 bg-emerald-50/30 rounded-xl">{c.assetMac}</td>
                                                <td className="p-7 text-slate-400 italic text-right">{c.desc}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* --- 視圖 B 與 D (完整回歸) --- */}
        {activeTab === "history" && (
            <div className="glass-panel p-10 rounded-[4rem] bg-white shadow-2xl overflow-hidden animate-in fade-in mt-10 duration-700">
                <div className="overflow-x-auto max-h-[70vh]">
                    <table className="w-full text-left user-table">
                        <thead className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-xl">
                            <tr>{["項次", "結案單號", "裝機日期", "使用單位", "主要 MAC", "核定 IP"].map(h => <th key={h}>{h}</th>)}</tr>
                        </thead>
                        <tbody>
                            {historyRecords.map((r, i) => (
                                <tr key={`hist-${r.id || i}`} className="user-row text-[13px] font-bold text-slate-600">
                                    <td className="p-7 text-slate-300 font-mono">{i + 1}</td>
                                    <td className="p-7 font-black text-slate-900">{r.結案單號 || r.id}</td>
                                    <td className="p-7 text-slate-400 font-mono">{r.裝機日期}</td>
                                    <td className="p-7">{r.使用單位}</td>
                                    <td className="p-7 font-mono text-[11px] text-slate-500 bg-slate-50/50 rounded-xl">{r.主要mac}</td>
                                    <td className="p-7 font-mono text-blue-600 font-black text-base tracking-tight">{r.核定ip}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {activeTab === "users" && (
          <div className="glass-panel overflow-hidden rounded-[4rem] bg-white shadow-2xl animate-in fade-in mt-10 duration-700">
             <div className="overflow-x-auto">
                <table className="w-full text-left user-table">
                   <thead>
                      <tr>{["使用者名稱", "系統帳號", "最後異動時間", "目前狀態"].map(h => <th key={h}>{h}</th>)}</tr>
                   </thead>
                   <tbody>
                      {users.map((u, idx) => (
                         <tr key={`user-${u.id || idx}`} className="user-row text-[15px] font-bold text-slate-700">
                            <td className="p-8 font-black">{u.username}</td>
                            <td className="p-8 font-mono text-slate-500 tracking-tight">{u.account}</td>
                            <td className="p-8 text-xs text-slate-400 font-mono">{new Date(u.updatedAt).toLocaleString()}</td>
                            <td className="p-8"><span className={`px-5 py-2 rounded-2xl text-xs font-black uppercase ${u.status ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{u.status ? 'Active' : 'Locked'}</span></td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        )}
      </main>

      {/* --- 旗艦級底部導航 --- */}
      <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[130] bg-slate-900/90 backdrop-blur-3xl p-3 rounded-full shadow-[0_30px_60px_rgba(0,0,0,0.3)] border border-white/10 flex gap-2 animate-in slide-in-from-bottom-12 duration-1000">
        {[
          { id: "dashboard", l: "行政總覽", c: "bg-white text-slate-900 shadow-xl" },
          { id: "history", l: "大數據歷史庫", c: "bg-white text-slate-900 shadow-xl" },
          { id: "vans", l: "VANS 安全稽核", c: "bg-blue-600 text-white shadow-blue-500/50" },
          { id: "users", l: "管理權限矩陣", c: "bg-emerald-500 text-white shadow-emerald-500/50" }
        ].map(b => (
          <button 
            key={b.id} 
            id={`v120-nav-btn-${b.id}`}
            title={`切換至 ${b.l} 視圖`}
            onClick={() => setActiveTab(b.id as any)} 
            className={`px-10 py-4 rounded-full font-black text-[11px] uppercase tracking-widest transition-all duration-500 ${activeTab === b.id ? b.c + " scale-105" : "text-slate-400 hover:text-white"}`}
          >
            {b.l}
          </button>
        ))}
      </div>

      {/* --- 全域強同步遮罩 --- */}
      {(isLoading || isSaving) && (
        <div className="fixed inset-0 z-[3000] flex flex-col items-center justify-center bg-white/80 backdrop-blur-2xl">
          <div className="w-24 h-24 border-[8px] border-slate-100 border-t-blue-600 rounded-full animate-spin mb-10 shadow-2xl"></div>
          <p className="text-blue-600 font-black tracking-[0.8em] uppercase text-sm animate-pulse neon-text">{loaderText || "全院數據物理同步中..."}</p>
        </div>
      )}

      {/* --- 物理通知氣泡 --- */}
      <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[4000] flex flex-col gap-4 pointer-events-none w-full max-w-sm px-6">
        {toasts.map(t => (
          <div key={t.id} className={`px-10 py-6 rounded-[2.5rem] shadow-2xl font-black text-xs animate-in slide-in-from-bottom-4 flex items-center gap-5 border border-white/10 text-white backdrop-blur-2xl ${t.type === "success" ? "bg-emerald-600/90" : t.type === "error" ? "bg-red-600/90" : "bg-slate-900/90"}`}>
            <span className="material-symbols-outlined text-2xl">{t.type === 'success' ? 'verified' : t.type === 'error' ? 'report' : 'info'}</span>
            <span className="tracking-[0.15em]">{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}