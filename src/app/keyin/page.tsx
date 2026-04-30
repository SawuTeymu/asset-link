"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getVendorProgress, vendorConfirmAsset } from "@/lib/actions/assets";
import styles from "./keyin.module.css";

/**
 * ==========================================
 * 檔案：src/app/keyin/page.tsx
 * 狀態：V400.1 動態狀態連動完全體 (潔淨規範版)
 * 職責：
 * 1. 預約錄入：支援 MAC 格式化與防呆。
 * 2. 狀態矩陣：動態支援 [待核定, 已退回(待修正), 已核定(待確認), 已結案]。
 * 3. 載入修正：將被退回的案件重新載入表單，再次提交時物理對沖舊單。
 * 4. 確認結案：接收 IP 後，觸發歸檔動作。
 * 5. 潔淨規範：移除所有 Inline Style，改用 CSS Modules。
 * ==========================================
 */

interface DeviceState {
  type: string;
  model: string;
  sn: string;
  mac: string;
  mac2: string;
  remark: string;
  original_sn?: string; // 用於追蹤被退回的原始序號，以便覆寫
}

export default function KeyinPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"entry" | "progress">("entry");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [vendorName, setVendorName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [buildingOptions, setBuildings] = useState<any[]>([]);

  const [metadata, setMetadata] = useState({ date: new Date().toISOString().split("T")[0], area: "", floor: "", unit: "", applicantName: "", applicantExt: "" });
  const [devices, setDevices] = useState<DeviceState[]>([{ type: "桌上型電腦", model: "", sn: "", mac: "", mac2: "", remark: "" }]);
  const [pendingRecords, setPendingRecords] = useState<any[]>([]);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" | "info" }[]>([]);

  const showToast = useCallback((msg: string, type: "success" | "error" | "info") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const fetchBuildings = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("buildings").select("*").eq("是否啟用", true).order("排序權重", { ascending: true });
      if (error) throw error;
      setBuildings(data || []);
      if (data && data.length > 0 && !metadata.area) setMetadata(prev => ({ ...prev, area: data[0].棟別名稱 }));
    } catch (err) { console.error("棟別同步異常"); }
  }, [metadata.area]);

  // 🚀 獲取廠商的全部進度 (包含進行中與歷史結案)
  const fetchPendingRecords = useCallback(async (vName: string) => {
    if (!vName) return;
    setIsLoading(true);
    try {
      // 調用 Server Action 確保獲取最新狀態且無快取
      const data = await getVendorProgress(vName);
      setPendingRecords(data || []);
    } catch (err: any) {
      showToast(err.message || "進度數據讀取失敗，請重新整理頁面", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const v = sessionStorage.getItem("asset_link_vendor");
    if (!v) { router.push("/"); return; }
    setVendorName(v);
    fetchBuildings();
    if (activeTab === "progress") fetchPendingRecords(v);
  }, [router, activeTab, fetchBuildings, fetchPendingRecords]);

  // --- 設備 MAC 格式化 ---
  const handleMacInput = (index: number, val: string, macField: "mac" | "mac2") => {
    let macStr = val.toUpperCase().replace(/[^A-F0-9]/g, "");
    if (macStr.length > 12) macStr = macStr.substring(0, 12);
    const parts = macStr.match(/.{1,2}/g);
    const formattedMac = parts ? parts.join(":") : macStr;
    const newDevices = [...devices]; 
    newDevices[index][macField] = formattedMac; 
    setDevices(newDevices);
  };

  // --- 提交預約 (支援新錄入與退回修正) ---
  const handleSubmit = async () => {
    if (isLoading) return;
    if (!metadata.area || !metadata.unit || !metadata.applicantName) { showToast("請完整填寫行政資料 (包含姓名)", "error"); return; }
    if (devices.some(d => !d.sn.trim())) { showToast("產品序號不可為空", "error"); return; }

    setIsLoading(true);
    try {
      const payload = devices.map(d => ({
        "來源廠商": vendorName, "裝機日期": metadata.date, "棟別": metadata.area, "樓層": metadata.floor,
        "使用單位": metadata.unit, "姓名": metadata.applicantName.trim(), "分機": metadata.applicantExt.trim(), 
        "設備類型": d.type, "品牌型號": d.model || "未提供",
        "產品序號": d.sn.trim().toUpperCase(), "主要mac": d.mac, "無線mac": d.mac2 || "", "備註": d.remark || "", "狀態": "待核定"
      }));

      // 如果這是「退回修正」的案件，先物理刪除原本的錯誤紀錄，防止序號 Unique 衝突
      for (const d of devices) {
        if (d.original_sn) {
          await supabase.from("資產").delete().eq("產品序號", d.original_sn);
        }
      }

      const { error } = await supabase.from("資產").insert(payload);
      
      if (error) {
        if (error.code === "23505") showToast("提交失敗：序號已存在", "error");
        else throw new Error(error.message);
        return;
      }

      setDevices([{ type: "桌上型電腦", model: "", sn: "", mac: "", mac2: "", remark: "" }]);
      showToast("預約錄入成功，已送交資訊中心", "success");
      setActiveTab("progress");
    } catch (err: any) {
      showToast(`寫入失敗: ${err.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  // --- 撤回申請 ---
  const handleDeletePending = async (sn: string) => {
    if (!confirm("確定要撤回此筆預約申請嗎？")) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.from("資產").delete().eq("產品序號", sn);
      if (error) throw error;
      showToast("申請已成功撤回", "success");
      fetchPendingRecords(vendorName);
    } catch (err) {
      showToast("撤回失敗", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // --- 載入退回修正 ---
  const handleLoadFix = async (sn: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from("資產").select("*").eq("產品序號", sn).single();
      if (error) throw error;
      
      setMetadata({
        date: data.裝機日期,
        area: data.棟別,
        floor: data.樓層,
        unit: data.使用單位,
        applicantName: data.姓名,
        applicantExt: data.分機
      });
      
      setDevices([{
        type: data.設備類型 || "桌上型電腦",
        model: data.品牌型號 || "",
        sn: data.產品序號,
        mac: data.主要mac || "",
        mac2: data.無線mac || "",
        remark: data.備註 || "",
        original_sn: data.產品序號 // 標記原始序號，以便提交時對沖
      }]);
      
      setActiveTab("entry");
      showToast("已載入案件，請修正錯誤後重新提交", "info");
    } catch (err) {
      showToast("載入修正資料失敗", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // --- 廠商確認結案 ---
  const handleConfirm = async (sn: string) => {
    if (!confirm("確認已完成現場設定並要歸檔此案件嗎？")) return;
    setIsLoading(true);
    try {
      await vendorConfirmAsset(sn);
      showToast("設備已確認並正式歸檔", "success");
      fetchPendingRecords(vendorName);
    } catch (err: any) {
      showToast(`結案失敗: ${err.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen text-slate-800 font-body-md overflow-x-hidden relative ${styles.medicalGradient} antialiased`}>
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      {isMobileMenuOpen && <div className="fixed inset-0 bg-sky-900/20 backdrop-blur-sm z-[45] md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>}

      <nav className="sticky top-0 w-full flex justify-between items-center px-4 md:px-6 h-16 bg-white/70 backdrop-blur-xl border-b border-white/40 shadow-sm z-40">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-sky-800 p-1"><span className="material-symbols-outlined">menu</span></button>
          <span className="text-lg md:text-xl font-black text-sky-800 tracking-tight truncate max-w-[250px]">Vendor Portal</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/")} className="flex items-center gap-1 font-bold text-slate-500 hover:text-red-500 transition-colors">
            <span className="material-symbols-outlined text-base">logout</span><span className="hidden md:inline text-xs">登出</span>
          </button>
        </div>
      </nav>

      <div className="flex">
        <aside className={`w-64 fixed left-0 top-0 h-screen pt-16 border-r border-white/30 bg-white/80 backdrop-blur-2xl p-6 z-50 transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
          <div className="flex justify-between items-center mb-8 px-2 font-black text-sky-800 uppercase tracking-widest"><p className="text-sm">ALink 作業區</p></div>
          <nav className="space-y-2">
             <button onClick={() => { setActiveTab("entry"); setIsMobileMenuOpen(false); }} className={`w-full text-left p-4 rounded-2xl font-bold transition-all flex items-center gap-3 ${activeTab === 'entry' ? 'bg-sky-50 text-sky-700 border-l-4 border-sky-600 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}><span className={`material-symbols-outlined text-sm ${styles.iconFill}`}>edit_square</span>預約錄入</button>
             <button onClick={() => { setActiveTab("progress"); setIsMobileMenuOpen(false); }} className={`w-full text-left p-4 rounded-2xl font-bold transition-all flex items-center gap-3 ${activeTab === 'progress' ? 'bg-sky-50 text-sky-700 border-l-4 border-sky-600 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}><span className={`material-symbols-outlined text-sm ${styles.iconFill}`}>hourglass_top</span>進度查詢</button>
          </nav>
        </aside>

        <main className="w-full md:ml-64 p-4 md:p-8">
          <header className="mb-10">
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">{activeTab === 'entry' ? `廠商錄入 : ${vendorName}` : '審核進度追蹤'}</h1>
            <p className="text-xs md:text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">Administrative Asset Interface</p>
          </header>

          {activeTab === 'entry' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in zoom-in-95 duration-500">
              <section className="col-span-1 lg:col-span-4">
                <div className={`${styles.clinicalGlass} rounded-3xl p-6 md:p-8 shadow-sm`}>
                  <div className="flex items-center gap-2 mb-8 border-b border-slate-100 pb-4"><span className={`material-symbols-outlined text-blue-600 ${styles.iconFill}`}>info</span><h2 className="text-lg font-bold text-slate-800 tracking-tight">行政基本資料</h2></div>
                  <div className="space-y-5">
                     <div><label className={styles.inputLabel}>裝機日期</label><input type="date" value={metadata.date} onChange={e => setMetadata({...metadata, date: e.target.value})} className={styles.crystalInput} /></div>
                     <div className="grid grid-cols-2 gap-4">
                       <div><label className={styles.inputLabel}>所屬棟別</label><select value={metadata.area} onChange={e => setMetadata({...metadata, area: e.target.value})} className={styles.crystalInput}>{buildingOptions.map(v => <option key={v.棟別代碼} value={v.棟別名稱}>{v.棟別名稱}</option>)}</select></div>
                       <div><label className={styles.inputLabel}>樓層</label><input type="text" value={metadata.floor} onChange={e => setMetadata({...metadata, floor: e.target.value.toUpperCase()})} placeholder="如: 05F" className={styles.crystalInput} /></div>
                     </div>
                     <div><label className={styles.inputLabel}>單位全稱</label><input type="text" value={metadata.unit} onChange={e => setMetadata({...metadata, unit: e.target.value})} placeholder="如: 資訊組" className={styles.crystalInput} /></div>
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
                       <div className="flex items-center gap-2"><span className={`material-symbols-outlined text-emerald-600 ${styles.iconFill}`}>dns</span><h2 className="text-lg font-bold text-slate-800 tracking-tight">設備詳細資訊</h2></div>
                       <button onClick={() => setDevices([...devices, { type: "桌上型電腦", model: "", sn: "", mac: "", mac2: "", remark: "" }])} className="text-blue-600 font-black text-[10px] uppercase tracking-[0.2em] bg-blue-50 px-5 py-2.5 rounded-xl hover:bg-blue-100 transition-all border border-blue-100 shadow-sm">+ 新增設備節點</button>
                    </div>
                    
                    <div className={styles.deviceContainer}>
                      {devices.map((d, i) => (
                        <div key={i} className={styles.deviceItemBlock}>
                          <div className={styles.rowGrid}>
                            <div><label className={styles.inputLabel}>設備類型</label><select value={d.type} onChange={e => { const nd = [...devices]; nd[i].type = e.target.value; setDevices(nd); }} className={styles.crystalInput}><option>桌上型電腦</option><option>筆記型電腦</option><option>印表機</option><option>醫療儀器</option><option>其他設備</option></select></div>
                            <div><label className={styles.inputLabel}>品牌型號</label><input placeholder="品牌型號" value={d.model} onChange={e => { const nd = [...devices]; nd[i].model = e.target.value; setDevices(nd); }} className={styles.crystalInput} /></div>
                            <div><label className={styles.inputLabel}>產品序號 (S/N)</label><input placeholder="S/N" value={d.sn} onChange={e => { const nd = [...devices]; nd[i].sn = e.target.value.toUpperCase(); setDevices(nd); }} className={`${styles.crystalInput} font-mono text-red-600`} /></div>
                          </div>
                          <div className={styles.rowGrid}>
                            <div><label className={styles.inputLabel}>主要 MAC</label><input placeholder="有線 MAC" value={d.mac} onChange={e => handleMacInput(i, e.target.value, "mac")} className={`${styles.crystalInput} font-mono text-blue-600`} /></div>
                            <div><label className={styles.inputLabel}>無線 MAC (可選)</label><input placeholder="無線" value={d.mac2} onChange={e => handleMacInput(i, e.target.value, "mac2")} className={`${styles.crystalInput} font-mono text-slate-400`} /></div>
                            <div><label className={styles.inputLabel}>設備備註</label><input placeholder="補充說明" value={d.remark} onChange={e => { const nd = [...devices]; nd[i].remark = e.target.value; setDevices(nd); }} className={styles.crystalInput} /></div>
                          </div>
                          {devices.length > 1 && <button onClick={() => setDevices(devices.filter((_, idx) => idx !== i))} className={styles.removeBtn}><span className="material-symbols-outlined text-[14px]">close</span></button>}
                        </div>
                      ))}
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-100">
                       <button onClick={handleSubmit} disabled={isLoading} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-[0.3em] text-sm shadow-xl shadow-blue-900/20 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3">
                         {isLoading ? <> <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> <span>系統處理中...</span> </> : <span>提交預約核准</span>}
                       </button>
                    </div>
                 </div>
              </section>
            </div>
          )}

          {activeTab === 'progress' && (
             <div className={`${styles.clinicalGlass} rounded-3xl p-6 md:p-8 shadow-sm flex flex-col min-h-[500px] animate-in slide-in-from-right-4`}>
                <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2"><span className={`material-symbols-outlined text-amber-500 ${styles.iconFill}`}>hourglass_empty</span><h2 className="text-lg font-bold text-slate-800 tracking-tight">廠商案件總覽 (含歷史)</h2></div>
                  <button onClick={() => fetchPendingRecords(vendorName)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 hover:text-blue-600 transition-colors bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm"><span className="material-symbols-outlined text-sm">sync</span> 重新整理</button>
                </div>
                <div className="overflow-x-auto w-full flex-1">
                  <table className="w-full text-left min-w-[900px]">
                    <thead>
                      <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                        <th className="pb-4 px-4">產品序號 (S/N)</th>
                        <th className="pb-4 px-4">部署單位 / 棟別</th>
                        <th className="pb-4 px-4">設備參數 / IP狀態</th>
                        <th className="pb-4 px-4">案件狀態</th>
                        <th className="pb-4 px-4 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                      {pendingRecords.map((record, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-all">
                          <td className="p-4 font-mono text-xs text-slate-500 align-top">{record.sn}</td>
                          <td className="p-4 font-bold align-top">
                            <p className="text-slate-800">{record.unit}</p>
                            <p className="text-[10px] text-slate-400 font-normal uppercase mt-0.5">{record.area} | {record.floor} | {record.date}</p>
                            <p className="text-[10px] text-slate-500 font-normal mt-0.5">{record.applicantName} #{record.applicantExt}</p>
                          </td>
                          <td className="p-4 align-top">
                            <p className="font-bold text-slate-600">{record.model}</p>
                            <p className="text-[10px] font-mono text-slate-500 uppercase mt-0.5">MAC: <span className="font-black text-blue-600">{record.mac1}</span></p>
                            {/* 當有配發 IP 時顯示 */}
                            {record.assignedIp && (
                              <p className="text-[10px] font-bold text-emerald-600 mt-1.5 bg-emerald-50 inline-block px-2 py-0.5 rounded border border-emerald-100">
                                核發 IP: {record.assignedIp}
                              </p>
                            )}
                          </td>
                          <td className="p-4 align-top">
                            {/* 🚀 動態狀態矩陣 */}
                            {record.status === '待核定' && <span className="bg-amber-100 text-amber-700 text-[10px] px-3 py-1.5 rounded-full border border-amber-200 font-black uppercase tracking-widest shadow-sm">審核中</span>}
                            
                            {record.status === '已退回(待修正)' && (
                              <div className="flex flex-col items-start gap-1">
                                <span className="bg-red-100 text-red-700 text-[10px] px-3 py-1.5 rounded-full border border-red-200 font-black uppercase tracking-widest shadow-sm">已退回</span>
                                <span className="text-[10px] text-red-600 font-bold bg-red-50 px-2 py-1 rounded border border-red-100">原因: {record.rejectReason}</span>
                              </div>
                            )}

                            {record.status === '已核定(待確認)' && (
                              <span className="bg-blue-100 text-blue-700 text-[10px] px-3 py-1.5 rounded-full border border-blue-200 font-black uppercase tracking-widest shadow-sm">已核發</span>
                            )}

                            {record.status === '已結案' && <span className="bg-emerald-100 text-emerald-700 text-[10px] px-3 py-1.5 rounded-full border border-emerald-200 font-black uppercase tracking-widest shadow-sm">歸檔完畢</span>}
                          </td>
                          <td className="p-4 align-top text-right">
                            <div className="flex flex-col items-end gap-2">
                               {/* 🚀 動態按鈕矩陣 */}
                               {record.status === '待核定' && (
                                 <button onClick={() => handleDeletePending(record.sn)} className="text-[10px] font-black uppercase tracking-widest px-4 py-2 border border-slate-200 text-red-500 rounded-xl hover:bg-red-50 hover:border-red-200 transition-all shadow-sm bg-white">撤回申請</button>
                               )}
                               
                               {record.status === '已退回(待修正)' && (
                                 <button onClick={() => handleLoadFix(record.sn)} className="text-[10px] font-black uppercase tracking-widest px-4 py-2 border border-amber-200 text-amber-600 rounded-xl hover:bg-amber-50 hover:border-amber-300 transition-all shadow-sm bg-white flex items-center gap-1">
                                   <span className="material-symbols-outlined text-[14px]">edit_document</span> 載入修正
                                 </button>
                               )}

                               {record.status === '已核定(待確認)' && (
                                 <button onClick={() => handleConfirm(record.sn)} className="text-[10px] font-black uppercase tracking-widest px-4 py-2 border border-transparent text-white bg-emerald-500 rounded-xl hover:bg-emerald-600 transition-all shadow-sm flex items-center gap-1">
                                   <span className="material-symbols-outlined text-[14px]">verified</span> 確認結案
                                 </button>
                               )}

                               {record.status === '已結案' && (
                                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">不適用操作</span>
                               )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {pendingRecords.length === 0 && !isLoading && (
                        <tr><td colSpan={5} className="py-20 text-center text-slate-400 font-bold italic">目前無任何案件紀錄。</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
             </div>
          )}
        </main>
      </div>

      {isLoading && (
        <div className={styles.loaderOverlay}><div className={styles.spinner}></div><p className="text-blue-600 font-black text-[10px] uppercase mt-6 tracking-[0.5em] animate-pulse">系統處理中...</p></div>
      )}

      <div className="fixed bottom-10 right-8 z-[9000] flex flex-col gap-3">
        {toasts.map(t => (
          <div key={t.id} className={styles.toastBase}>
            <span className={`material-symbols-outlined text-sm ${styles.iconFill} ${t.type === 'success' ? 'text-emerald-400' : t.type === 'error' ? 'text-red-400' : 'text-blue-400'}`}>
              {t.type === 'success' ? 'check_circle' : t.type === 'error' ? 'error' : 'info'}
            </span> 
            <span className="tracking-wide">{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}