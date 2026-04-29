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
 * 狀態：V300.7 CSS Modules (樣式物理脫離 + 錯置修復版)
 * ==========================================
 */

interface NsrRecord {
  id: string; 
  date: string; 
  area: string; 
  floor: string; 
  unit: string; 
  user: string; 
  ext: string; 
  points: number; 
  type: string; 
  desc: string; 
  status: string;
  remark: string;
}

export default function NsrPage() {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loaderText, setLoaderText] = useState("財務數據同步中...");
  const [nsrList, setNsrList] = useState<NsrRecord[]>([]);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" | "info" }[]>([]);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0], area: "總院區", floor: "", unit: "", user: "", ext: "", points: 1, type: "CAT 6", desc: ""
  });

  const [settleModal, setSettleModal] = useState<{
    isOpen: boolean; record: NsrRecord | null; isAddon: boolean; usePanel: boolean; total: number;
  }>({ isOpen: false, record: null, isAddon: false, usePanel: false, total: 0 });

  const showToast = useCallback((msg: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const fetchNsrList = useCallback(async () => {
    const isAuth = sessionStorage.getItem("asset_link_admin_auth");
    if (isAuth !== "true") { router.push("/"); return; }
    
    setIsLoading(true);
    try {
      const data = await getNsrList();
      const formatted = (data || []).map((row: any) => ({
        id: row.id, date: row.申請日期, area: row.棟別, floor: row.樓層, unit: row.申請單位, user: row.申請人, ext: row.連絡電話, points: Number(row.需求數量) || 0, type: row.線材規格, desc: row.施工事由, status: row.處理狀態, remark: row.結算備註 || ""
      }));
      setNsrList(formatted);
    } catch (err) { showToast("NSR 數據庫連線異常", "error"); } 
    finally { setIsLoading(false); }
  }, [router, showToast]);

  useEffect(() => { fetchNsrList(); }, [fetchNsrList]);

  const handleSubmit = async () => {
    if (!formData.unit || !formData.user || !formData.desc) {
      showToast("請完整填寫單位、申請人與施工事由", "error"); return;
    }
    
    setIsLoading(true); setLoaderText("立案對沖中...");
    try {
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const randomId = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      const formId = `C01${dateStr}${randomId}`;

      const payload = {
        form_id: formId, request_date: formData.date, area: formData.area, floor: formatFloor(formData.floor), dept_code: "", unit: formData.unit, applicant: formData.user, phone: formData.ext, qty: formData.points, cable_type: formData.type, reason: formData.desc
      };

      await submitNsrData(payload);
      showToast(`成功建立派工單：${formId}`, "success");
      setFormData(prev => ({ ...prev, unit: "", user: "", ext: "", desc: "", floor: "" }));
      fetchNsrList();
    } catch (err) { showToast("立案失敗", "error"); } 
    finally { setIsLoading(false); }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    setIsLoading(true); setLoaderText("狀態更新中...");
    try {
      await updateNsrStatus(id, newStatus);
      showToast(`單號 ${id} 狀態已更新為：${newStatus}`, "success"); fetchNsrList();
    } catch (err) { showToast("狀態更新失敗", "error"); } 
    finally { setIsLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`確定要物理銷毀單號 ${id} 嗎？此操作不可逆。`)) return;
    setIsLoading(true); setLoaderText("銷毀中...");
    try {
      await deleteNsrRecord(id);
      showToast("申請單已物理抹除", "success"); fetchNsrList();
    } catch (err) { showToast("抹除失敗", "error"); } 
    finally { setIsLoading(false); }
  };

  const openSettleModal = (record: NsrRecord) => {
    const initialPrice = calculateNsrPrice(record.type, record.points, false, false);
    setSettleModal({ isOpen: true, record, isAddon: false, usePanel: false, total: initialPrice });
  };

  useEffect(() => {
    if (settleModal.isOpen && settleModal.record) {
      const newTotal = calculateNsrPrice(settleModal.record.type, settleModal.record.points, settleModal.isAddon, settleModal.usePanel);
      setSettleModal(prev => ({ ...prev, total: newTotal }));
    }
  }, [settleModal.isAddon, settleModal.usePanel, settleModal.record]);

  const handleSettleCommit = async () => {
    if (!settleModal.record) return;
    setIsLoading(true); setLoaderText("財務對沖結算中...");
    try {
      const remark = `[115年度合約對沖] 加成施工:${settleModal.isAddon ? '是' : '否'}, 面板擴充:${settleModal.usePanel ? '是' : '否'}, 核銷總額: NT$ ${settleModal.total.toLocaleString()}`;
      await settleNsrRecord({ form_id: settleModal.record.id, isAddon: settleModal.isAddon, usePanel: settleModal.usePanel, finishRemark: remark });
      showToast("✅ 結算成功，已歸檔為待請款", "success");
      setSettleModal({ isOpen: false, record: null, isAddon: false, usePanel: false, total: 0 });
      fetchNsrList();
    } catch (err) { showToast("結算對沖失敗", "error"); } 
    finally { setIsLoading(false); }
  };

  return (
    <div className={`min-h-screen text-slate-800 font-body-md antialiased flex relative overflow-hidden ${styles.medicalGradient}`}>
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />

      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-sky-900/20 backdrop-blur-sm z-[45] md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      <aside className={`w-64 fixed left-0 top-0 z-50 h-screen border-r border-white/40 bg-white/70 backdrop-blur-2xl flex flex-col py-6 px-4 gap-2 transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
          <div className="flex items-center justify-between mb-8 px-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg"><span className={`material-symbols-outlined ${styles.iconFill}`}>account_balance</span></div>
              <div><h2 className="text-lg font-black text-sky-800 leading-tight">財務中樞</h2><p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-1">NSR Billing Hub</p></div>
            </div>
            <button className="md:hidden text-slate-500" onClick={() => setIsMobileMenuOpen(false)}><span className="material-symbols-outlined">close</span></button>
          </div>

          <button onClick={() => router.push("/keyin")} className="mb-6 w-full py-3 px-4 bg-white border border-slate-200 text-blue-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all active:scale-95 shadow-sm">
            <span className="material-symbols-outlined text-sm">add_circle</span> 切換廠商端錄入
          </button>

          <nav className="flex-1 space-y-2">
              <button onClick={() => router.push("/admin")} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-white/40 rounded-lg font-bold transition-all"><span className="material-symbols-outlined">dashboard</span> 首頁儀表板</button>
              <button onClick={() => router.push("/pending")} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-white/40 rounded-lg font-bold transition-all"><span className="material-symbols-outlined">event_note</span> 行政審核 (ERI)</button>
              <button className="w-full flex items-center gap-3 px-4 py-3 bg-blue-600 text-white rounded-lg shadow-md font-bold"><span className={`material-symbols-outlined ${styles.iconFill}`}>payments</span> 網點財務對沖</button>
              <button onClick={() => router.push("/internal")} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-white/40 rounded-lg font-bold transition-all"><span className="material-symbols-outlined">lan</span> 內部直通對沖</button>
          </nav>
      </aside>

      <main className="w-full md:ml-64 flex-1 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 w-full bg-white/70 backdrop-blur-lg border-b border-slate-200/50 shadow-sm px-4 md:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-sky-800 p-1"><span className="material-symbols-outlined">menu</span></button>
            <h1 className="text-lg md:text-xl font-bold tracking-tight text-sky-800">115年度網點計價引擎</h1>
          </div>
          <div className="flex items-center gap-3 md:gap-6">
            <button onClick={fetchNsrList} className="text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-1 text-sm font-bold"><span className="material-symbols-outlined text-sm">sync</span> 同步</button>
          </div>
        </header>

        <div className="p-4 md:p-8 w-full max-w-[1440px] mx-auto flex-1 flex flex-col gap-6">
          <section className={`${styles.clinicalGlass} rounded-3xl p-6 md:p-8 shadow-sm animate-in fade-in slide-in-from-top-4`}>
            <div className="flex items-center justify-between mb-6 border-b border-slate-200/50 pb-4">
               <div><h2 className="text-xl font-black text-slate-800">建立 NSR 施工派工單</h2><p className="text-xs text-slate-500 font-bold mt-1 tracking-widest uppercase">Create Work Order (C01)</p></div>
               <span className={`material-symbols-outlined text-3xl text-blue-500 ${styles.iconFill}`}>add_task</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">申請日期</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:border-blue-500 transition-colors" /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">施工院區</label><select value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})} className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:border-blue-500 transition-colors">{["總院區", "東院區", "南院區", "兒醫", "本院"].map(v => <option key={v} value={v}>{v}</option>)}</select></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">樓層</label><input type="text" placeholder="如: 05F" value={formData.floor} onChange={e => setFormData({...formData, floor: e.target.value})} onBlur={e => setFormData({...formData, floor: formatFloor(e.target.value)})} className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:border-blue-500 transition-colors" /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">需求數量 (點數)</label><input type="number" min="1" value={formData.points} onChange={e => setFormData({...formData, points: Number(e.target.value)})} className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:border-blue-500 transition-colors" /></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">申請單位</label><input type="text" placeholder="如: 資訊室" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:border-blue-500 transition-colors" /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">聯絡人</label><input type="text" placeholder="姓名" value={formData.user} onChange={e => setFormData({...formData, user: e.target.value})} className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:border-blue-500 transition-colors" /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">分機/手機</label><input type="text" placeholder="分機或手機" value={formData.ext} onChange={e => setFormData({...formData, ext: e.target.value})} className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:border-blue-500 transition-colors" /></div>
              <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">線材規格</label><select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:border-blue-500 transition-colors"><option>CAT 6</option><option>CAT 6A</option><option>光纖 (FIBER)</option></select></div>
            </div>

            <div className="mb-6">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">施工事由</label>
              <input type="text" placeholder="簡述派工原因，例如：新增護理站工作車網路孔" value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})} className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:border-blue-500 transition-colors" />
            </div>

            <div className="flex justify-end">
              <button onClick={handleSubmit} disabled={isLoading} className="px-8 py-3.5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-blue-900/20 hover:bg-blue-500 active:scale-95 transition-all flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">send</span> 立案發送
              </button>
            </div>
          </section>

          <section className={`${styles.clinicalGlass} rounded-3xl p-6 md:p-8 shadow-sm flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-4`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-slate-800">NSR 執行進度與核銷紀錄</h2>
            </div>
            
            <div className={styles.tableContainer}>
              <table className={`w-full text-left min-w-[1000px] ${styles.zebraGlass}`}>
                <thead>
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200/50">
                    <th className="pb-4 px-4">派工單號</th><th className="pb-4 px-4">單位資訊</th><th className="pb-4 px-4">施工內容</th><th className="pb-4 px-4 text-center">處理狀態</th><th className="pb-4 px-4 text-right">行政操作</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-bold text-slate-700 divide-y divide-slate-100/50">
                  {nsrList.map((row) => (
                    <tr key={row.id} className="hover:bg-white/40 transition-colors">
                      <td className="p-4 align-top">
                        <div className="font-mono text-blue-600 text-sm">{row.id}</div><div className="text-[10px] text-slate-400 font-mono mt-1">{row.date}</div>
                      </td>
                      <td className="p-4 align-top">
                        <div className="text-slate-800">{row.unit}</div><div className="text-[10px] text-slate-500 font-normal mt-1">{row.area} | {row.floor}</div><div className="text-[10px] text-slate-500 mt-0.5">{row.user} ({row.ext})</div>
                      </td>
                      <td className="p-4 align-top max-w-[250px]">
                        <div className="text-slate-800 flex items-center gap-2"><span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] text-slate-600 border border-slate-200">{row.type}</span><span className="text-emerald-600 font-black">{row.points} 點</span></div>
                        <div className="text-[11px] text-slate-500 mt-2 truncate" title={row.desc}>{row.desc}</div>
                        {row.remark && <div className="text-[10px] text-blue-500 mt-1 italic mt-2">↳ {row.remark}</div>}
                      </td>
                      <td className="p-4 align-top text-center">
                        <select 
                          value={row.status || "未處理"}
                          onChange={(e) => handleStatusChange(row.id, e.target.value)}
                          className={`text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full outline-none border cursor-pointer ${row.status === '待請款' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : row.status === '已完工' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : row.status === '處理中' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}
                        >
                          <option value="未處理">未處理</option><option value="處理中">處理中</option><option value="已完工">已完工</option><option value="待請款">待請款結案</option>
                        </select>
                      </td>
                      <td className="p-4 align-top text-right">
                        <div className="flex justify-end gap-2">
                          {row.status !== '待請款' && (
                            <button onClick={() => openSettleModal(row)} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-100" title="核算請款總額"><span className="material-symbols-outlined text-sm">calculate</span></button>
                          )}
                          <button onClick={() => handleDelete(row.id)} className="p-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-100" title="刪除單據"><span className="material-symbols-outlined text-sm">delete</span></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {nsrList.length === 0 && !isLoading && (
                    <tr><td colSpan={5} className="py-20 text-center text-slate-400 font-bold italic">目前無任何派工單資料。</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>

      {/* --- Settle Modal 結算面板 (115年度合約對沖) --- */}
      {settleModal.isOpen && settleModal.record && (
        <div className="fixed inset-0 z-[8000] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className={`${styles.clinicalGlass} bg-white p-6 md:p-8 rounded-[2.5rem] max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300`}>
            <div className="flex items-center gap-3 mb-6 border-b border-slate-200/50 pb-4">
               <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center">
                 <span className={`material-symbols-outlined ${styles.iconFill}`}>request_quote</span>
               </div>
               <div>
                 <h3 className="text-xl font-black text-slate-800">網點計價結算</h3>
                 <p className="text-[10px] text-slate-400 font-mono tracking-widest">{settleModal.record.id}</p>
               </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6 space-y-3">
               <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-500">施工規格</span><span className="text-sm font-black text-slate-800">{settleModal.record.type}</span></div>
               <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-500">點數</span><span className="text-sm font-black text-emerald-600">{settleModal.record.points} 點</span></div>
            </div>

            <div className="space-y-4 mb-8">
               <label className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl cursor-pointer hover:border-blue-400 transition-colors">
                  <div className="flex flex-col"><span className="text-sm font-bold text-slate-800">夜間/困難施工加成</span><span className="text-[10px] text-slate-400 font-bold">115年度合約特殊加給</span></div>
                  <input type="checkbox" className="w-5 h-5 text-blue-600 rounded focus:ring-0" checked={settleModal.isAddon} onChange={e => setSettleModal({...settleModal, isAddon: e.target.checked})} />
               </label>
               <label className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl cursor-pointer hover:border-blue-400 transition-colors">
                  <div className="flex flex-col"><span className="text-sm font-bold text-slate-800">加購 24 埠 PANEL</span><span className="text-[10px] text-slate-400 font-bold">機櫃耗材擴充</span></div>
                  <input type="checkbox" className="w-5 h-5 text-blue-600 rounded focus:ring-0" checked={settleModal.usePanel} onChange={e => setSettleModal({...settleModal, usePanel: e.target.checked})} />
               </label>
            </div>

            <div className="flex justify-between items-end mb-8 px-2">
               <span className="text-xs font-black text-slate-400 uppercase tracking-widest">核銷總額</span>
               <span className="text-3xl font-black text-indigo-600">NT$ {settleModal.total.toLocaleString()}</span>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setSettleModal({ isOpen: false, record: null, isAddon: false, usePanel: false, total: 0 })} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">取消返回</button>
              <button onClick={handleSettleCommit} className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-900/20 hover:bg-blue-500 active:scale-95 transition-all flex justify-center items-center gap-2">
                 <span className="material-symbols-outlined text-sm">price_check</span> 確認結算
              </button>
            </div>
          </div>
        </div>
      )}

      {(isLoading) && (
        <div className="fixed inset-0 z-[9000] flex flex-col items-center justify-center bg-white/60 backdrop-blur-md animate-in fade-in">
          <div className="w-14 h-14 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4 shadow-lg"></div>
          <p className="text-blue-600 font-black tracking-[0.3em] uppercase text-[10px] animate-pulse">{loaderText}</p>
        </div>
      )}

      <div className="fixed bottom-6 right-4 md:bottom-10 md:right-8 z-[9500] flex flex-col gap-3">
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