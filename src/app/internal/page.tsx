"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { submitInternalIssue, checkIpConflict } from "@/lib/actions/assets";

/**
 * ==========================================
 * 檔案：src/app/internal/page.tsx
 * 狀態：V400.1 內部直通入庫 (智慧防呆版)
 * 職責：
 * 1. 🚀 強制填寫 C01 表單號。
 * 2. 🚀 樓層自動補零 (5 -> 05F, 5f -> 05F, B1 維持 B1)。
 * 3. 🚀 SN 留空自動產生 (AUTO-YYYYMMDD-HEX)。
 * 4. 介面美學：對齊總控台高質感玻璃擬態。
 * ==========================================
 */

export default function InternalPage() {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [buildingOptions, setBuildings] = useState<any[]>([]);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" | "info" }[]>([]);

  const [formData, setFormData] = useState({
    formId: "", // C01 表單號
    date: new Date().toISOString().split("T")[0],
    area: "",
    floor: "",
    unit: "",
    applicantName: "",
    applicantExt: "",
    deviceType: "桌上型電腦",
    model: "",
    sn: "", // 產品序號
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
        if (data.length > 0 && !formData.area) setFormData(prev => ({ ...prev, area: data[0].棟別名稱 }));
      }
    } catch (err) { console.error("棟別同步異常"); }
  }, [formData.area]);

  useEffect(() => {
    const isAuth = sessionStorage.getItem("asset_link_admin_auth");
    if (isAuth !== "true") { router.push("/"); return; }
    fetchBuildings();
  }, [router, fetchBuildings]);

  // 🚀 樓層防呆：失去焦點時自動補零與加 F
  const handleFloorBlur = () => {
    let v = formData.floor.trim().toUpperCase();
    if (!v) return;
    
    // 如果只有輸入純數字 (例如: 5)
    if (/^\d+$/.test(v)) {
      setFormData(prev => ({ ...prev, floor: v.padStart(2, '0') + 'F' }));
    } 
    // 如果輸入數字加 F (例如: 5F, 12f)
    else {
      const match = v.match(/^(\d+)[F]$/);
      if (match) {
        setFormData(prev => ({ ...prev, floor: match[1].padStart(2, '0') + 'F' }));
      } else {
        // 其餘情況如 B1, B2 維持原樣
        setFormData(prev => ({ ...prev, floor: v }));
      }
    }
  };

  const handleMacInput = (val: string) => {
    let macStr = val.toUpperCase().replace(/[^A-F0-9]/g, "");
    if (macStr.length > 12) macStr = macStr.substring(0, 12);
    const parts = macStr.match(/.{1,2}/g);
    const formattedMac = parts ? parts.join(":") : macStr;
    setFormData(prev => ({ ...prev, mac1: formattedMac }));
  };

  const handleSubmit = async () => {
    if (isLoading) return;
    
    // 必填欄位檢查
    if (!formData.formId.trim()) { showToast("請輸入 C01 表單號", "error"); return; }
    if (!formData.ip.trim()) { showToast("請填寫核定 IP", "error"); return; }
    if (!formData.unit.trim() || !formData.applicantName.trim()) { showToast("請填寫單位與申請人", "error"); return; }

    setIsLoading(true);
    try {
      const isConflict = await checkIpConflict(formData.ip);
      if (isConflict) {
        showToast(`IP 衝突！${formData.ip} 已經存在於系統中`, "error");
        setIsLoading(false);
        return;
      }

      // 🚀 SN 留空自動產生防呆
      let finalSn = formData.sn.trim().toUpperCase();
      if (!finalSn) {
        const randomHex = Math.floor(Math.random() * 16777215).toString(16).toUpperCase().padStart(6, '0');
        const dateStr = formData.date.replace(/-/g, '');
        finalSn = `AUTO-${dateStr}-${randomHex}`;
      }

      const payload = {
        ...formData,
        formId: formData.formId.trim().toUpperCase(),
        sn: finalSn,
        ip: formData.ip.trim(),
        deviceName: formData.deviceName.trim().toUpperCase()
      };

      await submitInternalIssue(payload);
      
      showToast("直通入庫成功，該資產已寫入結案庫！", "success");
      
      // 清空表單，但保留 C01 單號與日期方便連續輸入
      setFormData(prev => ({
        ...prev,
        floor: "", unit: "", applicantName: "", applicantExt: "",
        model: "", sn: "", mac1: "", ip: "", deviceName: "", remark: ""
      }));

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
    <div className="min-h-screen text-slate-800 antialiased flex relative overflow-x-hidden bg-gradient-to-br from-slate-50 to-slate-100">
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-sky-900/20 backdrop-blur-sm z-[45] md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* --- 側邊選單 --- */}
      <aside className={`w-64 fixed left-0 top-0 h-screen border-r border-white/60 bg-white/70 backdrop-blur-2xl flex flex-col p-6 z-50 transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 shadow-[4px_0_24px_rgba(0,0,0,0.02)]`}>
          <div className="flex items-center gap-3 mb-10 px-2">
             <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg">
               <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>hub</span>
             </div>
             <h2 className="text-xl font-black text-sky-900 tracking-tighter uppercase">ALink 總控台</h2>
          </div>
          <nav className="flex-1 space-y-2">
              <button onClick={() => router.push("/admin")} className="w-full text-left p-4 rounded-2xl font-bold text-slate-600 hover:bg-white/60 flex items-center gap-3 transition-all"><span className="material-symbols-outlined text-base">dashboard</span> 儀表板首頁</button>
              <button onClick={() => router.push("/pending")} className="w-full text-left p-4 rounded-2xl font-bold text-slate-600 hover:bg-white/60 flex items-center gap-3 transition-all"><span className="material-symbols-outlined text-base">assignment_turned_in</span> 行政審核</button>
              
              <div className="my-4 border-t border-slate-200/50"></div>
              <p className="px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">NSR 作業模組</p>
              <button onClick={() => router.push("/nsr")} className="w-full text-left p-4 rounded-2xl font-bold text-slate-600 hover:bg-white/60 flex items-center gap-3 transition-all"><span className="material-symbols-outlined text-base">account_balance_wallet</span> 網點申請與結算</button>
              
              <div className="my-4 border-t border-slate-200/50"></div>
              <button className="w-full text-left p-4 rounded-2xl font-bold bg-blue-600 text-white shadow-md flex items-center gap-3 transition-all"><span className="material-symbols-outlined text-base">bolt</span> 內部直通入庫</button>
          </nav>
          <div className="mt-auto pt-6 border-t border-slate-200/50">
            <button onClick={handleLogout} className="w-full flex items-center gap-3 p-4 text-slate-400 font-bold hover:text-red-600 transition-colors"><span className="material-symbols-outlined text-base">logout</span> 登出系統</button>
          </div>
      </aside>

      <main className="w-full md:ml-64 flex-1 flex flex-col min-h-screen p-4 md:p-8">
        <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4 mt-12 md:mt-0">
          <div>
            <div className="flex items-center gap-3">
              <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-sky-800 p-1 -ml-2"><span className="material-symbols-outlined">menu</span></button>
              <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">內部特急直通入庫</h1>
            </div>
            <p className="text-xs md:text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest pl-10 md:pl-0">Direct Asset Registration</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in zoom-in-95 duration-300">
          {/* --- 行政表單 --- */}
          <section className="col-span-1 lg:col-span-4">
            <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-sm border border-white/60">
              <div className="flex items-center gap-2 mb-8 border-b border-slate-100 pb-4">
                <span className="material-symbols-outlined text-blue-600" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
                <h2 className="text-lg font-bold text-slate-800 tracking-tight">C01 授權與行政歸屬</h2>
              </div>
              
              <div className="space-y-5">
                 <div>
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">C01 申請表單號 <span className="text-red-500">*</span></label>
                   <input type="text" value={formData.formId} onChange={e => setFormData({...formData, formId: e.target.value.toUpperCase()})} placeholder="必填 (例如: C012026...)" className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all font-mono" />
                 </div>
                 <div>
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">完工/裝機日期</label>
                   <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all" />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">所屬棟別</label>
                     <select value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})} className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all">
                       {buildingOptions.map(v => <option key={v.棟別代碼} value={v.棟別名稱}>{v.棟別名稱}</option>)}
                     </select>
                   </div>
                   <div>
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">樓層 (自動補零)</label>
                     <input type="text" value={formData.floor} onChange={e => setFormData({...formData, floor: e.target.value})} onBlur={handleFloorBlur} placeholder="輸入 5 會變 05F" className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all uppercase" />
                   </div>
                 </div>
                 <div>
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">使用單位 <span className="text-red-500">*</span></label>
                   <input type="text" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} placeholder="如: 資訊組" className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all" />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">姓名 <span className="text-red-500">*</span></label>
                     <input type="text" value={formData.applicantName} onChange={e => setFormData({...formData, applicantName: e.target.value})} placeholder="如: 王小明" className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all" />
                   </div>
                   <div>
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">分機號碼</label>
                     <input type="text" value={formData.applicantExt} onChange={e => setFormData({...formData, applicantExt: e.target.value})} placeholder="如: 1234" className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all" />
                   </div>
                 </div>
              </div>
            </div>
          </section>

          {/* --- 設備與網路表單 --- */}
          <section className="col-span-1 lg:col-span-8">
             <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-6 md:p-8 shadow-sm border border-white/60 h-full flex flex-col">
                <div className="flex items-center gap-2 mb-8 border-b border-slate-100 pb-4">
                   <span className="material-symbols-outlined text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>dns</span>
                   <h2 className="text-lg font-bold text-slate-800 tracking-tight">網路與資產規格</h2>
                </div>
                
                <div className="bg-white/40 border border-slate-200 rounded-2xl p-6 flex flex-col gap-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">設備類型</label>
                      <select value={formData.deviceType} onChange={e => setFormData({...formData, deviceType: e.target.value})} className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all">
                        <option>桌上型電腦</option><option>筆記型電腦</option><option>印表機</option><option>醫療儀器</option><option>其他設備</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">品牌型號</label>
                      <input placeholder="如: ASUS M900" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1 text-red-500">產品序號 (留空自動產生)</label>
                      <input placeholder="AUTO- 系統帶入" value={formData.sn} onChange={e => setFormData({...formData, sn: e.target.value.toUpperCase()})} className="w-full bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 font-bold text-red-600 outline-none focus:border-red-400 focus:bg-white transition-all font-mono" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1 text-emerald-600">已佈署 IP <span className="text-red-500">*</span></label>
                      <input placeholder="192.168.x.x" value={formData.ip} onChange={e => setFormData({...formData, ip: e.target.value})} className="w-full bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5 font-black text-emerald-700 outline-none focus:border-emerald-400 focus:bg-white transition-all font-mono tracking-widest" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">有線 MAC</label>
                      <input placeholder="AA:BB:CC..." value={formData.mac1} onChange={e => handleMacInput(e.target.value)} className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all font-mono uppercase" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">設備主機名稱</label>
                      <input placeholder="如: PC-IT-01" value={formData.deviceName} onChange={e => setFormData({...formData, deviceName: e.target.value.toUpperCase()})} className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all font-mono uppercase" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5 ml-1">行政直通備註</label>
                    <input placeholder="填寫額外歸檔紀錄..." value={formData.remark} onChange={e => setFormData({...formData, remark: e.target.value})} className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all" />
                  </div>
                </div>

                <div className="mt-auto pt-8 border-t border-slate-100">
                   <button onClick={handleSubmit} disabled={isLoading} className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black uppercase tracking-[0.3em] text-sm shadow-xl shadow-slate-900/10 hover:bg-slate-900 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3">
                     {isLoading ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div><span>寫入資料庫中...</span></> : <><span className="material-symbols-outlined text-[18px]">bolt</span><span>強制寫入結案庫</span></>}
                   </button>
                </div>
             </div>
          </section>
        </div>
      </main>

      {/* --- 全局 Loading --- */}
      {isLoading && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-blue-600 font-black text-[10px] uppercase mt-6 tracking-[0.5em] animate-pulse">系統處理中...</p>
        </div>
      )}

      {/* --- Toast 訊息 --- */}
      <div className="fixed bottom-10 right-8 z-[9000] flex flex-col gap-3">
        {toasts.map(t => (
          <div key={t.id} className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-xl font-bold text-sm ${t.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : t.type === 'error' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-blue-50 text-blue-700 border border-blue-100'} animate-in slide-in-from-bottom-4`}>
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              {t.type === 'success' ? 'check_circle' : t.type === 'error' ? 'report' : 'info'}
            </span> 
            <span className="tracking-wide">{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}