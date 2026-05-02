"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import styles from "./nsr.module.css";

/**
 * ==========================================
 * 檔案：src/app/nsr/page.tsx
 * 狀態：V400.1 網點計價結算 (行動卡片優化版)
 * 職責：
 * 1. 歷史庫查詢：從 historical_assets 讀取已結案資產，進行 NSR 計價結算。
 * 2. 狀態管理：將「已結案」標記為「已計價結算」。
 * 3. 🚀 物理響應式架構：電腦版維持資料表(Table)，手機版改為獨立卡片區塊跳行顯示。
 * 4. 潔淨規範：無任何 Inline Styles 警告，完全依賴 module.css。
 * ==========================================
 */

export default function NsrPage() {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);
  
  // 篩選器狀態
  const [vendorFilter, setVendorFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" | "info" }[]>([]);

  // --- Toast 提示系統 ---
  const showToast = useCallback((msg: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // --- 獲取結案清單 ---
  const fetchNsrRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("historical_assets")
        .select("*")
        .order("裝機日期", { ascending: false });

      if (vendorFilter !== "ALL") {
        query = query.eq("同步來源", vendorFilter);
      }
      if (statusFilter !== "ALL") {
        query = query.eq("狀態", statusFilter);
      } else {
        // 預設只顯示與計價相關的兩種狀態
        query = query.in("狀態", ["已結案", "已計價結算"]);
      }

      const { data, error } = await query;

      if (error) {
        console.error("【讀取資料失敗】", error);
        throw error;
      }

      setRecords(data || []);
    } catch (err: any) {
      showToast(err.message || "清單載入失敗，請檢查系統連線", "error");
    } finally {
      setIsLoading(false);
    }
  }, [vendorFilter, statusFilter, showToast]);

  // --- 初始化與權限驗證 ---
  useEffect(() => {
    const isAuth = sessionStorage.getItem("asset_link_admin_auth");
    if (isAuth !== "true") { 
      router.push("/"); 
      return; 
    }
    fetchNsrRecords();
  }, [router, fetchNsrRecords]);

  // --- 單筆標記計價 ---
  const handleMarkBilled = async (sn: string) => {
    if (!confirm(`確定要將設備序號 ${sn} 標記為『已計價結算』嗎？`)) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("historical_assets")
        .update({ "狀態": "已計價結算" })
        .eq("產品序號", sn);

      if (error) throw error;
      
      showToast("標記成功，該設備已完成計價", "success");
      await fetchNsrRecords();
    } catch (err: any) {
      console.error("【計價更新失敗】", err);
      showToast(`更新失敗: ${err.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  // --- 批次標記計價 ---
  const handleBatchMarkBilled = async () => {
    const unbilledRecords = records.filter(r => r.狀態 === '已結案');
    if (unbilledRecords.length === 0) {
      showToast("目前畫面上沒有可以結算的『已結案』案件", "info");
      return;
    }

    if (!confirm(`確定要將畫面上篩選出的 ${unbilledRecords.length} 筆案件，批次標記為『已計價結算』嗎？`)) return;

    setIsLoading(true);
    try {
      const sns = unbilledRecords.map(r => r.產品序號);
      const { error } = await supabase
        .from("historical_assets")
        .update({ "狀態": "已計價結算" })
        .in("產品序號", sns);

      if (error) throw error;
      
      showToast(`批次作業完成，共結算 ${sns.length} 筆設備`, "success");
      await fetchNsrRecords();
    } catch (err: any) {
      console.error("【批次計價更新失敗】", err);
      showToast(`批次更新失敗: ${err.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  // --- 登出 ---
  const handleLogout = () => {
    sessionStorage.removeItem("asset_link_admin_auth");
    router.push("/");
  };

  return (
    <div className={`min-h-screen text-slate-800 antialiased flex relative overflow-x-hidden ${styles.medicalGradient}`}>
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      
      {/* 行動裝置選單遮罩 */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-sky-900/20 backdrop-blur-sm z-[45] md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* --- 側邊選單 (對齊總控台風格) --- */}
      <aside className={`w-64 fixed left-0 top-0 h-screen border-r border-white/40 ${styles.clinicalGlass} flex flex-col p-6 z-50 transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
          <div className="flex items-center gap-3 mb-10 px-2">
             <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg">
               <span className={`material-symbols-outlined ${styles.iconFill}`}>hub</span>
             </div>
             <h2 className="text-xl font-black text-sky-900 tracking-tighter uppercase">ALink 總控台</h2>
          </div>
          <nav className="flex-1 space-y-2">
              <button onClick={() => router.push("/admin")} className="w-full text-left p-4 rounded-2xl font-bold text-slate-600 hover:bg-white/60 flex items-center gap-3 transition-all">
                <span className="material-symbols-outlined text-base">dashboard</span> 儀表板首頁
              </button>
              <button onClick={() => router.push("/pending")} className="w-full text-left p-4 rounded-2xl font-bold text-slate-600 hover:bg-white/60 flex items-center gap-3 transition-all">
                <span className="material-symbols-outlined text-base">assignment_turned_in</span> 行政審核
              </button>
              <button className="w-full text-left p-4 rounded-2xl font-bold bg-blue-600 text-white shadow-md flex items-center gap-3 transition-all">
                <span className="material-symbols-outlined text-base">account_balance_wallet</span> 網點計價結算
              </button>
              <button onClick={() => router.push("/internal")} className="w-full text-left p-4 rounded-2xl font-bold text-slate-600 hover:bg-white/60 flex items-center gap-3 transition-all">
                <span className="material-symbols-outlined text-base">bolt</span> 內部直通入庫
              </button>
          </nav>
          <div className="mt-auto pt-6 border-t border-slate-200/50">
            <button onClick={handleLogout} className="w-full flex items-center gap-3 p-4 text-slate-400 font-bold hover:text-red-600 transition-colors">
              <span className="material-symbols-outlined text-base">logout</span> 登出系統
            </button>
          </div>
      </aside>

      {/* --- 主要內容區 --- */}
      <main className="w-full md:ml-64 flex-1 flex flex-col min-h-screen p-4 md:p-8">
        <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4 mt-12 md:mt-0">
          <div>
            <div className="flex items-center gap-3">
              <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-sky-800 p-1 -ml-2">
                <span className="material-symbols-outlined">menu</span>
              </button>
              <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">網點計價與結算管理</h1>
            </div>
            <p className="text-xs md:text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest pl-10 md:pl-0">Network Service Request Settlement</p>
          </div>
          <div className="flex gap-2">
             <button onClick={handleBatchMarkBilled} className="text-[10px] font-black uppercase tracking-widest px-5 py-3 bg-blue-600 text-white rounded-xl shadow-md hover:bg-blue-700 transition-all flex items-center gap-2">
               <span className={`material-symbols-outlined text-sm ${styles.iconFill}`}>fact_check</span> 批次結算
             </button>
             <button onClick={fetchNsrRecords} className="text-[10px] font-black uppercase tracking-widest px-4 py-3 bg-white text-slate-600 border border-slate-200 rounded-xl shadow-sm hover:text-blue-600 hover:border-blue-200 transition-all flex items-center gap-2">
               <span className="material-symbols-outlined text-sm">sync</span> 刷新
             </button>
          </div>
        </header>

        {/* --- 篩選控制列 --- */}
        <div className={`${styles.clinicalGlass} rounded-2xl p-5 mb-8 flex flex-col sm:flex-row gap-4 items-center shadow-sm`}>
           <div className="w-full sm:w-auto flex-1 flex items-center gap-3">
             <span className="material-symbols-outlined text-slate-400">filter_list</span>
             <span className="text-xs font-black tracking-widest text-slate-500 uppercase whitespace-nowrap">進階篩選</span>
           </div>
           <div className="w-full sm:w-auto flex gap-3 flex-col sm:flex-row">
             <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)} className={styles.crystalInput}>
                <option value="ALL">全部合作廠商</option>
                {/* 動態萃取廠商清單 (簡單實作) */}
                {Array.from(new Set(records.map(r => r.同步來源).filter(Boolean))).map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
             </select>
             <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={styles.crystalInput}>
                <option value="ALL">顯示全部狀態</option>
                <option value="已結案">未結算 (已結案)</option>
                <option value="已計價結算">已計價結算</option>
             </select>
           </div>
        </div>

        {/* --- 結算清單 (🚀 物理響應式卡片架構) --- */}
        <div className={`${styles.clinicalGlass} rounded-3xl p-6 md:p-8 shadow-sm flex flex-col min-h-[500px] animate-in slide-in-from-bottom-4`}>
          <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <span className={`material-symbols-outlined text-emerald-500 ${styles.iconFill}`}>account_balance_wallet</span>
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">可計價結案紀錄</h2>
            </div>
            <span className="text-xs font-black text-slate-400 bg-slate-100 px-3 py-1 rounded-full">共 {records.length} 筆</span>
          </div>
          
          {/* 套用 tableContainer 與 responsiveTable 實現無捲軸直向堆疊 */}
          <div className={styles.tableContainer}>
            <table className={`w-full text-left lg:min-w-[1000px] ${styles.responsiveTable}`}>
              <thead className={styles.desktopOnly}>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                  <th className="pb-4 px-4">產品序號 / 結案單號</th>
                  <th className="pb-4 px-4">部署單位 / 裝機日</th>
                  <th className="pb-4 px-4">設備參數 / 核發 IP</th>
                  <th className="pb-4 px-4">廠商 / 計價狀態</th>
                  <th className="pb-4 px-4 text-right">計價操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {records.map((record) => (
                  <tr key={record.產品序號} className={`${styles.mobileCard} hover:bg-slate-50/50 transition-all`}>
                    
                    <td className={`${styles.mobileTd} p-4 align-top`} data-label="產品序號 / 單號">
                      <p className="font-mono text-sm font-black text-slate-600">{record.產品序號}</p>
                      <p className="text-[10px] text-slate-400 mt-1 font-mono">單號: {record.結案單號}</p>
                    </td>

                    <td className={`${styles.mobileTd} p-4 font-bold align-top`} data-label="部署單位 / 裝機日">
                      <p className="text-slate-800">{record.使用單位}</p>
                      <p className="text-[10px] text-slate-400 font-normal uppercase mt-0.5">{record.棟別} | {record.樓層} | {record.裝機日期}</p>
                      <p className="text-[10px] text-slate-500 font-normal mt-0.5">{record.姓名} #{record.分機}</p>
                    </td>

                    <td className={`${styles.mobileTd} p-4 align-top`} data-label="設備參數 / IP狀態">
                      <p className="font-bold text-slate-600">{record.品牌型號} <span className="text-[10px] text-slate-400 font-normal">({record.設備類型})</span></p>
                      <p className="text-[10px] font-mono text-slate-500 uppercase mt-0.5">MAC: <span className="font-black text-blue-600">{record.主要mac}</span></p>
                      {record.核定ip && (
                        <p className="text-[10px] font-bold text-emerald-600 mt-1.5 bg-emerald-50 inline-block px-2 py-0.5 rounded border border-emerald-100">
                          核定 IP: {record.核定ip}
                        </p>
                      )}
                    </td>

                    <td className={`${styles.mobileTd} p-4 align-top`} data-label="廠商 / 計價狀態">
                      <p className="text-xs font-black text-sky-700 bg-sky-50 px-2 py-0.5 rounded inline-block mb-2 border border-sky-100">{record.同步來源}</p>
                      <div>
                        {record.狀態 === '已結案' && <span className="bg-amber-100 text-amber-700 text-[10px] px-3 py-1.5 rounded-full border border-amber-200 font-black uppercase tracking-widest shadow-sm">未計價</span>}
                        {record.狀態 === '已計價結算' && <span className="bg-emerald-100 text-emerald-700 text-[10px] px-3 py-1.5 rounded-full border border-emerald-200 font-black uppercase tracking-widest shadow-sm">已計價結算</span>}
                      </div>
                    </td>

                    <td className={`${styles.mobileTd} p-4 align-top lg:text-right`} data-label="管理操作">
                      <div className={`flex flex-col lg:items-end gap-2 ${styles.mobileActionStack}`}>
                         {record.狀態 === '已結案' && (
                           <button onClick={() => handleMarkBilled(record.產品序號)} className="text-[10px] font-black uppercase tracking-widest px-4 py-2.5 border border-blue-200 text-blue-600 rounded-xl hover:bg-blue-50 hover:border-blue-300 transition-all shadow-sm bg-white flex items-center justify-center lg:justify-end gap-1">
                             <span className={`material-symbols-outlined text-[16px] ${styles.iconFill}`}>price_check</span> 標記已計價
                           </button>
                         )}
                         {record.狀態 === '已計價結算' && (
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-full lg:w-auto py-2">結算作業完成</span>
                         )}
                      </div>
                    </td>

                  </tr>
                ))}
                {records.length === 0 && !isLoading && (
                  <tr><td colSpan={5} className="py-20 text-center text-slate-400 font-bold italic border-none">找不到符合條件的計價紀錄。</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* --- 全局 Loading --- */}
      {isLoading && (
        <div className={styles.loaderOverlay}>
          <div className={styles.spinner}></div>
          <p className="text-blue-600 font-black text-[10px] uppercase mt-6 tracking-[0.5em] animate-pulse">系統資料同步中...</p>
        </div>
      )}

      {/* --- Toast 訊息 --- */}
      <div className="fixed bottom-10 right-8 z-[9000] flex flex-col gap-3">
        {toasts.map(t => (
          <div key={t.id} className={`${styles.toastBase} ${t.type === 'info' ? 'bg-blue-50 text-blue-800 border-blue-200' : ''}`}>
            <span className={`material-symbols-outlined text-sm ${styles.iconFill} ${t.type === 'success' ? 'text-emerald-400' : t.type === 'error' ? 'text-red-400' : 'text-blue-400'}`}>
              {t.type === 'success' ? 'check_circle' : t.type === 'error' ? 'report' : 'info'}
            </span> 
            <span className="tracking-wide">{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}