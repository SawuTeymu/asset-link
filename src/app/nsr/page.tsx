"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  getNsrList, 
  submitNsrData, 
  settleNsrRecord,
  updateNsrStatus,
  deleteNsrRecord
} from "@/lib/actions/nsr";
import { formatFloor } from "@/lib/logic/formatters";
import { calculateNsrPrice } from "@/lib/logic/pricing";

// 🚀 物理導入同目錄樣式模組
import styles from "./nsr.module.css";

/**
 * ==========================================
 * 檔案：src/app/nsr/page.tsx
 * 狀態：V300.5 CSS Modules (樣式物理脫離版)
 * 修復項目：
 * 1. 樣式脫離：移除所有內聯標籤與 <style>，改由 styles 物件呼叫。
 * 2. 邏輯保全：115年度計價、C01自動對沖、全量簽核邏輯 0 簡化。
 * 3. 響應式：完整保留手機模式開關與漢堡選單。
 * ==========================================
 */

interface NsrRecord {
  id: string; date: string; area: string; floor: string; unit: string; user: string; ext: string; points: number; type: string; desc: string; total: number; status: string;
}

export default function NsrAdminPage() {
  const router = useRouter();
  
  // --- 1. 核心狀態與手機模式矩陣 ---
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [globalNsrData, setGlobalNsrData] = useState<NsrRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loaderText, setLoaderText] = useState("對沖中...");
  const [formData, setFormData] = useState({ id: "", date: "", area: "A 區", floor: "", unit: "", userWithExt: "", points: 1, type: "CAT 6", reason: "" });
  const [settleItem, setSettleItem] = useState<NsrRecord | null>(null);
  const [isAddonWork, setIsAddonWork] = useState(false);
  const [usePanel, setUsePanel] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" | "info" }[]>([]);

  const showToast = useCallback((msg: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getNsrList();
      const mapped = (data || []).map((r: any) => ({
        id: r.申請單號, date: r.申請日期, area: r.棟別, floor: r.樓層, unit: r.申請單位, user: r.申請人, ext: r.連絡電話, points: r.需求數量, type: r.線材規格, desc: r.施工事由, total: r.行政核銷總額, status: r.處理狀態
      }));
      setGlobalNsrData(mapped as NsrRecord[]);
    } catch { showToast("數據同步失敗", "error"); }
    finally { setIsLoading(false); }
  }, [showToast]);

  useEffect(() => {
    if (sessionStorage.getItem("asset_link_admin_auth") !== "true") { router.push("/"); return; }
    refreshData();
  }, [router, refreshData]);

  // --- 2. 業務邏輯對沖 (0 刪除) ---
  const handleIdInput = (val: string) => {
    const id = val.toUpperCase();
    setFormData(prev => ({ ...prev, id }));
    if (id.startsWith("C01") && id.length === 15) {
      setFormData(prev => ({ ...prev, date: `${id.substring(3, 7)}-${id.substring(7, 9)}-${id.substring(9, 11)}` }));
      showToast("單號對沖成功", "success");
    }
  };

  const handleNsrSubmit = async () => {
    if (!formData.id || !formData.unit || !formData.userWithExt) return showToast("欄位殘缺", "error");
    setIsLoading(true);
    const [user, ext] = formData.userWithExt.split("#");
    try {
      await submitNsrData({
        form_id: formData.id, request_date: formData.date, area: formData.area, floor: formatFloor(formData.floor), dept_code: "N/A", unit: formData.unit, applicant: user, phone: ext || "", qty: formData.points, cable_type: formData.type, reason: formData.reason
      });
      showToast("錄入成功", "success");
      setFormData({ id: "", date: "", area: "A 區", floor: "", unit: "", userWithExt: "", points: 1, type: "CAT 6", reason: "" });
      refreshData();
    } catch { showToast("寫入失敗", "error"); }
    finally { setIsLoading(false); }
  };

  const handleSettleCommit = async () => {
    if (!settleItem) return;
    setIsLoading(true);
    try {
      await settleNsrRecord({ form_id: settleItem.id, isAddon: isAddonWork, usePanel: usePanel, finishRemark: `核銷：${isAddonWork ? "加成 " : ""}${usePanel ? "+面板" : ""}` });
      setSettleItem(null); refreshData();
      showToast("行政結算入庫成功", "success");
    } catch { showToast("結算失敗", "error"); }
    finally { setIsLoading(false); }
  };

  const pendingPool = globalNsrData.filter(r => ["未處理", "待處理", "已派工"].includes(r.status));
  const settlePool = globalNsrData.filter(r => r.status === "已完工");
  const totalAmount = globalNsrData.reduce((acc, curr) => acc + (curr.total || 0), 0);

  return (
    <div className={styles.medicalGradient}>
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />

      {/* 🚀 手機版側邊欄遮罩 */}
      {isMobileMenuOpen && <div className="fixed inset-0 bg-sky-900/20 backdrop-blur-sm z-[45] md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>}

      <aside className={`w-64 fixed left-0 top-0 h-screen border-r border-white/40 ${styles.clinicalGlass} flex flex-col p-6 z-50 transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-2xl font-black text-sky-900 tracking-tighter">ALink NSR</h2>
            <button className="md:hidden text-slate-500" onClick={() => setIsMobileMenuOpen(false)}><span className="material-symbols-outlined">close</span></button>
          </div>
          <nav className="flex-1 space-y-2 font-bold">
              <button onClick={() => router.push("/admin")} className="w-full text-left p-3 hover:bg-white/50 rounded-xl transition-all">首頁儀表板</button>
              <button className="w-full text-left p-3 bg-blue-600 text-white rounded-xl shadow-lg">施工結算池</button>
              <button onClick={() => router.push("/pending")} className="w-full text-left p-3 hover:bg-white/50 rounded-xl transition-all">待核定矩陣</button>
          </nav>
          <button onClick={() => router.push("/")} className="mt-auto flex items-center gap-2 p-3 text-red-600 font-bold hover:bg-red-50 rounded-xl transition-all">
            <span className="material-symbols-outlined text-sm">logout</span> 登出中樞
          </button>
      </aside>

      <main className="w-full md:ml-64 flex-1 flex flex-col min-h-screen">
        <header className="px-6 py-4 bg-white/60 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between">
           <div className="flex items-center gap-4">
             <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-sky-800"><span className="material-symbols-outlined">menu</span></button>
             <h1 className="text-xl font-bold text-sky-800">建設與對沖中樞</h1>
           </div>
           <div className="hidden sm:flex items-center gap-3 bg-blue-50 px-4 py-1.5 rounded-full border border-blue-100">
              <span className={`material-symbols-outlined text-blue-600 text-sm ${styles.iconFill}`}>monitor_heart</span>
              <span className="text-xs font-bold text-blue-700 uppercase tracking-widest">System Health: 99.8%</span>
           </div>
        </header>

        <div className="p-4 md:p-8 grid grid-cols-1 xl:grid-cols-12 gap-6">
          
          {/* A. 需求錄入 (物理分離樣式呼叫) */}
          <section className={`col-span-1 xl:col-span-4 ${styles.clinicalGlass} ${styles.innerGlow} rounded-3xl p-8 shadow-xl animate-in fade-in slide-in-from-left-4`}>
             <div className="flex items-center gap-2 mb-8 border-b border-slate-100 pb-4 text-blue-700">
                <span className={`material-symbols-outlined ${styles.iconFill}`}>edit_note</span>
                <h2 className="text-lg font-black uppercase tracking-widest">Requirement Entry</h2>
             </div>
             <div className="space-y-5">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block" htmlFor="v300-id">申請單號 (C01)</label>
                  <input id="v300-id" title="單號" value={formData.id} onChange={e => handleIdInput(e.target.value)} placeholder="C01..." className="w-full p-4 rounded-xl border border-slate-200 bg-white/50 focus:ring-2 focus:ring-blue-500 outline-none font-mono font-bold text-blue-600" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest" htmlFor="v300-area">區域</label>
                     <select id="v300-area" title="區域" value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 bg-white/50 focus:ring-2 focus:ring-blue-500 outline-none font-bold">
                       {["A 區","B 區","C 區","兒醫","本院"].map(v => <option key={v} value={v}>{v}</option>)}
                     </select>
                   </div>
                   <div className="space-y-1">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest" htmlFor="v300-floor">樓層</label>
                     <input id="v300-floor" title="樓層" placeholder="4F" value={formData.floor} onChange={e => setFormData({...formData, floor: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 bg-white/50 focus:ring-2 focus:ring-blue-500 outline-none" />
                   </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block" htmlFor="v300-unit">申請單位</label>
                  <input id="v300-unit" title="單位" placeholder="單位名稱" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full p-4 rounded-xl border border-slate-200 bg-white/50 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block" htmlFor="v300-user">申請人</label>
                  <input id="v300-user" title="申請人" placeholder="姓名#分機" value={formData.userWithExt} onChange={e => setFormData({...formData, userWithExt: e.target.value})} className="w-full p-4 rounded-xl border border-slate-200 bg-white/50 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700" />
                </div>
                <button onClick={handleNsrSubmit} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.3em] hover:bg-blue-700 mt-4 shadow-xl shadow-blue-900/20 active:scale-95 transition-all">Execute Matrix Entry</button>
             </div>
          </section>

          {/* B. 監控池與結算 (物理分離樣式呼叫) */}
          <section className="col-span-1 xl:col-span-8 flex flex-col gap-6 animate-in fade-in slide-in-from-right-4">
             
             <div className={`${styles.clinicalGlass} rounded-3xl p-6 shadow-sm flex flex-col flex-1 min-h-[400px]`}>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-black text-sky-900 uppercase tracking-widest flex items-center gap-2">
                    <span className={`material-symbols-outlined text-blue-600 ${styles.iconFill}`}>vitals</span> Construction Pool ({pendingPool.length})
                  </h3>
                  <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-3 py-1 rounded-full border border-blue-100">REALTIME SYNC</span>
                </div>
                
                <div className={styles.tableContainer}>
                  <table className={`w-full ${styles.zebraGlass} min-w-[600px]`}>
                     <thead>
                       <tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                         <th className="p-4">Case ID</th>
                         <th className="p-4">Location / Unit</th>
                         <th className="p-4">Status</th>
                         <th className="p-4 text-right">Actions</th>
                       </tr>
                     </thead>
                     <tbody className="text-sm font-bold text-slate-700">
                       {pendingPool.map(item => (
                         <tr key={item.id} className="hover:bg-white/40 transition-colors">
                           <td className="p-4 font-mono text-blue-600">{item.id}</td>
                           <td className="p-4">
                              <p className="leading-tight">{item.unit}</p>
                              <p className="text-[10px] text-slate-400 mt-1 uppercase">{item.area} | {item.floor}F | {item.points} PTS</p>
                           </td>
                           <td className="p-4"><span className="text-[9px] font-black bg-blue-100 text-blue-700 px-2 py-1 rounded uppercase">{item.status}</span></td>
                           <td className="p-4 text-right flex justify-end gap-2">
                             <button onClick={() => updateNsrStatus(item.id, "已完工").then(refreshData)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm" title="完工結案"><span className="material-symbols-outlined text-sm">check_circle</span></button>
                             <button onClick={() => deleteNsrRecord(item.id).then(refreshData)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all shadow-sm" title="物理刪除"><span className="material-symbols-outlined text-sm">delete</span></button>
                           </td>
                         </tr>
                       ))}
                       {pendingPool.length === 0 && (
                         <tr><td colSpan={4} className="py-20 text-center text-slate-300 font-bold italic">施工監控池已排空</td></tr>
                       )}
                     </tbody>
                  </table>
                </div>
             </div>

             {/* C. NSR 財務對沖 */}
             <div className={`${styles.clinicalGlass} rounded-3xl p-8 shadow-lg bg-white/60 border-t-4 border-t-emerald-500`}>
                <div className="flex justify-between items-baseline mb-6">
                   <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm">115年度財務對沖庫 ({settlePool.length})</h3>
                   <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">已核銷總額</p>
                      <p className="text-3xl font-black text-blue-700 tracking-tighter">${totalAmount.toLocaleString()}</p>
                   </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {settlePool.map(item => (
                     <div key={item.id} onClick={() => setSettleItem(item)} className="flex justify-between items-center p-5 bg-white rounded-2xl border border-slate-100 hover:border-emerald-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer transition-all">
                        <div className="overflow-hidden pr-2">
                           <p className="text-base font-black text-slate-800 truncate">{item.unit}</p>
                           <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase mt-1">{item.id} | {item.type}</p>
                        </div>
                        <button className="text-[10px] bg-emerald-600 text-white px-4 py-2 rounded-xl font-black uppercase shadow-lg shadow-emerald-900/20 flex-shrink-0">算帳</button>
                     </div>
                   ))}
                 </div>
                 {settlePool.length === 0 && <p className="py-10 text-center text-slate-300 font-bold italic">目前無待核銷案件</p>}
             </div>
          </section>
        </div>

        {/* 🚀 SVG 物理對正 */}
        <div className="mt-auto px-8 pb-8">
          <div className={`h-24 w-full rounded-3xl overflow-hidden relative border border-white/40 ${styles.clinicalGlass}`}>
            <svg className="absolute bottom-0 right-0 w-2/3 h-full" preserveAspectRatio="none" viewBox="0 0 400 100">
              <path className={styles.vitalLine} d="M0,80 L40,80 L50,20 L60,80 L100,80 L110,95 L120,80 L200,80 L215,10 L230,80 L300,80 L310,60 L320,80 L400,80" />
            </svg>
          </div>
        </div>
      </main>

      {/* D. 結算對沖 Modal (樣式對正) */}
      {settleItem && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-6 bg-slate-900/40 backdrop-blur-md animate-in fade-in">
          <div className={`${styles.clinicalGlass} p-8 md:p-12 rounded-[3rem] w-full max-w-lg shadow-2xl animate-in zoom-in-95 bg-white border-2 border-white`}>
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-inner">
               <span className={`material-symbols-outlined text-3xl ${styles.iconFill}`}>account_balance_wallet</span>
            </div>
            <h4 className="text-2xl font-black text-slate-800 mb-2 text-center tracking-tighter">115年度合約計價結算</h4>
            <p className="text-sm font-bold text-slate-500 text-center mb-10 font-mono uppercase tracking-widest">{settleItem.id}</p>
            
            <div className="space-y-4 bg-slate-50/80 p-6 rounded-[2rem] border border-slate-100 mb-8">
                <label className="flex items-center justify-between p-2 cursor-pointer group">
                   <span className="text-sm font-bold text-slate-600 group-hover:text-blue-700 transition-colors">符合加成施工條件 (夜間/困難)</span>
                   <input type="checkbox" checked={isAddonWork} onChange={e => setIsAddonWork(e.target.checked)} className="w-6 h-6 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500" />
                </label>
                <label className="flex items-center justify-between p-2 cursor-pointer group">
                   <span className="text-sm font-bold text-slate-600 group-hover:text-blue-700 transition-colors">加購 24 埠 PANEL 空架 (+$1,000)</span>
                   <input type="checkbox" checked={usePanel} onChange={e => setUsePanel(e.target.checked)} className="w-6 h-6 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500" />
                </label>
                <div className="pt-6 border-t border-slate-200 text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-2">核銷結算金額 (TWD)</p>
                    {/* 🚀 Fix TS2345: 引數順序對正 (spec, points, ...) */}
                    <p className="text-5xl font-black text-blue-700 tracking-tighter">
                       <span className="text-xl mr-1 font-mono text-slate-400">$</span>
                       {calculateNsrPrice(settleItem.type, settleItem.points, isAddonWork, usePanel).toLocaleString()}
                    </p>
                </div>
            </div>

            <div className="flex gap-4 font-black">
              <button onClick={() => setSettleItem(null)} className="flex-1 py-4 bg-white border border-slate-200 rounded-2xl text-xs uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all">Cancel</button>
              <button onClick={handleSettleCommit} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-blue-900/20 hover:bg-blue-500 active:scale-95 transition-all">Confirm & Settle</button>
            </div>
          </div>
        </div>
      )}

      {/* E. 全域強同步遮罩 */}
      {(isLoading) && (
        <div className="fixed inset-0 z-[6000] flex flex-col items-center justify-center bg-white/60 backdrop-blur-md animate-in fade-in">
          <div className="w-16 h-16 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-6"></div>
          <p className="text-blue-600 font-black tracking-[0.5em] uppercase text-[10px] animate-pulse">{loaderText}</p>
        </div>
      )}

      {/* F. 通知氣泡系統 */}
      <div className="fixed bottom-10 right-8 z-[7000] flex flex-col gap-3">
        {toasts.map(t => (
          <div key={t.id} className={`px-6 py-4 rounded-2xl shadow-2xl font-bold text-xs animate-in slide-in-from-right-4 flex items-center gap-4 border ${t.type === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"} backdrop-blur-xl`}>
            <span className={`material-symbols-outlined text-lg ${styles.iconFill}`}>{t.type === 'success' ? 'check_circle' : 'error'}</span>
            <span className="tracking-wide uppercase">{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}