"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { submitInternalBatch, checkIpConflict } from "@/lib/actions/assets";
import styles from "./internal.module.css";

/**
 * ==========================================
 * 檔案：src/app/internal/page.tsx
 * 狀態：V2.0 內部直通批次防呆升級版
 * 職責：
 * 1. 支援多節點設備同時錄入 (比照 Keyin 體驗)。
 * 2. 樓層欄位防呆：失去焦點時自動補 0 與 F (例如 '5' 變 '05F')。
 * 3. 自動 SN：留空時自動產生 AUTO 序號。
 * 4. 強制 C01：必須輸入以 C01 開頭的結案表單號。
 * ==========================================
 */

interface DeviceState {
  deviceType: string;
  model: string;
  sn: string;
  mac1: string;
  ip: string;
  deviceName: string;
  remark: string;
}

export default function InternalEntryPage() {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [buildingOptions, setBuildings] = useState<any[]>([]);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" | "info" }[]>([]);

  // 🚀 行政資料擴充 C01 表單號
  const [metadata, setMetadata] = useState({ 
    c01FormId: "", 
    date: new Date().toISOString().split("T")[0], 
    area: "", 
    floor: "", 
    unit: "", 
    applicantName: "", 
    applicantExt: "" 
  });

  // 🚀 設備清單改為陣列支援批次
  const [devices, setDevices] = useState<DeviceState[]>([{ 
    deviceType: "桌上型電腦", model: "", sn: "", mac1: "", ip: "", deviceName: "", remark: "" 
  }]);

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

  useEffect(() => {
    const isAuth = sessionStorage.getItem("asset_link_admin_auth");
    if (isAuth !== "true") { router.push("/"); return; }
    fetchBuildings();
  }, [router, fetchBuildings]);

  // 🚀 樓層自動補齊邏輯
  const handleFloorBlur = () => {
    let val = metadata.floor.trim().toUpperCase().replace(/\s+/g, '');
    if (!val) return;

    // 單純數字自動補 0 與 F (例如 5 -> 05F, 12 -> 12F)
    if (/^\d+$/.test(val)) {
      setMetadata({ ...metadata, floor: val.padStart(2, '0') + 'F' });
      return;
    }
    // 已有 F 但缺 0 (例如 5F -> 05F)
    if (/^\d+F$/.test(val)) {
      setMetadata({ ...metadata, floor: val.replace(/\d+/, m => m.padStart(2, '0')) });
      return;
    }
    // B開頭數字 (例如 B1 -> B1F)
    if (/^B\d+$/.test(val)) {
      setMetadata({ ...metadata, floor: val + 'F' });
      return;
    }
    setMetadata({ ...metadata, floor: val });
  };

  const handleMacInput = (index: number, val: string) => {
    let macStr = val.toUpperCase().replace(/[^A-F0-9]/g, "");
    if (macStr.length > 12) macStr = macStr.substring(0, 12);
    const parts = macStr.match(/.{1,2}/g);
    const newDevices = [...devices];
    newDevices[index].mac1 = parts ? parts.join(":") : macStr;
    setDevices(newDevices);
  };

  // 🚀 批次提交與防呆驗證
  const handleSubmit = async () => {
    if (isLoading) return;
    
    // 檢查 C01 表單號
    const formId = metadata.c01FormId.trim().toUpperCase();
    if (!formId || !formId.startsWith("C01")) {
      showToast("表單號必須以 C01 開頭", "error");
      return;
    }

    if (!metadata.area || !metadata.unit || !metadata.applicantName) {
      showToast("請完整填寫行政基本資料", "error");
      return;
    }

    // 檢查設備必填欄位 (IP, 名稱)
    for (let i = 0; i < devices.length; i++) {
      if (!devices[i].ip || !devices[i].deviceName) {
        showToast(`第 ${i + 1} 項設備：請確保核定 IP 與設備名稱皆已填寫`, "error");
        return;
      }
    }

    setIsLoading(true);
    try {
      // IP 衝突雙重確認
      for (const d of devices) {
        const isConflict = await checkIpConflict(d.ip);
        if (isConflict && !confirm(`注意：IP [${d.ip}] 在系統中已有紀錄，是否確定要強制覆寫入庫？`)) {
          setIsLoading(false);
          return;
        }
      }

      // 🚀 動態生成 SN
      const payload = devices.map(d => {
        let finalSn = d.sn.trim().toUpperCase();
        if (!finalSn) {
          const randomHex = Math.floor(Math.random() * 16777215).toString(16).toUpperCase().padStart(6, '0');
          finalSn = `AUTO-${metadata.date.replace(/-/g, '')}-${randomHex}`;
        }

        return {
          formId: formId,
          date: metadata.date,
          area: metadata.area,
          floor: metadata.floor,
          unit: metadata.unit,
          applicantName: metadata.applicantName.trim(),
          applicantExt: metadata.applicantExt.trim(),
          deviceType: d.deviceType,
          model: d.model,
          sn: finalSn,
          mac1: d.mac1,
          ip: d.ip.trim(),
          deviceName: d.deviceName.trim().toUpperCase(),
          remark: d.remark
        };
      });

      const res = await submitInternalBatch(payload);
      
      if (res.success) {
        showToast(`成功批次直通入庫 ${payload.length} 筆設備！`, "success");
        // 初始化重置
        setMetadata({ c01FormId: "", date: new Date().toISOString().split("T")[0], area: buildingOptions[0]?.棟別名稱 || "", floor: "", unit: "", applicantName: "", applicantExt: "" });
        setDevices([{ deviceType: "桌上型電腦", model: "", sn: "", mac1: "", ip: "", deviceName: "", remark: "" }]);
      }
    } catch (err: any) {
      showToast(err.message, "error");
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
              <button onClick={() => router.push("/nsr")} className="w-full text-left p-4 rounded-2xl font-bold text-slate-600 hover:bg-white/60 flex items-center gap-3 transition-all"><span className="material-symbols-outlined text-base">account_balance_wallet</span> 網點計價結算</button>
              <button className="w-full text-left p-4 rounded-2xl font-bold bg-blue-600 text-white shadow-md flex items-center gap-3 transition-all"><span className="material-symbols-outlined text-base">bolt</span> 內部直通入庫</button>
          </nav>
          <div className="mt-auto pt-6 border-t border-slate-200/50">
            <button onClick={handleLogout} className="w-full flex items-center gap-3 p-4 text-slate-400 font-bold hover:text-red-600 transition-colors"><span className="material-symbols-outlined text-base">logout</span> 登出系統</button>
          </div>
      </aside>

      <main className="w-full md:ml-64 flex-1 flex flex-col p-4 md:p-8 animate-in fade-in duration-500">
        <header className="mb-10 mt-12 md:mt-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-sky-800 p-1 -ml-2"><span className="material-symbols-outlined">menu</span></button>
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">內部直通結案入庫</h1>
          </div>
          <p className="text-xs md:text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest pl-10 md:pl-0">Internal Direct Archiving</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
           {/* 左側：行政表單 */}
           <section className="col-span-1 lg:col-span-4">
              <div className={`${styles.clinicalGlass} rounded-3xl p-6 md:p-8 shadow-sm`}>
                <div className="flex items-center gap-2 mb-8 border-b border-slate-100 pb-4">
                  <span className={`material-symbols-outlined text-purple-600 ${styles.iconFill}`}>bolt</span>
                  <h2 className="text-lg font-bold text-slate-800 tracking-tight">歸檔行政依據</h2>
                </div>
                <div className="space-y-5">
                   <div>
                     <label className={styles.inputLabel}>結案表單號 (強制 C01 開頭)</label>
                     <input type="text" placeholder="如: C01202603200049" value={metadata.c01FormId} onChange={e => setMetadata({...metadata, c01FormId: e.target.value.toUpperCase()})} className={`${styles.crystalInput} border-purple-300 font-mono`} />
                   </div>
                   <div><label className={styles.inputLabel}>入庫/裝機日期</label><input type="date" value={metadata.date} onChange={e => setMetadata({...metadata, date: e.target.value})} className={styles.crystalInput} /></div>
                   <div className="grid grid-cols-2 gap-4">
                     <div><label className={styles.inputLabel}>部署棟別</label><select value={metadata.area} onChange={e => setMetadata({...metadata, area: e.target.value})} className={styles.crystalInput}>{buildingOptions.map(v => <option key={v.棟別代碼} value={v.棟別名稱}>{v.棟別名稱}</option>)}</select></div>
                     <div><label className={styles.inputLabel}>樓層</label><input type="text" value={metadata.floor} onChange={e => setMetadata({...metadata, floor: e.target.value})} onBlur={handleFloorBlur} placeholder="如: 5" className={styles.crystalInput} /></div>
                   </div>
                   <div><label className={styles.inputLabel}>使用單位</label><input type="text" value={metadata.unit} onChange={e => setMetadata({...metadata, unit: e.target.value})} placeholder="單位全稱" className={styles.crystalInput} /></div>
                   <div className="grid grid-cols-2 gap-4">
                     <div><label className={styles.inputLabel}>聯絡人姓名</label><input type="text" value={metadata.applicantName} onChange={e => setMetadata({...metadata, applicantName: e.target.value})} placeholder="姓名" className={styles.crystalInput} /></div>
                     <div><label className={styles.inputLabel}>分機號碼</label><input type="text" value={metadata.applicantExt} onChange={e => setMetadata({...metadata, applicantExt: e.target.value})} placeholder="分機" className={styles.crystalInput} /></div>
                   </div>
                </div>
              </div>
           </section>

           {/* 右側：批次設備表單 */}
           <section className="col-span-1 lg:col-span-8 flex flex-col">
              <div className={`${styles.clinicalGlass} rounded-3xl p-6 md:p-8 shadow-sm flex flex-col flex-1`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-slate-100 pb-4">
                   <div className="flex items-center gap-2"><span className={`material-symbols-outlined text-blue-600 ${styles.iconFill}`}>dns</span><h2 className="text-lg font-bold text-slate-800 tracking-tight">入庫設備節點清單</h2></div>
                   <button onClick={() => setDevices([...devices, { deviceType: "桌上型電腦", model: "", sn: "", mac1: "", ip: "", deviceName: "", remark: "" }])} className="text-purple-600 font-black text-[10px] uppercase tracking-[0.2em] bg-purple-50 px-5 py-2.5 rounded-xl hover:bg-purple-100 transition-all border border-purple-100 shadow-sm">+ 新增設備</button>
                </div>

                <div className="flex flex-col gap-5 w-full">
                  {devices.map((d, i) => (
                    <div key={i} className={styles.deviceItemBlock}>
                      <div className={styles.rowGrid}>
                        <div><label className={styles.inputLabel}>設備類型</label><select value={d.deviceType} onChange={e => { const nd = [...devices]; nd[i].deviceType = e.target.value; setDevices(nd); }} className={styles.crystalInput}><option>桌上型電腦</option><option>筆記型電腦</option><option>印表機</option><option>醫療儀器</option><option>其他設備</option></select></div>
                        <div><label className={styles.inputLabel}>品牌型號</label><input placeholder="品牌型號" value={d.model} onChange={e => { const nd = [...devices]; nd[i].model = e.target.value; setDevices(nd); }} className={styles.crystalInput} /></div>
                        <div><label className={styles.inputLabel}>產品序號 (留空自動補)</label><input placeholder="自動產生 AUTO 序號" value={d.sn} onChange={e => { const nd = [...devices]; nd[i].sn = e.target.value.toUpperCase(); setDevices(nd); }} className={`${styles.crystalInput} font-mono text-red-600`} /></div>
                      </div>
                      <div className={styles.rowGrid}>
                        <div><label className={styles.inputLabel}>配置 IP</label><input placeholder="10.x.x.x" value={d.ip} onChange={e => { const nd = [...devices]; nd[i].ip = e.target.value; setDevices(nd); }} className={`${styles.crystalInput} font-mono text-emerald-600 border-emerald-200`} /></div>
                        <div><label className={styles.inputLabel}>設備識別名稱</label><input placeholder="電腦名稱" value={d.deviceName} onChange={e => { const nd = [...devices]; nd[i].deviceName = e.target.value.toUpperCase(); setDevices(nd); }} className={`${styles.crystalInput} font-mono text-blue-600 border-blue-200`} /></div>
                        <div><label className={styles.inputLabel}>MAC 位址</label><input placeholder="有線 MAC" value={d.mac1} onChange={e => handleMacInput(i, e.target.value)} className={`${styles.crystalInput} font-mono`} /></div>
                      </div>
                      <div className="w-full">
                         <label className={styles.inputLabel}>內部直通備註</label><input placeholder="如: 單位緊急擴編配置" value={d.remark} onChange={e => { const nd = [...devices]; nd[i].remark = e.target.value; setDevices(nd); }} className={styles.crystalInput} />
                      </div>
                      {devices.length > 1 && <button onClick={() => setDevices(devices.filter((_, idx) => idx !== i))} className={styles.removeBtn}><span className="material-symbols-outlined text-[14px]">close</span></button>}
                    </div>
                  ))}
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100">
                   <button onClick={handleSubmit} disabled={isLoading} className="w-full py-5 bg-purple-600 text-white rounded-2xl font-black uppercase tracking-[0.3em] text-sm shadow-xl shadow-purple-900/20 hover:bg-purple-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3">
                     {isLoading ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div><span>寫入資料庫中...</span></> : <><span className="material-symbols-outlined">bolt</span>強制直通結案</>}
                   </button>
                </div>
              </div>
           </section>
        </div>
      </main>

      {isLoading && <div className={styles.loaderOverlay}><div className={styles.spinner}></div><p className="text-purple-600 font-black text-[10px] uppercase mt-6 tracking-[0.5em] animate-pulse">系統處理中...</p></div>}
      <div className="fixed bottom-10 right-8 z-[9000] flex flex-col gap-3">{toasts.map(t => <div key={t.id} className={`${styles.toastBase} ${t.type === 'info' ? 'bg-blue-50 text-blue-800 border-blue-200' : ''}`}><span className={`material-symbols-outlined text-sm ${styles.iconFill} ${t.type === 'success' ? 'text-emerald-400' : t.type === 'error' ? 'text-red-400' : 'text-blue-400'}`}>{t.type === 'success' ? 'check_circle' : t.type === 'error' ? 'report' : 'info'}</span><span className="tracking-wide">{t.msg}</span></div>)}</div>
    </div>
  );
}
