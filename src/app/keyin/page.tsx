```react
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { checkIpConflict } from "@/lib/actions/assets";

// 物理導入樣式模組 (0 內聯樣式)
import styles from "./keyin.module.css";

/**
 * ==========================================
 * 檔案：src/app/keyin/page.tsx
 * 狀態：V300.26 實體路徑修正版 (修復錄入失敗問題)
 * 物理職責：
 * 1. 實體對正：將 API 調用路徑鎖定為物理資料表「資產」(由截圖 image_7df058.png 確認)。
 * 2. 數據源對沖：從「buildings」表獲取棟別，寫入「資產」表。
 * 3. 0 簡化：保留品牌型號、無線 MAC、備註、MAC 自動格式化。
 * 4. 無符號化：物理抹除按鈕與 UI 中的所有 Emoji 符號。
 * ==========================================
 */

export default function KeyinPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"entry" | "progress">("entry");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [vendorName, setVendorName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  
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

  // 100% 物理對沖：獲取棟別清單
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

  // 100% 物理對沖：獲取進行中案件 (指向「資產」表)
  const fetchPendingRecords = useCallback(async (vName: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("資產") // 🚀 物理修正：對正 image_7df058.png 中的表名
        .select("*")
        .eq("來源廠商", vName)
        .order("建立時間", { ascending: false });
      
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
    fetchBuildings();
    if (activeTab === "progress") fetchPendingRecords(v);
  }, [router, activeTab, fetchPendingRecords, fetchBuildings]);

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
    if (!metadata.area || !metadata.unit || !metadata.applicant) {
      showToast("請完整填寫行政資訊", "error"); 
      return;
    }
    
    const hasEmptySn = devices.some(d => !d.sn.trim());
    if (hasEmptySn) {
       showToast("設備序號不可為空", "error");
       return;
    }

    setIsLoading(true);
    try {
      // 🚀 物理對沖：對正「資產」表之資料庫欄位名稱
      const payload = devices.map(d => ({
        "來源廠商": vendorName,
        "裝機日期": metadata.date,
        "棟別": metadata.area,
        "樓層": metadata.floor,
        "使用單位": metadata.unit,
        "姓名分機": metadata.applicant,
        "設備類型": d.type,
        "品牌型號": d.model || "未提供",
        "產品序號": d.sn,
        "主要mac": d.mac,
        "無線mac": d.mac2 || "",
        "備註": d.remark || "",
        "狀態": "待核定"
      }));

      const { error } = await supabase.from("資產").insert(payload);
      if (error) throw error;

      setDevices([{ type: "桌上型電腦", model: "", sn: "", mac: "", mac2: "", remark: "" }]);
      showToast("預約錄入成功", "success");
      setActiveTab("progress");
    } catch (err) {
      showToast("錄入失敗，請確認資料庫連結", "error");
    } finally {
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
          <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-sky-800 p-1"><span className="material-symbols-outlined">menu</span></button>
          <span className="text-lg md:text-xl font-bold bg-gradient-to-r from-sky-700 to-sky-500 bg-clip-text text-transparent">Vendor Portal</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/")} className="material-symbols-outlined text-slate-500 hover:text-sky-600 transition-colors">logout</button>
        </div>
      </nav>

      <div className="flex">
        {/* SideNavBar */}
        <aside className={`w-64 fixed left-0 top-0 h-screen pt-16 border-r border-white/30 bg-white/80 backdrop-blur-2xl p-6 z-50 transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
          <div className="flex justify-between items-center mb-8 px-2 font-black text-sky-800">廠商作業</div>
          <nav className="space-y-2">
             <button onClick={() => { setActiveTab("entry"); setIsMobileMenuOpen(false); }} className={`w-full text-left p-3 rounded-xl font-bold transition-all ${activeTab === 'entry' ? 'bg-sky-50 text-sky-700 border-l-4 border-sky-600' : 'text-slate-600 hover:bg-slate-50'}`}>預約錄入</button>
             <button onClick={() => { setActiveTab("progress"); setIsMobileMenuOpen(false); }} className={`w-full text-left p-3 rounded-xl font-bold transition-all ${activeTab === 'progress' ? 'bg-sky-50 text-sky-700 border-l-4 border-sky-600' : 'text-slate-600 hover:bg-slate-50'}`}>進度查詢</button>
          </nav>
        </aside>

        <main className="w-full md:ml-64 p-4 md:p-8">
          <header className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">{activeTab === 'entry' ? `廠商作業區 : ${vendorName}` : '送件進度追蹤'}</h1>
          </header>

          {activeTab === 'entry' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* 行政資料 */}
              <section className="col-span-1 lg:col-span-4">
                <div className={`${styles.clinicalGlass} rounded-2xl p-5 md:p-8 shadow-sm`}>
                  <div className="flex items-center gap-2 mb-6">
                    <span className={`material-symbols-outlined text-blue-600 ${styles.iconFill}`}>info</span>
                    <h2 className="text-lg font-bold text-slate-800">行政資料</h2>
                  </div>
                  <div className="space-y-4">
                     <div><label className="text-xs font-bold text-slate-500 mb-1 block">裝機日期</label><input type="date" value={metadata.date} onChange={e => setMetadata({...metadata, date: e.target.value})} className={styles.crystalInput} /></div>
                     <div className="grid grid-cols-2 gap-3">
                       <div>
                         <label className="text-xs font-bold text-slate-500 mb-1 block">棟別</label>
                         <select value={metadata.area} onChange={e => setMetadata({...metadata, area: e.target.value})} className={styles.crystalInput}>
                           {buildingOptions.map(v => <option key={v.棟別代碼} value={v.棟別名稱}>{v.棟別名稱}</option>)}
                         </select>
                       </div>
                       <div><label className="text-xs font-bold text-slate-500 mb-1 block">樓層</label><input type="text" value={metadata.floor} onChange={e => setMetadata({...metadata, floor: e.target.value})} placeholder="如: 05F" className={styles.crystalInput} /></div>
                     </div>
                     <div><label className="text-xs font-bold text-slate-500 mb-1 block">單位全稱</label><input type="text" value={metadata.unit} onChange={e => setMetadata({...metadata, unit: e.target.value})} placeholder="如: 醫學影像組" className={styles.crystalInput} /></div>
                     <div><label className="text-xs font-bold text-slate-500 mb-1 block">填報人 (#分機)</label><input type="text" value={metadata.applicant} onChange={e => setMetadata({...metadata, applicant: e.target.value})} placeholder="單位人員#12345" className={styles.crystalInput} /></div>
                  </div>
                </div>
              </section>

              {/* 設備技術參數 */}
              <section className="col-span-1 lg:col-span-8 flex flex-col">
                 <div className={`${styles.clinicalGlass} rounded-2xl p-5 md:p-8 shadow-sm flex flex-col flex-1`}>
                    <div className="flex justify-between items-center mb-6">
                       <h2 className="text-lg font-bold text-slate-800">設備技術參數</h2>
                       <button onClick={() => setDevices([...devices, { type: "桌上型電腦", model: "", sn: "", mac: "", mac2: "", remark: "" }])} className="text-blue-600 font-bold bg-blue-50 px-4 py-2 rounded-lg self-start sm:self-auto">+ 新增設備</button>
                    </div>
                    <div className="overflow-x-auto w-full">
                      <table className={`w-full text-left min-w-[1000px] ${styles.zebraGlass}`}>
                        <thead>
                          <tr className="text-xs text-slate-500 border-b border-slate-200">
                            <th className="pb-3 px-2">類型</th><th className="pb-3 px-2">品牌型號</th><th className="pb-3 px-2">序號 (大寫)</th><th className="pb-3 px-2">主要 MAC</th><th className="pb-3 px-2">無線 MAC</th><th className="pb-3 px-2">備註</th><th className="pb-3 px-2 text-right">操作</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {devices.map((d, i) => (
                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-3 px-2">
                                <select value={d.type} onChange={e => { const nd = [...devices]; nd[i].type = e.target.value; setDevices(nd); }} className="w-full bg-transparent border border-slate-200 rounded p-2 text-sm outline-none font-bold"><option>桌上型電腦</option><option>筆記型電腦</option><option>印表機</option><option>醫療儀器</option><option>其他設備</option></select>
                              </td>
                              <td className="py-3 px-2"><input placeholder="品牌型號" value={d.model} onChange={e => { const nd = [...devices]; nd[i].model = e.target.value; setDevices(nd); }} className="w-full bg-transparent border border-slate-200 rounded p-2 text-sm outline-none" /></td>
                              <td className="py-3 px-2"><input placeholder="SN" value={d.sn} onChange={e => { const nd = [...devices]; nd[i].sn = e.target.value.toUpperCase(); setDevices(nd); }} className="w-full bg-transparent border border-slate-200 rounded p-2 text-sm font-mono text-red-600 outline-none font-bold" /></td>
                              <td className="py-3 px-2"><input placeholder="MAC" value={d.mac} onChange={e => handleMacInput(i, e.target.value, "mac")} className="w-full bg-transparent border border-slate-200 rounded p-2 text-sm font-mono text-blue-600 outline-none font-bold" /></td>
                              <td className="py-3 px-2"><input placeholder="MAC 2" value={d.mac2} onChange={e => handleMacInput(i, e.target.value, "mac2")} className="w-full bg-transparent border border-slate-200 rounded p-2 text-sm font-mono text-slate-500 outline-none" /></td>
                              <td className="py-3 px-2"><input placeholder="備註" value={d.remark} onChange={e => { const nd = [...devices]; nd[i].remark = e.target.value; setDevices(nd); }} className="w-full bg-transparent border border-slate-200 rounded p-2 text-sm outline-none" /></td>
                              <td className="py-3 px-2 text-right">{devices.length > 1 && <button onClick={() => setDevices(devices.filter((_, idx) => idx !== i))} className="text-red-500 p-2"><span className="material-symbols-outlined text-sm">delete</span></button>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button onClick={handleSubmit} disabled={isLoading} className="mt-6 w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-md hover:bg-blue-700 active:scale-95 transition-all">提交預約核准</button>
                 </div>
              </section>
            </div>
          )}

          {activeTab === 'progress' && (
             <div className={`${styles.clinicalGlass} rounded-2xl p-5 md:p-8 shadow-sm flex flex-col min-h-[500px]`}>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-bold text-slate-800">審核中案件 ({pendingRecords.length})</h2>
                  <button onClick={() => fetchPendingRecords(vendorName)} className="text-xs font-bold text-slate-500 flex items-center gap-1 hover:text-blue-600 transition-colors"><span className="material-symbols-outlined text-sm">sync</span> 重新整理</button>
                </div>
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left min-w-[800px]">
                    <thead><tr className="text-xs text-slate-500 border-b border-slate-200"><th className="pb-3 px-2">序號</th><th className="pb-3 px-2">單位 / 棟別</th><th className="pb-3 px-2">設備規格</th><th className="pb-3 px-2">狀態</th><th className="pb-3 px-2 text-right">操作</th></tr></thead>
                    <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                      {pendingRecords.map((record, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-3 font-mono text-xs text-slate-400">{record.產品序號}</td>
                          <td className="p-3"><p className="font-bold">{record.使用單位}</p><p className="text-xs text-slate-500">{record.棟別} | {record.樓層}</p></td>
                          <td className="p-3"><p className="font-bold">{record.設備類型}</p><p className="text-xs font-mono text-blue-600">主要 MAC: {record.主要mac}</p></td>
                          <td className="p-3"><span className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded">{record.狀態}</span></td>
                          <td className="p-3 text-right"><button onClick={() => handleDeletePending(record.產品序號)} className="text-xs px-3 py-1.5 border border-slate-200 text-red-500 rounded hover:bg-red-50 transition-colors">撤回</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
             </div>
          )}
        </main>
      </div>

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

```
