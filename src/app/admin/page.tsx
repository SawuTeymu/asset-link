"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  getDashboardStats, 
  searchHistoricalAssets, 
  getVendorsAdmin, 
  addVendorAdmin, 
  toggleVendorStatusAdmin, 
  resetVendorPasswordAdmin 
} from "@/lib/actions/admin";
import styles from "./admin.module.css";

/**
 * ==========================================
 * 檔案：src/app/admin/page.tsx
 * 狀態：V3.0 總控台戰情室 (歷史庫與帳號管理擴充版)
 * 職責：
 * 1. 儀表板：呈現系統 4 大維度指標。
 * 2. 歷史結案資料庫：支援 SN/IP/MAC/單位的模糊搜尋，具備手機真卡片 RWD。
 * 3. 帳號安全管理：廠商清單呈現、快速開關(啟用/停權)、密碼強制重設與新增廠商。
 * ==========================================
 */

export default function AdminDashboardPage() {
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<"dashboard" | "history" | "account">("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" | "info" }[]>([]);

  // --- 狀態庫 ---
  const [stats, setStats] = useState({ pending: 0, historical: 0, nsr: 0, vendor: 0 });
  
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [searchKeyword, setSearchKeyword] = useState("");

  const [vendors, setVendors] = useState<any[]>([]);
  const [newVendorName, setNewVendorName] = useState("");

  const showToast = useCallback((msg: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // --- 初始化與權限驗證 ---
  useEffect(() => {
    const isAuth = sessionStorage.getItem("asset_link_admin_auth");
    if (isAuth !== "true") { router.push("/"); return; }
    loadData(activeTab);
  }, [router, activeTab]);

  const loadData = async (tab: string) => {
    setIsLoading(true);
    try {
      if (tab === "dashboard") {
        const res = await getDashboardStats();
        if (res.success && res.data) {
          setStats({ pending: res.data.pendingCount, historical: res.data.historicalCount, nsr: res.data.nsrPendingCount, vendor: res.data.vendorCount });
        }
      } else if (tab === "history") {
        await executeSearch("");
      } else if (tab === "account") {
        await fetchVendors();
      }
    } catch (err) {
      showToast("資料同步異常", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // --- 歷史庫邏輯 ---
  const executeSearch = async (keyword: string) => {
    setIsLoading(true);
    try {
      const res = await searchHistoricalAssets(keyword);
      if (res.success) setHistoryRecords(res.data || []);
      else showToast(res.message || "搜尋失敗", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // --- 帳號管理邏輯 ---
  const fetchVendors = async () => {
    const res = await getVendorsAdmin();
    if (res.success) setVendors(res.data || []);
  };

  const handleAddVendor = async () => {
    if (!newVendorName.trim()) { showToast("請輸入廠商名稱", "error"); return; }
    setIsLoading(true);
    const res = await addVendorAdmin(newVendorName);
    if (res.success) {
      showToast(`成功建立廠商：${newVendorName}`, "success");
      setNewVendorName("");
      await fetchVendors();
    } else {
      showToast(res.message || "新增失敗", "error");
    }
    setIsLoading(false);
  };

  const handleToggleVendor = async (name: string, currentIsActive: boolean) => {
    setIsLoading(true);
    const res = await toggleVendorStatusAdmin(name, currentIsActive);
    if (res.success) {
      showToast(`已變更 ${name} 的權限狀態`, "success");
      await fetchVendors();
    } else {
      showToast(res.message || "狀態變更失敗", "error");
    }
    setIsLoading(false);
  };

  const handleResetPassword = async (name: string) => {
    const pwd = prompt(`請輸入要強制指派給「${name}」的新密碼 (至少6碼)：`, "123456");
    if (pwd === null) return;
    
    setIsLoading(true);
    const res = await resetVendorPasswordAdmin(name, pwd);
    if (res.success) {
      showToast(`已強制重設 ${name} 的登入密碼`, "success");
      await fetchVendors();
    } else {
      showToast(res.message || "密碼重設失敗", "error");
    }
    setIsLoading(false);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("asset_link_admin_auth");
    router.push("/");
  };

  return (
    <div className={`min-h-screen text-slate-800 antialiased flex relative overflow-x-hidden ${styles.medicalGradient}`}>
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-sky-900/20 backdrop-blur-sm z-[45] md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* --- 左側總控台導覽列 --- */}
      <aside className={`w-64 fixed left-0 top-0 h-screen border-r border-white/40 ${styles.clinicalGlass} flex flex-col p-6 z-50 transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
          <div className="flex items-center gap-3 mb-8 px-2">
             <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-lg">
               <span className={`material-symbols-outlined ${styles.iconFill}`}>admin_panel_settings</span>
             </div>
             <h2 className="text-xl font-black text-slate-800 tracking-tighter uppercase">ALink 總控台</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-1 pr-2 pb-10">
              <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 mt-2">控制中樞</p>
              <button onClick={() => { setActiveTab("dashboard"); setIsMobileMenuOpen(false); }} className={`w-full text-left p-3.5 rounded-2xl font-bold transition-all flex items-center gap-3 ${activeTab === 'dashboard' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-600 hover:bg-white/60'}`}>
                <span className={`material-symbols-outlined text-sm ${activeTab === 'dashboard' ? styles.iconFill : ''}`}>dashboard</span> 戰情儀表板
              </button>
              <button onClick={() => { setActiveTab("history"); setIsMobileMenuOpen(false); }} className={`w-full text-left p-3.5 rounded-2xl font-bold transition-all flex items-center gap-3 ${activeTab === 'history' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-600 hover:bg-white/60'}`}>
                <span className={`material-symbols-outlined text-sm ${activeTab === 'history' ? styles.iconFill : ''}`}>database</span> 歷史結案庫
              </button>
              <button onClick={() => { setActiveTab("account"); setIsMobileMenuOpen(false); }} className={`w-full text-left p-3.5 rounded-2xl font-bold transition-all flex items-center gap-3 ${activeTab === 'account' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-600 hover:bg-white/60'}`}>
                <span className={`material-symbols-outlined text-sm ${activeTab === 'account' ? styles.iconFill : ''}`}>manage_accounts</span> 廠商權限管理
              </button>

              <div className="my-5 border-t border-slate-200/50"></div>
              <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">作業模組</p>
              
              <button onClick={() => router.push("/pending")} className="w-full text-left p-3.5 rounded-2xl font-bold text-slate-600 hover:bg-white/60 flex items-center gap-3 transition-all"><span className="material-symbols-outlined text-sm">assignment_turned_in</span> 行政配發審核</button>
              <button onClick={() => router.push("/nsr")} className="w-full text-left p-3.5 rounded-2xl font-bold text-slate-600 hover:bg-white/60 flex items-center gap-3 transition-all"><span className="material-symbols-outlined text-sm">account_balance_wallet</span> 網點計價結算</button>
              <button onClick={() => router.push("/internal")} className="w-full text-left p-3.5 rounded-2xl font-bold text-slate-600 hover:bg-white/60 flex items-center gap-3 transition-all"><span className="material-symbols-outlined text-sm">bolt</span> 內部直通入庫</button>
          </div>
          
          <div className="pt-4 border-t border-slate-200/50 mt-auto">
            <button onClick={handleLogout} className="w-full flex items-center gap-3 p-4 text-slate-400 font-bold hover:text-red-600 transition-colors"><span className="material-symbols-outlined text-base">logout</span> 登出系統</button>
          </div>
      </aside>

      <main className="w-full md:ml-64 flex-1 flex flex-col min-h-screen p-4 md:p-8">
        
        {/* =========================================
            分頁 1：戰情儀表板 (Dashboard)
            ========================================= */}
        {activeTab === 'dashboard' && (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <header className="mb-10 mt-12 md:mt-0">
              <div className="flex items-center gap-3">
                <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-sky-800 p-1 -ml-2"><span className="material-symbols-outlined">menu</span></button>
                <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">戰情儀表板</h1>
              </div>
              <p className="text-xs md:text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest pl-10 md:pl-0">System Operation Dashboard</p>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
               <div className={`${styles.clinicalGlass} rounded-3xl p-6 flex flex-col justify-between hover:scale-[1.02] transition-transform`}>
                 <div className="flex justify-between items-start mb-4">
                   <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><span className={`material-symbols-outlined ${styles.iconFill}`}>database</span></div>
                 </div>
                 <h3 className="text-slate-400 font-black text-[10px] tracking-widest uppercase mb-1">設備歷史結案總數</h3>
                 <p className="text-4xl font-black text-slate-800">{stats.historical}</p>
               </div>
               
               <div className={`${styles.clinicalGlass} rounded-3xl p-6 flex flex-col justify-between hover:scale-[1.02] transition-transform`}>
                 <div className="flex justify-between items-start mb-4">
                   <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600"><span className={`material-symbols-outlined ${styles.iconFill}`}>assignment_late</span></div>
                 </div>
                 <h3 className="text-slate-400 font-black text-[10px] tracking-widest uppercase mb-1">待核定資產申請</h3>
                 <p className="text-4xl font-black text-slate-800">{stats.pending}</p>
               </div>

               <div className={`${styles.clinicalGlass} rounded-3xl p-6 flex flex-col justify-between hover:scale-[1.02] transition-transform`}>
                 <div className="flex justify-between items-start mb-4">
                   <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><span className={`material-symbols-outlined ${styles.iconFill}`}>account_balance_wallet</span></div>
                 </div>
                 <h3 className="text-slate-400 font-black text-[10px] tracking-widest uppercase mb-1">未處理 NSR 網點計價</h3>
                 <p className="text-4xl font-black text-slate-800">{stats.nsr}</p>
               </div>

               <div className={`${styles.clinicalGlass} rounded-3xl p-6 flex flex-col justify-between hover:scale-[1.02] transition-transform`}>
                 <div className="flex justify-between items-start mb-4">
                   <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600"><span className={`material-symbols-outlined ${styles.iconFill}`}>storefront</span></div>
                 </div>
                 <h3 className="text-slate-400 font-black text-[10px] tracking-widest uppercase mb-1">已註冊合作廠商</h3>
                 <p className="text-4xl font-black text-slate-800">{stats.vendor}</p>
               </div>
            </div>
          </div>
        )}

        {/* =========================================
            分頁 2：歷史結案資料庫 (Historical Database)
            ========================================= */}
        {activeTab === 'history' && (
          <div className="animate-in fade-in zoom-in-95 duration-300 flex flex-col flex-1">
            <header className="mb-8 mt-12 md:mt-0">
              <div className="flex items-center gap-3">
                <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-sky-800 p-1 -ml-2"><span className="material-symbols-outlined">menu</span></button>
                <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">歷史結案資料庫</h1>
              </div>
              <p className="text-xs md:text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest pl-10 md:pl-0">Historical Assets Archive</p>
            </header>

            <div className={`${styles.clinicalGlass} rounded-2xl p-4 mb-8 flex flex-col sm:flex-row gap-4 items-center shadow-sm`}>
               <div className="w-full flex-1 relative">
                 <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                 <input 
                   type="text" 
                   value={searchKeyword} 
                   onChange={e => setSearchKeyword(e.target.value)}
                   onKeyDown={e => { if(e.key === 'Enter') executeSearch(searchKeyword) }}
                   placeholder="搜尋 序號 (S/N) / IP / MAC / 單位名稱..." 
                   className={`${styles.crystalInput} pl-12`} 
                 />
               </div>
               <button onClick={() => executeSearch(searchKeyword)} className="w-full sm:w-auto px-6 py-3 bg-slate-800 text-white font-black text-[12px] uppercase tracking-widest rounded-xl hover:bg-slate-700 transition-all flex items-center justify-center gap-2">
                 搜尋資料庫
               </button>
            </div>

            <div className={`${styles.clinicalGlass} rounded-3xl p-6 md:p-8 shadow-sm flex flex-col flex-1`}>
              <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <span className={`material-symbols-outlined text-slate-600 ${styles.iconFill}`}>database</span>
                  <h2 className="text-lg font-bold text-slate-800 tracking-tight">大數據檢索結果</h2>
                </div>
                <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-widest">Top 150 Records</span>
              </div>
              
              {/* 電腦版表格 */}
              <div className="hidden lg:block w-full overflow-x-auto">
                <table className="w-full text-left min-w-[1000px]">
                  <thead>
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                      <th className="pb-4 px-4 w-[160px] whitespace-nowrap">設備序號 (S/N)</th>
                      <th className="pb-4 px-4 w-[200px] whitespace-nowrap">部署單位 / 裝機日</th>
                      <th className="pb-4 px-4 min-w-[250px]">設備參數 / 網路配置</th>
                      <th className="pb-4 px-4 w-[120px]">來源廠商</th>
                      <th className="pb-4 px-4 w-[120px] text-right">結案單號</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {historyRecords.map((record, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-all">
                        <td className="p-4 align-top whitespace-nowrap">
                          <p className="font-mono text-sm font-black text-slate-700">{record.sn}</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-1">{record.deviceType}</p>
                        </td>
                        <td className="p-4 font-bold align-top whitespace-nowrap">
                          <p className="text-slate-800">{record.unit}</p>
                          <p className="text-[10px] text-slate-400 font-normal uppercase mt-0.5">{record.area} | {record.floor} | {record.date}</p>
                          <p className="text-[10px] text-slate-500 font-normal mt-0.5 bg-slate-50 inline-block px-1 rounded">{record.applicantName} #{record.applicantExt}</p>
                        </td>
                        <td className="p-4 align-top">
                          <p className="font-bold text-slate-700">{record.model}</p>
                          <p className="text-[10px] font-mono text-slate-500 mt-1 block">MAC: <span className="text-blue-600 font-black">{record.mac1 || 'N/A'}</span></p>
                          {record.ip && <p className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 inline-block mt-1">IP: {record.ip}</p>}
                        </td>
                        <td className="p-4 align-top">
                          <p className="text-[11px] font-black text-sky-700 bg-sky-50 px-2 py-1 rounded inline-block border border-sky-100">{record.vendor}</p>
                        </td>
                        <td className="p-4 align-top text-right whitespace-nowrap">
                           <p className="text-[10px] font-mono font-black text-slate-400">{record.formId}</p>
                           {record.remark && <p className="text-[10px] text-slate-400 mt-1 max-w-[150px] truncate ml-auto" title={record.remark}>{record.remark}</p>}
                        </td>
                      </tr>
                    ))}
                    {historyRecords.length === 0 && !isLoading && <tr><td colSpan={5} className="py-20 text-center text-slate-400 font-bold italic border-none">無相符的歷史結案資料。</td></tr>}
                  </tbody>
                </table>
              </div>

              {/* 手機版卡片 */}
              <div className="grid grid-cols-1 gap-5 lg:hidden w-full">
                {historyRecords.map((record, i) => (
                  <div key={i} className={styles.deviceItemBlock}>
                    <div className="flex justify-between items-center border-b border-slate-200/60 pb-3 mb-3">
                      <span className="font-mono text-sm font-black text-slate-700">{record.sn}</span>
                      <span className="bg-slate-100 text-slate-500 text-[9px] px-2 py-1 rounded font-mono font-black tracking-widest">{record.formId}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                         <label className={styles.inputLabel}>單位 / 裝機資訊</label>
                         <div className="bg-white/60 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700">
                           {record.unit} ({record.area} {record.floor})
                           <span className="text-slate-500 mt-1 block">{record.applicantName} #{record.applicantExt}</span>
                           <span className="text-slate-400 mt-1 block font-mono text-[10px]">{record.date}</span>
                         </div>
                      </div>
                      <div>
                         <label className={styles.inputLabel}>設備 / 網路參數</label>
                         <div className="bg-white/60 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700">
                           <span className="text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-100 mr-2 text-[10px]">{record.deviceType}</span>
                           {record.model}
                           <span className="text-blue-600 font-mono mt-2 block tracking-widest text-[11px]">MAC: {record.mac1 || 'N/A'}</span>
                           {record.ip && <span className="text-emerald-600 font-mono mt-1 block tracking-widest text-[11px]">IP: {record.ip}</span>}
                         </div>
                      </div>
                    </div>
                    <div className="mt-2 pt-3 border-t border-slate-200/60 flex justify-between items-center">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">來源: {record.vendor}</span>
                    </div>
                  </div>
                ))}
                {historyRecords.length === 0 && !isLoading && <div className="py-20 text-center text-slate-400 font-bold italic">無相符的歷史結案資料。</div>}
              </div>
            </div>
          </div>
        )}

        {/* =========================================
            分頁 3：廠商權限管理 (Account Management)
            ========================================= */}
        {activeTab === 'account' && (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <header className="mb-10 mt-12 md:mt-0">
              <div className="flex items-center gap-3">
                <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-sky-800 p-1 -ml-2"><span className="material-symbols-outlined">menu</span></button>
                <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">廠商權限管理</h1>
              </div>
              <p className="text-xs md:text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest pl-10 md:pl-0">Vendor Account Center</p>
            </header>

            <div className={`${styles.clinicalGlass} rounded-2xl p-5 mb-8 flex flex-col sm:flex-row gap-4 items-center shadow-sm`}>
               <div className="w-full sm:w-auto flex-1 relative">
                 <input 
                   type="text" 
                   value={newVendorName} 
                   onChange={e => setNewVendorName(e.target.value)}
                   onKeyDown={e => { if(e.key === 'Enter') handleAddVendor() }}
                   placeholder="輸入新合作廠商完整名稱..." 
                   className={styles.crystalInput} 
                 />
               </div>
               <button onClick={handleAddVendor} className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white font-black text-[12px] uppercase tracking-widest rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                 <span className="material-symbols-outlined text-[16px]">add_circle</span> 新增實體廠商
               </button>
            </div>

            <div className={`${styles.clinicalGlass} rounded-3xl p-6 md:p-8 shadow-sm flex flex-col min-h-[500px]`}>
              <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <span className={`material-symbols-outlined text-slate-600 ${styles.iconFill}`}>manage_accounts</span>
                  <h2 className="text-lg font-bold text-slate-800 tracking-tight">授權廠商清單</h2>
                </div>
                <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-widest">共 {vendors.length} 家</span>
              </div>
              
              <div className="hidden lg:block w-full overflow-x-auto">
                <table className="w-full text-left min-w-[800px]">
                  <thead>
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                      <th className="pb-4 px-4 w-[250px]">廠商實體名稱</th>
                      <th className="pb-4 px-4 w-[150px]">行政狀態</th>
                      <th className="pb-4 px-4 min-w-[200px]">登入密碼</th>
                      <th className="pb-4 px-4 w-[200px] text-right">權限操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {vendors.map((v, i) => (
                      <tr key={i} className={`hover:bg-slate-50/50 transition-all ${!v.isActive ? 'opacity-50 grayscale' : ''}`}>
                        <td className="p-4 align-middle">
                          <p className="font-bold text-slate-800 text-base">{v.name}</p>
                        </td>
                        <td className="p-4 align-middle">
                          {v.isActive 
                            ? <span className="bg-emerald-100 text-emerald-700 text-[10px] px-3 py-1.5 rounded-full border border-emerald-200 font-black uppercase tracking-widest shadow-sm">正常啟用</span>
                            : <span className="bg-red-100 text-red-700 text-[10px] px-3 py-1.5 rounded-full border border-red-200 font-black uppercase tracking-widest shadow-sm">停權鎖定</span>
                          }
                        </td>
                        <td className="p-4 align-middle">
                          <div className="flex items-center gap-3">
                            <p className="font-mono font-black text-slate-600 tracking-widest text-lg">{v.password}</p>
                            {v.password === '123456' && <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded border border-amber-200">預設密碼</span>}
                          </div>
                        </td>
                        <td className="p-4 align-middle text-right">
                           <div className="flex items-center justify-end gap-2">
                             <button onClick={() => handleResetPassword(v.name)} className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 hover:bg-amber-100 hover:text-amber-600 transition-all flex items-center justify-center shadow-sm" title="強制重設密碼">
                               <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                             </button>
                             <button onClick={() => handleToggleVendor(v.name, v.isActive)} className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center shadow-sm ${v.isActive ? 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white border border-red-100' : 'bg-emerald-50 text-emerald-500 hover:bg-emerald-500 hover:text-white border border-emerald-100'}`} title={v.isActive ? "暫停權限" : "恢復權限"}>
                               <span className="material-symbols-outlined text-[18px]">{v.isActive ? 'block' : 'check_circle'}</span>
                             </button>
                           </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 gap-5 lg:hidden w-full">
                {vendors.map((v, i) => (
                  <div key={i} className={`${styles.deviceItemBlock} ${!v.isActive ? 'opacity-60 grayscale bg-slate-50' : ''}`}>
                    <div className="flex justify-between items-center border-b border-slate-200/60 pb-3 mb-2">
                      <span className="font-bold text-base text-slate-800">{v.name}</span>
                      {v.isActive 
                        ? <span className="bg-emerald-100 text-emerald-700 text-[10px] px-3 py-1.5 rounded-full border border-emerald-200 font-black uppercase tracking-widest shadow-sm">正常</span>
                        : <span className="bg-red-100 text-red-700 text-[10px] px-3 py-1.5 rounded-full border border-red-200 font-black uppercase tracking-widest shadow-sm">停權</span>
                      }
                    </div>
                    <div className="flex items-center justify-between mb-4 mt-2">
                      <label className={styles.inputLabel}>登入密碼</label>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-slate-600 tracking-widest text-lg">{v.password}</span>
                        {v.password === '123456' && <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded border border-amber-200">預設</span>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-200/60">
                       <button onClick={() => handleResetPassword(v.name)} className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-amber-100 hover:text-amber-600 transition-all flex items-center justify-center gap-2">
                         <span className="material-symbols-outlined text-[16px]">lock_reset</span>重設密碼
                       </button>
                       <button onClick={() => handleToggleVendor(v.name, v.isActive)} className={`w-full py-3 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${v.isActive ? 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white border border-red-100' : 'bg-emerald-50 text-emerald-500 hover:bg-emerald-500 hover:text-white border border-emerald-100'}`}>
                         <span className="material-symbols-outlined text-[16px]">{v.isActive ? 'block' : 'check_circle'}</span> {v.isActive ? '停權' : '啟用'}
                       </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </main>

      {isLoading && <div className={styles.loaderOverlay}><div className={styles.spinner}></div><p className="text-slate-800 font-black text-[10px] uppercase mt-6 tracking-[0.5em] animate-pulse">系統處理中...</p></div>}
      <div className="fixed bottom-10 right-8 z-[9000] flex flex-col gap-3">{toasts.map(t => <div key={t.id} className={`${styles.toastBase} ${t.type === 'info' ? 'bg-blue-50 text-blue-800 border-blue-200' : ''}`}><span className={`material-symbols-outlined text-sm ${styles.iconFill} ${t.type === 'success' ? 'text-emerald-400' : t.type === 'error' ? 'text-red-400' : 'text-blue-400'}`}>{t.type === 'success' ? 'check_circle' : t.type === 'error' ? 'report' : 'info'}</span><span className="tracking-wide">{t.msg}</span></div>)}</div>
    </div>
  );
}