"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { checkIpConflict, submitInternalIssue } from "@/lib/actions/assets";
import { formatFloor } from "@/lib/logic/formatters";

// 🚀 引入共用佈局組件
import AdminSidebar from "@/components/layout/AdminSidebar";
import TopNavbar from "@/components/layout/TopNavbar";

/**
 * ==========================================
 * 檔案：src/app/internal/page.tsx
 * 狀態：V5.5 旗艦終極全功能版 (日曆選取 + 行政自動化 + 型別全修復)
 * 物理職責：
 * 1. 內部快速通道：年月日日曆物理選取，數據直通 historical_assets。
 * 2. 行政規則：姓名分機空格自動帶入 #，對齊 keyin.tsx。
 * 3. 解決型別衝突：對齊 checkIpConflict(2) 與 submitInternalIssue(1)。
 * 4. 物理還原：寫回發光球背景、玻璃卡片與強同步遮罩。
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
    ext: "", // 存儲 姓名#分機
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

  // --- 2. 日曆視圖與 UI 狀態 ---
  const [viewDate, setViewDate] = useState(new Date()); 
  const [isLoading, setIsLoading] = useState(false);
  const [loaderText, setLoaderText] = useState("");
  const [ipConflict, setIpConflict] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [reportModal, setReportModal] = useState<{ isOpen: boolean; content: string }>({ isOpen: false, content: "" });
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // --- 3. 權限物理守衛 ---
  useEffect(() => {
    const auth = sessionStorage.getItem("asset_link_admin_auth");
    if (auth !== "true") { router.push("/"); }
  }, [router]);

  // --- 4. 物理自動化邏輯 ---
  
  /**
   * 🚀 行政自動化：空格轉 # (參考 keyin.tsx 規則)
   */
  const handleExtChange = (val: string) => {
    const formatted = val.replace(/\s+/g, '#');
    setFormData(prev => ({ ...prev, ext: formatted }));
  };

  /**
   * 🚀 MAC 格式化物理對沖
   */
  const handleMacInput = (key: 'mac1' | 'mac2', val: string) => {
    const cleaned = val.toUpperCase().replace(/[^0-9A-F]/g, '');
    let formatted = "";
    for (let i = 0; i < cleaned.length && i < 12; i++) {
        if (i > 0 && i % 2 === 0) formatted += ":";
        formatted += cleaned[i];
    }
    setFormData(prev => ({ ...prev, [key]: formatted }));
  };

  /**
   * 🚀 IP 物理防撞：解決 TS2554 (傳遞 2 個參數)
   */
  const handleIpBlur = async () => {
    if (!formData.ip) return;
    const isConflicted = await checkIpConflict(formData.ip, formData.issueType === "REPLACE");
    if (isConflicted) {
        setIpConflict(`⚠️ 物理衝突：IP ${formData.ip} 已被占用`);
        showToast("偵測到 IP 衝突", "error");
    } else {
        setIpConflict(null);
    }
  };

  /**
   * 🚀 物理日曆生成邏輯 (年月日選擇器)
   */
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

  const handleClear = () => {
    if (confirm("確定清空目前所有行政填報內容？")) {
        setFormData({
            date: new Date().toISOString().split("T")[0], area: "A", floor: "", unit: "", ext: "",
            issueType: "NEW", deviceType: "桌上型電腦", model: "", sn: "", mac1: "", mac2: "", ip: "", name: "", remark: ""
        });
        setIpConflict(null);
    }
  };

  /**
   * 🚀 執行內部快速結案 (解決 TS2554 與 TS2345)
   */
  const handleFastIssue = async () => {
    if (!formData.unit || !formData.sn || !formData.ip) return showToast("單位、序號與 IP 為必填項", "error");
    if (ipConflict) return showToast("請先排除 IP 物理衝突", "error");
    if (!formData.ext.includes("#")) return showToast("人員格式錯誤 (姓名#分機)", "error");

    setIsLoading(true);
    setLoaderText("執行內部結案數據物理對沖...");

    try {
      // 🚀 物理映射：date -> installDate，解決 TS2345；僅傳遞 1 個 Payload 物件，解決 TS2554
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

      const reportTxt = [
        "【Asset-Link 內部快速結案報告】",
        `執行日期: ${formData.date}`,
        `裝機地點: ${formData.area}棟 ${formatFloor(formData.floor)}F`,
        `使用單位: ${formData.unit}`,
        `行政人員: ${formData.ext}`,
        `核定 IP : ${formData.ip}`,
        `物理序號: ${formData.sn.toUpperCase()}`,
        `設備名稱: ${formData.name.toUpperCase()}`,
        `業務性質: ${formData.issueType === "REPLACE" ? "舊機汰換結案" : "新購配發結案"}`,
        `主要 MAC: ${formData.mac1}`,
        "------------------------------",
        "※ 此紀錄已成功物理寫入結案庫，無需後續審核。"
      ].join("\n");

      setReportModal({ isOpen: true, content: reportTxt });
      showToast("內部結案入庫成功", "success");
    } catch (e) {
      showToast("結案傳輸失敗", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const copyReport = () => {
    const el = document.createElement('textarea');
    el.value = reportModal.content;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showToast("結案報告已複製至剪貼簿", "success");
  };

  return (
    <div className="bg-[#f0f4f8] min-h-screen flex text-[#1d1d1f] font-sans antialiased overflow-x-hidden relative">
      
      {/* 🚀 V5.1 旗艦發光背景球還原 */}
      <div className="fixed z-0 blur-[100px] opacity-20 rounded-full pointer-events-none bg-blue-600 w-[600px] h-[600px] -top-48 -left-48 animate-pulse"></div>
      <div className="fixed z-0 blur-[100px] opacity-20 rounded-full pointer-events-none bg-cyan-400 w-[500px] h-[500px] bottom-0 -right-48 animate-pulse"></div>

      {/* 🚀 側邊欄與頂部導航 */}
      <AdminSidebar currentRoute="/internal" isOpen={isSidebarOpen} onLogout={() => router.push("/")} />

      <div className="flex-1 flex flex-col relative z-10">
        <TopNavbar title="內部直通結案中樞" onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} />

        <main className="p-6 lg:p-10 max-w-[1440px] mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          <div className="flex justify-between items-end mb-10 px-2">
              <div>
                  <h1 className="text-3xl font-black text-slate-800 tracking-tight">內部人員直通錄入</h1>
                  <p className="text-sm font-bold text-slate-500 mt-1 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
                    Internal Fast-Track Channel
                  </p>
              </div>
              <button onClick={handleClear} className="px-6 py-3 bg-white border border-slate-200 rounded-2xl font-black text-xs text-slate-400 hover:text-red-500 transition-all flex items-center gap-2 shadow-sm">
                  <span className="material-symbols-outlined text-sm font-black">refresh</span> 全部重設
              </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* 左側：日曆日期與行政對沖 (佔 5 欄) */}
              <div className="lg:col-span-5 space-y-8">
                  
                  {/* 🚀 物理年月日日曆選取器 */}
                  <section className="bg-white rounded-[2.5rem] p-8 shadow-2xl shadow-slate-200/40 border border-white relative overflow-hidden group">
                      <div className="flex justify-between items-center mb-8 relative z-10">
                          <h3 className="text-sm font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                              <span className="material-symbols-outlined font-black">calendar_month</span> 裝機日期物理選取
                          </h3>
                          <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 shadow-inner">
                              <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() - 1)))} className="w-8 h-8 rounded-full hover:bg-white hover:shadow-sm flex items-center justify-center transition-all">
                                  <span className="material-symbols-outlined text-sm font-black">chevron_left</span>
                              </button>
                              <span className="text-xs font-black text-slate-700 min-w-[100px] text-center tracking-widest">{viewDate.getFullYear()}年 {viewDate.getMonth() + 1}月</span>
                              <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() + 1)))} className="w-8 h-8 rounded-full hover:bg-white hover:shadow-sm flex items-center justify-center transition-all">
                                  <span className="material-symbols-outlined text-sm font-black">chevron_right</span>
                              </button>
                          </div>
                      </div>

                      <div className="grid grid-cols-7 gap-2 text-center mb-4 relative z-10">
                          {["日","一","二","三","四","五","六"].map(w => <div key={w} className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">{w}</div>)}
                      </div>
                      <div className="grid grid-cols-7 gap-2 text-center relative z-10">
                          {calendarDays.map((d, i) => (
                              <div key={i} 
                                   onClick={() => d && setFormData({...formData, date: d})}
                                   className={`h-11 flex items-center justify-center text-sm rounded-2xl cursor-pointer transition-all ${!d ? 'invisible' : d === formData.date ? 'bg-blue-600 text-white font-black shadow-lg shadow-blue-200 scale-105' : 'text-slate-500 hover:bg-blue-50 font-bold'}`}>
                                  {d ? d.split('-')[2] : ''}
                              </div>
                          ))}
                      </div>
                      <div className="mt-8 pt-6 border-t border-slate-50 flex justify-between items-center px-4">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">已對沖日期</span>
                          <div className="flex items-center gap-2">
                              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                              <span className="text-sm font-mono font-black text-blue-600 tracking-wider">{formData.date}</span>
                          </div>
                      </div>
                  </section>

                  {/* 地點與行政自動化 */}
                  <section className="bg-white rounded-[2.5rem] p-8 shadow-2xl shadow-slate-200/40 space-y-6 border border-white">
                      <h3 className="text-sm font-black text-blue-600 uppercase tracking-widest flex items-center gap-2 mb-4">
                          <span className="material-symbols-outlined font-black">domain</span> 裝機地點與行政對沖
                      </h3>
                      <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block" htmlFor="area-sel">裝機棟別</label>
                              <select id="area-sel" title="院區" value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold text-sm shadow-inner">
                                  {["A","B","C","D","E","G","H","I","K","T"].map(v => <option key={v} value={v}>{v} 棟</option>)}
                              </select>
                          </div>
                          <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block" htmlFor="floor-in">所在樓層</label>
                              <input id="floor-in" value={formData.floor} onChange={e => setFormData({...formData, floor: e.target.value})} onBlur={e => setFormData({...formData, floor: formatFloor(e.target.value)})} className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold text-sm shadow-inner" placeholder="05" />
                          </div>
                      </div>
                      <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-blue-600 uppercase ml-1 block" htmlFor="ext-in">人員分機 (物理自動化：空格轉#)</label>
                          <input id="ext-in" value={formData.ext} onChange={e => handleExtChange(e.target.value)} className="w-full bg-blue-50/50 border-none rounded-2xl px-5 py-4 font-black text-sm text-blue-700 placeholder:text-blue-200 shadow-inner" placeholder="姓名 分機 (自動補全 #)" title="人員資訊" />
                      </div>
                      <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase ml-1 block" htmlFor="unit-in">裝機單位全稱</label>
                          <input id="unit-in" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-black text-slate-800 shadow-inner" placeholder="輸入準確單位名稱..." />
                      </div>
                  </section>
              </div>

              {/* 右側：技術參數對沖 (佔 7 欄) */}
              <div className="lg:col-span-7">
                  <section className="bg-slate-900 rounded-[3rem] p-10 shadow-2xl space-y-8 relative overflow-hidden group h-full flex flex-col">
                      <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full -mr-40 -mt-40 group-hover:scale-150 transition-transform duration-1000"></div>
                      <h3 className="text-sm font-black text-blue-400 uppercase tracking-[0.4em] flex items-center gap-3 mb-8 relative z-10">
                          <span className="material-symbols-outlined text-blue-400 font-black">memory</span> 物理技術參數對沖
                      </h3>
                      
                      <div className="space-y-8 relative z-10 flex-1">
                          <div className="grid grid-cols-2 gap-8">
                              <div className="space-y-2">
                                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1 block">業務性質</label>
                                  <div className="flex bg-slate-800 p-1.5 rounded-2xl border border-slate-700/50">
                                      <button onClick={() => setFormData({...formData, issueType: "NEW"})} className={`flex-1 py-3 text-[11px] font-black rounded-xl transition-all ${formData.issueType === 'NEW' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'}`}>新購配發</button>
                                      <button onClick={() => setFormData({...formData, issueType: "REPLACE"})} className={`flex-1 py-3 text-[11px] font-black rounded-xl transition-all ${formData.issueType === 'REPLACE' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500'}`}>舊機汰換</button>
                                  </div>
                              </div>
                              <div className="space-y-2">
                                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1 block" htmlFor="type-sel">設備類型</label>
                                  <select id="type-sel" title="類型" value={formData.deviceType} onChange={e => setFormData({...formData, deviceType: e.target.value})} className="w-full bg-slate-800 border-none rounded-2xl px-5 py-4 text-white font-bold text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all">
                                      <option>桌上型電腦</option><option>筆記型電腦</option><option>伺服器</option><option>印表機</option><option>網路設備</option><option>醫療工作站</option>
                                  </select>
                              </div>
                          </div>

                          <div className="grid grid-cols-2 gap-8">
                              <div className="space-y-2">
                                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1 block" htmlFor="model-in">品牌型號 (I)</label>
                                  <input id="model-in" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} className="w-full bg-slate-800 border-none rounded-2xl px-5 py-4 text-white font-bold text-sm shadow-inner" placeholder="例如: ASUS D700" />
                              </div>
                              <div className="space-y-2">
                                  <label className="text-[10px] font-black text-red-500 uppercase ml-1 block" htmlFor="sn-in">物理序號 S/N (J)</label>
                                  <input id="sn-in" value={formData.sn} onChange={e => setFormData({...formData, sn: e.target.value.toUpperCase()})} className="w-full bg-slate-800 border-none rounded-2xl px-5 py-4 text-red-400 font-mono font-black shadow-inner" placeholder="強制大寫對沖" />
                              </div>
                          </div>

                          <div className="grid grid-cols-2 gap-8">
                              <div className="space-y-2">
                                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1 block" htmlFor="mac1-in">主要 MAC (有線)</label>
                                  <input id="mac1-in" value={formData.mac1} onChange={e => handleMacInput('mac1', e.target.value)} className="w-full bg-slate-800 border-none rounded-2xl px-5 py-4 text-blue-400 font-mono text-xs font-black shadow-inner" placeholder="XX:XX:XX..." />
                              </div>
                              <div className="space-y-2">
                                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1 block" htmlFor="mac2-in">無線 MAC (選填)</label>
                                  <input id="mac2-in" value={formData.mac2} onChange={e => handleMacInput('mac2', e.target.value)} className="w-full bg-slate-800 border-none rounded-2xl px-5 py-4 text-emerald-400 font-mono text-xs font-black shadow-inner" placeholder="選填欄位" />
                              </div>
                          </div>
                          
                          <div className="pt-8 border-t border-slate-800/60 space-y-8 mt-4">
                              <div className="space-y-2">
                                  <label className="text-[10px] font-black text-blue-500 uppercase ml-1 block" htmlFor="ip-in">核定固定 IP (即時防撞偵測)</label>
                                  <input id="ip-in" value={formData.ip} onChange={e => setFormData({...formData, ip: e.target.value})} onBlur={handleIpBlur} className={`w-full border-none rounded-3xl px-8 py-6 font-mono font-black text-2xl transition-all shadow-2xl ${ipConflict ? 'bg-red-900/40 text-red-200 ring-2 ring-red-500' : 'bg-slate-800 text-blue-400 focus:ring-2 focus:ring-blue-600'}`} placeholder="10.X.X.X" />
                                  {ipConflict && <p className="text-[10px] text-red-500 font-black mt-3 animate-bounce">{ipConflict}</p>}
                              </div>
                              <div className="space-y-2">
                                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1 block" htmlFor="name-in">物理設備名稱標記</label>
                                  <input id="name-in" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} className="w-full bg-slate-800 border-none rounded-2xl px-5 py-4 text-white font-black tracking-widest shadow-inner" placeholder="例如: INF-PC-01" />
                              </div>
                          </div>
                      </div>

                      <div className="pt-6 relative z-10">
                          <button onClick={handleFastIssue} disabled={isLoading || !!ipConflict} className="w-full py-7 bg-white text-slate-900 rounded-[2.5rem] font-black text-sm uppercase tracking-[0.4em] shadow-2xl active:scale-95 hover:bg-blue-50 transition-all disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-4">
                              <span className="material-symbols-outlined text-blue-600 font-black">verified</span>
                              執行內部快速結案並物理存檔
                          </button>
                      </div>
                  </section>
              </div>
          </div>
        </main>
      </div>

      {/* 🚀 物理結案報告 Modal (還原純淨文本呈現) */}
      {reportModal.isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-[3.5rem] p-12 shadow-2xl animate-in zoom-in-95 border-t-[12px] border-t-blue-600 relative overflow-hidden">
              <div className="text-center mb-10">
                  <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-blue-600 mb-6 shadow-inner border border-blue-100">
                      <span className="material-symbols-outlined text-6xl font-black">check_circle</span>
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">結案報告物理生成成功</h2>
                  <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest">Archive Migration Success</p>
              </div>
              <div className="bg-slate-50 rounded-[2rem] p-8 font-mono text-[11px] text-slate-700 leading-relaxed whitespace-pre-wrap border border-slate-100 mb-10 shadow-inner select-all">
                  {reportModal.content}
              </div>
              <div className="flex gap-4">
                  <button onClick={copyReport} className="flex-1 py-5 bg-blue-600 text-white text-xs font-black rounded-2xl shadow-xl shadow-blue-900/20 active:scale-95 transition-all uppercase tracking-widest flex items-center justify-center gap-3">
                      <span className="material-symbols-outlined text-lg font-black">content_copy</span> 物理複製內容
                  </button>
                  <button onClick={() => window.location.reload()} className="flex-1 py-5 bg-slate-100 text-slate-600 text-xs font-black rounded-2xl active:scale-95 transition-all uppercase tracking-widest">
                      完成並關閉
                  </button>
              </div>
          </div>
        </div>
      )}

      {/* 強同步全域遮罩 (V5.1 風格) */}
      {isLoading && (
        <div className="fixed inset-0 z-[2000] flex flex-col items-center justify-center bg-white/90 backdrop-blur-xl">
           <div className="w-16 h-16 border-[6px] border-slate-100 border-t-blue-600 rounded-full animate-spin mb-8 shadow-2xl"></div>
           <p className="text-sm font-black text-blue-600 uppercase tracking-[0.5em] animate-pulse">{loaderText}</p>
        </div>
      )}

      {/* 物理通知氣泡 */}
      {toast && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[2100] px-10 py-6 rounded-[2.5rem] shadow-2xl font-black text-xs text-white flex items-center gap-5 animate-in slide-in-from-bottom duration-500 bg-slate-900/95 backdrop-blur-md border border-white/10">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}>
                <span className="material-symbols-outlined text-lg text-white font-black">{toast.type === 'success' ? 'done_all' : 'error'}</span>
            </div>
            <span className="tracking-wide text-sm font-bold ml-2">{toast.msg}</span>
        </div>
      )}
    </div>
  );
}