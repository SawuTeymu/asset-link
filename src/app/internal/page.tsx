"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { submitInternalBatch, checkIpConflict } from "@/lib/actions/assets";
import styles from "./internal.module.css";

/**
 * ==========================================
 * 檔案：src/app/internal/page.tsx
 * 狀態：V2.2 內部直通批次防呆升級版 (加入舊換新機制)
 * 職責：
 * 1. 🚀 業務規則同步：加入「作業類型」(新機/舊換新) 下拉選單與高亮視覺。
 * 2. 舊機 IP 防呆：若選擇舊換新，強制要求輸入舊機 IP，並自動封裝 [REPLACE] 標籤。
 * 3. 雙 MAC 支援：維持有線與無線 MAC 的輸入功能。
 * 4. 樓層與單號防呆：維持樓層自動補 0 與 F，及強制 C01 表單號。
 * ==========================================
 */

interface DeviceState {
  actionType: "新機" | "舊換新"; // 🚀 新增作業類型
  deviceType: string;
  model: string;
  sn: string;
  mac1: string;
  mac2: string;
  ip: string;
  deviceName: string;
  remark: string;
  oldIp: string; // 🚀 新增舊機 IP 欄位
}

export default function InternalEntryPage() {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [buildingOptions, setBuildings] = useState<any[]>([]);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" | "info" }[]>([]);

  const [metadata, setMetadata] = useState({ 
    c01FormId: "", 
    date: new Date().toISOString().split("T")[0], 
    area: "", 
    floor: "", 
    unit: "", 
    applicantName: "", 
    applicantExt: "" 
  });

  const [devices, setDevices] = useState<DeviceState[]>([{ 
    actionType: "新機", deviceType: "桌上型電腦", model: "", sn: "", mac1: "", mac2: "", ip: "", deviceName: "", remark: "", oldIp: "" 
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

  const handleFloorBlur = () => {
    let val = metadata.floor.trim().toUpperCase().replace(/\s+/g, '');
    if (!val) return;

    if (/^\d+$/.test(val)) {
      setMetadata({ ...metadata, floor: val.padStart(2, '0') + 'F' });
      return;
    }
    if (/^\d+F$/.test(val)) {
      setMetadata({ ...metadata, floor: val.replace(/\d+/, m => m.padStart(2, '0')) });
      return;
    }
    if (/^B\d+$/.test(val)) {
      setMetadata({ ...metadata, floor: val + 'F' });
      return;
    }
    setMetadata({ ...metadata, floor: val });
  };

  const handleMacInput = (index: number, val: string, field: 'mac1' | 'mac2') => {
    let macStr = val.toUpperCase().replace(/[^A-F0-9]/g, "");
    if (macStr.length > 12) macStr = macStr.substring(0, 12);
    const parts = macStr.match(/.{1,2}/g);
    const newDevices = [...devices];
    newDevices[index][field] = parts ? parts.join(":") : macStr;
    setDevices(newDevices);
  };

  const handleSubmit = async () => {
    if (isLoading) return;
    
    const formId = metadata.c01FormId.trim().toUpperCase();
    if (!formId || !formId.startsWith("C01")) {
      showToast("表單號必須以 C01 開頭", "error");
      return;
    }

    if (!metadata.area || !metadata.unit || !metadata.applicantName) {
      showToast("請完整填寫行政基本資料", "error");
      return;
    }

    // 🚀 強制驗證舊機 IP 與必要欄位
    for (let i = 0; i < devices.length; i++) {
      if (devices[i].actionType === "舊換新" && !devices[i].oldIp.trim()) {
        showToast(`第 ${i + 1} 項設備為「舊換新」，請務必填寫欲汰換的舊機 IP`, "error");
        return;
      }
      if (!devices[i].ip || !devices[i].deviceName) {
        showToast(`第 ${i + 1} 項設備：請確保核定 IP 與設備名稱皆已填寫`, "error");
        return;
      }
    }

    setIsLoading(true);
    try {
      for (const d of devices) {
        const isConflict = await checkIpConflict(d.ip);
        if (isConflict && !confirm(`注意：新配置 IP [${d.ip}] 在系統中已有紀錄，是否確定要強制覆寫入庫？`)) {
          setIsLoading(false);
          return;
        }
      }

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
          mac2: d.mac2,
          ip: d.ip.trim(),
          deviceName: d.deviceName.trim().toUpperCase(),
          // 🚀 自動封裝標籤與傳遞舊機 IP
          remark: d.actionType === "舊換新" ? `[REPLACE] 汰換舊機IP: ${d.oldIp.trim()}。${d.remark}` : d.remark,
          old_ip: d.actionType === "舊換新" ? d.oldIp.trim() : undefined
        };
      });

      const res = await submitInternalBatch(payload);
      
      if (res.success) {
        showToast(`成功批次直通入庫 ${payload.length} 筆設備！`, "success");
        setMetadata({ c01FormId: "", date: new Date().toISOString().split("T")[0], area: buildingOptions[0]?.棟別名稱 || "", floor: "", unit: "", applicantName: "", applicantExt: "" });
        setDevices([{ actionType: "新機", deviceType: "桌上型電腦", model: "", sn: "", mac1: "", mac2: "", ip: "", deviceName: "", remark: "", oldIp: "" }]);
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
           <section className="col-span-1 lg:col-span-4">
              <div className={`${styles.clinicalGlass} rounded-3xl p-6 md:p-8 shadow-sm`}>
                <div className="flex items-center gap-2 mb-8 border-b border-slate-100 pb-4">
                  <span className={`material-symbols-outlined text-purple-600 ${styles.iconFill}`}>bolt</span>
                  <h2 className="text-lg font-bold text-slate-800 tracking-tight">歸檔行政依據</h2>
                </div>
                <div className="space-y-5">
                   <div>
                     <label className={styles.inputLabel}>結案表單號 (強制 C01 開頭)</label>
                     <input type="text" value={metadata.c01FormId} onChange={e => setMetadata({...metadata, c01FormId: e.target.value.toUpperCase()})} className={`${styles.crystalInput} border-purple-300 font-mono`} />
                   </div>
                   <div><label className={styles.inputLabel}>入庫/裝機日期</label><input type="date" value={metadata.date} onChange={e => setMetadata({...metadata, date: e.target.value})} className={styles.crystalInput} /></div>
                   <div className="grid grid-cols-2 gap-4">
                     <div><label className={styles.inputLabel}>部署棟別</label><select value={metadata.area} onChange={e => setMetadata({...metadata, area: e.target.value})} className={styles.crystalInput}>{buildingOptions.map(v => <option key={v.棟別代碼} value={v.棟別名稱}>{v.棟別名稱}</option>)}</select></div>
                     <div><label className={styles.inputLabel}>樓層</label><input type="text" value={metadata.floor} onChange={e => setMetadata({...metadata, floor: e.target.value})} onBlur={handleFloorBlur} className={styles.crystalInput} /></div>
                   </div>
                   <div><label className={styles.inputLabel}>使用單位</label><input type="text" value={metadata.unit} onChange={e => setMetadata({...metadata, unit: e.target.value})} className={styles.crystalInput} /></div>
                   <div className="grid grid-cols-2 gap-4">
                     <div><label className={styles.inputLabel}>聯絡人姓名</label><input type="text" value={metadata.applicantName} onChange={e => setMetadata({...metadata, applicantName: e.target.value})} className={styles.crystalInput} /></div>
                     <div><label className={styles.inputLabel}>分機號碼</label><input type="text" value={metadata.applicantExt} onChange={e => setMetadata({...metadata, applicantExt: e.target.value})} className={styles.crystalInput} /></div>
                   </div>
                </div>
              </div>
           </section>

           <section className="col-span-1 lg:col-span-8 flex flex-col">
              <div className={`${styles.clinicalGlass} rounded-3xl p-6 md:p-8 shadow-sm flex flex-col flex-1`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-slate-100 pb-4">
                   <div className="flex items-center gap-2"><span className={`material-symbols-outlined text-blue-600 ${styles.iconFill}`}>dns</span><h2 className="text-lg font-bold text-slate-800 tracking-tight">入庫設備節點清單</h2></div>
                   <button onClick={() => setDevices([...devices, { actionType: "新機", deviceType: "桌上型電腦", model: "", sn: "", mac1: "", mac2: "", ip: "", deviceName: "", remark: "", oldIp: "" }])} className="text-purple-600 font-black text-[10px] uppercase tracking-[0.2em] bg-purple-50 px-5 py-2.5 rounded-xl hover:bg-purple-100 transition-all border border-purple-100 shadow-sm">+ 新增設備</button>
                </div>

                <div className="flex flex-col gap-5 w-full">
                  {devices.map((d, i) => (
                    <div key={i} className={styles.deviceItemBlock}>
                      <div className={styles.rowGrid}>
                        {/* 🚀 加入作業類型，套用廠商端的高亮視覺 */}
                        <div className="col-span-1">
                          <label className={styles.inputLabel}>作業類型</label>
                          <select 
                            value={d.actionType} 
                            onChange={e => { const nd = [...devices]; nd[i].actionType = e.target.value as "新機"|"舊換新"; if (nd[i].actionType === '新機') nd[i].oldIp = ''; setDevices(nd); }} 
                            className={`${styles.crystalInput} text-center tracking-widest text-[14px] font-black transition-all duration-300 ${d.actionType === '舊換新' ? 'bg-rose-100 border-rose-500 text-rose-800 shadow-inner' : 'bg-sky-100 border-sky-500 text-sky-800 shadow-inner'}`}
                          >
                            <option value="新機">新設機台</option>
                            <option value="舊換新">舊換新 (汰換)</option>
                          </select>
                        </div>
                        <div><label className={styles.inputLabel}>設備類型</label><select value={d.deviceType} onChange={e => { const nd = [...devices]; nd[i].deviceType = e.target.value; setDevices(nd); }} className={styles.crystalInput}><option>桌上型電腦</option><option>筆記型電腦</option><option>印表機</option><option>醫療儀器</option><option>其他設備</option></select></div>
                        <div><label className={styles.inputLabel}>品牌型號</label><input value={d.model} onChange={e => { const nd = [...devices]; nd[i].model = e.target.value; setDevices(nd); }} className={styles.crystalInput} /></div>
                      </div>
                      
                      <div className={styles.rowGrid}>
                        <div><label className={styles.inputLabel}>產品序號 (留空自動補)</label><input value={d.sn} onChange={e => { const nd = [...devices]; nd[i].sn = e.target.value.toUpperCase(); setDevices(nd); }} className={`${styles.crystalInput} font-mono text-red-600`} /></div>
                        <div><label className={styles.inputLabel}>有線 MAC</label><input value={d.mac1} onChange={e => handleMacInput(i, e.target.value, 'mac1')} className={`${styles.crystalInput} font-mono`} /></div>
                        <div><label className={styles.inputLabel}>無線 MAC</label><input value={d.mac2} onChange={e => handleMacInput(i, e.target.value, 'mac2')} className={`${styles.crystalInput} font-mono text-slate-400`} /></div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-1">
                         <div><label className={styles.inputLabel}>新配置 IP</label><input value={d.ip} onChange={e => { const nd = [...devices]; nd[i].ip = e.target.value; setDevices(nd); }} className={`${styles.crystalInput} font-mono text-emerald-600 border-emerald-200`} /></div>
                         <div><label className={styles.inputLabel}>設備識別名稱</label><input value={d.deviceName} onChange={e => { const nd = [...devices]; nd[i].deviceName = e.target.value.toUpperCase(); setDevices(nd); }} className={`${styles.crystalInput} font-mono text-blue-600 border-blue-200`} /></div>
                      </div>

                      {/* 🚀 動態展開舊換新專屬必填欄位 */}
                      {d.actionType === '舊換新' && (
                        <div className="w-full bg-red-50 p-4 rounded-xl border border-red-200 mt-1 animate-in fade-in zoom-in-95 duration-200">
                           <label className={`${styles.inputLabel} text-red-800 flex items-center gap-1`}>
                             <span className="material-symbols-outlined text-[14px]">warning</span> 請輸入欲汰換之舊設備 IP (必填)
                           </label>
                           <input placeholder="輸入舊機 IP，系統將於入庫時自動作廢該舊機..." value={d.oldIp} onChange={e => { const nd = [...devices]; nd[i].oldIp = e.target.value.trim(); setDevices(nd); }} className={`${styles.crystalInput} font-mono border-red-300 shadow-inner mt-1`} />
                        </div>
                      )}

                      <div className="w-full mt-1">
                         <label className={styles.inputLabel}>內部直通備註</label>
                         <input value={d.remark} onChange={e => { const nd = [...devices]; nd[i].remark = e.target.value; setDevices(nd); }} className={styles.crystalInput} />
                      </div>

                      {devices.length > 1 && <button onClick={() => setDevices(devices.filter((_, idx) => idx !== i))} className={styles.removeBtn}><span className="material-symbols-outlined text-[14px]">close</span></button>}
                    </div>
                  ))}
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100">
                   <button onClick={handleSubmit} disabled={isLoading} className="w-full py-5 bg-purple-600 text-white rounded-2xl font-black uppercase tracking-[0.3em] text-sm shadow-xl shadow-purple-900/20 hover:bg-purple-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3">
                     {isLoading ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div><span>寫入資料庫中...</span></> : <><span className="material-symbols-outlined">bolt</span>強制直通結案入庫</>}
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