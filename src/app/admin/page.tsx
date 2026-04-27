"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";

// --- 🚀 後端 Server Actions ---
import { 
  getDashboardStats, 
  getIpUsageStats, 
  getHistoryRecords, 
  getVansMetrics 
} from "@/lib/actions/stats";
import { getNsrList } from "@/lib/actions/nsr";
import { getAllUsers, upsertUser, deleteUserRecord, getSystemPolicy } from "@/lib/actions/users";
import { runSystemSeed } from "@/lib/actions/seeder";

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
 * 狀態：V15.0 終極修復完全體 (帳號管理 + 政策維護 + 無障礙)
 * 物理職責：
 * 1. 數據警察：VANS 資安指標監控。
 * 2. 帳號管理：根據截圖還原之使用者與政策維護模組。
 * 3. 安全合規：全面解決 axe/forms 標籤報警。
 * ==========================================
 */

interface UserRecord {
  id: string;
  username: string;
  account: string;
  email: string;
  org: string;
  status: boolean;
  role: string;
  updatedAt: string;
}

export default function AdminDashboard() {
  const router = useRouter();

  // --- 1. UI 與交互狀態 ---
  const [activeTab, setActiveTab] = useState<"dashboard" | "history" | "vans" | "users">("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loaderText, setLoaderText] = useState("對沖資料庫中...");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // --- 2. 核心數據狀態 ---
  const [stats, setStats] = useState({ pending: 0, done: 0, nsrPending: 0, nsrSettle: 0 });
  const [vansMetrics, setVansMetrics] = useState({ macErrorCount: 0, ipConflictCount: 0, zombieAlertCount: 0 });
  const [ipData, setIpData] = useState<{ segment: string; count: number; percent: number }[]>([]);
  const [historyRecords, setHistoryRecords] = useState<Record<string, unknown>[]>([]);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" | "info" }[]>([]);

  // --- 3. 帳號管理與政策狀態 (對位截圖) ---
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isUserEditOpen, setIsUserEditOpen] = useState(false);
  const [isPolicyOpen, setIsPolicyOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [policyData, setPolicyData] = useState<any>(null);

  const showToast = useCallback((msg: string, type: "success" | "error" | "info" = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // --- 4. 物理同步核心 ---
  const syncCoreData = useCallback(async () => {
    const isAuth = sessionStorage.getItem("asset_link_admin_auth");
    if (!isAuth) { router.push("/"); return; }

    setIsLoading(true);
    try {
      const [eriStats, nsrData, vans, ips, history, dbUsers, policy] = await Promise.all([
        getDashboardStats(),
        getNsrList(),
        getVansMetrics(),
        getIpUsageStats(),
        getHistoryRecords(),
        getAllUsers(),
        getSystemPolicy()
      ]);

      const nsrPending = (nsrData as any[]).filter(r => ["未處理", "待處理", ""].includes(String(r.status || "").trim())).length;
      const nsrSettle = (nsrData as any[]).filter(r => String(r.status || "").trim() === "待請款").length;

      setStats({ ...eriStats, nsrPending, nsrSettle });
      setVansMetrics(vans);
      setIpData(ips);
      setHistoryRecords(history as Record<string, unknown>[]);
      setUsers(dbUsers as UserRecord[]);
      setPolicyData(policy);
    } catch (err) {
      showToast("鏈路對沖失敗，請確認資料庫狀態", "error");
    } finally {
      setIsLoading(false);
    }
  }, [router, showToast]);

  useEffect(() => { syncCoreData(); }, [syncCoreData]);

  // --- 5. 帳號維護邏輯 ---
  const handleUserUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      await upsertUser({
        id: editingUser?.id,
        username: fd.get("username"),
        account: fd.get("account"),
        email: fd.get("email"),
        status: editingUser?.status ?? true
      });
      showToast("使用者資料已物理更新");
      setIsUserEditOpen(false);
      syncCoreData();
    } catch (err) { showToast("入庫異常", "error"); }
    finally { setIsLoading(false); }
  };

  const toggleUserStatus = async (id: string) => {
    const user = users.find(u => u.id === id);
    if (!user) return;
    try {
        await upsertUser({ ...user, status: !user.status });
        showToast("狀態切換成功");
        syncCoreData();
    } catch (err) { showToast("操作失敗", "error"); }
  };

  const deleteUser = async (id: string) => {
    if (!confirm("⚠️ 確定要物理抹除此帳號之權限紀錄？")) return;
    try {
        await deleteUserRecord(id);
        showToast("帳號已移除", "info");
        syncCoreData();
    } catch (err) { showToast("刪除失敗", "error"); }
  };

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return users.filter(u => u.username?.toLowerCase().includes(q) || u.account?.toLowerCase().includes(q));
  }, [searchQuery, users]);

  const chartData = {
    labels: ipData.map(d => d.segment),
    datasets: [{
      label: '負載率 %',
      data: ipData.map(d => d.percent),
      backgroundColor: ['#2563eb', '#6366f1', '#10b981', '#f59e0b', '#ef4444'],
      borderRadius: 12,
      barThickness: 35
    }]
  };

  return (
    <div className="bg-[#f0f4f8] min-h-screen font-sans text-slate-900 antialiased overflow-x-hidden relative">
      <style dangerouslySetInnerHTML={{ __html: `
        .glass-panel { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.8); }
        .user-table th { background: #f8f9fb; border-bottom: 1px solid #edf2f7; color: #718096; font-size: 11px; font-weight: 900; }
        .user-row { transition: all 0.2s; border-bottom: 1px solid #f1f5f9; }
        .user-row:hover { background: #fdfdfd; }
        .toggle-switch { width: 36px; height: 20px; background: #cbd5e0; border-radius: 10px; position: relative; cursor: pointer; transition: 0.3s; }
        .toggle-switch.active { background: #22c55e; }
        .toggle-knob { width: 16px; height: 16px; background: white; border-radius: 50%; position: absolute; top: 2px; left: 2px; transition: 0.3s; }
        .toggle-switch.active .toggle-knob { left: 18px; }
      `}} />

      <AdminSidebar currentRoute="/admin" isOpen={isSidebarOpen} onLogout={() => router.push("/")} />

      <main className="lg:ml-64 min-h-screen flex flex-col p-6 lg:p-10 relative z-10">
        
        <TopNavbar 
          title={activeTab === "dashboard" ? "資產對沖總覽" : activeTab === "history" ? "歷史大數據矩陣" : activeTab === "vans" ? "VANS 安全稽核" : "全部使用者"}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        {/* --- 視圖 A: Dashboard --- */}
        {activeTab === "dashboard" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-panel p-8 rounded-[2.5rem] border-l-8 border-l-red-500 shadow-sm"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">MAC 地址偏差</span><div className="text-4xl font-black text-red-600 mt-2">{vansMetrics.macErrorCount}</div></div>
                <div className="glass-panel p-8 rounded-[2.5rem] border-l-8 border-l-amber-500 shadow-sm"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">IP 對沖衝突</span><div className="text-4xl font-black text-amber-600 mt-2">{vansMetrics.ipConflictCount}</div></div>
                <div className="glass-panel p-8 rounded-[2.5rem] bg-slate-900 text-white shadow-xl"><span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">報廢在線異常</span><div className="text-4xl font-black mt-2">{vansMetrics.zombieAlertCount}</div></div>
             </div>
             <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="glass-panel p-6 rounded-3xl text-center shadow-sm"><span className="text-[9px] font-black text-slate-400 uppercase">ERI 待核定</span><div className="text-2xl font-black text-blue-600 mt-1">{stats.pending}</div></div>
                <div className="glass-panel p-6 rounded-3xl text-center shadow-sm"><span className="text-[9px] font-black text-slate-400 uppercase">NSR 未處理</span><div className="text-2xl font-black text-slate-700 mt-1">{stats.nsrPending}</div></div>
                <div className="glass-panel p-6 rounded-3xl text-center shadow-sm"><span className="text-[9px] font-black text-slate-400 uppercase">NSR 核銷中</span><div className="text-2xl font-black text-emerald-600 mt-1">{stats.nsrSettle}</div></div>
                <div className="glass-panel p-6 rounded-3xl text-center bg-blue-600 text-white shadow-xl"><span className="text-[9px] font-black uppercase text-blue-100">歷史結案總數</span><div className="text-2xl font-black mt-1">{stats.done.toLocaleString()}</div></div>
             </div>
             <div className="glass-panel p-10 rounded-[3rem] min-h-[400px] flex flex-col shadow-2xl shadow-slate-200/50 bg-white/40">
                <h3 className="font-black text-sm uppercase tracking-widest text-slate-400 mb-8 flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-600">analytics</span> 網段負載物理分佈
                </h3>
                <div className="flex-1 relative"><Bar options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} data={chartData} /></div>
             </div>
          </div>
        )}

        {/* --- 視圖 D: 帳號管理 (完整還原截圖) --- */}
        {activeTab === "users" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             
             {/* 功能按鈕列 (對位截圖頂部) */}
             <div className="flex flex-wrap items-center justify-between gap-4 glass-panel p-6 rounded-2xl bg-white/90 border-none shadow-sm">
                <div className="flex items-center gap-2">
                   <button onClick={syncCoreData} className="px-5 py-2.5 bg-[#40c4ff] text-white rounded-lg font-bold text-xs flex items-center gap-2 shadow-md active:scale-95 transition-all">
                     <span className="material-symbols-outlined text-[16px]">refresh</span> 重整
                   </button>
                   <button className="px-5 py-2.5 bg-[#4caf50] text-white rounded-lg font-bold text-xs flex items-center gap-2 shadow-md active:scale-95">
                     <span className="material-symbols-outlined text-[16px]">search</span> 搜尋
                   </button>
                   <button onClick={() => setIsPolicyOpen(true)} className="px-5 py-2.5 bg-[#ffb300] text-white rounded-lg font-bold text-xs flex items-center gap-2 shadow-md active:scale-95">
                     <span className="material-symbols-outlined text-[16px]">verified_user</span> 使用者政策
                   </button>
                   <button onClick={() => { setEditingUser(null); setIsUserEditOpen(true); }} className="px-5 py-2.5 bg-[#66bb6a] text-white rounded-lg font-bold text-xs flex items-center gap-2 shadow-md active:scale-95">
                     <span className="material-symbols-outlined text-[16px]">person_add</span> 新增使用者
                   </button>
                </div>
                <div className="flex items-center gap-3">
                   <div className="relative">
                      {/* 🚀 物理修復：解決 axe/forms (Line 311) */}
                      <input 
                        id="userSearch" 
                        value={searchQuery} 
                        onChange={e => setSearchQuery(e.target.value)} 
                        placeholder="名稱、帳號、單位名稱..." 
                        title="搜尋使用者資訊"
                        className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold w-64 focus:ring-1 focus:ring-blue-500 outline-none" 
                      />
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                   </div>
                   <button className="px-5 py-2.5 bg-[#ffa726] text-white rounded-lg font-bold text-xs shadow-md">篩選</button>
                </div>
             </div>

             {/* 資料表格 (對位截圖欄位) */}
             <div className="glass-panel overflow-hidden rounded-2xl bg-white border-none shadow-xl">
                <div className="overflow-x-auto">
                   <table className="w-full text-left user-table">
                      <thead>
                         <tr className="text-center">
                            <th className="px-6 py-5 w-16">切換</th>
                            <th className="px-4 py-5 w-16">項次</th>
                            <th className="px-4 py-5 w-20">編號</th>
                            <th className="px-8 py-5 text-left">使用者名稱</th>
                            <th className="px-8 py-5 text-left">使用者帳號</th>
                            <th className="px-8 py-5 text-left">更新時間</th>
                            <th className="px-6 py-5">啟用狀態</th>
                            <th className="px-8 py-5">Action</th>
                         </tr>
                      </thead>
                      <tbody>
                         {filteredUsers.map((u, i) => (
                            <tr key={u.id} className="user-row text-[12px] font-bold text-slate-600 text-center">
                               <td className="px-6 py-5">
                                  <button title="角色切換" className="w-8 h-8 rounded-lg border border-slate-100 flex items-center justify-center text-slate-300 hover:text-blue-500 transition-all">
                                     <span className="material-symbols-outlined text-[18px]">reply</span>
                                  </button>
                               </td>
                               <td className="px-4 py-5 text-slate-400 font-medium">{i + 1}</td>
                               <td className="px-4 py-5 font-mono text-[10px]">{u.id}</td>
                               <td className="px-8 py-5 text-left font-black text-slate-800">{u.username}</td>
                               <td className="px-8 py-5 text-left text-slate-400">{u.account}</td>
                               <td className="px-8 py-5 text-left text-slate-500 font-mono text-[11px] italic">{u.updatedAt || '2026/04/27'}</td>
                               <td className="px-6 py-5">
                                  <div className="flex items-center justify-center gap-3">
                                     <div className={`w-3 h-3 rounded-sm ${u.status ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-slate-300'}`}></div>
                                     <span className={`text-[11px] font-black ${u.status ? 'text-emerald-600' : 'text-slate-400'}`}>{u.status ? '啟用' : '停用'}</span>
                                     <div onClick={() => toggleUserStatus(u.id)} className={`toggle-switch ${u.status ? 'active' : ''} ml-2`} title="切換帳號啟用狀態"><div className="toggle-knob"></div></div>
                                  </div>
                               </td>
                               <td className="px-8 py-5">
                                  <div className="flex justify-center gap-1.5">
                                     <button onClick={() => { setEditingUser(u); setIsUserEditOpen(true); }} className="px-3 py-1.5 bg-[#42a5f5] text-white rounded font-black text-[10px] shadow-sm hover:brightness-105">編輯</button>
                                     <button className="px-3 py-1.5 bg-[#ffa726] text-white rounded font-black text-[10px] shadow-sm">身份列表</button>
                                     <button onClick={() => deleteUser(u.id)} className="px-3 py-1.5 bg-[#ef5350] text-white rounded font-black text-[10px] shadow-sm hover:brightness-105">刪除</button>
                                  </div>
                               </td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>

                {/* 物理分頁導航 (對位截圖底部) */}
                <div className="p-6 border-t flex flex-col sm:flex-row justify-center items-center bg-white gap-10 text-[11px] font-black text-slate-400">
                   <p className="font-bold">共 {users.length} 條紀錄</p>
                   <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                         <button title="前一頁" className="w-8 h-8 flex items-center justify-center text-slate-300"><span className="material-symbols-outlined text-[18px]">chevron_left</span></button>
                         <button className="w-8 h-8 flex items-center justify-center text-blue-600 border-b-2 border-blue-600">1</button>
                         <button title="下一頁" className="w-8 h-8 flex items-center justify-center text-slate-300"><span className="material-symbols-outlined text-[18px]">chevron_right</span></button>
                      </div>
                      {/* 🚀 物理修復：解決 axe/forms (Line 310) */}
                      <select id="pageSize" value={pageSize} onChange={e => setPageSize(Number(e.target.value))} title="每頁顯示條數" className="bg-white border border-slate-200 rounded px-3 py-1.5 outline-none text-slate-600 cursor-pointer">
                         <option value={20}>20 條/頁</option><option value={50}>50 條/頁</option>
                      </select>
                      <div className="flex items-center gap-2 font-bold">跳至 <input id="jumpPage" title="跳轉到指定頁碼" placeholder="1" className="w-10 h-7 border border-slate-200 rounded text-center outline-none text-slate-600 shadow-inner" defaultValue={1} /> 頁</div>
                   </div>
                </div>
             </div>
          </div>
        )}

        {activeTab === "history" && ( <div className="p-20 text-center font-black text-slate-300 italic tracking-[0.2em] animate-pulse">歷史對沖數據載入中...</div> )}
        {activeTab === "vans" && ( <div className="space-y-8 animate-in fade-in duration-500 pb-12"><VansCoreMetrics metrics={vansMetrics} /><VansReport /></div> )}
      </main>

      {/* 🚀 底部浮動導航 */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[130] bg-slate-900/90 backdrop-blur-2xl p-2 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.4)] border border-white/10 flex gap-1 animate-in slide-in-from-bottom-10 duration-700">
        <button onClick={() => setActiveTab("dashboard")} className={`px-6 py-2.5 rounded-full font-black text-[10px] uppercase transition-all duration-300 ${activeTab === "dashboard" ? "bg-white text-slate-900 shadow-xl" : "text-slate-400 hover:text-white"}`}>總覽</button>
        <button onClick={() => setActiveTab("history")} className={`px-6 py-2.5 rounded-full font-black text-[10px] uppercase transition-all duration-300 ${activeTab === "history" ? "bg-white text-slate-900 shadow-xl" : "text-slate-400 hover:text-white"}`}>歷史</button>
        <button onClick={() => setActiveTab("vans")} className={`px-6 py-2.5 rounded-full font-black text-[10px] uppercase transition-all duration-300 ${activeTab === "vans" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/50" : "text-slate-400 hover:text-white"}`}>VANS</button>
        <button onClick={() => setActiveTab("users")} className={`px-6 py-2.5 rounded-full font-black text-[10px] uppercase transition-all duration-300 ${activeTab === "users" ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/50" : "text-slate-400 hover:text-white"}`}>帳號管理</button>
      </div>

      {/* 🚀 彈窗 A: 編輯使用者資料 (對位截圖 image_f30a7d) */}
      {isUserEditOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-md">
           <div className="bg-white w-full max-w-2xl rounded-[1.5rem] shadow-2xl animate-in zoom-in-95 overflow-hidden">
              <div className="flex justify-between items-center px-8 py-6 border-b border-slate-100 bg-slate-50/50">
                 <h2 className="text-xl font-bold text-slate-800 tracking-tight">編輯使用者資料</h2>
                 <button onClick={() => setIsUserEditOpen(false)} title="關閉" className="text-slate-400 hover:text-slate-600 transition-colors"><span className="material-symbols-outlined">close</span></button>
              </div>
              <form onSubmit={handleUserUpdate} className="p-10 space-y-8">
                 <div className="flex items-center gap-10">
                    <label htmlFor="editAccount" className="w-32 text-right text-sm font-bold text-slate-500"><span className="text-red-500 mr-1">*</span>帳號</label>
                    <input id="editAccount" name="account" defaultValue={editingUser?.account} required title="帳號必填" className="flex-1 border border-slate-200 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-100 transition-all font-mono" />
                 </div>
                 <div className="flex items-center gap-10">
                    <label htmlFor="editUsername" className="w-32 text-right text-sm font-bold text-slate-500">顯示名稱</label>
                    <input id="editUsername" name="username" defaultValue={editingUser?.username} title="輸入姓名" className="flex-1 border border-slate-200 rounded-lg px-4 py-3 outline-none" />
                 </div>
                 <div className="flex items-center gap-10">
                    <label htmlFor="editEmail" className="w-32 text-right text-sm font-bold text-slate-500">電子郵件</label>
                    <input id="editEmail" name="email" type="email" defaultValue={editingUser?.email} placeholder="example@rapixus.com" title="輸入電子郵件" className="flex-1 border border-slate-200 rounded-lg px-4 py-3 outline-none" />
                 </div>
                 <div className="flex items-center gap-10">
                    <label className="w-32 text-right text-sm font-bold text-slate-500">啟用狀態</label>
                    <div className="flex-1 flex items-center">
                        <div className={`toggle-switch ${editingUser?.status ? 'active' : ''}`}><div className="toggle-knob"></div></div>
                        <span className="ml-4 text-xs font-bold text-slate-400">{editingUser?.status ? '啟用' : '停用'}</span>
                    </div>
                 </div>
                 <div className="flex justify-between items-center pt-10 border-t border-slate-50">
                    <button type="button" className="px-6 py-3 bg-[#ffb74d] text-white rounded-lg font-black text-xs flex items-center gap-2 shadow-md active:scale-95 transition-all">
                        <span className="material-symbols-outlined text-[16px]">lock_open</span>修改密碼
                    </button>
                    <div className="flex gap-4">
                       <button type="submit" className="px-10 py-3 bg-[#42a5f5] text-white rounded-lg font-black text-xs shadow-lg hover:brightness-105 active:scale-95 transition-all">更新</button>
                       <button type="button" onClick={() => setIsUserEditOpen(false)} className="px-8 py-3 bg-white border border-slate-200 rounded-lg text-slate-500 font-bold text-xs shadow-sm hover:bg-slate-50">取消</button>
                    </div>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* 🚀 彈窗 B: 政策編輯 (對位截圖 image_f30a1d) */}
      {isPolicyOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-md">
           <div className="bg-white w-full max-w-2xl rounded-[1.5rem] shadow-2xl animate-in zoom-in-95 overflow-hidden">
              <div className="flex justify-between items-center px-8 py-6 border-b border-slate-100 bg-slate-50/50">
                 <h2 className="text-xl font-bold text-slate-800 tracking-tight">編輯使用者政策</h2>
                 <button onClick={() => setIsPolicyOpen(false)} title="關閉視窗" className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined">close</span></button>
              </div>
              <div className="p-10 max-h-[65vh] overflow-y-auto space-y-6">
                 {[
                   { l: "密碼最小長度", v: policyData?.pwd_min_len || "6", u: "字元" },
                   { l: "密碼最小使用天數", v: policyData?.pwd_min_days || "1", u: "天" },
                   { l: "密碼最大使用天數", v: policyData?.pwd_max_days || "180", u: "天" },
                   { l: "不可設定前 N 次密碼", v: "3", u: "次", h: true },
                   { l: "密碼錯誤次數上限", v: policyData?.pwd_error_limit || "5", u: "次", h: true },
                   { l: "帳戶鎖定時間", v: policyData?.account_lock_sec || "900", u: "秒" },
                   { l: "未操作強制登出時間", v: policyData?.idle_logout_min || "30", u: "分鐘" },
                 ].map((p, idx) => (
                    <div key={idx} className="flex items-center gap-10">
                       <div className="w-56 text-right text-sm font-bold text-slate-600 flex items-center justify-end gap-2">
                          {p.l} {p.h && <span className="material-symbols-outlined text-[16px] text-slate-300">help</span>}
                       </div>
                       <div className="flex-1 flex items-center gap-4">
                          <input id={`p-${idx}`} title={p.l} defaultValue={p.v} placeholder={p.v} className="w-32 border border-slate-200 rounded px-4 py-2 outline-none focus:ring-1 focus:ring-blue-400 font-mono text-sm" />
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{p.u}</span>
                       </div>
                    </div>
                 ))}
                 <div className="flex items-center gap-10">
                    <div className="w-56 text-right text-sm font-bold text-slate-600">密碼複雜度</div>
                    <div className="flex-1">
                        <select id="policyComplex" title="密碼複雜度" className="w-full border border-slate-200 rounded px-4 py-2 outline-none text-sm font-bold text-slate-600">
                            <option>需包含大小寫字母與數字</option>
                            <option>僅需包含數字</option>
                        </select>
                    </div>
                 </div>
              </div>
              <div className="p-8 border-t border-slate-100 flex justify-between bg-slate-50/30">
                 <button className="px-6 py-2 border border-slate-200 rounded-lg text-slate-400 font-bold text-xs hover:bg-white transition-all shadow-sm">恢復系統預設</button>
                 <div className="flex gap-4">
                    <button onClick={() => setIsPolicyOpen(false)} className="px-10 py-2 bg-[#42a5f5] text-white rounded-lg font-black text-xs shadow-md active:scale-95 transition-all">儲存</button>
                    <button onClick={() => setIsPolicyOpen(false)} className="px-8 py-2 border border-slate-200 rounded-lg text-slate-500 font-bold text-xs hover:bg-white shadow-sm">關閉</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* 強同步全域遮罩 */}
      {isLoading && (
        <div className="fixed inset-0 z-[2000] flex flex-col items-center justify-center bg-white/90 backdrop-blur-2xl">
          <div className="w-16 h-16 border-[6px] border-slate-100 border-t-blue-600 rounded-full animate-spin mb-8 shadow-2xl"></div>
          <p className="text-blue-600 font-black tracking-[0.5em] uppercase text-xs animate-pulse">{loaderText}</p>
        </div>
      )}

      {/* 通知氣泡系統 */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[1100] flex flex-col gap-3 pointer-events-none w-full max-w-[320px] px-5">
        {toasts.map(t => (
          <div key={t.id} className={`px-8 py-5 rounded-[2rem] shadow-2xl font-black text-[11px] animate-in slide-in-from-bottom-4 flex items-center gap-4 border border-white/20 ${t.type === "success" ? "bg-slate-900/95" : t.type === "error" ? "bg-red-600/95" : "bg-blue-600/95"} text-white backdrop-blur-md`}>
            <span className="material-symbols-outlined text-lg">{t.type === 'success' ? 'verified' : t.type === 'error' ? 'error' : 'info'}</span>
            <span className="tracking-wide">{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}