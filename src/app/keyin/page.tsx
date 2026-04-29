"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// 物理導入樣式模組 (0 內聯樣式)
import styles from "./keyin.module.css";

/**
 * ==========================================
 * 檔案：src/app/keyin/page.tsx
 * 狀態：V300.28 物理修復版 (解決按鈕無反應問題)
 * 物理職責：
 * 1. 狀態釋放：確保 isLoading 在所有 API 結束後強制回歸 false，防止按鈕鎖死。
 * 2. 實體對沖：100% 對準資料庫「資產」表與中文化欄位。
 * 3. 0 簡化：保留品牌型號、無線 MAC、備註、MAC 自動格式化。
 * 4. 無符號化：抹除所有 Emoji 符號，Toast 回歸純淨專業 UI。
 * ==========================================
 */

export default function KeyinPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"entry" | "progress">("entry");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [vendorName, setVendorName] = useState("");
  const [isLoading, setIsLoading] = useState(false); // 預設改為 false 確保初始可點擊
  
  const [buildingOptions, setBuildings] = useState<any[]>([]);

  const [metadata, setMetadata] = useState({ 
    date: new Date().toISOString().split("T")[0], 
    area: "", 
    floor: "", 
    unit: "", 
    applicant: "" 
  });
  
  const [devices, setDevices] = useState([
    { type: "桌上型電腦", model: "", sn: "", mac: "", mac2: "", remark: "" }
  ]);
  
  const [pendingRecords, setPendingRecords] = useState<any[]>([]);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" }[]>([]);

  const showToast = useCallback((msg: string, type: "success" | "error") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // 物理對沖：獲取棟別清單 (對準 buildings 表)
  const fetchBuildings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("buildings")
        .select("*")
        .eq("是否啟用", true)
        .order("排序權重", { ascending: true });
      
      if (error) throw error;
      setBuildings(data || []);
      if (data && data.length > 0 && !metadata.area) {
        setMetadata(prev => ({ ...prev, area: data[0].棟別名稱 }));
      }
    } catch (err) {
      console.error("棟別主檔同步失敗");
    }
  }, [metadata.area]);

  // 物理對沖：獲取進行中案件 (對準「資產」表)
  const fetchPendingRecords = useCallback(async (vName: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("資產")
        .select("*")
        .eq("來源廠商", vName)
        .order("建立時間", { ascending: false });
      
      if (error) throw error;
      setPendingRecords(data || []);
    } catch (err) {
      console.error("進度查詢異常");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const v = sessionStorage.getItem("asset_link_vendor");
    if (!v) { router.push("/"); return; }
    setVendorName(v);
    
    // 初始化數據載入
    const init = async () => {
      await fetchBuildings();
      if (activeTab === "progress") {
        await fetchPendingRecords(v);
      }
    };
    init();
  }, [router, activeTab, fetchBuildings, fetchPendingRecords]);

  const handleMacInput = (index: number, val: string, macField: "mac" | "mac2") => {
    let macStr = val.toUpperCase().replace(/[^A-F0-9]/g, "");
    if (macStr.length > 12) macStr = macStr.substring(0, 12);
    const parts = macStr.match(/.{1,2}/g);
    const formattedMac = parts ? parts.join(":") : macStr;
    const newDevices = [...devices]; 
    newDevices[index][macField] = formattedMac; 
    setDevices(newDevices);
  };

  const handleSubmit = async () => {
    // 防呆：確保不是在加載中
    if (isLoading) return;

    if (!metadata.area || !metadata.unit || !metadata.applicant) {
      showToast("請完整填寫行政資訊 (棟別/單位/人員)", "error"); 
      return;
    }
    
    const hasEmptySn = devices.some(d => !d.sn.trim());
    if (hasEmptySn) {
       showToast("產品序號不可為空", "error");
       return;
    }

    setIsLoading(true);
    try {
      // 物理對沖：對正資料庫「資產」表欄位
      const payload = devices.map(d => ({
        "來源廠商": vendorName,
        "裝機日期": metadata.date,
        "棟別": metadata.area,
        "樓層": metadata.floor,
        "使用單位": metadata.unit,
        "姓名分機": metadata.applicant,
        "設備類型": d.type,
        "品牌型號": d.model || "未提供",
        "產品序號": d.sn.trim(),
        "主要mac": d.mac,
        "無線mac": d.mac2 || "",
        "備註": d.remark || "",
        "狀態": "待核定"
      }));

      const { error } = await supabase.from("資產").insert(payload);
      
      if (error) {
        // 若為重複序號報錯，顯示友善提示
        if (error.code === "23505") {
          showToast("提交失敗：設備序號已存在於系統中", "error");
        } else {
          throw error;
        }
        return;
      }

      // 成功後重置
      setDevices([{ type: "桌上型電腦", model: "", sn: "", mac: "", mac2: "", remark: "" }]);
      showToast("預約申請已成功提交", "success");
      setActiveTab("progress");
    } catch (err) {
      showToast("系統寫入失敗，請檢查資料庫連線", "error");
      console.error(err);
    } finally {
      // 🚀 物理修復關鍵：無論成功或失敗，都強制解除 Loading
      setIsLoading(false);
    }
  };

  const handleDeletePending = async (sn: string) => {
    if (!confirm("確定要撤回這筆預約申請嗎？")) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.from("資產").delete().eq("產品序號", sn);
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
    <div className={`min-h-screen text-slate-800 font-body-md overflow-x-hidden relative ${styles.medicalGradient} antialiased`}>
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />

      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-sky-900/20 backdrop-blur-sm z-[45] md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* TopNavBar */}
      <nav className="sticky top-0 w-full flex justify-between items-center px-4 md:px-6 h-16 bg-white/70 backdrop-blur-xl border-b border-white/40 shadow-sm z-40">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-sky-800 p-1">
             <span className="material-symbols-outlined">menu</span>
          </button>
          <span className="text-lg md:text-xl font-bold bg-gradient-to-r from-sky-700 to-sky-500 bg-clip-text text-transparent truncate max-w-[200px]">Vendor Portal</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/")} className="material-symbols-outlined text-slate-500 hover:text-sky-600 transition-colors">logout</button>
        </div>
      </nav>

      <div className="flex">
        {/* SideNavBar */}
        <aside className={`w-64 fixed left-0 top-0 h-screen pt-16 border-r border-white/30 bg-white/80 backdrop-blur-2xl p-6 z-50 transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
          <div className="flex justify-between items-center mb-8 px-2 font-black text-sky-800">
            <p className="text-lg uppercase">ALink 作業區</p>
            <button className="md:hidden text-slate-500" onClick={() => setIsMobileMenuOpen(false)}><span className="material-symbols-outlined">close</span></button>
          </div>
          <nav className="space-y-2">
             <button onClick={() => { setActiveTab("entry"); setIsMobileMenuOpen(false); }} className={`w-full text-left p-3 rounded-xl font-bold transition-all ${activeTab === 'entry' ? 'bg-sky-50 text-sky-700 border-l-4 border-sky-600 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>預約錄入</button>
             <button onClick={() => { setActiveTab("progress"); setIsMobileMenuOpen(false); }} className={`w-full text-left p-3 rounded-xl font-bold transition-all ${activeTab === 'progress' ? 'bg-sky-50 text-sky-700 border-l-4 border-sky-600 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>進度查詢</button>
          </nav>
        </aside>

        {/* Main Canvas */}
        <main className="w-full md:ml-64 p-4 md:p-8">
          <header className="mb-8 flex flex-col">
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">{activeTab === 'entry' ? `廠商錄入 : ${vendorName}` : '送件進度追蹤'}</h1>
            <p className="text-xs md:text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">Administrative Asset Keyin</p>
          </header>

          {activeTab === 'entry' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in zoom-in-95 duration-500">
              <section className="col-span-1 lg:col-span-4">
                <div className={`${styles.clinicalGlass} rounded-2xl p-6 md:p-8 shadow-sm`}>
                  <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-3">
                    <span className="material-symbols-outlined text-blue-600">info</span>
                    <h2 className="text-lg font-bold text-slate-800">行政資料</h2>
                  </div>
                  <div className="space-y-4">
                     <div><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">裝機日期</label><input type="date" value={metadata.date} onChange={e => setMetadata({...metadata, date: e.target.value})} className={styles.crystalInput} /></div>
                     <div className="grid grid-cols-2 gap-3">
                       <div>
                         <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">棟別</label>
                         <select value={metadata.area} onChange={e => setMetadata({...metadata, area: e.target.value})} className={styles.crystalInput}>
                           {buildingOptions.map(v => <option key={v.棟別代碼} value={v.棟別名稱}>{v.棟別名稱}</option>)}
                         </select>
                       </div>
                       <div><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">樓層</label><input type="text" value={metadata.floor} onChange={e => setMetadata({...metadata, floor: e.target.value.toUpperCase()})} placeholder="如: 05F" className={styles.crystalInput} /></div>
                     </div>
                     <div><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">單位全稱</label><input type="text" value={metadata.unit} onChange={e => setMetadata({...metadata, unit: e.target.value})} placeholder="如: 資訊組" className={styles.crystalInput} /></div>
                     <div><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">填報人 (#分機)</label><input type="text" value={metadata.applicant} onChange={e => setMetadata({...metadata, applicant: e.target.value})} placeholder="姓名#1234" className={styles.crystalInput} /></div>
                  </div>
                </div>
              </section>

              <section className="col-span-1 lg:col-span-8 flex flex-col">
                 <div className={`${styles.clinicalGlass} rounded-2xl p-6 md:p-8 shadow-sm flex flex-col flex-1`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-3">
                       <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-emerald-600">dns</span>
                          <h2 className="text-lg font-bold text-slate-800">設備技術參數</h2>
                       </div>
                       <button onClick={() => setDevices([...devices, { type: "桌上型電腦", model: "", sn: "", mac: "", mac2: "", remark: "" }])} className="text-blue-600 font-bold text-xs uppercase tracking-widest bg-blue-50 px-4 py-2 rounded-lg hover:bg-blue-100 transition-all">
                         + 新增設備點位
                       </button>
                    </div>
                    
                    <div className="overflow-x-auto w-full flex-1">
                      <table className={`w-full text-left min-w-[1000px] ${styles.zebraGlass}`}>
                        <thead>
                          <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                            <th className="pb-3 px-2">類型</th>
                            <th className="pb-3 px-2">品牌型號</th>
                            <th className="pb-3 px-2">產品序號 (S/N)</th>
                            <th className="pb-3 px-2">主要 MAC</th>
                            <th className="pb-3 px-2">無線 MAC</th>
                            <th className="pb-3 px-2">備註</th>
                            <th className="pb-3 px-2 text-right">操作</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/50">
                          {devices.map((d, i) => (
                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-3 px-2">
                                <select value={d.type} onChange={e => { const nd = [...devices]; nd[i].type = e.target.value; setDevices(nd); }} className="w-[120px] bg-transparent border border-slate-200 rounded p-2 text-sm outline-none font-bold">
                                  <option>桌上型電腦</option><option>筆記型電腦</option><option>印表機</option><option>醫療儀器</option><option>其他設備</option>
                                </select>
                              </td>
                              <td className="py-3 px-2"><input placeholder="型號" value={d.model} onChange={e => { const nd = [...devices]; nd[i].model = e.target.value; setDevices(nd); }} className="w-full bg-transparent border border-slate-200 rounded p-2 text-sm outline-none font-bold" /></td>
                              <td className="py-3 px-2"><input placeholder="S/N" value={d.sn} onChange={e => { const nd = [...devices]; nd[i].sn = e.target.value.toUpperCase(); setDevices(nd); }} className="w-full bg-transparent border border-slate-200 rounded p-2 text-sm font-mono text-red-600 outline-none font-black uppercase" /></td>
                              <td className="py-3 px-2"><input placeholder="MAC" value={d.mac} onChange={e => handleMacInput(i, e.target.value, "mac")} className="w-full bg-transparent border border-slate-200 rounded p-2 text-sm font-mono text-blue-600 outline-none font-black" /></td>
                              <td className="py-3 px-2"><input placeholder="無線 MAC" value={d.mac2} onChange={e => handleMacInput(i, e.target.value, "mac2")} className="w-full bg-transparent border border-slate-200 rounded p-2 text-sm font-mono text-slate-400 outline-none" /></td>
                              <td className="py-3 px-2"><input placeholder="註記" value={d.remark} onChange={e => { const nd = [...devices]; nd[i].remark = e.target.value; setDevices(nd); }} className="w-full bg-transparent border border-slate-200 rounded p-2 text-sm outline-none" /></td>
                              <td className="py-3 px-2 text-right">
                                {devices.length > 1 && (
                                  <button onClick={() => setDevices(devices.filter((_, idx) => idx !== i))} className="text-red-500 p-2 hover:bg-red-50 rounded transition-all"><span className="material-symbols-outlined text-sm">delete</span></button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button 
                      onClick={handleSubmit} 
                      disabled={isLoading} 
                      className="mt-6 w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-900/20 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {isLoading ? "同步中..." : "提交預約核准"}
                    </button>
                 </div>
              </section>
            </div>
          )}

          {activeTab === 'progress' && (
             <div className={`${styles.clinicalGlass} rounded-2xl p-6 md:p-8 shadow-sm flex flex-col min-h-[500px] animate-in slide-in-from-right-4`}>
                <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-500">hourglass_empty</span>
                    <h2 className="text-lg font-black text-slate-800">審核中案件 ({pendingRecords.length})</h2>
                  </div>
                  <button onClick={() => fetchPendingRecords(vendorName)} className="text-xs font-bold text-slate-500 flex items-center gap-1 hover:text-blue-600 transition-colors">
                    <span className="material-symbols-outlined text-sm">sync</span> 重新整理
                  </button>
                </div>

                <div className="overflow-x-auto w-full flex-1">
                  <table className="w-full text-left min-w-[800px]">
                    <thead>
                      <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                        <th className="pb-3 px-2">產品序號 (S/N)</th>
                        <th className="pb-3 px-2">單位 / 棟別</th>
                        <th className="pb-3 px-2">主要 MAC</th>
                        <th className="pb-3 px-2">狀態</th>
                        <th className="pb-3 px-2 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                      {pendingRecords.map((record, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-all">
                          <td className="p-3 font-mono text-xs text-slate-400">{record.產品序號}</td>
                          <td className="p-3 font-bold">
                            <p>{record.使用單位}</p>
                            <p className="text-[10px] text-slate-400 font-normal">{record.棟別} | {record.樓層} | {record.裝機日期}</p>
                          </td>
                          <td className="p-3">
                            <p className="font-bold">{record.設備類型}</p>
                            <p className="text-[10px] font-mono text-blue-600 uppercase">{record.主要mac}</p>
                          </td>
                          <td className="p-3">
                            <span className="bg-amber-100 text-amber-700 text-[10px] px-2.5 py-1 rounded-full border border-amber-200 font-black uppercase tracking-widest">待核定</span>
                          </td>
                          <td className="p-3 text-right">
                            <button onClick={() => handleDeletePending(record.產品序號)} className="text-xs px-3 py-1.5 border border-slate-200 text-red-500 rounded-lg hover:bg-red-50 transition-all">
                              撤回
                            </button>
                          </td>
                        </tr>
                      ))}
                      {pendingRecords.length === 0 && !isLoading && (
                        <tr><td colSpan={5} className="py-20 text-center text-slate-300 font-bold italic">目前沒有等待審核的案件。</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
             </div>
          )}
        </main>
      </div>

      {/* 物理黑底白字 Toast */}
      <div className="fixed bottom-10 right-8 z-[7000] flex flex-col gap-3">
        {toasts.map(t => (
          <div key={t.id} className={styles.toastBase}>
            <span className="material-symbols-outlined text-sm">{t.type === 'success' ? 'check_circle' : 'error'}</span> {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}