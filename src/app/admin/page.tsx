"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
// 🚀 物理防護：改用相對路徑，防止 Next.js 找不到模組引發 Server Error
import { 
  getDashboardStats, getHistoricalArchive, 
  getVendorsAdmin, addVendorAdmin, toggleVendorStatusAdmin, resetVendorPasswordAdmin,
  uploadVansIps, executeVansCleansing 
} from "../../lib/actions/admin";
import styles from "./admin.module.css";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"dashboard" | "history" | "accounts" | "vans">("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" | "info" }[]>([]);

  const [stats, setStats] = useState({ totalHistory: 0, pendingReview: 0, pendingNsr: 0, totalVendors: 0 });
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [searchHistory, setSearchHistory] = useState("");
  const [vendors, setVendors] = useState<any[]>([]);
  const [newVendorName, setNewVendorName] = useState("");
  const [vansIps, setVansIps] = useState<string[]>([]);

  const showToast = useCallback((msg: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    const res = await getDashboardStats();
    if (res.success && res.data) setStats(res.data);
    setIsLoading(false);
  }, []);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getHistoricalArchive(500); 
      setHistoryRecords(data);
    } catch (err: any) { showToast(err.message, "error"); } 
    finally { setIsLoading(false); }
  }, [showToast]);

  const fetchAccounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getVendorsAdmin();
      setVendors(data);
    } catch (err: any) { showToast(err.message, "error"); } 
    finally { setIsLoading(false); }
  }, [showToast]);

  useEffect(() => {
    const isAuth = sessionStorage.getItem("asset_link_admin_auth");
    if (isAuth !== "true") { router.push("/"); return; }

    if (activeTab === "dashboard") fetchDashboard();
    if (activeTab === "history") fetchHistory();
    if (activeTab === "accounts") fetchAccounts();
  }, [router, activeTab, fetchDashboard, fetchHistory, fetchAccounts]);

  const handleAddVendor = async () => {
    if (!newVendorName.trim()) { showToast("請輸入廠商名稱", "error"); return; }
    setIsLoading(true);
    try {
      await addVendorAdmin(newVendorName);
      showToast("廠商帳號建立成功，預設密碼為 123456", "success");
      setNewVendorName("");
      await fetchAccounts();
    } catch (err: any) { showToast(err.message, "error"); } 
    finally { setIsLoading(false); }
  };

  const handleToggleVendor = async (name: string, status: string) => {
    setIsLoading(true);
    try {
      await toggleVendorStatusAdmin(name, status);
      showToast(`已成功變更 ${name} 的存取權限`, "success");
      await fetchAccounts();
    } catch (err: any) { showToast(err.message, "error"); } 
    finally { setIsLoading(false); }
  };

  const handleResetPassword = async (name: string) => {
    if (!confirm(`確定要將 [${name}] 的密碼強制重置為預設 (123456) 嗎？`)) return;
    setIsLoading(true);
    try {
      await resetVendorPasswordAdmin(name);
      showToast(`已重置 ${name} 的登入密碼`, "success");
    } catch (err: any) { showToast(err.message, "error"); } 
    finally { setIsLoading(false); }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("asset_link_admin_auth");
    router.push("/");
  };

  const handleVansFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const ipRegex = /\b(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;
      const foundIps = text.match(ipRegex) || [];
      const uniqueIps = Array.from(new Set(foundIps)); 
      
      setVansIps(uniqueIps);
      showToast(`成功解析出 ${uniqueIps.length.toLocaleString()} 筆不重複的有效 IP`, "success");
    };
    reader.readAsText(file);
  };

  const handleRunVansCleansing = async () => {
    if(vansIps.length === 0) return showToast("請先上傳並解析 VANS 檔案", "error");
    if(!confirm(`即將把 ${vansIps.length} 筆 IP 作為基準，對歷史庫執行智慧去重與狀態更新。確定執行嗎？`)) return;

    setIsLoading(true);
    try {
      showToast("正在上傳 VANS 基準資料至伺服器...", "info");
      await uploadVansIps(vansIps);
      
      showToast("上傳完成，開始執行資料庫 12 萬筆深度清洗...", "info");
      await executeVansCleansing();
      
      showToast("✅ 大數據清洗作業圓滿完成！", "success");
      setVansIps([]);
      
      setActiveTab("history");
      fetchHistory();
    } catch(e: any) {
      showToast(e.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredHistory = historyRecords.filter(r => 
    r.sn.includes(searchHistory.toUpperCase()) || 
    r.unit.includes(searchHistory) ||
    r.ip.includes(searchHistory) ||
    r.status.includes(searchHistory)
  );

  return (
    <div className={`min-h-screen text-slate-800 antialiased flex relative overflow-x-hidden ${styles.medicalGradient}`}>
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-sky-900/20 backdrop-blur-sm z-[45] md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      <aside className={`w-64 fixed left-0 top-0 h-screen border-r border-white/40 ${styles.clinicalGlass} flex flex-col p-6 z-50 transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
          <div className="flex items-center gap-3 mb-10 px-2">
             <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-lg">
               <span className={`material-symbols-outlined ${styles.iconFill}`}>admin_panel_settings</span>
             </div>
             <h2 className="text-xl font-black text-slate-800 tracking-tighter uppercase">ALink 總控台</h2>
          </div>
          <nav className="flex-1 space-y-2 overflow-y-auto pr-2 pb-10">
              <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 mt-2">戰情與管理</p>
              <button onClick={() => { setActiveTab("dashboard"); setIsMobileMenuOpen(false); }} className={`w-full text-left p-4 rounded-2xl font-bold transition-all flex items-center gap-3 ${activeTab === 'dashboard' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-600 hover:bg-white/60'}`}>
                <span className={`material-symbols-outlined text-sm ${activeTab === 'dashboard' ? styles.iconFill : ''}`}>dashboard</span> 儀表板首頁
              </button>
              <button onClick={() => { setActiveTab("history"); setIsMobileMenuOpen(false); }} className={`w-full text-left p-4 rounded-2xl font-bold transition-all flex items-center gap-3 ${activeTab === 'history' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-600 hover:bg-white/60'}`}>
                <span className={`material-symbols-outlined text-sm ${activeTab === 'history' ? styles.iconFill : ''}`}>database</span> 歷史結案資料庫
              </button>
              <button onClick={() => { setActiveTab("accounts"); setIsMobileMenuOpen(false); }} className={`w-full text-left p-4 rounded-2xl font-bold transition-all flex items-center gap-3 ${activeTab === 'accounts' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-600 hover:bg-white/60'}`}>
                <span className={`material-symbols-outlined text-sm ${activeTab === 'accounts' ? styles.iconFill : ''}`}>manage_accounts</span> 帳號權限管理
              </button>
              <button onClick={() => { setActiveTab("vans"); setIsMobileMenuOpen(false); }} className={`w-full text-left p-4 rounded-2xl font-bold transition-all flex items-center gap-3 mt-2 ${activeTab === 'vans' ? 'bg-blue-600 text-white shadow-md' : 'text-blue-700 bg-blue-50 border border-blue-100 hover:bg-blue-100'}`}>
                <span className={`material-symbols-outlined text-sm ${activeTab === 'vans' ? styles.iconFill : ''}`}>cleaning_services</span> VANS 智慧比對清洗
              </button>
              <div className="my-6 border-t border-slate-200/50"></div>
              <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">作業模組通道</p>
              <button onClick={() => router.push("/pending")} className="w-full text-left p-4 rounded-2xl font-bold text-slate-600 hover:bg-white/60 flex items-center gap-3 transition-all"><span className="material-symbols-outlined text-base text-amber-500">assignment_turned_in</span> 行政審核 (待辦)</button>
              <button onClick={() => router.push("/nsr")} className="w-full text-left p-4 rounded-2xl font-bold text-slate-600 hover:bg-white/60 flex items-center gap-3 transition-all"><span className="material-symbols-outlined text-base text-emerald-500">account_balance_wallet</span> 網點計價結算</button>
              <button onClick={() => router.push("/internal")} className="w-full text-left p-4 rounded-2xl font-bold text-slate-600 hover:bg-white/60 flex items-center gap-3 transition-all"><span className="material-symbols-outlined text-base text-purple-500">bolt</span> 內部直通入庫</button>
          </nav>
          <div className="mt-auto pt-4 border-t border-slate-200/50">
            <button onClick={handleLogout} className="w-full flex items-center gap-3 p-4 text-slate-400 font-bold hover:text-red-600 transition-colors"><span className="material-symbols-outlined text-base">logout</span> 安全登出</button>
          </div>
      </aside>

      <main className="w-full md:ml-64 flex-1 flex flex-col min-h-screen p-4 md:p-8">
        <header className="mb-8 mt-12 md:mt-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-sky-800 p-1 -ml-2"><span className="material-symbols-outlined">menu</span></button>
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
              {activeTab === 'dashboard' && '系統維運儀表板'}
              {activeTab === 'history' && '全域歷史結案資料庫'}
              {activeTab === 'accounts' && '帳號與權限控制'}
              {activeTab === 'vans' && '大數據比對清洗引擎'}
            </h1>
          </div>
          <p className="text-xs md:text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest pl-10 md:pl-0">System Control Center</p>
        </header>

        {activeTab === 'dashboard' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className={`${styles.clinicalGlass} rounded-3xl p-6 shadow-sm border-l-4 border-l-slate-800`}>
                <div className="flex items-center gap-3 text-slate-500 mb-4"><span className="material-symbols-outlined">database</span><span className="text-xs font-black uppercase tracking-widest">歷史歸檔總數</span></div>
                <div className="text-4xl font-black text-slate-800">{stats.totalHistory.toLocaleString()} <span className="text-sm font-bold text-slate-400">筆</span></div>
              </div>
              <div className={`${styles.clinicalGlass} rounded-3xl p-6 shadow-sm border-l-4 border-l-amber-500`}>
                <div className="flex items-center gap-3 text-amber-600 mb-4"><span className="material-symbols-outlined">pending_actions</span><span className="text-xs font-black uppercase tracking-widest">待核定資產案件</span></div>
                <div className="text-4xl font-black text-amber-600">{stats.pendingReview} <span className="text-sm font-bold text-amber-500/50">件待辦</span></div>
              </div>
              <div className={`${styles.clinicalGlass} rounded-3xl p-6 shadow-sm border-l-4 border-l-emerald-500`}>
                <div className="flex items-center gap-3 text-emerald-600 mb-4"><span className="material-symbols-outlined">receipt_long</span><span className="text-xs font-black uppercase tracking-widest">未處理 NSR 計價</span></div>
                <div className="text-4xl font-black text-emerald-600">{stats.pendingNsr} <span className="text-sm font-bold text-emerald-500/50">件待處理</span></div>
              </div>
              <div className={`${styles.clinicalGlass} rounded-3xl p-6 shadow-sm border-l-4 border-l-blue-500`}>
                <div className="flex items-center gap-3 text-blue-600 mb-4"><span className="material-symbols-outlined">storefront</span><span className="text-xs font-black uppercase tracking-widest">授權合作廠商</span></div>
                <div className="text-4xl font-black text-blue-600">{stats.totalVendors} <span className="text-sm font-bold text-blue-500/50">家實體</span></div>
              </div>
            </div>

            <div className={`${styles.clinicalGlass} rounded-3xl p-8 shadow-sm flex flex-col items-center justify-center min-h-[300px] text-center`}>
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 shadow-inner"><span className="material-symbols-outlined text-4xl text-slate-400">monitoring</span></div>
              <h2 className="text-xl font-black text-slate-700 mb-2">系統運作一切正常</h2>
              <p className="text-sm font-bold text-slate-500 max-w-md">請透過左側選單進入「行政審核」或「歷史資料庫」執行管理作業。各項模組的安全與日誌系統皆已啟用監控中。</p>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <div className={`${styles.clinicalGlass} rounded-2xl p-5 mb-6 flex flex-col sm:flex-row gap-4 items-center shadow-sm`}>
               <div className="w-full flex-1 relative">
                 <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                 <input type="text" placeholder="搜尋 產品序號 (S/N)、核定 IP、單位名稱或狀態 (如: VANS未尋獲)..." value={searchHistory} onChange={e => setSearchHistory(e.target.value)} className={`${styles.crystalInput} pl-12`} />
               </div>
               <div className="text-xs font-black text-slate-400 bg-white px-4 py-3 rounded-xl shadow-sm border border-slate-100 whitespace-nowrap">顯示最新 500 筆</div>
            </div>

            <div className={`${styles.clinicalGlass} rounded-3xl p-6 shadow-sm flex flex-col min-h-[500px]`}>
              <div className={styles.tableContainer}>
                <table className={`w-full text-left lg:min-w-[1000px] ${styles.responsiveTable}`}>
                  <thead className={styles.desktopOnly}>
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                      <th className="pb-4 px-4 w-[160px]">產品序號 / IP</th>
                      <th className="pb-4 px-4 w-[200px]">部署單位 / 裝機日</th>
                      <th className="pb-4 px-4 min-w-[250px]">設備參數 / 備註</th>
                      <th className="pb-4 px-4 w-[120px]">同步來源</th>
                      <th className="pb-4 px-4 w-[120px] text-right">當前狀態</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {filteredHistory.map((record, idx) => (
                      <tr key={`${record.sn}-${idx}`} className={`${styles.mobileCard} hover:bg-slate-50/50 transition-all`}>
                        <td className={`${styles.mobileTd} p-4 align-top whitespace-nowrap`} data-label="產品序號 / IP">
                          <p className="font-mono text-sm font-black text-slate-600">{record.sn}</p>
                          {record.ip && <p className="text-[11px] font-mono text-emerald-600 mt-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 inline-block">{record.ip}</p>}
                        </td>
                        <td className={`${styles.mobileTd} p-4 font-bold align-top whitespace-nowrap`} data-label="部署單位 / 裝機日">
                          <p className="text-slate-800">{record.unit}</p>
                          <p className="text-[10px] text-slate-400 font-normal uppercase mt-0.5">{record.area} | {record.floor} | {record.date}</p>
                        </td>
                        <td className={`${styles.mobileTd} p-4 align-top`} data-label="設備參數 / 備註">
                          <p className="font-bold text-slate-600">{record.model} <span className="text-[10px] text-slate-400 font-normal">({record.deviceType})</span></p>
                          {record.mac && <p className="text-[10px] font-mono text-slate-500 mt-0.5">MAC: {record.mac}</p>}
                          {record.remark && <p className="text-[10px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 mt-1 line-clamp-2">{record.remark}</p>}
                        </td>
                        <td className={`${styles.mobileTd} p-4 align-top whitespace-nowrap`} data-label="同步來源">
                          <p className={`text-[10px] font-black px-2 py-1 rounded inline-block ${record.source === '內部直通' ? 'bg-purple-100 text-purple-700' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>{record.source}</p>
                        </td>
                        <td className={`${styles.mobileTd} p-4 align-top lg:text-right whitespace-nowrap`} data-label="當前狀態">
                          <span className={`text-[10px] font-black uppercase tracking-widest block py-2 ${record.status === 'VANS未尋獲' ? 'text-red-500' : record.status === '重複作廢' ? 'text-slate-400 line-through' : record.status.includes('VANS正常') ? 'text-emerald-600' : 'text-slate-500'}`}>
                            {record.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredHistory.length === 0 && !isLoading && <tr><td colSpan={5} className="py-20 text-center text-slate-400 font-bold italic border-none">找不到符合條件的歷史紀錄。</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 分頁 3：帳號與權限管理 */}
        {activeTab === 'accounts' && (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <div className={`${styles.clinicalGlass} rounded-2xl p-6 mb-8 flex flex-col md:flex-row gap-4 items-end shadow-sm`}>
               <div className="w-full md:flex-1">
                 <label className={styles.inputLabel}>新增合作廠商實體</label>
                 <input type="text" placeholder="請輸入新廠商名稱 (建立後預設密碼為 123456)" value={newVendorName} onChange={e => setNewVendorName(e.target.value)} className={styles.crystalInput} onKeyDown={e => { if (e.key === 'Enter') handleAddVendor(); }}/>
               </div>
               <button onClick={handleAddVendor} disabled={isLoading} className="w-full md:w-auto py-3 px-6 bg-slate-800 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-slate-700 transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50">
                 <span className="material-symbols-outlined text-sm">person_add</span> 建立廠商帳號
               </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               <div className={`lg:col-span-2 ${styles.clinicalGlass} rounded-3xl p-6 shadow-sm`}>
                  <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4"><span className={`material-symbols-outlined text-blue-600 ${styles.iconFill}`}>storefront</span><h2 className="text-lg font-bold text-slate-800 tracking-tight">合作廠商權限清單</h2></div>
                  <div className="flex flex-col gap-4">
                    {vendors.map((v) => (
                      <div key={v.name} className={`${styles.deviceItemBlock} !p-4 !flex-row !items-center !gap-4 justify-between bg-white/60`}>
                         <div>
                           <h3 className="font-black text-slate-800 text-sm">{v.name}</h3>
                           {/* 🚀 物理防護：移除可能導致 SSR 崩潰的 new Date 解析，改用安全的字串截斷 */}
                           <p className="text-[10px] text-slate-400 font-mono mt-1">註冊: {v.createdAt ? v.createdAt.substring(0, 10) : '無紀錄'}</p>
                         </div>
                         <div className="flex items-center gap-3">
                           <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${v.status === '正常' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{v.status}</span>
                           <div className="flex gap-2">
                             <button onClick={() => handleToggleVendor(v.name, v.status)} title={v.status === '正常' ? '停權該廠商' : '恢復該廠商權限'} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${v.status === '正常' ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'}`}><span className="material-symbols-outlined text-sm">{v.status === '正常' ? 'block' : 'check_circle'}</span></button>
                             <button onClick={() => handleResetPassword(v.name)} title="重置密碼為 123456" className="w-8 h-8 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 hover:text-slate-800 flex items-center justify-center transition-all"><span className="material-symbols-outlined text-sm">lock_reset</span></button>
                           </div>
                         </div>
                      </div>
                    ))}
                    {vendors.length === 0 && <p className="text-center text-slate-400 font-bold text-sm py-10">目前無廠商紀錄</p>}
                  </div>
               </div>
               <div className={`lg:col-span-1 ${styles.clinicalGlass} rounded-3xl p-6 shadow-sm opacity-60 relative overflow-hidden group`}>
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity"><span className="text-xs font-black bg-slate-800 text-white px-4 py-2 rounded-full uppercase tracking-widest shadow-lg">即將開放</span></div>
                  <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4"><span className={`material-symbols-outlined text-slate-600 ${styles.iconFill}`}>admin_panel_settings</span><h2 className="text-lg font-bold text-slate-800 tracking-tight">內部管理員清單</h2></div>
                  <div className="flex flex-col gap-4 filter grayscale pointer-events-none">
                     <div className={`${styles.deviceItemBlock} !p-4 !flex-row !items-center !gap-4 justify-between bg-slate-50 border-dashed`}>
                        <div><h3 className="font-black text-slate-600 text-sm">SysAdmin</h3><p className="text-[10px] text-slate-400 font-mono mt-1">最高權限</p></div><span className="text-[10px] font-black px-3 py-1 rounded-full border bg-slate-200 text-slate-500 border-slate-300">啟用中</span>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* 分頁 4：VANS 智慧大數據比對清洗 */}
        {activeTab === 'vans' && (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <div className={`${styles.clinicalGlass} rounded-3xl p-6 md:p-8 shadow-sm max-w-4xl mx-auto`}>
               <div className="flex items-center gap-2 mb-8 border-b border-slate-100 pb-4">
                 <span className={`material-symbols-outlined text-blue-600 ${styles.iconFill}`}>cleaning_services</span><h2 className="text-lg font-bold text-slate-800 tracking-tight">VANS 基準比對與智慧清洗</h2>
               </div>
               <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-8">
                 <h3 className="font-black text-blue-800 mb-3 flex items-center gap-2"><span className="material-symbols-outlined text-xl">security</span> 清洗機制與安全宣告</h3>
                 <ul className="text-sm text-blue-700 space-y-2 list-disc list-inside pl-2 font-bold leading-relaxed">
                   <li>自動搜尋重複設備，保留最新一筆，其餘標示為「重複作廢」。</li>
                   <li>上傳 VANS 報表 (支援 .csv 或 .txt)，自動擷取 IP。</li>
                   <li>歷史庫中 IP 不在名單內者，變更為「VANS未尋獲」。</li>
                   <li>系統絕對不會刪除任何資料，所有動作均可由歷史庫重新查閱。</li>
                 </ul>
               </div>
               <div className="space-y-8">
                  <div>
                    <label className={styles.inputLabel}>選擇 VANS 匯出報表</label>
                    <input type="file" accept=".csv,.txt" onChange={handleVansFileUpload} className={`${styles.crystalInput} py-4 cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100`} />
                  </div>
                  {vansIps.length > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 animate-in slide-in-from-bottom-2">
                      <div className="text-emerald-700 font-black flex items-center gap-2 text-lg mb-1"><span className="material-symbols-outlined">check_circle</span>檔案解析成功</div>
                      <p className="text-emerald-600 text-sm font-bold pl-8">已從檔案中萃取出 <span className="text-emerald-800 text-lg mx-1">{vansIps.length.toLocaleString()}</span> 筆有效 IP 位址。</p>
                    </div>
                  )}
                  <button onClick={handleRunVansCleansing} disabled={isLoading || vansIps.length === 0} className="w-full py-6 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-sm shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3">
                    {isLoading ? <><span className="material-symbols-outlined animate-spin">refresh</span>資料庫巨量清洗中...</> : <><span className="material-symbols-outlined">database_check</span>開始執行比對與智慧清洗</>}
                  </button>
               </div>
            </div>
          </div>
        )}

      </main>

      {isLoading && <div className={styles.loaderOverlay}><div className={styles.spinner}></div><p className="text-slate-800 font-black text-[10px] uppercase mt-6 tracking-[0.5em] animate-pulse">系統處理中...</p></div>}
      <div className="fixed bottom-10 right-8 z-[9000] flex flex-col gap-3">{toasts.map(t => <div key={t.id} className={`${styles.toastBase} ${t.type === 'info' ? 'bg-slate-50 text-slate-800 border-slate-200' : ''}`}><span className={`material-symbols-outlined text-sm ${styles.iconFill} ${t.type === 'success' ? 'text-emerald-400' : t.type === 'error' ? 'text-red-400' : 'text-slate-400'}`}>{t.type === 'success' ? 'check_circle' : t.type === 'error' ? 'report' : 'info'}</span><span className="tracking-wide">{t.msg}</span></div>)}</div>
    </div>
  );
}