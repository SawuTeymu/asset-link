"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { markNsrBilled, batchMarkNsrBilled } from "@/lib/actions/assets";
import styles from "./nsr.module.css";

/**
 * ==========================================
 * 檔案：src/app/nsr/page.tsx
 * 狀態：V400.5 NSR 申請與結算雙軌完整版 (NSR 血統強制過濾)
 * 職責：
 * 1. 網點申請錄入：強制為所有單據加上 "NSR-" 序號前綴。
 * 2. 🚀 精準結算限制：從 historical_assets 讀取時，強制使用 .like("產品序號", "NSR-%")，100% 隔絕非網點設備。
 * 3. 雙分頁架構：左側選單可切換「申請錄入」與「計價結算」。
 * 4. 物理響應式：維持手機版卡片直向堆疊跳行顯示。
 * ==========================================
 */

interface NsrRequest {
  type: string;
  location: string;
  sn: string;
  remark: string;
}

export default function NsrPage() {
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<"entry" | "settlement">("entry");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [buildingOptions, setBuildings] = useState<any[]>([]);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" | "info" }[]>([]);

  // --- 申請錄入專用狀態 ---
  const [metadata, setMetadata] = useState({ date: new Date().toISOString().split("T")[0], area: "", floor: "", unit: "", applicantName: "", applicantExt: "" });
  const [requests, setRequests] = useState<NsrRequest[]>([{ type: "新設網點", location: "", sn: "", remark: "" }]);

  // --- 結算專用狀態 ---
  const [records, setRecords] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL"); // 已拔除廠商篩選器

  const showToast = useCallback((msg: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const fetchBuildings = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("buildings").select("*").eq("是否啟用", true).order("排序權重", { ascending: true });
      if (!error && data) {
        setBuildings(data);
        if (data.length > 0 && !metadata.area) setMetadata(prev => ({ ...prev, area: data[0].棟別名稱 }));
      }
    } catch (err) { console.error("棟別同步異常"); }
  }, [metadata.area]);

  // --- 🚀 獲取結案清單 (NSR 血統強制過濾) ---
  const fetchNsrRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      // 🚀 核心邏輯：利用 NSR- 前綴，精準且嚴格地只抓取從「NSR網點申請」頁面送出的資料
      let query = supabase
        .from("historical_assets")
        .select("*")
        .like("產品序號", "NSR-%") // 絕對隔絕非 NSR 單據
        .order("裝機日期", { ascending: false });

      if (statusFilter !== "ALL") {
        query = query.eq("狀態", statusFilter);
      } else {
        query = query.in("狀態", ["已結案", "已計價結算"]);
      }

      const { data, error } = await query;
      if (error) throw error;
      setRecords(data || []);
    } catch (err: any) {
      showToast(err.message || "清單載入失敗", "error");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, showToast]);

  useEffect(() => {
    const isAuth = sessionStorage.getItem("asset_link_admin_auth");
    if (isAuth !== "true") { router.push("/"); return; }
    fetchBuildings();
    if (activeTab === "settlement") fetchNsrRecords();
  }, [router, activeTab, fetchBuildings, fetchNsrRecords]);

  // --- 🚀 NSR 申請送出邏輯 (強制賦予 NSR 血統) ---
  const handleSubmitNsr = async () => {
    if (isLoading) return;
    if (!metadata.area || !metadata.unit || !metadata.applicantName) { 
      showToast("請完整填寫行政基本資料", "error"); 
      return; 
    }

    setIsLoading(true);
    try {
      const formId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `NSR-${Date.now()}`;
      
      const payload = requests.map(r => {
        let finalSn = r.sn.trim().toUpperCase();
        
        // 🚀 強制保證每一筆資料都有 NSR- 前綴
        if (!finalSn) {
          const randomHex = Math.floor(Math.random() * 16777215).toString(16).toUpperCase().padStart(6, '0');
          finalSn = `NSR-${metadata.date.replace(/-/g, '')}-${randomHex}`;
        } else {
          if (!finalSn.startsWith("NSR-")) {
            finalSn = `NSR-${finalSn}`;
          }
        }

        return {
          "案件編號": formId,
          "裝機日期": metadata.date,
          "棟別": metadata.area,
          "樓層": metadata.floor,
          "使用單位": metadata.unit,
          "姓名": metadata.applicantName.trim(),
          "分機": metadata.applicantExt.trim(),
          "設備類型": "網點工程", 
          "品牌型號": r.type,
          "產品序號": finalSn,
          "主要mac": "",
          "無線mac": "",
          "備註": `[${r.location}] ${r.remark}`.trim(),
          "來源廠商": "資訊中心發包",
          "狀態": "待核定"
        };
      });

      const { error } = await supabase.from("資產").insert(payload);
      if (error) throw new Error(error.message);

      setRequests([{ type: "新設網點", location: "", sn: "", remark: "" }]);
      showToast("NSR 網點申請已成功錄入，請至待核定區進行後續流程", "success");
    } catch (err: any) {
      console.error("NSR 申請失敗", err);
      showToast(`寫入失敗: ${err.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  // --- 結算標記邏輯 ---
  const handleMarkBilled = async (sn: string) => {
    if (!confirm(`確定要將設備序號 ${sn} 標記為『已計價結算』嗎？`)) return;
    setIsLoading(true);
    try {
      await markNsrBilled(sn);
      showToast("標記成功，該工程已完成計價", "success");
      await fetchNsrRecords();
    } catch (err: any) {
      showToast(err.message || "更新失敗", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBatchMarkBilled = async () => {
    const unbilledRecords = records.filter(r => r.狀態 === '已結案');
    if (unbilledRecords.length === 0) {
      showToast("目前畫面上沒有可以結算的案件", "info");
      return;
    }
    if (!confirm(`確定要批次標記 ${unbilledRecords.length} 筆為『已計價結算』嗎？`)) return;

    setIsLoading(true);
    try {
      const sns = unbilledRecords.map(r => r.產品序號);
      await batchMarkNsrBilled(sns);
      showToast(`批次作業完成，共結算 ${sns.length} 筆工程`, "success");
      await fetchNsrRecords();
    } catch (err: any) {
      showToast(err.message || "批次更新失敗", "error");
    } finally {
      setIsLoading(false);
    }
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

      <aside className={`w-64 fixed left-0 top-0 h-screen border-r border-white/40 ${styles.clinicalGlass} flex flex-col p-6 z-50 transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
          <div className="flex items-center gap-3 mb-10 px-2">
             <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg">
               <span className={`material-symbols-outlined ${styles.iconFill}`}>hub</span>
             </div>
             <h2 className="text-xl font-black text-sky-900 tracking-tighter uppercase">ALink 總控台</h2>
          </div>
          <nav className="flex-1 space-y-2">
              <button onClick={() => router.push("/admin")} className="w-full text-left p-4 rounded-2xl font-bold text-slate-600 hover:bg-white/60 flex items-center gap-3 transition-all"><span className="material-symbols-outlined text-base">dashboard</span> 儀表板首頁</button>
              <button onClick={() => router.push("/pending")} className="w-full text-left p-4 rounded-2xl font-bold text-slate-600 hover:bg-white/60 flex items-center gap-3 transition-all"><span className="material-symbols-outlined text-base">assignment_turned_in</span> 行政審核</button>
              
              <div className="my-4 border-t border-slate-200/50"></div>
              <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">NSR 作業模組</p>
              
              <button onClick={() => { setActiveTab("entry"); setIsMobileMenuOpen(false); }} className={`w-full text-left p-4 rounded-2xl font-bold transition-all flex items-center gap-3 ${activeTab === 'entry' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-white/60'}`}>
                <span className={`material-symbols-outlined text-sm ${activeTab === 'entry' ? styles.iconFill : ''}`}>edit_document</span> NSR 網點申請
              </button>
              <button onClick={() => { setActiveTab("settlement"); setIsMobileMenuOpen(false); }} className={`w-full text-left p-4 rounded-2xl font-bold transition-all flex items-center gap-3 ${activeTab === 'settlement' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-white/60'}`}>
                <span className={`material-symbols-outlined text-sm ${activeTab === 'settlement' ? styles.iconFill : ''}`}>account_balance_wallet</span> 計價結算管理
              </button>
              
              <div className="my-4 border-t border-slate-200/50"></div>
              
              <button onClick={() => router.push("/internal")} className="w-full text-left p-4 rounded-2xl font-bold text-slate-600 hover:bg-white/60 flex items-center gap-3 transition-all"><span className="material-symbols-outlined text-base">bolt</span> 內部直通入庫</button>
          </nav>
          <div className="mt-auto pt-6 border-t border-slate-200/50">
            <button onClick={handleLogout} className="w-full flex items-center gap-3 p-4 text-slate-400 font-bold hover:text-red-600 transition-colors"><span className="material-symbols-outlined text-base">logout</span> 登出系統</button>
          </div>
      </aside>

      <main className="w-full md:ml-64 flex-1 flex flex-col min-h-screen p-4 md:p-8">
        
        {/* =========================================
            🚀 分頁 1：NSR 網點申請錄入
            ========================================= */}
        {activeTab === 'entry' && (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <header className="mb-10 mt-12 md:mt-0">
              <div className="flex items-center gap-3">
                <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-sky-800 p-1 -ml-2"><span className="material-symbols-outlined">menu</span></button>
                <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">NSR 網點申請錄入</h1>
              </div>
              <p className="text-xs md:text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest pl-10 md:pl-0">Network Service Request Form</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <section className="col-span-1 lg:col-span-4">
                <div className={`${styles.clinicalGlass} rounded-3xl p-6 md:p-8 shadow-sm`}>
                  <div className="flex items-center gap-2 mb-8 border-b border-slate-100 pb-4"><span className={`material-symbols-outlined text-blue-600 ${styles.iconFill}`}>info</span><h2 className="text-lg font-bold text-slate-800 tracking-tight">行政基本資料</h2></div>
                  <div className="space-y-5">
                     <div><label className={styles.inputLabel}>申請日期</label><input type="date" value={metadata.date} onChange={e => setMetadata({...metadata, date: e.target.value})} className={styles.crystalInput} /></div>
                     <div className="grid grid-cols-2 gap-4">
                       <div><label className={styles.inputLabel}>所屬棟別</label><select value={metadata.area} onChange={e => setMetadata({...metadata, area: e.target.value})} className={styles.crystalInput}>{buildingOptions.map(v => <option key={v.棟別代碼} value={v.棟別名稱}>{v.棟別名稱}</option>)}</select></div>
                       <div><label className={styles.inputLabel}>樓層</label><input type="text" value={metadata.floor} onChange={e => setMetadata({...metadata, floor: e.target.value.toUpperCase()})} placeholder="如: 05F" className={styles.crystalInput} /></div>
                     </div>
                     <div><label className={styles.inputLabel}>申請單位</label><input type="text" value={metadata.unit} onChange={e => setMetadata({...metadata, unit: e.target.value})} placeholder="如: 資訊組" className={styles.crystalInput} /></div>
                     <div className="grid grid-cols-2 gap-4">
                       <div><label className={styles.inputLabel}>聯絡人姓名</label><input type="text" value={metadata.applicantName} onChange={e => setMetadata({...metadata, applicantName: e.target.value})} placeholder="如: 王小明" className={styles.crystalInput} /></div>
                       <div><label className={styles.inputLabel}>分機號碼</label><input type="text" value={metadata.applicantExt} onChange={e => setMetadata({...metadata, applicantExt: e.target.value})} placeholder="如: 1234" className={styles.crystalInput} /></div>
                     </div>
                  </div>
                </div>
              </section>

              <section className="col-span-1 lg:col-span-8 flex flex-col">
                 <div className={`${styles.clinicalGlass} rounded-3xl p-6 md:p-8 shadow-sm flex flex-col flex-1`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-slate-100 pb-4">
                       <div className="flex items-center gap-2"><span className={`material-symbols-outlined text-emerald-600 ${styles.iconFill}`}>lan</span><h2 className="text-lg font-bold text-slate-800 tracking-tight">網點工程需求</h2></div>
                       <button onClick={() => setRequests([...requests, { type: "新設網點", location: "", sn: "", remark: "" }])} className="text-blue-600 font-black text-[10px] uppercase tracking-[0.2em] bg-blue-50 px-5 py-2.5 rounded-xl hover:bg-blue-100 transition-all border border-blue-100 shadow-sm">+ 新增工程項目</button>
                    </div>
                    
                    <div className="flex flex-col gap-5 w-full">
                      {requests.map((r, i) => (
                        <div key={i} className={styles.deviceItemBlock}>
                          <div className={styles.rowGrid}>
                            <div><label className={styles.inputLabel}>工程類別</label><select value={r.type} onChange={e => { const nr = [...requests]; nr[i].type = e.target.value; setRequests(nr); }} className={styles.crystalInput}><option>新設網點</option><option>資訊座移機</option><option>線路查修</option><option>Switch佈建</option><option>其他工程</option></select></div>
                            <div className="col-span-1 sm:col-span-2"><label className={styles.inputLabel}>詳細位置 / 房號</label><input placeholder="如: 712 辦公室左側牆面" value={r.location} onChange={e => { const nr = [...requests]; nr[i].location = e.target.value; setRequests(nr); }} className={styles.crystalInput} /></div>
                          </div>
                          <div className={styles.rowGrid}>
                            <div><label className={styles.inputLabel}>NSR 申請單號 (留空自動產生)</label><input placeholder="NSR-" value={r.sn} onChange={e => { const nr = [...requests]; nr[i].sn = e.target.value.toUpperCase(); setRequests(nr); }} className={`${styles.crystalInput} font-mono text-red-600`} /></div>
                            <div className="col-span-1 sm:col-span-2"><label className={styles.inputLabel}>需求備註</label><input placeholder="請簡述施工需求..." value={r.remark} onChange={e => { const nr = [...requests]; nr[i].remark = e.target.value; setRequests(nr); }} className={styles.crystalInput} /></div>
                          </div>
                          {requests.length > 1 && <button onClick={() => setRequests(requests.filter((_, idx) => idx !== i))} className={styles.removeBtn}><span className="material-symbols-outlined text-[14px]">close</span></button>}
                        </div>
                      ))}
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-100">
                       <button onClick={handleSubmitNsr} disabled={isLoading} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-[0.3em] text-sm shadow-xl shadow-blue-900/20 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3">
                         {isLoading ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div><span>處理中...</span></> : <span>送出網點申請</span>}
                       </button>
                    </div>
                 </div>
              </section>
            </div>
          </div>
        )}


        {/* =========================================
            🚀 分頁 2：網點計價結算 (無廠商篩選器、100% NSR 血統隔離)
            ========================================= */}
        {activeTab === 'settlement' && (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4 mt-12 md:mt-0">
              <div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-sky-800 p-1 -ml-2"><span className="material-symbols-outlined">menu</span></button>
                  <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">網點計價結算管理</h1>
                </div>
                <p className="text-xs md:text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest pl-10 md:pl-0">Network Settlement Console</p>
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

            <div className={`${styles.clinicalGlass} rounded-2xl p-5 mb-8 flex flex-col sm:flex-row gap-4 items-center shadow-sm`}>
               <div className="w-full sm:w-auto flex-1 flex items-center gap-3">
                 <span className="material-symbols-outlined text-slate-400">filter_list</span>
                 <span className="text-xs font-black tracking-widest text-slate-500 uppercase whitespace-nowrap">狀態篩選</span>
               </div>
               {/* 🚀 已移除不必要的「廠商篩選器」，因為單據全部來自資訊中心發包的 NSR 單 */}
               <div className="w-full sm:w-auto flex gap-3 flex-col sm:flex-row">
                 <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={styles.crystalInput}>
                    <option value="ALL">顯示全部狀態</option>
                    <option value="已結案">未結算 (已結案)</option>
                    <option value="已計價結算">已計價結算</option>
                 </select>
               </div>
            </div>

            <div className={`${styles.clinicalGlass} rounded-3xl p-6 md:p-8 shadow-sm flex flex-col min-h-[500px]`}>
              <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <span className={`material-symbols-outlined text-emerald-500 ${styles.iconFill}`}>account_balance_wallet</span>
                  <h2 className="text-lg font-bold text-slate-800 tracking-tight">專屬 NSR 可計價紀錄</h2>
                </div>
                <span className="text-xs font-black text-slate-400 bg-slate-100 px-3 py-1 rounded-full">共 {records.length} 筆</span>
              </div>
              
              <div className={styles.tableContainer}>
                <table className={`w-full text-left lg:min-w-[1000px] ${styles.responsiveTable}`}>
                  <thead className={styles.desktopOnly}>
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                      <th className="pb-4 px-4">產品序號 / 結案單號</th>
                      <th className="pb-4 px-4">部署單位 / 裝機日</th>
                      <th className="pb-4 px-4">設備參數 / 核發 IP</th>
                      <th className="pb-4 px-4">來源 / 計價狀態</th>
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
                        <td className={`${styles.mobileTd} p-4 align-top`} data-label="工程明細 / 位置">
                          <p className="font-bold text-slate-600">{record.品牌型號} <span className="text-[10px] text-slate-400 font-normal">({record.設備類型})</span></p>
                          <p className="text-[10px] text-slate-500 mt-1 bg-slate-50 p-2 rounded border border-slate-100">{record.行政備註 || record.備註 || "無詳細備註"}</p>
                        </td>
                        <td className={`${styles.mobileTd} p-4 align-top`} data-label="來源 / 計價狀態">
                          <p className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded inline-block mb-2 border border-emerald-100">NSR 系統單</p>
                          <div>
                            {record.狀態 === '已結案' && <span className="bg-amber-100 text-amber-700 text-[10px] px-3 py-1.5 rounded-full border border-amber-200 font-black uppercase tracking-widest shadow-sm">未計價</span>}
                            {record.狀態 === '已計價結算' && <span className="bg-emerald-100 text-emerald-700 text-[10px] px-3 py-1.5 rounded-full border border-emerald-200 font-black uppercase tracking-widest shadow-sm">已計價結算</span>}
                          </div>
                        </td>
                        <td className={`${styles.mobileTd} p-4 align-top lg:text-right`} data-label="管理操作">
                          <div className={`flex flex-col lg:items-end gap-2 ${styles.mobileActionStack}`}>
                             {record.狀態 === '已結案' && <button onClick={() => handleMarkBilled(record.產品序號)} className="text-[10px] font-black uppercase tracking-widest px-4 py-2.5 border border-blue-200 text-blue-600 rounded-xl hover:bg-blue-50 hover:border-blue-300 transition-all shadow-sm bg-white flex items-center justify-center lg:justify-end gap-1"><span className={`material-symbols-outlined text-[16px] ${styles.iconFill}`}>price_check</span> 標記已計價</button>}
                             {record.狀態 === '已計價結算' && <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-full lg:w-auto py-2">結算作業完成</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {records.length === 0 && !isLoading && <tr><td colSpan={5} className="py-20 text-center text-slate-400 font-bold italic border-none">找不到符合條件的計價紀錄。</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {isLoading && <div className={styles.loaderOverlay}><div className={styles.spinner}></div><p className="text-blue-600 font-black text-[10px] uppercase mt-6 tracking-[0.5em] animate-pulse">系統資料同步中...</p></div>}
      <div className="fixed bottom-10 right-8 z-[9000] flex flex-col gap-3">{toasts.map(t => <div key={t.id} className={`${styles.toastBase} ${t.type === 'info' ? 'bg-blue-50 text-blue-800 border-blue-200' : ''}`}><span className={`material-symbols-outlined text-sm ${styles.iconFill} ${t.type === 'success' ? 'text-emerald-400' : t.type === 'error' ? 'text-red-400' : 'text-blue-400'}`}>{t.type === 'success' ? 'check_circle' : t.type === 'error' ? 'report' : 'info'}</span><span className="tracking-wide">{t.msg}</span></div>)}</div>
    </div>
  );
}