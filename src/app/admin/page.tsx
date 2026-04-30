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
 * 狀態：V300.41 文字體驗優化版 (白話文、專業口語)
 * 職責：
 * 1. 介面文字：將技術術語 (如:對沖、物理) 轉換為使用者友善的專業口語。
 * 2. 佈局結構：維持儀表板的整潔，消除不必要的橫向滾動條。
 * 3. 實體對齊：數據讀取邏輯維持與「資產」表及「historical_assets」精準綁定。
 * 4. 無符號化：維持企業級專業外觀，沒有任何表情符號。
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

  // 獨立封裝的資料獲取邏輯，根除外部 Action 依賴錯誤
  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. 獲取待處理案件數 (鎖定「資產」表)
      const { count: pendingCount } = await supabase
        .from("資產")
        .select("*", { count: "exact", head: true })
        .eq("狀態", "待核定");

      // 2. 獲取已結案總數 (鎖定 historical_assets)
      const { data: historyData, count: doneCount } = await supabase
        .from("historical_assets")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

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
      console.error("儀表板資料載入異常:", err);
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
            <div className={`${styles.clinicalGlass} p-8 rounded-3xl border-l-4 border-amber-400 transition-transform hover:-translate-y-1`}>
                <p className="text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">待核定案件</p>
                <h3 className="text-4xl font-black text-slate-800">{stats.pending}</h3>
            </div>
            <div className={`${styles.clinicalGlass} p-8 rounded-3xl border-l-4 border-blue-500 transition-transform hover:-translate-y-1`}>
                <p className="text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">已歸檔資產</p>
                <h3 className="text-4xl font-black text-slate-800">{stats.done.toLocaleString()}</h3>
            </div>
            <div className={`${styles.clinicalGlass} p-8 rounded-3xl border-l-4 border-indigo-500 transition-transform hover:-translate-y-1`}>
                <p className="text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">最高網段負載</p>
                <h3 className="text-4xl font-black text-slate-800">{maxIpPercent}%</h3>
            </div>
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
    </div>
  );
}