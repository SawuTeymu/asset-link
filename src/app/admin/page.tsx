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
 * 狀態：V10.0 終極無障礙修復版 (解決 axe/forms 報警)
 * 物理職責：
 * 1. 數據警察：VANS 監控與資安對沖。
 * 2. 帳號管理：實裝完整無障礙標籤綁定。
 * 3. 解決報警：補齊 select-name 與 label/title 屬性。
 * ==========================================
 */

interface UserRecord {
  id: string;
  username: string;
  account: string;
  org: string;
  status: boolean;
  role: string;
  createdAt: string;
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

  // --- 2. 核心大數據狀態 ---
  const [stats, setStats] = useState({ pending: 0, done: 0, nsrPending: 0, nsrSettle: 0 });
  const [vansMetrics, setVansMetrics] = useState({ macErrorCount: 0, ipConflictCount: 0, zombieAlertCount: 0 });
  const [ipData, setIpData] = useState<{ segment: string; count: number; percent: number }[]>([]);
  const [historyRecords, setHistoryRecords] = useState<Record<string, unknown>[]>([]);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" }[]>([]);

  // --- 3. 帳號管理專用狀態 ---
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // --- 4. 數據同步核心 ---
  const syncCoreData = useCallback(async () => {
    const isAuth = sessionStorage.getItem("asset_link_admin_auth");
    if (!isAuth) { router.push("/"); return; }

    setIsLoading(true);
    try {
      const [eriStats, nsrData, vans, ips, history] = await Promise.all([
        getDashboardStats(),
        getNsrList(),
        getVansMetrics(),
        getIpUsageStats(),
        getHistoryRecords()
      ]);

      const nsrPending = (nsrData as any[]).filter(r => ["未處理", "待處理", ""].includes(String(r.status || "").trim())).length;
      const nsrSettle = (nsrData as any[]).filter(r => String(r.status || "").trim() === "待請款").length;

      setStats({ ...eriStats, nsrPending, nsrSettle });
      setVansMetrics(vans);
      setIpData(ips);
      setHistoryRecords(history as Record<string, unknown>[]);

      // 初始化帳號管理內容
      setUsers([
        { id: "1", username: "admin", account: "admin", org: "資訊室", status: true, role: "超級管理員", createdAt: "2024-01-01" },
        { id: "4", username: "李祥民", account: "A30304", org: "資訊室", status: true, role: "一般使用者", createdAt: "2024-02-15" },
        { id: "5", username: "楊金龍", account: "A32462", org: "資訊室", status: true, role: "一般使用者", createdAt: "2024-03-10" },
        { id: "6", username: "尤宏鳴", account: "A6072", org: "資訊室", status: true, role: "外部廠商", createdAt: "2024-04-05" },
        { id: "120", username: "林于浚", account: "A38774", org: "資訊室", status: true, role: "一般使用者", createdAt: "2024-04-20" },
        { id: "121", username: "洪國華", account: "A36639", org: "資訊室", status: true, role: "維護工程師", createdAt: "2024-04-25" },
        { id: "122", username: "王武昔", account: "A12978", org: "資訊室", status: true, role: "一般使用者", createdAt: "2024-05-01" },
        { id: "123", username: "許朝興", account: "A11171", org: "資訊室", status: true, role: "一般使用者", createdAt: "2024-05-05" },
        { id: "124", username: "徐英傑", account: "A13955", org: "資訊室", status: true, role: "一般使用者", createdAt: "2024-05-10" },
        { id: "125", username: "劉泰瑋", account: "A23910", org: "資訊室", status: true, role: "一般使用者", createdAt: "2024-05-15" },
      ]);
    } catch (err) {
      showToast("鏈路中斷，請確認數據表名", "error");
    } finally {
      setIsLoading(false);
    }
  }, [router, showToast]);

  useEffect(() => { syncCoreData(); }, [syncCoreData]);

  // --- 5. 帳號維護處理 ---
  const handleUserSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newUser: UserRecord = {
      id: editingUser?.id || String(Math.floor(Math.random() * 1000)),
      username: fd.get("username") as string,
      account: fd.get("account") as string,
      org: fd.get("org") as string,
      status: true,
      role: fd.get("role") as string,
      createdAt: editingUser?.createdAt || new Date().toISOString().split("T")[0]
    };
    if (editingUser) setUsers(prev => prev.map(u => u.id === editingUser.id ? newUser : u));
    else setUsers(prev => [newUser, ...prev]);
    setIsUserModalOpen(false); setEditingUser(null);
    showToast(editingUser ? "資料已更新" : "帳號已錄入");
  };

  const toggleStatus = (id: string) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: !u.status } : u));
    showToast("狀態已同步", "success");
  };

  const deleteUser = (id: string) => {
    if (!confirm("⚠️ 確定抹除此帳號紀錄？")) return;
    setUsers(prev => prev.filter(u => u.id !== id));
    showToast("帳號已移除", "success");
  };

  // --- 6. 數據矩陣運算 ---
  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return users;
    return users.filter(u => u.username.toLowerCase().includes(q) || u.account.toLowerCase().includes(q) || u.org.toLowerCase().includes(q));
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
    <div className="bg-[#f8fafc] min-h-screen font-sans text-slate-900 antialiased overflow-x-hidden relative">
      <style dangerouslySetInnerHTML={{ __html: `
        .glass-panel { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.8); }
        .user-table th { background: #f8f9fb; border-bottom: 1px solid #edf2f7; color: #718096; font-size: 11px; font-weight: 900; }
        .user-row { transition: all 0.2s; border-bottom: 1px solid #f1f5f9; }
        .toggle-switch { width: 36px; height: 20px; background: #cbd5e0; border-radius: 10px; position: relative; cursor: pointer; transition: 0.3s; }
        .toggle-switch.active { background: #22c55e; }
        .toggle-knob { width: 16px; height: 16px; background: white; border-radius: 50%; position: absolute; top: 2px; left: 2px; transition: 0.3s; }
        .toggle-switch.active .toggle-knob { left: 18px; }
      `}} />

      <div className="fixed z-0 blur-[120px] opacity-10 rounded-full pointer-events-none bg-blue-600 w-[600px] h-[600px] -top-48 -left-48 animate-pulse"></div>
      <div className="fixed z-0 blur-[120px] opacity-10 rounded-full pointer-events-none bg-emerald-400 w-[500px] h-[500px] bottom-0 -right-48 animate-pulse"></div>

      <AdminSidebar currentRoute="/admin" isOpen={isSidebarOpen} onLogout={() => router.push("/")} />

      <main className="lg:ml-64 min-h-screen flex flex-col p-6 lg:p-10 relative z-10">
        
        <TopNavbar 
          title={activeTab === "dashboard" ? "資產對沖總覽" : activeTab === "history" ? "歷史大數據矩陣" : activeTab === "vans" ? "VANS 安全稽核" : "帳號管理中樞"}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        {/* --- 分頁 A: Dashboard --- */}
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
                <div className="glass-panel p-6 rounded-3xl text-center bg-blue-600 text-white shadow-xl shadow-blue-500/20"><span className="text-[9px] font-black uppercase text-blue-100">歷史結案總數</span><div className="text-2xl font-black mt-1">{stats.done.toLocaleString()}</div></div>
             </div>
             <div className="glass-panel p-10 rounded-[3rem] min-h-[400px] flex flex-col shadow-2xl shadow-slate-200/50">
                <h3 className="font-black text-sm uppercase tracking-widest text-slate-400 mb-8">網段負載物理分佈</h3>
                <div className="flex-1 relative"><Bar options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} data={chartData} /></div>
             </div>
          </div>
        )}

        {/* --- 分頁 D: 帳號管理 (補全無障礙標籤) --- */}
        {activeTab === "users" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             
             <div className="flex flex-wrap items-center justify-between gap-4 glass-panel p-6 rounded-2xl bg-white/90 border-none shadow-sm">
                <div className="flex items-center gap-2">
                   <button onClick={syncCoreData} className="px-5 py-2.5 bg-[#40c4ff] text-white rounded-lg font-bold text-xs flex items-center gap-2 shadow-md hover:brightness-105 transition-all"><span className="material-symbols-outlined text-[16px]">refresh</span> 重整</button>
                   <button className="px-5 py-2.5 bg-[#4caf50] text-white rounded-lg font-bold text-xs flex items-center gap-2 shadow-md"><span className="material-symbols-outlined text-[16px]">search</span> 搜尋</button>
                   <button className="px-5 py-2.5 bg-[#ffb300] text-white rounded-lg font-bold text-xs flex items-center gap-2 shadow-md"><span className="material-symbols-outlined text-[16px]">verified_user</span> 使用者政策</button>
                   <button onClick={() => { setEditingUser(null); setIsUserModalOpen(true); }} className="px-5 py-2.5 bg-[#66bb6a] text-white rounded-lg font-bold text-xs flex items-center gap-2 shadow-md"><span className="material-symbols-outlined text-[16px]">person_add</span> 新增使用者</button>
                </div>
                <div className="flex items-center gap-3">
                   <div className="relative">
                      {/* 🚀 補齊搜尋 Input 之 title */}
                      <input id="userSearch" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="名稱、帳號、單位名稱..." title="搜尋使用者帳號或單位" className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold w-64 focus:ring-1 focus:ring-blue-500 outline-none" />
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                   </div>
                </div>
             </div>

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
                            <th className="px-8 py-5 text-left">組織名稱</th>
                            <th className="px-6 py-5">啟用狀態</th>
                            <th className="px-8 py-5">Action</th>
                         </tr>
                      </thead>
                      <tbody>
                         {filteredUsers.map((u, i) => (
                            <tr key={u.id} className="user-row text-[12px] font-bold text-slate-600 text-center">
                               <td className="px-6 py-5"><button className="w-8 h-8 rounded-lg border border-slate-100 flex items-center justify-center text-slate-300 hover:text-blue-500 transition-all"><span className="material-symbols-outlined text-[18px]">reply</span></button></td>
                               <td className="px-4 py-5 text-slate-400">{i + 1}</td>
                               <td className="px-4 py-5 font-mono">{u.id}</td>
                               <td className="px-8 py-5 text-left font-black text-slate-800">{u.username}</td>
                               <td className="px-8 py-5 text-left text-slate-400">{u.account}</td>
                               <td className="px-8 py-5 text-left">{u.org}</td>
                               <td className="px-6 py-5">
                                  <div className="flex items-center justify-center gap-3">
                                     <div className={`w-3 h-3 rounded-sm ${u.status ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                     <span className={`text-[11px] font-black ${u.status ? 'text-emerald-600' : 'text-slate-400'}`}>{u.status ? '啟用' : '停用'}</span>
                                     <div onClick={() => toggleStatus(u.id)} className={`toggle-switch ${u.status ? 'active' : ''} ml-2`}><div className="toggle-knob"></div></div>
                                  </div>
                               </td>
                               <td className="px-8 py-5">
                                  <div className="flex justify-center gap-1">
                                     <button onClick={() => { setEditingUser(u); setIsUserModalOpen(true); }} className="px-3 py-1.5 bg-[#42a5f5] text-white rounded font-black text-[10px] hover:brightness-105">編輯</button>
                                     <button className="px-3 py-1.5 bg-[#ffa726] text-white rounded font-black text-[10px]">身份列表</button>
                                     <button onClick={() => deleteUser(u.id)} className="px-3 py-1.5 bg-[#ef5350] text-white rounded font-black text-[10px] hover:brightness-105">刪除</button>
                                  </div>
                               </td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>

                {/* 🚀 物理修復：底部分頁區之無障礙屬性 */}
                <div className="p-6 border-t flex flex-col sm:flex-row justify-center items-center bg-white gap-10 text-[11px] font-black text-slate-400">
                   <p>共 {users.length} 條紀錄</p>
                   <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                         <button className="w-8 h-8 flex items-center justify-center text-slate-300"><span className="material-symbols-outlined text-[18px]">chevron_left</span></button>
                         <button className="w-8 h-8 flex items-center justify-center text-blue-600 border-b-2 border-blue-600">1</button>
                         <button className="w-8 h-8 flex items-center justify-center text-slate-300"><span className="material-symbols-outlined text-[18px]">chevron_right</span></button>
                      </div>
                      {/* 🚀 解決 axe/forms (Line 310)：補齊 id 與 title */}
                      <select id="pageSizeSelect" value={pageSize} onChange={e => setPageSize(Number(e.target.value))} title="每頁顯示條數" className="bg-white border border-slate-200 rounded px-3 py-1.5 outline-none text-slate-600 cursor-pointer">
                         <option value={20}>20 條/頁</option><option value={50}>50 條/頁</option>
                      </select>
                      <div className="flex items-center gap-2 font-bold">
                        {/* 🚀 解決 axe/forms (Line 311)：補齊 id, title 與 placeholder */}
                        跳至 <input id="jumpToPage" title="輸入頁碼並跳轉" placeholder="1" className="w-10 h-7 border border-slate-200 rounded text-center outline-none text-slate-600" defaultValue={1} /> 頁
                      </div>
                   </div>
                </div>
             </div>
          </div>
        )}

        {activeTab === "history" && ( <div className="space-y-6 animate-in fade-in duration-500">歷史大數據紀錄同步中...</div> )}
        {activeTab === "vans" && ( <div className="space-y-8 animate-in fade-in duration-500 pb-12"><VansCoreMetrics metrics={vansMetrics} /><VansReport /></div> )}
      </main>

      {/* 🚀 底部浮動導航 */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[130] bg-slate-900/90 backdrop-blur-2xl p-2 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/10 flex gap-1 animate-in slide-in-from-bottom-10 duration-700">
        <button onClick={() => setActiveTab("dashboard")} className={`px-6 py-2.5 rounded-full font-black text-[10px] uppercase transition-all duration-300 ${activeTab === "dashboard" ? "bg-white text-slate-900 shadow-xl" : "text-slate-400 hover:text-white"}`}>對沖總覽</button>
        <button onClick={() => setActiveTab("history")} className={`px-6 py-2.5 rounded-full font-black text-[10px] uppercase transition-all duration-300 ${activeTab === "history" ? "bg-white text-slate-900 shadow-xl" : "text-slate-400 hover:text-white"}`}>歷史大數據</button>
        <button onClick={() => setActiveTab("vans")} className={`px-6 py-2.5 rounded-full font-black text-[10px] uppercase transition-all duration-300 ${activeTab === "vans" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/50" : "text-slate-400 hover:text-white"}`}>VANS 稽核</button>
        <button onClick={() => setActiveTab("users")} className={`px-6 py-2.5 rounded-full font-black text-[10px] uppercase transition-all duration-300 ${activeTab === "users" ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/50" : "text-slate-400 hover:text-white"}`}>帳號管理</button>
      </div>

      {/* 🚀 物理維護彈窗：解決 axe/forms (Line 338-342) */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-md">
           <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95 border-t-[10px] border-t-emerald-500">
              <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">{editingUser ? '編輯帳號資料' : '錄入全新使用者'}</h2>
              <p className="text-xs font-bold text-slate-400 mb-8 uppercase tracking-widest">Account Physical Maintenance</p>
              <form onSubmit={handleUserSubmit} className="space-y-6">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                       <label htmlFor="modalUsername" className="text-[10px] font-black text-slate-400 ml-1">使用者姓名</label>
                       <input id="modalUsername" name="username" defaultValue={editingUser?.username} required title="輸入使用者姓名" placeholder="姓名" className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold text-sm shadow-inner" />
                    </div>
                    <div className="space-y-1">
                       <label htmlFor="modalAccount" className="text-[10px] font-black text-slate-400 ml-1">員工編號/帳號</label>
                       <input id="modalAccount" name="account" defaultValue={editingUser?.account} required title="輸入員工編號或登入帳號" placeholder="例如 A30304" className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-mono font-bold text-sm shadow-inner" />
                    </div>
                 </div>
                 <div className="space-y-1">
                    <label htmlFor="modalOrg" className="text-[10px] font-black text-slate-400 ml-1">組織部門</label>
                    <input id="modalOrg" name="org" defaultValue={editingUser?.org} required title="輸入所屬組織或部門" placeholder="資訊室 / 行政組" className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold text-sm shadow-inner" />
                 </div>
                 <div className="space-y-1">
                    <label htmlFor="modalRole" className="text-[10px] font-black text-slate-400 ml-1">權限角色定義</label>
                    {/* 🚀 解決 axe/forms (Line 342)：補齊 id 與 title */}
                    <select id="modalRole" name="role" defaultValue={editingUser?.role || "一般使用者"} title="選擇使用者角色類別" className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold text-sm shadow-inner cursor-pointer">
                       <option>超級管理員</option><option>一般使用者</option><option>外部廠商工程師</option>
                    </select>
                 </div>
                 <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setIsUserModalOpen(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black text-slate-400 uppercase text-xs">取消離開</button>
                    <button type="submit" className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black shadow-lg active:scale-95 transition-all uppercase text-xs">寫入雲端中樞</button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* 強同步遮罩 */}
      {isLoading && (
        <div className="fixed inset-0 z-[2000] flex flex-col items-center justify-center bg-white/90 backdrop-blur-2xl">
          <div className="w-16 h-16 border-[6px] border-slate-100 border-t-blue-600 rounded-full animate-spin mb-8 shadow-2xl"></div>
          <p className="text-blue-600 font-black tracking-[0.5em] uppercase text-xs animate-pulse">{loaderText}</p>
        </div>
      )}

      {/* 通知氣泡 */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[1100] flex flex-col gap-3 pointer-events-none w-full max-w-[320px] px-5">
        {toasts.map(t => (
          <div key={t.id} className={`px-8 py-5 rounded-[2rem] shadow-2xl font-black text-[11px] animate-in slide-in-from-bottom-4 flex items-center gap-4 border border-white/20 ${t.type === "success" ? "bg-slate-900/95" : "bg-red-600/95"} text-white backdrop-blur-md`}>
            <span className="material-symbols-outlined text-lg">{t.type === 'success' ? 'verified' : 'error'}</span>
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}