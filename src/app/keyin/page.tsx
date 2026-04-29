"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// 🚀 物理導入同目錄樣式模組 (確保絕對 0 內聯樣式)
import styles from "./keyin.module.css";

/**
 * ==========================================
 * 檔案：src/app/keyin/page.tsx
 * 狀態：V300.9 Medical M3 (全功能對沖 + 零內聯樣式純淨版)
 * 物理職責：
 * 1. 真實 Supabase 寫入與申請進度追蹤面板。
 * 2. 絕對樣式脫離：拔除所有 <style> 標籤與 Tailwind CDN，確保生產環境 0 報警。
 * 3. 邏輯 0 簡化：MAC 自動格式化、防呆檢查、動態設備陣列全數保留。
 * ==========================================
 */

export default function KeyinPage() {
  const router = useRouter();

  // --- 1. 核心狀態矩陣 ---
  const [activeTab, setActiveTab] = useState<"entry" | "progress">("entry");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [vendorName, setVendorName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // 錄入表單狀態
  const [metadata, setMetadata] = useState({ date: new Date().toISOString().split("T")[0], area: "總院區", floor: "", unit: "", applicant: "" });
  const [devices, setDevices] = useState([{ type: "桌上型電腦", model: "", sn: "", mac: "", ip: "", name: "" }]);
  
  // 申請進度狀態
  const [pendingRecords, setPendingRecords] = useState<any[]>([]);
  
  // 物理通知氣泡
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" | "info" }[]>([]);

  const showToast = useCallback((msg: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // --- 2. 生命週期與數據同步 ---
  const fetchPendingRecords = useCallback(async (vName: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("assets_pending")
        .select("*")
        .eq("廠商名稱", vName)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setPendingRecords(data || []);
    } catch (err) {
      showToast("進度數據同步失敗", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const v = sessionStorage.getItem("asset_link_vendor");
    if (!v) { router.push("/"); return; }
    setVendorName(v);
    if (activeTab === "progress") fetchPendingRecords(v);
  }, [router, activeTab, fetchPendingRecords]);

  // --- 3. 核心業務邏輯 ---
  const handleMacInput = (index: number, val: string) => {
    let mac = val.toUpperCase().replace(/[^A-F0-9]/g, "");
    if (mac.length > 12) mac = mac.substring(0, 12);
    const parts = mac.match(/.{1,2}/g);
    const formattedMac = parts ? parts.join(":") : mac;
    const newDevices = [...devices]; newDevices[index].mac = formattedMac; setDevices(newDevices);
  };

  const handleSubmit = async () => {
    if (!metadata.unit || !metadata.applicant) {
      showToast("請填寫完整的單位與填報人員資訊", "error"); 
      return;
    }
    
    // 檢查是否有空 MAC (印表機等特例除外，此處實作基礎防呆)
    const hasEmptyMac = devices.some(d => !d.mac.trim());
    if (hasEmptyMac) {
       showToast("設備 MAC 位址不可為空", "error");
       return;
    }

    setIsLoading(true);
    try {
      // 🚀 復原真實資料庫對沖邏輯 (寫入 assets_pending)
      const payload = devices.map(d => ({
        "廠商名稱": vendorName,
        "裝機日期": metadata.date,
        "棟別": metadata.area,
        "樓層": metadata.floor,
        "使用單位": metadata.unit,
        "填報人": metadata.applicant,
        "設備類型": d.type,
        "品牌型號": d.model || "未提供",
        "主要mac": d.mac,
        "產品序號": d.sn || "未提供"
      }));

      const { error } = await supabase.from("assets_pending").insert(payload);
      if (error) throw error;

      // 清空表單並提示成功
      setDevices([{ type: "桌上型電腦", model: "", sn: "", mac: "", ip: "", name: "" }]);
      showToast("✅ 預約申請已成功送出，請靜候資訊室核准", "success");
      
      // 自動切換到進度追蹤面板
      setActiveTab("progress");
    } catch (err) {
      showToast("申請錄入失敗，請檢查網路連線", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePending = async (id: string) => {
    if (!confirm("確定要撤回這筆預約申請嗎？")) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.from("assets_pending").delete().eq("id", id);
      if (error) throw error;
      showToast("申請已撤回", "success");
      fetchPendingRecords(vendorName);
    } catch (err) {
      showToast("撤回失敗", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen text-slate-800 font-body-md overflow-x-hidden relative antialiased ${styles.medicalGradient}`}>
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />

      {/* 🚀 手機版側邊欄遮罩 */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-sky-900/20 backdrop-blur-sm z-[45] md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* TopNavBar */}
      <nav className="sticky top-0 w-full flex justify-between items-center px-4 md:px-6 h-16 bg-white/70 backdrop-blur-xl border-b border-white/40 shadow-sm z-40">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-sky-800 p-1">
             <span className="material-symbols-outlined">menu</span>
          </button>
          <span className="text-lg md:text-xl font-bold bg-gradient-to-r from-sky-700 to-sky-500 bg-clip-text text-transparent truncate max-w-[200px] md:max-w-none">Vendor Portal</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden md:inline-block text-xs font-bold text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200">{vendorName}</span>
          <button onClick={() => router.push("/")} className="material-symbols-outlined text-slate-500 hover:text-red-600 transition-colors" title="登出系統">logout</button>
        </div>
      </nav>

      <div className="flex">
        {/* SideNavBar (RWD) */}
        <aside className={`w-64 fixed left-0 top-0 h-screen pt-16 border-r border-white/40 bg-white/80 backdrop-blur-2xl p-6 z-50 transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
          <div className="flex justify-between items-center mb-8">
            <p className="text-lg font-black text-sky-800 tracking-tight">廠商專屬通道</p>
            <button className="md:hidden text-slate-500" onClick={() => setIsMobileMenuOpen(false)}><span className="material-symbols-outlined">close</span></button>
          </div>
          <nav className="space-y-2 font-bold">
             <button 
               onClick={() => { setActiveTab("entry"); setIsMobileMenuOpen(false); }} 
               className={`w-full text-left p-3 rounded-xl transition-all flex items-center gap-2 ${activeTab === 'entry' ? 'bg-sky-100 text-sky-700 border-l-4 border-sky-600 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
             >
               <span className={`material-symbols-outlined text-sm ${activeTab === 'entry' ? styles.iconFill : ''}`}>edit_document</span> 預約錄入
             </button>
             
             {/* 申請進度面板按鈕 */}
             <button 
               onClick={() => { setActiveTab("progress"); setIsMobileMenuOpen(false); }} 
               className={`w-full text-left p-3 rounded-xl transition-all flex items-center gap-2 ${activeTab === 'progress' ? 'bg-sky-100 text-sky-700 border-l-4 border-sky-600 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
             >
               <span className={`material-symbols-outlined text-sm ${activeTab === 'progress' ? styles.iconFill : ''}`}>pending_actions</span> 申請進度追蹤
             </button>
          </nav>
        </aside>

        {/* Main Canvas (RWD) */}
        <main className="w-full md:ml-64 p-4 md:p-8 max-w-[1200px] mx-auto">
          
          <header className="mb-6 md:mb-8 animate-in fade-in slide-in-from-top-4">
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 truncate tracking-tight">{activeTab === 'entry' ? '設備預約錄入' : '送件進度查詢'}</h1>
            <p className="text-xs md:text-sm font-bold text-slate-500 mt-1">
              {activeTab === 'entry' ? '請填寫行政資訊與實體 MAC 參數，提交後將進入資訊室審核池。' : '追蹤您送出的預約單狀態，若填寫錯誤可於審核前撤回。'}
            </p>
          </header>

          {/* 視圖 A：預約錄入表單 */}
          {activeTab === 'entry' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in zoom-in-95 duration-300">
              {/* 行政資訊 */}
              <section className="col-span-1 lg:col-span-4">
                <div className={`${styles.clinicalGlass} rounded-3xl p-6 shadow-sm`}>
                  <div className="flex items-center gap-2 mb-6 border-b border-slate-200/50 pb-3">
                    <span className={`material-symbols-outlined text-blue-600 ${styles.iconFill}`}>info</span>
                    <h2 className="text-lg font-black text-slate-800">行政資訊</h2>
                  </div>
                  <div className="space-y-4">
                     <div><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">裝機日期</label><input type="date" value={metadata.date} onChange={e => setMetadata({...metadata, date: e.target.value})} className={styles.crystalInput} /></div>
                     <div className="grid grid-cols-2 gap-3">
                       <div>
                         <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">院區</label>
                         <select value={metadata.area} onChange={e => setMetadata({...metadata, area: e.target.value})} className={styles.crystalInput}>
                           {["總院區","東院區","南院區","兒醫","本院"].map(v => <option key={v} value={v}>{v}</option>)}
                         </select>
                       </div>
                       <div><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">樓層</label><input type="text" value={metadata.floor} onChange={e => setMetadata({...metadata, floor: e.target.value})} placeholder="如: 12F" className={styles.crystalInput} /></div>
                     </div>
                     <div><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">單位全稱</label><input type="text" value={metadata.unit} onChange={e => setMetadata({...metadata, unit: e.target.value})} placeholder="如: 護理部" className={styles.crystalInput} /></div>
                     <div><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">填報人 (#分機)</label><input type="text" value={metadata.applicant} onChange={e => setMetadata({...metadata, applicant: e.target.value})} placeholder="姓名#1234" className={styles.crystalInput} /></div>
                  </div>
                </div>
              </section>

              {/* 技術參數 Table */}
              <section className="col-span-1 lg:col-span-8 flex flex-col">
                 <div className={`${styles.clinicalGlass} rounded-3xl p-6 shadow-sm flex flex-col flex-1`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-200/50 pb-3">
                       <div className="flex items-center gap-2">
                          <span className={`material-symbols-outlined text-emerald-600 ${styles.iconFill}`}>dns</span>
                          <h2 className="text-lg font-black text-slate-800">設備技術參數</h2>
                       </div>
                       <button onClick={() => setDevices([...devices, { type: "桌上型電腦", model: "", sn: "", mac: "", ip: "", name: "" }])} className="text-blue-600 font-black text-xs uppercase tracking-widest bg-blue-50 px-4 py-2 rounded-xl shadow-sm self-start sm:self-auto hover:bg-blue-100 transition-colors">+ 新增設備點位</button>
                    </div>
                    
                    <div className="overflow-x-auto w-full flex-1">
                      <table className={`w-full text-left min-w-[600px] ${styles.zebraGlass}`}>
                        <thead>
                          <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                            <th className="pb-3 px-3">類型</th>
                            <th className="pb-3 px-3">序號 (大寫)</th>
                            <th className="pb-3 px-3">MAC (自動對沖)</th>
                            <th className="pb-3 px-3 text-right">操作</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/50">
                          {devices.map((d, i) => (
                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-3 px-2">
                                <select value={d.type} onChange={e => { const nd = [...devices]; nd[i].type = e.target.value; setDevices(nd); }} className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm outline-none font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20">
                                  <option>桌上型電腦</option><option>筆記型電腦</option><option>印表機</option><option>醫療儀器</option>
                                </select>
                              </td>
                              <td className="py-3 px-2">
                                <input placeholder="設備 SN" value={d.sn} onChange={e => { const nd = [...devices]; nd[i].sn = e.target.value.toUpperCase(); setDevices(nd); }} className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm font-mono font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:font-sans" />
                              </td>
                              <td className="py-3 px-2">
                                <input placeholder="A1:B2:C3:D4:E5:F6" value={d.mac} onChange={e => handleMacInput(i, e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm font-mono font-bold text-blue-600 outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:font-sans" />
                              </td>
                              <td className="py-3 px-2 text-right">
                                {devices.length > 1 && (
                                  <button onClick={() => setDevices(devices.filter((_, idx) => idx !== i))} className="text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors" title="刪除此列">
                                    <span className="material-symbols-outlined text-sm">delete</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button onClick={handleSubmit} disabled={isLoading} className="mt-6 w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-900/20 hover:bg-blue-500 active:scale-[0.98] transition-all disabled:opacity-50 flex justify-center items-center gap-2">
                      {isLoading ? <span className="material-symbols-outlined animate-spin text-sm">refresh</span> : '🚀 提交預約核准 (Submit)'}
                    </button>
                 </div>
              </section>
            </div>
          )}

          {/* 視圖 B：復原的申請進度面板 */}
          {activeTab === 'progress' && (
             <div className={`${styles.clinicalGlass} rounded-3xl p-6 md:p-8 shadow-sm flex flex-col min-h-[500px] animate-in slide-in-from-right-4 duration-300`}>
                <div className="flex items-center justify-between mb-6 border-b border-slate-200/50 pb-4">
                  <div className="flex items-center gap-2">
                    <span className={`material-symbols-outlined text-amber-500 ${styles.iconFill}`}>hourglass_empty</span>
                    <h2 className="text-lg font-black text-slate-800">審核中案件 ({pendingRecords.length})</h2>
                  </div>
                  <button onClick={() => fetchPendingRecords(vendorName)} className="text-xs font-bold text-slate-500 flex items-center gap-1 hover:text-blue-600 transition-colors">
                    <span className="material-symbols-outlined text-sm">sync</span> 重新整理
                  </button>
                </div>

                <div className="overflow-x-auto w-full flex-1">
                  <table className={`w-full text-left min-w-[700px] ${styles.zebraGlass}`}>
                    <thead>
                      <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                        <th className="pb-4 px-4">申請單號</th>
                        <th className="pb-4 px-4">佈署單位 / 樓層</th>
                        <th className="pb-4 px-4">設備規格</th>
                        <th className="pb-4 px-4">狀態</th>
                        <th className="pb-4 px-4 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/50 text-sm font-bold text-slate-700">
                      {pendingRecords.map((record) => (
                        <tr key={record.id} className="hover:bg-white/40 transition-colors">
                          <td className="p-4 font-mono text-xs text-slate-400">{String(record.id).substring(0, 8).toUpperCase()}</td>
                          <td className="p-4">
                            <p className="text-slate-800">{record.使用單位}</p>
                            <p className="text-[10px] text-slate-500 font-normal">{record.棟別} | {record.樓層} | {record.裝機日期}</p>
                          </td>
                          <td className="p-4">
                            <p>{record.設備類型}</p>
                            <p className="text-xs font-mono text-blue-600">{record.主要mac}</p>
                          </td>
                          <td className="p-4">
                            <span className="bg-amber-100 text-amber-700 text-[10px] px-2.5 py-1 rounded-full border border-amber-200 tracking-widest uppercase">審核中</span>
                          </td>
                          <td className="p-4 text-right">
                            <button onClick={() => handleDeletePending(record.id)} className="text-xs px-3 py-1.5 bg-white border border-slate-200 text-red-500 rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors shadow-sm">
                              撤回
                            </button>
                          </td>
                        </tr>
                      ))}
                      {pendingRecords.length === 0 && !isLoading && (
                        <tr><td colSpan={5} className="py-20 text-center text-slate-400 font-bold italic">目前沒有等待審核的預約案件。</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
             </div>
          )}

        </main>
      </div>

      {/* --- 全域強同步遮罩 --- */}
      {isLoading && (
        <div className="fixed inset-0 z-[6000] flex flex-col items-center justify-center bg-white/60 backdrop-blur-md animate-in fade-in">
          <div className="w-14 h-14 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4 shadow-lg"></div>
          <p className="text-blue-600 font-black tracking-widest text-[10px] uppercase animate-pulse">Syncing Matrix...</p>
        </div>
      )}

      {/* --- 物理通知氣泡 --- */}
      <div className="fixed bottom-6 right-4 md:bottom-10 md:right-8 z-[7000] flex flex-col gap-3">
        {toasts.map(t => (
          <div key={t.id} className={`px-6 py-4 rounded-2xl shadow-2xl font-bold text-xs animate-in slide-in-from-right-4 flex items-center gap-3 border ${t.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : t.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-white text-slate-700 border-slate-200'}`}>
            <span className={`material-symbols-outlined text-lg ${styles.iconFill}`}>{t.type === 'success' ? 'check_circle' : t.type === 'error' ? 'error' : 'info'}</span> 
            <span className="tracking-wide">{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}