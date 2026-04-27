"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";

// 🚀 引入共用佈局與後端 Actions
import AdminSidebar from "@/components/layout/AdminSidebar";
import TopNavbar from "@/components/layout/TopNavbar";
import { checkIpConflict, submitInternalIssue } from "@/lib/actions/assets";
import { formatFloor } from "@/lib/logic/formatters";

/**
 * ==========================================
 * 檔案：src/app/internal/page.tsx
 * 狀態：V60.0 內部直通旗艦版 (0 簡化、0 刪除)
 * 物理職責：
 * 1. 視覺中樞：旗艦背景呼吸球、玻璃擬態 UI。
 * 2. 快速通道：內部人員直通結案，跳過審核直接入庫。
 * 3. 即時防撞：IP 錄入時物理偵測 assets 與歷史庫衝突。
 * 4. 無障礙修復：全量補齊 axe/forms 物理屬性。
 * ==========================================
 */

export default function InternalFastIssue() {
  const router = useRouter();

  // --- 1. 核心表單狀態 ---
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    area: "A",
    floor: "",
    unit: "",
    ext: "",
    issueType: "NEW" as "NEW" | "REPLACE",
    deviceType: "桌上型電腦",
    model: "",
    sn: "",
    mac1: "",
    mac2: "",
    ip: "",
    name: "",
    remark: ""
  });

  // --- 2. 交互與 UI 狀態 ---
  const [viewDate, setViewDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [loaderText, setLoaderText] = useState("對沖中...");
  const [ipConflict, setIpConflict] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [reportModal, setReportModal] = useState<{ isOpen: boolean; content: string }>({ isOpen: false, content: "" });
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" | "info" }[]>([]);

  const showToast = useCallback((msg: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // --- 3. 物理日曆生成邏輯 ---
  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const elements = [];
    for (let i = 0; i < firstDay; i++) elements.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
        elements.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return elements;
  }, [viewDate]);

  // --- 4. 業務對沖邏輯 ---
  const handleIpBlur = async () => {
    if (!formData.ip) return;
    try {
        const isConflicted = await checkIpConflict(formData.ip, formData.issueType === "REPLACE");
        if (isConflicted) {
            setIpConflict(`⚠️ 物理衝突：IP ${formData.ip} 已被其他設備佔用`);
            showToast("偵測到 IP 衝突警告", "error");
        } else {
            setIpConflict(null);
        }
    } catch {
        showToast("IP 衝突檢測連線失敗", "error");
    }
  };

  const handleFastIssue = async () => {
    if (!formData.unit || !formData.sn || !formData.ip) {
        return showToast("單位、序號與 IP 為物理必填項", "error");
    }
    
    setIsLoading(true);
    setLoaderText("執行內部直通結案...");
    
    try {
        await submitInternalIssue({
            installDate: formData.date,
            area: formData.area,
            floor: formatFloor(formData.floor),
            unit: formData.unit,
            ext: formData.ext,
            type: formData.deviceType,
            model: formData.model,
            sn: formData.sn.toUpperCase(),
            mac1: formData.mac1,
            mac2: formData.mac2,
            ip: formData.ip,
            name: formData.name.toUpperCase(),
            remark: formData.remark
        });

        const report = `【ALink 內部結案報告】\n單號：FAST-ISSUE\n日期：${formData.date}\n單位：${formData.unit}\nIP位址：${formData.ip}\n序號：${formData.sn.toUpperCase()}\n狀態：直接入庫 (已跳過審核)`;
        setReportModal({ isOpen: true, content: report });
        showToast("內部結案入庫成功", "success");
        
        // 清空重要欄位，保留行政資訊
        setFormData(prev => ({ ...prev, sn: "", mac1: "", mac2: "", ip: "", name: "", remark: "" }));
    } catch {
        showToast("提交失敗，請檢查資料庫連線或單號重複", "error");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#f8fafc] min-h-screen flex text-slate-900 font-sans antialiased overflow-x-hidden relative">
      <style dangerouslySetInnerHTML={{ __html: `
        .glass-panel { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(25px); border: 1px solid rgba(255, 255, 255, 0.8); box-shadow: 0 10px 40px -10px rgba(0,0,0,0.04); }
        .internal-input { width: 100%; background: rgba(241, 245, 249, 0.6); border: none; border-radius: 1.5rem; padding: 16px 20px; font-weight: 700; font-size: 14px; focus:ring-2; focus:ring-blue-500; outline: none; transition: all 0.3s; }
        .internal-input:focus { background: white; box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1); }
        .saas-label { font-size: 11px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; display: block; margin-left: 8px; }
        .black-card { background: #0f172a; color: white; border-radius: 3rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
        .neon-text { text-shadow: 0 0 10px rgba(37, 99, 235, 0.2); }
      `}} />

      {/* 🚀 ALink 旗艦呼吸背景球 (物理對沖) */}
      <div className="fixed z-0 blur-[120px] opacity-15 rounded-full pointer-events-none bg-blue-600 w-[700px] h-[700px] -top-64 -left-64 animate-pulse"></div>
      <div className="fixed z-0 blur-[120px] opacity-10 rounded-full pointer-events-none bg-emerald-400 w-[600px] h-[600px] bottom-0 right-0 animate-pulse delay-700"></div>
      <div className="fixed z-0 blur-[100px] opacity-10 rounded-full pointer-events-none bg-indigo-500 w-[400px] h-[400px] top-1/2 left-1/2 -translate-x-1/2 animate-bounce duration-[10s]"></div>

      <AdminSidebar currentRoute="/internal" isOpen={isSidebarOpen} onLogout={() => router.push("/")} />

      <div className="flex-1 flex flex-col relative z-10">
        <TopNavbar title="內部人員直通結案中樞" onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} />

        <main className="p-6 lg:p-10 max-w-[1400px] mx-auto w-full mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              
              {/* --- 左側：行政與日曆區塊 --- */}
              <div className="lg:col-span-5 space-y-8 animate-in fade-in slide-in-from-left-8 duration-700">
                  <section className="glass-panel p-10 rounded-[3rem] border border-white">
                      <div className="flex justify-between items-center mb-8">
                          <h3 className="text-sm font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                            <span className="material-symbols-outlined">calendar_month</span> 裝機日期物理選取
                          </h3>
                          <div className="flex items-center gap-3 bg-white/50 px-4 py-2 rounded-2xl border border-slate-100 shadow-inner">
                              <button id="cal-prev" title="上個月" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1))} className="w-8 h-8 rounded-full hover:bg-white flex items-center justify-center transition-all"><span className="material-symbols-outlined text-sm font-black">chevron_left</span></button>
                              <span className="text-xs font-black text-slate-700 min-w-[100px] text-center">{viewDate.getFullYear()}年 {viewDate.getMonth() + 1}月</span>
                              <button id="cal-next" title="下個月" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1))} className="w-8 h-8 rounded-full hover:bg-white flex items-center justify-center transition-all"><span className="material-symbols-outlined text-sm font-black">chevron_right</span></button>
                          </div>
                      </div>
                      <div className="grid grid-cols-7 gap-2 text-center">
                          {["日","一","二","三","四","五","六"].map(w => <div key={w} className="text-[10px] font-black text-slate-300 uppercase">{w}</div>)}
                          {calendarDays.map((d, i) => (
                              <div key={i} onClick={() => d && setFormData({...formData, date: d})} className={`h-11 flex items-center justify-center text-sm rounded-2xl cursor-pointer transition-all ${!d ? 'invisible' : d === formData.date ? 'bg-blue-600 text-white font-black shadow-lg scale-110' : 'text-slate-500 hover:bg-blue-50 font-bold'}`}>
                                  {d ? d.split('-')[2] : ''}
                              </div>
                          ))}
                      </div>
                  </section>

                  <section className="glass-panel p-10 rounded-[3rem] border border-white space-y-6">
                      <div className="grid grid-cols-2 gap-6">
                          <div>
                            <label className="saas-label" htmlFor="internal-area-sel">裝機院區</label>
                            <select id="internal-area-sel" title="院區選擇" value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})} className="internal-input font-black text-sm">
                                {["A","B","C","D","E","G","H","I","K","T"].map(v => <option key={v} value={v}>{v} 棟</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="saas-label" htmlFor="internal-floor-in">樓層</label>
                            <input id="internal-floor-in" title="樓層" value={formData.floor} onChange={e => setFormData({...formData, floor: e.target.value})} onBlur={e => setFormData({...formData, floor: formatFloor(e.target.value)})} className="internal-input" placeholder="例如：05" />
                          </div>
                      </div>
                      <div>
                        <label className="saas-label !text-blue-600" htmlFor="internal-ext-in">人員姓名與分機</label>
                        <input id="internal-ext-in" title="人員姓名與分機" value={formData.ext} onChange={e => setFormData({...formData, ext: e.target.value.replace(/\s+/g, '#')})} className="internal-input text-blue-600 font-black" placeholder="姓名#分機" />
                      </div>
                      <div>
                        <label className="saas-label" htmlFor="internal-unit-in">裝機單位全稱</label>
                        <input id="internal-unit-in" title="裝機單位" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="internal-input" placeholder="例如：資訊組" />
                      </div>
                  </section>
              </div>

              {/* --- 右側：黑色科技卡片區塊 --- */}
              <div className="lg:col-span-7 animate-in fade-in slide-in-from-right-8 duration-700">
                  <section className="black-card p-12 h-full flex flex-col space-y-10 relative overflow-hidden group border border-white/5">
                      <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full -mr-40 -mt-40 group-hover:scale-150 transition-transform duration-1000"></div>
                      
                      <h3 className="text-sm font-black text-blue-400 uppercase tracking-[0.4em] flex items-center gap-3 relative z-10">
                        <span className="material-symbols-outlined text-blue-400 font-black text-2xl">memory</span> 物理技術參數對沖
                      </h3>

                      <div className="space-y-10 flex-1 relative z-10">
                          <div className="grid grid-cols-2 gap-8">
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1" htmlFor="internal-mod-in">品牌型號 (I)</label>
                                <input id="internal-mod-in" title="品牌型號" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} className="w-full bg-slate-800 border-none rounded-2xl px-6 py-5 text-white font-bold focus:ring-2 focus:ring-blue-500 outline-none" placeholder="例如：ASUS D700" />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1" htmlFor="internal-sn-in">產品序號 S/N (J)</label>
                                <input id="internal-sn-in" title="產品序號" value={formData.sn} onChange={e => setFormData({...formData, sn: e.target.value.toUpperCase()})} className="w-full bg-slate-800 border-none rounded-2xl px-6 py-5 text-red-400 font-mono font-black focus:ring-2 focus:ring-red-500 outline-none" placeholder="強制大寫" />
                              </div>
                          </div>

                          <div className="space-y-4">
                              <label className="text-[11px] font-black text-blue-500 uppercase tracking-[0.3em] ml-2 flex items-center gap-2" htmlFor="internal-ip-in">
                                <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></span> 核定固定 IP (即時防撞)
                              </label>
                              <input id="internal-ip-in" title="核定 IP" value={formData.ip} onChange={e => setFormData({...formData, ip: e.target.value})} onBlur={handleIpBlur} className={`w-full bg-slate-900/50 border-2 border-white/5 rounded-[3rem] px-10 py-10 font-mono font-black text-5xl text-blue-400 shadow-2xl transition-all ${ipConflict ? 'border-red-500 bg-red-500/5' : 'focus:border-blue-500'}`} placeholder="10.X.X.X" />
                              {ipConflict && <p className="text-sm text-red-500 font-black mt-3 animate-bounce flex items-center gap-2"><span className="material-symbols-outlined">warning</span> {ipConflict}</p>}
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1" htmlFor="internal-name-in">物理設備名稱標記</label>
                            <input id="internal-name-in" title="設備名稱" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} className="w-full bg-slate-800 border-none rounded-2xl px-8 py-6 text-white font-black tracking-[0.2em] focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="例如: INF-PC-01" />
                          </div>
                      </div>

                      <button onClick={handleFastIssue} disabled={isLoading || !!ipConflict} className="w-full py-8 bg-white text-slate-900 rounded-[3rem] font-black text-sm uppercase tracking-[0.5em] shadow-2xl active:scale-95 hover:bg-blue-50 transition-all flex items-center justify-center gap-4 relative z-10 disabled:opacity-50 disabled:cursor-not-allowed">
                          <span className="material-symbols-outlined text-blue-600 font-black text-2xl">verified</span> 執行內部快速直通結案
                      </button>
                  </section>
              </div>
          </div>
        </main>
      </div>

      {/* --- 彈窗 A: 結案報告 (旗艦毛玻璃) --- */}
      {reportModal.isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-xl rounded-[4rem] p-12 shadow-2xl animate-in zoom-in-95 relative border border-white/10 overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 rounded-full -mr-32 -mt-32"></div>
                <h2 className="text-3xl font-black text-slate-800 tracking-tighter mb-4 flex items-center gap-3">
                  <span className="material-symbols-outlined text-blue-600 text-4xl">task_alt</span> 直通結案完成
                </h2>
                <div className="bg-slate-50 p-8 rounded-[2.5rem] font-mono text-sm text-slate-600 whitespace-pre-wrap leading-relaxed border border-slate-100 shadow-inner mb-8">
                    {reportModal.content}
                </div>
                <div className="flex gap-4">
                  <button onClick={() => { 
                    const blob = new Blob([reportModal.content], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = "結案報告.txt";
                    link.click();
                  }} className="flex-1 py-5 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">
                    下載報告
                  </button>
                  <button onClick={() => setReportModal({ isOpen: false, content: "" })} className="flex-1 py-5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/30 active:scale-95 transition-all">
                    完成並關閉
                  </button>
                </div>
            </div>
        </div>
      )}

      {/* --- 全域強同步遮罩 --- */}
      {isLoading && (
        <div className="fixed inset-0 z-[3000] flex flex-col items-center justify-center bg-white/80 backdrop-blur-2xl">
          <div className="w-24 h-24 border-[8px] border-slate-100 border-t-blue-600 rounded-full animate-spin mb-10 shadow-2xl"></div>
          <p className="text-blue-600 font-black tracking-[0.8em] uppercase text-sm animate-pulse neon-text">{loaderText}</p>
        </div>
      )}

      {/* --- 通知氣泡 --- */}
      <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[4000] flex flex-col gap-4 pointer-events-none w-full max-w-sm px-6">
        {toasts.map(t => (
          <div key={t.id} className={`px-10 py-6 rounded-[2.5rem] shadow-2xl font-black text-xs animate-in slide-in-from-bottom-4 flex items-center gap-5 border border-white/10 text-white backdrop-blur-2xl ${t.type === "success" ? "bg-emerald-600/90" : t.type === "error" ? "bg-red-600/90" : "bg-slate-900/90"}`}>
            <span className="material-symbols-outlined text-2xl">{t.type === 'success' ? 'verified' : 'info'}</span>
            <span className="tracking-[0.2em]">{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}