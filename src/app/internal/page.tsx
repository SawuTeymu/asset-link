"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { submitInternalIssue } from "@/lib/actions/assets";
import styles from "./internal.module.css";

/**
 * ==========================================
 * 檔案：src/app/internal/page.tsx
 * 狀態：V400.1 內部直通入庫 (自動化防呆升級版)
 * 職責：
 * 1. 提供資訊中心直接錄入免廠商審核之急件或內部設備。
 * 2. 🚀 防呆規則：樓層自動補零加F (5 -> 05F)、SN 留空自動產生 (INT-日期-亂碼)。
 * 3. 🚀 MAC 自動格式化與轉大寫。
 * 4. 完美對齊全站高階卡片 RWD 視覺與側邊欄。
 * ==========================================
 */

export default function InternalPage() {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [buildingOptions, setBuildings] = useState<any[]>([]);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" | "info" }[]>([]);

  // 表單資料狀態
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    area: "",
    floor: "",
    unit: "",
    applicantName: "",
    applicantExt: "",
    deviceType: "桌上型電腦",
    model: "",
    sn: "",
    mac1: "",
    ip: "",
    deviceName: "",
    remark: ""
  });

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
        if (data.length > 0 && !form.area) setForm(prev => ({ ...prev, area: data[0].棟別名稱 }));
      }
    } catch (err) { console.error("棟別同步異常"); }
  }, [form.area]);

  useEffect(() => {
    const isAuth = sessionStorage.getItem("asset_link_admin_auth");
    if (isAuth !== "true") { router.push("/"); return; }
    fetchBuildings();
  }, [router, fetchBuildings]);

  // 🚀 樓層格式化邏輯 (5 -> 05F, 5f -> 05F, 12 -> 12F)
  const formatFloor = (val: string) => {
    let f = val.trim().toUpperCase();
    if (/^\d$/.test(f)) return `0${f}F`;       // 輸入 "5" -> "05F"
    if (/^\dF$/.test(f)) return `0${f}`;       // 輸入 "5F" -> "05F"
    if (/^\d{2}$/.test(f)) return `${f}F`;     // 輸入 "12" -> "12F"
    return f;                                  // "B1", "G" 等維持原樣
  };

  const handleFloorBlur = () => {
    setForm(prev => ({ ...prev, floor: formatFloor(prev.floor) }));
  };

  // 🚀 MAC 地址自動格式化
  const handleMacInput = (val: string) => {
    let macStr = val.toUpperCase().replace(/[^A-F0-9]/g, "");
    if (macStr.length > 12) macStr = macStr.substring(0, 12);
    const parts = macStr.match(/.{1,2}/g);
    setForm(prev => ({ ...prev, mac1: parts ? parts.join(":") : macStr }));
  };

  // 送出表單
  const handleSubmit = async () => {
    if (isLoading) return;
    if (!form.area || !form.unit || !form.applicantName) { 
      showToast("請完整填寫行政基本資料 (包含單位與聯絡人)", "error"); 
      return; 
    }
    if (!form.ip) {
      showToast("內部直通入庫必須填寫核定 IP", "error"); 
      return; 
    }

    setIsLoading(true);
    try {
      // 🚀 再次確保樓層被正確格式化
      const finalFloor = formatFloor(form.floor);

      // 🚀 自動產生 SN 邏輯 (INT = Internal)
      let finalSn = form.sn.trim().toUpperCase();
      if (!finalSn) {
        const randomHex = Math.floor(Math.random() * 16777215).toString(16).toUpperCase().padStart(6, '0');
        const dateStr = form.date.replace(/-/g, '');
        finalSn = `INT-${dateStr}-${randomHex}`;
      }

      const payload = {
        date: form.date,
        area: form.area,
        floor: finalFloor,
        unit: form.unit,
        applicantName: form.applicantName.trim(),
        applicantExt: form.applicantExt.trim(),
        deviceType: form.deviceType,
        model: form.model.trim() || "未提供",
        sn: finalSn,
        mac1: form.mac1,
        ip: form.ip.trim(),
        deviceName: form.deviceName.trim().toUpperCase(),
        remark: form.remark.trim()
      };

      await submitInternalIssue(payload);

      showToast(`直通入庫成功！序號 [${finalSn}] 已歸檔`, "success");
      
      // 清空設備相關欄位，保留行政單位方便連續輸入
      setForm(prev => ({
        ...prev,
        model: "",
        sn: "",
        mac1: "",
        ip: "",
        deviceName: "",
        remark: ""
      }));
      
    } catch (err: any) {
      console.error("入庫失敗", err);
      showToast(`寫入失敗: ${err.message}`, "error");
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

      {/* --- 側邊選單 --- */}
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
              
              <button onClick={() => router.push("/nsr")} className="w-full text-left p-4 rounded-2xl font-bold text-slate-600 hover:bg-white/60 flex items-center gap-3 transition-all">
                <span className="material-symbols-outlined text-sm">edit_document</span> NSR 網點系統
              </button>
              
              <div className="my-4 border-t border-slate-200/50"></div>
              
              <button className="w-full text-left p-4 rounded-2xl font-bold bg-blue-600 text-white shadow-md flex items-center gap-3 transition-all">
                <span className={`material-symbols-outlined text-base ${styles.iconFill}`}>bolt</span> 內部直通入庫
              </button>
          </nav>
          <div className="mt-auto pt-6 border-t border-slate-200/50">
            <button onClick={handleLogout} className="w-full flex items-center gap-3 p-4 text-slate-400 font-bold hover:text-red-600 transition-colors"><span className="material-symbols-outlined text-base">logout</span> 登出系統</button>
          </div>
      </aside>

      {/* --- 主要內容區 --- */}
      <main className="w-full md:ml-64 flex-1 flex flex-col min-h-screen p-4 md:p-8">
        <div className="animate-in fade-in zoom-in-95 duration-300">
            <header className="mb-10 mt-12 md:mt-0">
              <div className="flex items-center gap-3">
                <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-sky-800 p-1 -ml-2"><span className="material-symbols-outlined">menu</span></button>
                <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">內部直通入庫</h1>
              </div>
              <p className="text-xs md:text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest pl-10 md:pl-0">Internal Direct Asset Registry</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* --- 區塊 1：行政資料 --- */}
              <section className="col-span-1 lg:col-span-4">
                <div className={`${styles.clinicalGlass} rounded-3xl p-6 md:p-8 shadow-sm`}>
                  <div className="flex items-center gap-2 mb-8 border-b border-slate-100 pb-4">
                    <span className={`material-symbols-outlined text-blue-600 ${styles.iconFill}`}>info</span>
                    <h2 className="text-lg font-bold text-slate-800 tracking-tight">行政基本資料</h2>
                  </div>
                  <div className="space-y-5">
                     <div>
                       <label className={styles.inputLabel}>結案日期</label>
                       <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className={styles.crystalInput} />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                       <div>
                         <label className={styles.inputLabel}>所屬棟別</label>
                         <select value={form.area} onChange={e => setForm({...form, area: e.target.value})} className={styles.crystalInput}>
                           {buildingOptions.map(v => <option key={v.棟別代碼} value={v.棟別名稱}>{v.棟別名稱}</option>)}
                         </select>
                       </div>
                       <div>
                         <label className={styles.inputLabel}>樓層</label>
                         <input 
                           type="text" 
                           value={form.floor} 
                           onChange={e => setForm({...form, floor: e.target.value})} 
                           onBlur={handleFloorBlur}
                           placeholder="輸入 5 會自動變 05F" 
                           className={styles.crystalInput} 
                         />
                       </div>
                     </div>
                     <div>
                       <label className={styles.inputLabel}>使用單位</label>
                       <input type="text" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} placeholder="如: 資訊組" className={styles.crystalInput} />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                       <div>
                         <label className={styles.inputLabel}>保管人姓名</label>
                         <input type="text" value={form.applicantName} onChange={e => setForm({...form, applicantName: e.target.value})} placeholder="如: 王小明" className={styles.crystalInput} />
                       </div>
                       <div>
                         <label className={styles.inputLabel}>分機號碼</label>
                         <input type="text" value={form.applicantExt} onChange={e => setForm({...form, applicantExt: e.target.value})} placeholder="如: 1234" className={styles.crystalInput} />
                       </div>
                     </div>
                  </div>
                </div>
              </section>

              {/* --- 區塊 2：設備參數 --- */}
              <section className="col-span-1 lg:col-span-8 flex flex-col">
                 <div className={`${styles.clinicalGlass} rounded-3xl p-6 md:p-8 shadow-sm flex flex-col flex-1`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-slate-100 pb-4">
                       <div className="flex items-center gap-2">
                         <span className={`material-symbols-outlined text-emerald-600 ${styles.iconFill}`}>dns</span>
                         <h2 className="text-lg font-bold text-slate-800 tracking-tight">網路與設備參數</h2>
                       </div>
                    </div>
                    
                    <div className="flex flex-col gap-5 w-full">
                      <div className={styles.deviceItemBlock}>
                        <div className={styles.rowGrid}>
                          <div>
                            <label className={styles.inputLabel}>設備類型</label>
                            <select value={form.deviceType} onChange={e => setForm({...form, deviceType: e.target.value})} className={styles.crystalInput}>
                              <option>桌上型電腦</option>
                              <option>筆記型電腦</option>
                              <option>印表機</option>
                              <option>醫療儀器</option>
                              <option>其他設備</option>
                            </select>
                          </div>
                          <div>
                            <label className={styles.inputLabel}>品牌型號</label>
                            <input placeholder="如: ASUS M800" value={form.model} onChange={e => setForm({...form, model: e.target.value})} className={styles.crystalInput} />
                          </div>
                          <div>
                            <label className={styles.inputLabel}>產品序號 (S/N)</label>
                            <input 
                              placeholder="留空將自動產生 (INT-...)" 
                              value={form.sn} 
                              onChange={e => setForm({...form, sn: e.target.value.toUpperCase()})} 
                              className={`${styles.crystalInput} font-mono text-red-600`} 
                            />
                          </div>
                        </div>

                        <div className={styles.rowGrid}>
                          <div>
                            <label className={styles.inputLabel}>指定 IP</label>
                            <input 
                              placeholder="10.x.x.x" 
                              value={form.ip} 
                              onChange={e => setForm({...form, ip: e.target.value})} 
                              className={`${styles.crystalInput} font-mono text-emerald-600`} 
                            />
                          </div>
                          <div>
                            <label className={styles.inputLabel}>有線 MAC</label>
                            <input 
                              placeholder="XX:XX:XX..." 
                              value={form.mac1} 
                              onChange={e => handleMacInput(e.target.value)} 
                              className={`${styles.crystalInput} font-mono text-blue-600`} 
                            />
                          </div>
                          <div>
                            <label className={styles.inputLabel}>設備網域名稱 (Device Name)</label>
                            <input 
                              placeholder="如: PC-ADMIN" 
                              value={form.deviceName} 
                              onChange={e => setForm({...form, deviceName: e.target.value.toUpperCase()})} 
                              className={styles.crystalInput} 
                            />
                          </div>
                        </div>

                        <div>
                          <label className={styles.inputLabel}>行政備註</label>
                          <input 
                            placeholder="請簡述直通原因..." 
                            value={form.remark} 
                            onChange={e => setForm({...form, remark: e.target.value})} 
                            className={styles.crystalInput} 
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-100">
                       <button onClick={handleSubmit} disabled={isLoading} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-[0.3em] text-sm shadow-xl shadow-blue-900/20 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3">
                         {isLoading ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div><span>處理中...</span></> : <span>強制結案歸檔</span>}
                       </button>
                    </div>
                 </div>
              </section>
            </div>
        </div>
      </main>

      {/* --- 全局 Loading --- */}
      {isLoading && (
        <div className={styles.loaderOverlay}>
          <div className={styles.spinner}></div>
          <p className="text-blue-600 font-black text-[10px] uppercase mt-6 tracking-[0.5em] animate-pulse">系統處理中...</p>
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