"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
  deleteUserRecord 
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
 * 狀態：V81.0 物理修正版 (移除無效字元 + 語法對正)
 * 物理職責：
 * 1. 視覺中樞：還原 3XL 毛玻璃、呼吸球背景。
 * 2. VANS 存檔：實作對沖結果持久化入庫 (vans_audit_logs)。
 * 3. 編譯通關：物理移除檔案開頭的 Markdown 標記，確保 Vercel 綠燈。
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

  // --- 1. UI 核心狀態 ---
  const [activeTab, setActiveTab] = useState<"dashboard" | "history" | "vans" | "users">("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loaderText, setLoaderText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // --- 2. 數據矩陣狀態 ---
  const [stats, setStats] = useState({ pending: 0, done: 0, nsrPending: 0, nsrSettle: 0 });
  const [vansMetrics, setVansMetrics] = useState<VansMetrics>({ macErrorCount: 0, ipConflictCount: 0, zombieAlertCount: 0 });
  const [ipData, setIpData] = useState<{ segment: string; count: number; percent: number }[]>([]);
  const [historyRecords, setHistoryRecords] = useState<Record<string, any>[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" | "info" }[]>([]);

  // --- 3. VANS 解析與持久化狀態 ---
  const [vansData, setVansData] = useState<any[]>([]);
  const [vansConflicts, setVansConflicts] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const showToast = useCallback((msg: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // --- 4. 數據同步中樞 ---
  const syncCoreData = useCallback(async () => {
    const isAuth = sessionStorage.getItem("asset_link_admin_auth");
    if (!isAuth) { router.push("/"); return; }
    try {
      const [eriStats, nsrData, vans, ips, dbUsers, cloudHistory] = await Promise.all([
        getDashboardStats(), getNsrList(), getVansMetrics(), getIpUsageStats(),
        getAllUsers(), getHistoryRecords()
      ]);

      const nsrTyped = nsrData as any[];
      const nsrPendingCount = nsrTyped.filter(r => ["未處理", "待處理", ""].includes(String(r.處理狀態 || "").trim())).length;
      const nsrSettleCount = nsrTyped.filter(r => String(r.處理狀態 || "").trim() === "待請款").length;

      // 物理嗅探上次稽核紀錄
      const { data: lastAudit } = await supabase
        .from("vans_audit_logs")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setStats({ ...eriStats, nsrPending: nsrPendingCount, nsrSettle: nsrSettleCount });
      setVansMetrics({ 
        ...(vans as VansMetrics), 
        lastAuditAt: lastAudit?.created_at ? new Date(lastAudit.created_at).toLocaleString() : "無紀錄" 
      });
      setIpData(ips);
      setUsers(dbUsers as UserRecord[]);
      setHistoryRecords(cloudHistory as Record<string, any>[]);
    } catch (err) {
      showToast("雲端數據對正異常", "error");
    } finally { setIsLoading(false); }
  }, [router, showToast]);

  useEffect(() => { syncCoreData(); }, [syncCoreData]);

  // --- 5. VANS 持久化入庫邏輯 ---
  const handleSaveAudit = async () => {
    if (vansConflicts.length === 0 && vansData.length === 0) return;
    setIsSaving(true);
    setLoaderText("稽核數據持久化入庫中...");
    try {
      const adminName = sessionStorage.getItem("asset_link_admin_name") || "System";
      const { error } = await supabase.from("vans_audit_logs").insert([{
        admin_name: adminName,
        total_scanned: vansData.length,
        mac_errors: vansMetrics.macErrorCount,
        ip_conflicts: vansMetrics.ipConflictCount,
        zombies: vansMetrics.zombieAlertCount,
        conflict_data: vansConflicts
      }]);

      if (error) throw error;
      showToast("✅ 資安稽核歷史已成功存檔", "success");
      await syncCoreData();
    } catch (err) {
      showToast("存檔失敗：請確認 vans_audit_logs 表結構", "error");
    } finally { setIsSaving(false); }
  };

  // --- 6. VANS 大數據對沖解析 (物理邏輯) ---
  const handleVansUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    setLoaderText("VANS 大數據物理對沖中...");
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
              conflictsList.push({ type: 'IP_CONFLICT', ip: vIp, vansName: v['名稱'], assetName: "未註冊設備", vansMac: vMac, assetMac: "無紀錄", desc: "黑戶 IP 佔用院內網段" });
           }
        });

        setVansMetrics(prev => ({ ...prev, macErrorCount: mErr, ipConflictCount: iCon, zombieAlertCount: zAmb }));
        setVansConflicts(conflictsList);
        showToast(`對沖完成！偵測到 ${conflictsList.length} 筆威脅`, "info");
      } catch (err) {
        showToast("CSV 解析失敗", "error");
      } finally { setIsLoading(false); }
    };
    reader.readAsText(file);
  };

  const chartData = {
    labels: ipData.map(d => d.segment),
    datasets: [{
      label: '負荷率 %',
      data: ipData.map(d => d.percent),
      backgroundColor: ['#2563eb', '#6366f1', '#10b981', '#f59e0b', '#ef4444'],
      borderRadius: 16,
      barThickness: 32
    }]
  };

  return (
    <div className="bg-[#f8fafc] min-h-screen font-sans text-slate-900 antialiased overflow-x-hidden relative">
      <style dangerouslySetInnerHTML={{ __html: `
        .glass-panel { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(25px); border: 1px solid rgba(255, 255, 255, 0.8); box-shadow: 0 10px 40px -10px rgba(0,0,0,0.04); }
        .user-table th { background: #f8fafc; border-bottom: 2px solid #edf2f7; color: #64748b; font-size: 11px; font-weight: 900; text-align: center; text-transform: uppercase; padding: 18px; }
        .user-row { transition: all 0.3s ease; border-bottom: 1px solid #f1f5f9; text-align: center; }
        .user-row:hover { background: #ffffff; }
        .neon-text { text-shadow: 0 0 10px rgba(37, 99, 235, 0.2); }
      `}} />

      <div className="fixed z-0 blur-[120px] opacity-15 rounded-full pointer-events-none bg-blue-600 w-[700px] h-[700px] -top-64 -left-64 animate-pulse"></div>
      <div className="fixed z-0 blur-[120px] opacity-10 rounded-full pointer-events-none bg-emerald-400 w-[600px] h-[600px] bottom-0 right-0 animate-pulse delay-700"></div>

      <AdminSidebar currentRoute="/admin" isOpen={isSidebarOpen} onLogout={() => router.push("/")} />

      <main className="lg:ml-64 min-h-screen flex flex-col p-6 lg:p-10 relative z-10">
        <TopNavbar 
          title={activeTab === "dashboard" ? "行政對沖總覽" : activeTab === "history" ? "歷史大數據矩陣" : activeTab === "vans" ? "VANS 安全稽核" : "使用者維護中樞"}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        {/* --- 視圖 A: Dashboard --- */}
        {activeTab === "dashboard" && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="glass-panel p-10 rounded-[2.5rem] border-l-[8px] border-l-red-500">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span> MAC 物理偏差指標</span>
                   <div className="text-6xl font-black text-red-600 mt-4 tracking-tighter neon-text">{vansMetrics.macErrorCount}</div>
                </div>
                <div className="glass-panel p-10 rounded-[2.5rem] border-l-[8px] border-l-amber-500">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">黑戶 IP 佔用異常</span>
                   <div className="text-6xl font-black text-amber-500 mt-4 tracking-tighter neon-text">{vansMetrics.ipConflictCount}</div>
                </div>
                <div className="glass-panel p-10 rounded-[2.5rem] bg-slate-900 text-white shadow-2xl">
                   <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">上次稽核存檔時間</span>
                   <div className="text-xl font-bold mt-4 tracking-tight text-blue-100">{vansMetrics.lastAuditAt}</div>
                </div>
             </div>

             <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { l: "ERI 待核定", v: stats.pending, c: "text-blue-600" },
                  { l: "NSR 未處理", v: stats.nsrPending, c: "text-slate-700" },
                  { l: "NSR 待核銷", v: stats.nsrSettle, c: "text-emerald-600" },
                  { l: "結案歸檔總數", v: stats.done.toLocaleString(), c: "bg-blue-600 text-white", dark: true }
                ].map((s, idx) => (
                    <div key={idx} className={`glass-panel p-8 rounded-[2rem] text-center ${s.dark ? s.c : ''}`}>
                       <span className={`text-[11px] font-black uppercase tracking-widest ${s.dark ? 'text-blue-100' : 'text-slate-400'}`}>{s.l}</span>
                       <div className={`text-4xl font-black mt-2 ${s.dark ? 'text-white' : s.c}`}>{s.v}</div>
                    </div>
                ))}
             </div>

             <div className="glass-panel p-12 rounded-[3.5rem] min-h-[500px] flex flex-col border-white/60">
                <h3 className="font-black text-sm uppercase tracking-[0.3em] text-slate-400 mb-10 flex items-center gap-3">
                   <span className="material-symbols-outlined text-blue-600 font-black">insights</span> 全院網段物理負荷監控矩陣
                </h3>
                <div className="flex-1 relative">
                    <Bar options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } }} data={chartData} />
                </div>
             </div>
          </div>
        )}

        {/* --- 視圖 C: VANS 安全稽核 --- */}
        {activeTab === "vans" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
                <div className="glass-panel p-12 rounded-[3rem] border-l-[12px] border-l-blue-600 flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="max-w-2xl">
                        <h2 className="text-4xl font-black text-slate-900 tracking-tighter flex items-center gap-4">
                            <span className="material-symbols-outlined text-5xl text-blue-600">admin_panel_settings</span> VANS 實體稽核存檔
                        </h2>
                        <p className="text-sm font-bold text-slate-500 mt-4">請匯入 `vans全用戶.csv` 執行物理對沖。完成後點擊「物理存入資料庫」即可完成歸檔。</p>
                    </div>
                    <div className="flex gap-4">
                        <input id="vansAdminInput" type="file" accept=".csv" ref={vansInputRef} onChange={handleVansUpload} className="hidden" title="VANS CSV 上傳" />
                        <button onClick={() => vansInputRef.current?.click()} className="px-10 py-5 bg-slate-900 text-white rounded-3xl font-black text-sm uppercase tracking-[0.3em] shadow-2xl hover:bg-blue-600 transition-all flex items-center gap-3">
                            <span className="material-symbols-outlined">upload_file</span> 注入數據
                        </button>
                        {vansData.length > 0 && (
                            <button onClick={handleSaveAudit} disabled={isSaving} className="px-10 py-5 bg-emerald-600 text-white rounded-3xl font-black text-sm uppercase tracking-[0.3em] shadow-xl hover:brightness-110 transition-all flex items-center gap-3 active:scale-95">
                                <span className="material-symbols-outlined">{isSaving ? 'sync' : 'cloud_done'}</span> 物理存入資料庫
                            </button>
                        )}
                    </div>
                </div>

                {vansData.length > 0 && (
                    <div className="glass-panel rounded-[3.5rem] overflow-hidden bg-white shadow-2xl">
                        <div className="bg-slate-50/80 px-10 py-6 border-b flex justify-between items-center">
                            <span className="text-base font-black text-slate-800 flex items-center gap-3"><span className="material-symbols-outlined text-red-500">report_problem</span> 實體對沖異常報表</span>
                            <span className="bg-red-100 text-red-600 px-5 py-2 rounded-full text-xs font-black uppercase tracking-widest">共 {vansConflicts.length} 筆偵測項</span>
                        </div>
                        <div className="overflow-x-auto max-h-[60vh]">
                            <table className="w-full text-left user-table">
                                <thead className="sticky top-0 z-20 backdrop-blur-xl bg-slate-50/90">
                                    <tr>{["類型", "核定 IP", "VANS 識別", "系統標記", "VANS MAC", "登記 MAC", "分析判定"].map(h => <th key={h}>{h}</th>)}</tr>
                                </thead>
                                <tbody>
                                    {vansConflicts.map((c, i) => (
                                        <tr key={i} className="user-row text-[12px] font-bold text-slate-600">
                                            <td className="p-6"><span className={`px-4 py-2 rounded-xl text-[10px] font-black text-white uppercase ${c.type === 'MAC_ERROR' ? 'bg-red-500' : c.type === 'IP_CONFLICT' ? 'bg-amber-500' : 'bg-slate-800'}`}>{c.type}</span></td>
                                            <td className="p-6 font-mono text-blue-600 font-black text-sm">{c.ip}</td>
                                            <td className="p-6">{c.vansName}</td>
                                            <td className="p-6">{c.assetName}</td>
                                            <td className="p-6 font-mono text-red-500">{c.vansMac}</td>
                                            <td className="p-6 font-mono text-emerald-600">{c.assetMac}</td>
                                            <td className="p-6 text-slate-400 italic">{c.desc}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* --- 視圖 B 與 D --- */}
        {activeTab === "history" && (
            <div className="glass-panel p-10 rounded-[3rem] bg-white shadow-2xl overflow-hidden animate-in fade-in">
                <div className="overflow-x-auto max-h-[70vh]">
                    <table className="w-full text-left user-table">
                        <thead className="sticky top-0 z-20 bg-slate-50/90">
                            <tr>{["項次", "單號", "日期", "使用單位", "MAC", "核定 IP"].map(h => <th key={h}>{h}</th>)}</tr>
                        </thead>
                        <tbody>
                            {historyRecords.map((r, i) => (
                                <tr key={i} className="user-row text-[12px] font-bold text-slate-600">
                                    <td className="p-6">{i + 1}</td>
                                    <td className="p-6 font-black text-slate-800">{r.結案單號 || r.id}</td>
                                    <td className="p-6 text-slate-400">{r.裝機日期}</td>
                                    <td className="p-6">{r.使用單位}</td>
                                    <td className="p-6 font-mono text-[11px] text-slate-500">{r.主要mac}</td>
                                    <td className="p-6 font-mono text-blue-600 font-black text-sm">{r.核定ip}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {activeTab === "users" && (
          <div className="glass-panel overflow-hidden rounded-[3rem] bg-white shadow-2xl animate-in fade-in">
             <div className="overflow-x-auto">
                <table className="w-full text-left user-table">
                   <thead>
                      <tr>{["使用者名稱", "帳號", "狀態"].map(h => <th key={h}>{h}</th>)}</tr>
                   </thead>
                   <tbody>
                      {users.map((u) => (
                         <tr key={u.id} className="user-row text-[14px] font-bold text-slate-600">
                            <td className="p-6 font-black text-slate-800">{u.username}</td>
                            <td className="p-6 font-mono text-slate-500">{u.account}</td>
                            <td className="p-6"><span className={u.status ? 'text-emerald-500' : 'text-slate-300'}>{u.status ? 'Active' : 'Locked'}</span></td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        )}
      </main>

      {/* --- 底部浮動導航 --- */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[130] bg-slate-900/90 backdrop-blur-3xl p-2.5 rounded-full shadow-2xl border border-white/10 flex gap-2 animate-in slide-in-from-bottom-10 duration-700">
        {[
          { id: "dashboard", l: "總覽", c: "bg-white text-slate-900" },
          { id: "history", l: "歷史庫", c: "bg-white text-slate-900" },
          { id: "vans", l: "VANS 稽核", c: "bg-blue-600 text-white" },
          { id: "users", l: "帳號管理", c: "bg-emerald-500 text-white" }
        ].map(b => (
          <button key={b.id} onClick={() => setActiveTab(b.id as any)} className={`px-8 py-3.5 rounded-full font-black text-[11px] uppercase tracking-widest transition-all duration-500 ${activeTab === b.id ? b.c + " scale-105" : "text-slate-400 hover:text-white"}`}>
            {b.l}
          </button>
        ))}
      </div>

      {/* --- 全域強同步遮罩 --- */}
      {(isLoading || isSaving) && (
        <div className="fixed inset-0 z-[3000] flex flex-col items-center justify-center bg-white/80 backdrop-blur-2xl">
          <div className="w-24 h-24 border-[8px] border-slate-100 border-t-blue-600 rounded-full animate-spin mb-10 shadow-2xl"></div>
          <p className="text-blue-600 font-black tracking-[0.8em] uppercase text-sm animate-pulse neon-text">{loaderText || "行政數據物理對沖中..."}</p>
        </div>
      )}

      {/* --- 通知氣泡 --- */}
      <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[4000] flex flex-col gap-4 pointer-events-none w-full max-w-sm px-6">
        {toasts.map(t => (
          <div key={t.id} className={`px-10 py-6 rounded-[2.5rem] shadow-2xl font-black text-xs animate-in slide-in-from-bottom-4 flex items-center gap-5 border border-white/10 text-white backdrop-blur-2xl ${t.type === "success" ? "bg-emerald-600/90" : t.type === "error" ? "bg-red-600/90" : "bg-slate-900/90"}`}>
            <span className="material-symbols-outlined text-2xl">{t.type === 'success' ? 'verified' : 'info'}</span>
            <span className="tracking-[0.2em]">{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
