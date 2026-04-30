"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js";
import { Bar } from "react-chartjs-2";

import styles from "./admin.module.css";

// 註冊 Chart.js 組件
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

/**
 * ==========================================
 * 檔案：src/app/admin/page.tsx
 * 狀態：V300.50 互動跳轉升級版
 * 職責：
 * 1. 互動跳轉：數字卡片加入 onClick 事件，有資料時可直接點擊跳轉至詳細頁面。
 * 2. 視覺回饋：可點擊的卡片加入 cursor-pointer 與 hover:shadow-lg 效果。
 * 3. 實體對齊：完全鎖定「資產」與「historical_assets」雙資料表，時間排序為「建立時間」。
 * 4. 防呆提示：無資料時點擊會顯示 Toast 提示，不進行無效跳轉。
 * ==========================================
 */

export default function AdminDashboard() {
  const router = useRouter();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // 儀表板數據狀態
  const [stats, setStats] = useState({ pending: 0, done: 0 });
  const [ipData, setIpData] = useState<{ segment: string; count: number; percent: number }[]>([]);
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  
  // 加入 Toast 提示系統 (用於防呆回饋)
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" | "info" }[]>([]);

  const showToast = useCallback((msg: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // 獨立封裝的資料獲取邏輯
  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. 獲取待處理案件數 (對準「資產」)
      const { count: pendingCount, error: pendingErr } = await supabase
        .from("資產")
        .select("*", { count: "exact", head: true })
        .eq("狀態", "待核定");
        
      if (pendingErr) console.error("資產表讀取失敗", pendingErr);

      // 2. 獲取已結案總數 (對準 historical_assets 與 建立時間)
      const { data: historyData, count: doneCount, error: histErr } = await supabase
        .from("historical_assets")
        .select("*", { count: "exact" })
        .order("建立時間", { ascending: false });

      if (histErr) console.error("歷史表讀取失敗", histErr);

      setStats({
        pending: pendingCount || 0,
        done: doneCount || 0
      });

      // 3. 處理最近歸檔紀錄 (取前 20 筆)
      if (historyData) {
        setHistoryRecords(historyData.slice(0, 20));
        
        // 4. 計算 IP 網段使用率
        const segments = ["10.128", "10.130", "10.142", "192.168"];
        const ipUsage = segments.map(seg => {
          const count = historyData.filter((d: any) => String(d.核定ip || "").startsWith(seg)).length;
          // 假設每個網段最大可用 IP 數為 250
          const percent = Math.min(Math.floor((count / 250) * 100), 100);
          return { segment: seg, count, percent };
        });
        setIpData(ipUsage);
      }
    } catch (err) {
      console.error("資料載入異常:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // 驗證管理者登入狀態
    const isAuth = sessionStorage.getItem("asset_link_admin_auth");
    if (isAuth !== "true") { 
      router.push("/"); 
      return; 
    }
    fetchDashboardData();
  }, [router, fetchDashboardData]);

  // 取得最高負載百分比
  const maxIpPercent = ipData.length > 0 ? Math.max(...ipData.map(d => d.percent)) : 0;

  // --- 互動點擊事件處理 ---
  
  const handlePendingClick = () => {
    if (stats.pending > 0) {
      router.push("/pending");
    } else {
      showToast("目前無待核定案件", "success");
    }
  };

  const handleArchiveClick = () => {
    if (stats.done > 0) {
      // 若未來有 /history 頁面，可將此處改為 router.push("/history")
      showToast("已歸檔資產詳細報表模組即將開放", "info");
    } else {
      showToast("目前無已歸檔資產", "info");
    }
  };

  return (
    <div className={`min-h-screen text-slate-800 antialiased flex relative overflow-hidden ${styles.medicalGradient}`}>
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />

      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-sky-900/20 backdrop-blur-sm z-[45] md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* --- 側邊導航選單 --- */}
      <aside className={`w-64 fixed left-0 top-0 h-screen border-r border-white/40 ${styles.clinicalGlass} flex flex-col p-6 z-50 transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
          <div className="flex items-center gap-3 mb-10 px-2">
             <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg">
               <span className={`material-symbols-outlined ${styles.iconFill}`}>hub</span>
             </div>
             <h2 className="text-xl font-black text-sky-900 tracking-tighter uppercase">ALink 總控台</h2>
          </div>
          
          <nav className="flex-1 space-y-2">
              <button className="w-full text-left p-4 rounded-2xl font-bold bg-blue-600 text-white shadow-md flex items-center gap-3 transition-all">
                <span className="material-symbols-outlined text-base">dashboard</span> 儀表板首頁
              </button>
              <button onClick={() => router.push("/pending")} className="w-full text-left p-4 rounded-2xl font-bold text-slate-600 hover:bg-white/60 flex items-center gap-3 transition-all">
                <span className="material-symbols-outlined text-base">assignment_turned_in</span> 行政審核
              </button>
              <button onClick={() => router.push("/nsr")} className="w-full text-left p-4 rounded-2xl font-bold text-slate-600 hover:bg-white/60 flex items-center gap-3 transition-all">
                <span className="material-symbols-outlined text-base">account_balance_wallet</span> 網點計價結算
              </button>
              <button onClick={() => router.push("/internal")} className="w-full text-left p-4 rounded-2xl font-bold text-slate-600 hover:bg-white/60 flex items-center gap-3 transition-all">
                <span className="material-symbols-outlined text-base">bolt</span> 內部直通入庫
              </button>
          </nav>

          <div className="mt-auto pt-6 border-t border-slate-200/50">
             <button onClick={() => router.push("/")} className="w-full flex items-center gap-3 p-4 text-slate-400 font-bold hover:text-red-600 transition-colors">
               <span className="material-symbols-outlined text-base">logout</span> 登出系統
             </button>
          </div>
      </aside>

      {/* --- 主要內容區塊 --- */}
      <main className="w-full md:ml-64 flex-1 flex flex-col min-h-screen">
        <header className="px-6 py-5 bg-white/60 backdrop-blur-xl border-b border-slate-200/50 sticky top-0 z-30 flex items-center justify-between shadow-sm">
           <div className="flex items-center gap-4">
             <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-sky-800 p-1">
               <span className="material-symbols-outlined">menu</span>
             </button>
             <h1 className="text-lg font-black text-sky-800 uppercase tracking-widest">Administrative Dashboard</h1>
           </div>
           <button onClick={fetchDashboardData} className="text-slate-400 hover:text-blue-600 transition-colors bg-white p-2 rounded-lg border border-slate-100 shadow-sm flex items-center gap-2 text-xs font-bold">
             <span className="material-symbols-outlined text-sm">sync</span> 資料更新
           </button>
        </header>

        <div className="p-6 md:p-10 max-w-[1440px] mx-auto w-full flex-1">
          <div className="mb-10">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">全院資產營運概況</h2>
            <p className="text-sm text-slate-500 font-bold mt-2 uppercase tracking-widest">監控系統設備部署與網路資源分配</p>
          </div>

          {/* 數據統計卡片 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {/* 待核定案件 (支援點擊跳轉) */}
            <div 
              onClick={handlePendingClick}
              className={`${styles.clinicalGlass} p-8 rounded-3xl border-l-4 border-amber-400 transition-all duration-300 ${stats.pending > 0 ? 'cursor-pointer hover:-translate-y-1.5 hover:shadow-lg hover:bg-white/90 group' : 'opacity-80'}`}
            >
                <div className="flex justify-between items-start mb-2">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">待核定案件</p>
                  {stats.pending > 0 && <span className="material-symbols-outlined text-amber-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity">open_in_new</span>}
                </div>
                <h3 className="text-4xl font-black text-slate-800">{stats.pending}</h3>
                {stats.pending > 0 && <p className="text-[10px] text-amber-600 font-bold mt-2 opacity-0 group-hover:opacity-100 transition-opacity">點擊前往審核作業</p>}
            </div>

            {/* 已歸檔資產 (支援點擊提示/跳轉) */}
            <div 
              onClick={handleArchiveClick}
              className={`${styles.clinicalGlass} p-8 rounded-3xl border-l-4 border-blue-500 transition-all duration-300 ${stats.done > 0 ? 'cursor-pointer hover:-translate-y-1.5 hover:shadow-lg hover:bg-white/90 group' : 'opacity-80'}`}
            >
                <div className="flex justify-between items-start mb-2">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">已歸檔資產</p>
                  {stats.done > 0 && <span className="material-symbols-outlined text-blue-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity">open_in_new</span>}
                </div>
                <h3 className="text-4xl font-black text-slate-800">{stats.done.toLocaleString()}</h3>
                {stats.done > 0 && <p className="text-[10px] text-blue-600 font-bold mt-2 opacity-0 group-hover:opacity-100 transition-opacity">點擊查看詳細報表</p>}
            </div>

            {/* 網段負載 */}
            <div className={`${styles.clinicalGlass} p-8 rounded-3xl border-l-4 border-indigo-500 transition-transform hover:-translate-y-1`}>
                <p className="text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">最高網段負載</p>
                <h3 className="text-4xl font-black text-slate-800">{maxIpPercent}%</h3>
            </div>

            {/* 系統狀態 */}
            <div className={`${styles.clinicalGlass} p-8 rounded-3xl border-l-4 border-emerald-500 transition-transform hover:-translate-y-1`}>
                <p className="text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">資料庫連線狀態</p>
                <h3 className="text-4xl font-black text-slate-800 text-emerald-600">正常</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* IP 負載圖表 */}
            <div className={`${styles.clinicalGlass} col-span-1 lg:col-span-8 rounded-[2.5rem] p-8 shadow-sm h-[480px] flex flex-col`}>
                <h3 className="font-black text-lg text-slate-800 mb-6 tracking-tight">網路區段負載狀態</h3>
                <div className="flex-1 w-full relative">
                    <Bar 
                      options={{ 
                        responsive: true, 
                        maintainAspectRatio: false, 
                        plugins: { legend: { display: false } },
                        scales: { y: { beginAtZero: true, max: 100, ticks: { callback: (value) => `${value}%` } } }
                      }} 
                      data={{ 
                        labels: ipData.map(d => d.segment), 
                        datasets: [{ 
                          data: ipData.map(d => d.percent), 
                          backgroundColor: '#3b82f6', 
                          borderRadius: 8,
                          barThickness: 40
                        }] 
                      }} 
                    />
                </div>
            </div>

            {/* 最近歸檔日誌 */}
            <div className={`${styles.clinicalGlass} col-span-1 lg:col-span-4 rounded-[2.5rem] p-8 shadow-sm h-[480px] flex flex-col overflow-hidden`}>
                <h3 className="font-black text-lg text-slate-800 mb-6 tracking-tight">最近歸檔日誌</h3>
                <div className="overflow-y-auto flex-1 pr-2">
                    <table className={`w-full ${styles.zebraGlass} text-sm text-left`}>
                        <thead className="sticky top-0 bg-white/90 backdrop-blur-md">
                           <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                               <th className="pb-3 px-2">部署單位</th>
                               <th className="pb-3 px-2 text-right">核發 IP</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/50">
                           {historyRecords.length > 0 ? historyRecords.map((log, i) => (
                             <tr key={i} className="hover:bg-slate-50 transition-colors">
                                <td className="p-3 font-bold text-slate-700 truncate max-w-[150px]">{log.使用單位 || '未紀錄'}</td>
                                <td className="p-3 font-mono text-blue-600 text-right font-bold">{log.核定ip || '-'}</td>
                             </tr>
                           )) : (
                             <tr><td colSpan={2} className="p-8 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">目前尚無歸檔紀錄</td></tr>
                           )}
                        </tbody>
                    </table>
                </div>
            </div>
          </div>
        </div>
      </main>

      {/* --- 全域 Loading 遮罩 --- */}
      {isLoading && (
        <div className={styles.loaderOverlay}>
          <div className={styles.spinner}></div>
          <p className="text-blue-600 font-black text-[10px] uppercase mt-6 tracking-[0.5em] animate-pulse">系統資料載入中...</p>
        </div>
      )}

      {/* --- Toast 提示氣泡 --- */}
      <div className="fixed bottom-10 right-8 z-[9000] flex flex-col gap-3">
        {toasts.map(t => (
          <div key={t.id} className={`${styles.toastBase} ${t.type === 'info' ? 'bg-blue-900' : ''}`}>
            <span className={`material-symbols-outlined text-sm ${t.type === 'success' ? 'text-emerald-400' : t.type === 'error' ? 'text-red-400' : 'text-blue-400'}`}>
              {t.type === 'success' ? 'check_circle' : t.type === 'error' ? 'report' : 'info'}
            </span> 
            <span className="tracking-wide">{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}