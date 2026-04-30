"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { checkIpConflict, submitInternalIssue } from "@/lib/actions/assets";

import styles from "./internal.module.css";

/**
 * ==========================================
 * 檔案：src/app/internal/page.tsx
 * 狀態：V300.46 姓名分機獨立顯示版
 * ==========================================
 */

export default function InternalPage() {
  const router = useRouter();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loaderText, setLoaderText] = useState("系統初始化...");
  const [buildingOptions, setBuildings] = useState<any[]>([]);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" }[]>([]);

  // 🚀 獨立分開的表單欄位
  const [formData, setFormData] = useState({ 
    date: new Date().toISOString().split("T")[0], 
    area: "", floor: "", unit: "", applicantName: "", applicantExt: "", 
    type: "桌上型電腦", model: "", sn: "", ip: "", remark: "" 
  });
  
  const [ipConflict, setIpConflict] = useState<string | null>(null);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const fetchBuildings = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("buildings").select("*").eq("是否啟用", true).order("排序權重", { ascending: true });
      if (error) throw error;
      if (data) {
        setBuildings(data);
        if (data.length > 0 && !formData.area) setFormData(prev => ({ ...prev, area: data[0].棟別名稱 }));
      }
    } catch (err) { console.error("棟別資料同步異常"); }
  }, [formData.area]);

  useEffect(() => { 
    const isAuth = sessionStorage.getItem("asset_link_admin_auth");
    if (isAuth !== "true") { router.push("/"); return; }
    
    setIsLoading(true);
    fetchBuildings().then(() => { setIsLoading(false); setLoaderText("資料準備就緒"); });
  }, [router, fetchBuildings]);

  const handleIpBlur = async () => {
    if (!formData.ip) { setIpConflict(null); return; }
    const isConflicted = await checkIpConflict(formData.ip);
    setIpConflict(isConflicted ? `注意：IP ${formData.ip} 於資料庫中已存在紀錄` : null);
  };

  const handleFastIssue = async () => {
    if (!formData.unit || !formData.sn || !formData.ip || !formData.area || !formData.applicantName) {
      showToast("請填寫完整的行政與技術欄位資訊", "error"); return;
    }
    
    setIsLoading(true);
    setLoaderText("執行資料同步...");
    
    try {
      await submitInternalIssue({
        ip: formData.ip, mac1: "", sn: formData.sn.toUpperCase(), deviceName: formData.sn.toUpperCase(),
        deviceType: formData.type, model: formData.model || "未提供", area: formData.area, floor: formData.floor,
        unit: formData.unit, applicantName: formData.applicantName.trim(), applicantExt: formData.applicantExt.trim(), remark: formData.remark
      });
      
      showToast("資產已成功直通入庫並完成歸檔", "success");
      setFormData(prev => ({ ...prev, sn: "", ip: "", model: "", remark: "" }));
      setIpConflict(null);
    } catch (err) {
      showToast("系統寫入失敗，請檢查網路連線", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen text-slate-800 font-body-md antialiased flex relative overflow-hidden ${styles.clinicalBg}`}>
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      {isMobileMenuOpen && <div className="fixed inset-0 bg-sky-900/20 backdrop-blur-sm z-[45] md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>}

      <aside className={`w-64 fixed left-0 top-0 h-screen border-r border-white/40 ${styles.clinicalGlass} flex flex-col p-6 z-50 transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
          <div className="flex items-center gap-3 mb-10 px-2">
             <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg"><span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1, 'wght' 400" }}>lan</span></div>
             <h2 className="text-xl font-black text-sky-900 tracking-tighter uppercase">ALink 總控台</h2>
          </div>
          <nav className="flex-1 space-y-2">
              <button onClick={() => router.push("/admin")} className="w-full text-left p-4 rounded-2xl font-bold text-slate-600 hover:bg-white/60 flex items-center gap-3 transition-all"><span className="material-symbols-outlined text-base">dashboard</span> 儀表板首頁</button>
              <button onClick={() => router.push("/pending")} className="w-full text-left p-4 rounded-2xl font-bold text-slate-600 hover:bg-white/60 flex items-center gap-3 transition-all"><span className="material-symbols-outlined text-base">assignment_turned_in</span> 行政審核</button>
              <button onClick={() => router.push("/nsr")} className="w-full text-left p-4 rounded-2xl font-bold text-slate-600 hover:bg-white/60 flex items-center gap-3 transition-all"><span className="material-symbols-outlined text-base">account_balance_wallet</span> 網點計價結算</button>
              <button className="w-full text-left p-4 rounded-2xl font-bold bg-blue-600 text-white shadow-md flex items-center gap-3 transition-all"><span className="material-symbols-outlined text-base">bolt</span> 內部直通入庫</button>
          </nav>
          <div className="mt-auto pt-6 border-t border-slate-200/50"><button onClick={() => router.push("/")} className="w-full flex items-center gap-3 p-4 text-slate-400 font-bold hover:text-red-600 transition-colors"><span className="material-symbols-outlined text-base">logout</span> 登出系統</button></div>
      </aside>
      
      <main className="w-full md:ml-64 p-4 md:p-8 flex-1 flex flex-col max-w-[1300px] mx-auto">
         <header className="mb-10 flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-sky-800 p-1"><span className="material-symbols-outlined">menu</span></button>
            <div><h1 className="text-3xl font-black text-slate-900 tracking-tight">內部快速直通入庫系統</h1><p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Internal Direct Asset-Sync Portal</p></div>
         </header>

         <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className={`${styles.clinicalGlass} col-span-1 lg:col-span-7 p-6 md:p-10 rounded-[2.5rem] shadow-sm animate-in zoom-in-95 duration-500`}>
               <div className="flex items-center gap-3 mb-10 border-b border-slate-100 pb-6"><span className="material-symbols-outlined text-blue-600">domain_verification</span><h4 className="font-black text-lg text-slate-800">行政與設備基礎資訊</h4></div>
               <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">所屬棟別</label><select value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})} className={styles.crystalInput}>{buildingOptions.map(b => <option key={b.棟別代碼} value={b.棟別名稱}>{b.棟別名稱}</option>)}</select></div>
                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">單位全稱</label><input value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className={styles.crystalInput} placeholder="如: 資訊組" /></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">樓層</label><input value={formData.floor} onChange={e => setFormData({...formData, floor: e.target.value.toUpperCase()})} className={styles.crystalInput} placeholder="如: 12F" /></div>
                    <div className="grid grid-cols-2 gap-3">
                       {/* 🚀 分離姓名與分機 */}
                       <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">聯絡人</label><input value={formData.applicantName} onChange={e => setFormData({...formData, applicantName: e.target.value})} className={styles.crystalInput} placeholder="姓名" /></div>
                       <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">分機</label><input value={formData.applicantExt} onChange={e => setFormData({...formData, applicantExt: e.target.value})} className={styles.crystalInput} placeholder="號碼" /></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">產品序號 (S/N)</label><input value={formData.sn} onChange={e => setFormData({...formData, sn: e.target.value.toUpperCase()})} className={`${styles.crystalInput} font-mono`} placeholder="設備實體序號" /></div>
                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">品牌型號</label><input value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} className={styles.crystalInput} placeholder="如: ASUS D700" /></div>
                  </div>
                  <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">設備備註說明</label><textarea value={formData.remark} onChange={e => setFormData({...formData, remark: e.target.value})} className={`${styles.crystalInput} min-h-[120px] resize-none`} placeholder="請註記特殊配置或安裝細節..." /></div>
               </div>
            </div>

            <div className="col-span-1 lg:col-span-5 flex flex-col gap-8 animate-in slide-in-from-right-4 duration-700">
              <div className={`${styles.clinicalGlass} p-6 md:p-10 rounded-[2.5rem] shadow-sm flex-1 flex flex-col`}>
                 <div className="flex items-center gap-3 mb-10 border-b border-slate-100 pb-6"><span className="material-symbols-outlined text-emerald-600 font-bold">router</span><h4 className="font-black text-lg text-slate-800">網路分配參數</h4></div>
                 <div className="space-y-8 flex-1">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">核定 IP 地址</label>
                      <input value={formData.ip} onChange={e => setFormData({...formData, ip: e.target.value})} onBlur={handleIpBlur} className={`${styles.crystalInput} font-mono text-xl text-blue-600 font-black tracking-tight`} placeholder="10.XXX.X.X" />
                      {ipConflict && <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2"><span className="material-symbols-outlined text-red-500 text-sm">warning</span><p className="text-[10px] font-black text-red-600 uppercase animate-pulse">{ipConflict}</p></div>}
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">設備類型</label>
                      <div className="grid grid-cols-2 gap-3">
                         {["桌上型電腦", "筆記型電腦", "印表機", "醫療儀器", "伺服器", "其他"].map(t => <button key={t} onClick={() => setFormData({...formData, type: t})} className={`py-3 px-2 rounded-xl text-xs font-black transition-all border ${formData.type === t ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}>{t}</button>)}
                      </div>
                    </div>
                 </div>
                 <div className="mt-12 pt-8 border-t border-slate-100">
                    <button onClick={handleFastIssue} disabled={isLoading || !!ipConflict} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl shadow-blue-900/30 hover:bg-blue-500 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-3">
                      {isLoading ? <> <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> <span>資料同步中</span> </> : <> <span className="material-symbols-outlined">verified_user</span> <span>確認並直通入庫</span> </>}
                    </button>
                    <p className="text-center text-[9px] font-bold text-slate-400 mt-4 uppercase tracking-tighter">此動作將直接將資料寫入結案資料庫，請謹慎操作</p>
                 </div>
              </div>
            </div>
         </div>
      </main>

      {isLoading && <div className={styles.loaderOverlay}><div className={styles.spinner}></div><p className="text-blue-600 font-black tracking-[0.4em] text-[10px] uppercase mt-6 animate-pulse">{loaderText}</p></div>}
      <div className="fixed bottom-10 right-8 z-[9000] flex flex-col gap-4">{toasts.map(t => <div key={t.id} className={styles.toastBase}><span className={`material-symbols-outlined text-base ${t.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>{t.type === 'success' ? 'check_circle' : 'error'}</span> <span className="tracking-wide">{t.msg}</span></div>)}</div>
    </div>
  );
}