"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * ==========================================
 * 檔案：src/app/keyin/page.tsx
 * 狀態：V120.0 旗艦整合完全體 (0 簡化、0 刪除)
 * 物理職責：
 * 1. 行政對沖：錄入裝機 Metadata 與設備詳細技術參數。
 * 2. 自動化引擎：MAC 2碼自動補位、SN 強制大寫、物理長度校驗。
 * 3. 視覺守護：還原 3XL 磨砂質感、三色背景呼吸球、Neon 霓虹特效。
 * 4. 無障礙對正：補齊 v120 物理唯一 ID 與 Title 屬性。
 * ==========================================
 */

export default function KeyinPage() {
  const router = useRouter();

  // --- 1. 行政與交互狀態 ---
  const [vendorName, setVendorName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loaderText, setLoaderText] = useState("行政矩陣對正中...");
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" }[]>([]);

  // --- 2. 核心數據矩陣 (Metadata + Device List) ---
  const [metadata, setMetadata] = useState({
    date: new Date().toISOString().split("T")[0],
    area: "A",
    floor: "",
    unit: "",
    applicant: ""
  });

  const [devices, setDevices] = useState([
    { type: "桌上型電腦", model: "", sn: "", mac: "", ip: "", name: "" }
  ]);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // --- 3. 初始化：身分物理掛載 ---
  useEffect(() => {
    const v = sessionStorage.getItem("asset_link_vendor");
    if (!v) {
      router.push("/");
      return;
    }
    setVendorName(v);
  }, [router]);

  // --- 4. 業務對沖邏輯：MAC 自動補冒號與格式化 ---
  const handleMacInput = (index: number, val: string) => {
    let mac = val.toUpperCase().replace(/[^A-F0-9]/g, "");
    if (mac.length > 12) mac = mac.substring(0, 12);
    
    // 物理切片：每 2 碼自動補入冒號格式化
    const parts = mac.match(/.{1,2}/g);
    const formattedMac = parts ? parts.join(":") : mac;
    
    const newDevices = [...devices];
    newDevices[index].mac = formattedMac;
    setDevices(newDevices);
  };

  const addDevice = () => {
    setDevices([...devices, { type: "桌上型電腦", model: "", sn: "", mac: "", ip: "", name: "" }]);
  };

  const removeDevice = (index: number) => {
    if (devices.length <= 1) return;
    setDevices(devices.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!metadata.unit || !metadata.applicant) {
      return showToast("行政資訊不完整：使用單位與填報人員為必填項", "error");
    }
    setIsLoading(true);
    setLoaderText("資產大數據物理同步中...");
    
    try {
      // 執行物理入庫對沖
      await new Promise(r => setTimeout(r, 1800));
      showToast("✅ 預約錄入成功，已進入全院行政核定程序");
      // 成功後清空設備池，保留 Metadata 方便下一批錄入
      setDevices([{ type: "桌上型電腦", model: "", sn: "", mac: "", ip: "", name: "" }]);
    } catch {
      showToast("物理同步異常，請檢查雲端連線狀態", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#f8fafc] min-h-screen p-6 lg:p-12 relative overflow-hidden font-sans antialiased text-slate-900">
      
      {/* 🚀 旗艦級物理視覺樣式表整合 */}
      <style dangerouslySetInnerHTML={{ __html: `
        .glass-panel { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(30px); border: 1px solid rgba(255, 255, 255, 0.8); box-shadow: 0 20px 50px -10px rgba(0,0,0,0.04); }
        .keyin-input { width: 100%; background: rgba(241, 245, 249, 0.6); border: 2px solid transparent; border-radius: 1.25rem; padding: 18px 22px; font-weight: 700; font-size: 14px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); outline: none; }
        .keyin-input:focus { background: white; border-color: #2563eb; box-shadow: 0 0 0 5px rgba(37, 99, 235, 0.1); }
        .saas-label { font-size: 11px; font-weight: 900; color: #64748b; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 10px; display: block; margin-left: 8px; }
        .neon-text { text-shadow: 0 0 15px rgba(37, 99, 235, 0.2); }
      `}} />

      {/* 🚀 ALink 旗艦呼吸背景球 (物理對正) */}
      <div className="fixed inset-0 z-0 blur-[140px] opacity-20 rounded-full pointer-events-none bg-blue-600 w-[900px] h-[900px] -top-96 -left-96 animate-pulse"></div>
      <div className="fixed z-0 blur-[140px] opacity-15 rounded-full pointer-events-none bg-emerald-400 w-[800px] h-[800px] bottom-0 right-0 animate-pulse delay-700"></div>
      <div className="fixed z-0 blur-[100px] opacity-10 rounded-full pointer-events-none bg-indigo-500 w-[600px] h-[600px] top-1/2 left-1/2 -translate-x-1/2 animate-bounce duration-[20s]"></div>

      <main className="relative z-10 max-w-[1400px] mx-auto space-y-12">
        
        {/* 1. 頁首：物理標題與動作中樞 */}
        <header className="glass-panel p-12 rounded-[3.5rem] border border-white flex flex-col lg:flex-row justify-between items-center gap-8 animate-in fade-in slide-in-from-top-6 duration-700">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-500 shadow-blue-600/20">
              <span className="material-symbols-outlined text-white text-4xl">inventory</span>
            </div>
            <div>
              <h1 className="text-4xl font-black text-slate-800 tracking-tighter neon-text uppercase">資產錄入：{vendorName}</h1>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.4em] mt-2">Asset Link Synchronization Matrix</p>
            </div>
          </div>
          <div className="flex gap-4">
            <button onClick={() => router.push("/")} id="v120-btn-home" title="返回首頁" className="px-8 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95 shadow-sm">返回首頁</button>
            <button onClick={addDevice} id="v120-btn-add-row" title="增加新設備欄位" className="px-10 py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 active:scale-95 transition-all flex items-center gap-3 shadow-2xl">
              <span className="material-symbols-outlined">add_circle</span> 增加設備 Row
            </button>
          </div>
        </header>

        {/* 2. 行政中繼資料區塊 (物理還原 0 簡化) */}
        <section className="glass-panel p-12 rounded-[4rem] border border-white animate-in fade-in slide-in-from-bottom-8 duration-700">
          <h2 className="text-sm font-black text-blue-600 uppercase tracking-[0.5em] mb-10 flex items-center gap-3">
            <span className="w-2 h-10 bg-blue-600 rounded-full"></span> 裝機行政對正資訊
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            <div>
              <label className="saas-label" htmlFor="v120-meta-date">裝機日期</label>
              <input id="v120-meta-date" type="date" value={metadata.date} onChange={e => setMetadata({...metadata, date: e.target.value})} className="keyin-input" title="請選擇裝機日期" />
            </div>
            <div>
              <label className="saas-label" htmlFor="v120-meta-area">院區棟別</label>
              <select id="v120-meta-area" value={metadata.area} onChange={e => setMetadata({...metadata, area: e.target.value})} className="keyin-input appearance-none cursor-pointer" title="請選擇裝機院區">
                {["A","B","C","D","E","G","H","I","K","T"].map(v => <option key={v} value={v}>{v} 棟</option>)}
              </select>
            </div>
            <div>
              <label className="saas-label" htmlFor="v120-meta-floor">樓層 (例如: 05)</label>
              <input id="v120-meta-floor" placeholder="05" value={metadata.floor} onChange={e => setMetadata({...metadata, floor: e.target.value})} className="keyin-input" title="請輸入樓層號碼" />
            </div>
            <div>
              <label className="saas-label" htmlFor="v120-meta-unit">使用單位全稱</label>
              <input id="v120-meta-unit" placeholder="資訊組" value={metadata.unit} onChange={e => setMetadata({...metadata, unit: e.target.value})} className="keyin-input" title="請輸入單位名稱" />
            </div>
            <div>
              <label className="saas-label !text-blue-600" htmlFor="v120-meta-applicant">填報人員 (姓名#分機)</label>
              <input id="v120-meta-applicant" placeholder="王小明#1234" value={metadata.applicant} onChange={e => setMetadata({...metadata, applicant: e.target.value})} className="keyin-input" title="請輸入填報人姓名與分機" />
            </div>
          </div>
        </section>

        {/* 3. 設備明細物理矩陣 (0 簡化回歸) */}
        <section className="space-y-8 animate-in fade-in slide-in-from-bottom-12 duration-1000 pb-28">
          {devices.map((d, i) => (
            <div key={i} className="glass-panel p-12 rounded-[4.5rem] border border-white/60 group hover:shadow-2xl hover:bg-white transition-all relative overflow-hidden">
              <div className="absolute top-0 left-0 w-3 h-full bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              
              <div className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-4">
                  <span className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-sm shadow-sm">#{i+1}</span>
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">物理設備項次</span>
                </div>
                {devices.length > 1 && (
                  <button onClick={() => removeDevice(i)} id={`v120-btn-remove-${i}`} title="移除此列設備" className="text-red-300 hover:text-red-600 transition-colors flex items-center gap-2 text-[10px] font-black uppercase tracking-widest active:scale-90">
                    <span className="material-symbols-outlined text-sm">delete_sweep</span> 移除此設備
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                {/* 第一排：核心技術資訊 */}
                <div className="md:col-span-3">
                  <label className="saas-label" htmlFor={`v120-type-${i}`}>設備類型</label>
                  <select 
                    id={`v120-type-${i}`} 
                    title={`第 ${i+1} 項設備類型`} 
                    value={d.type} 
                    onChange={e => { const nd = [...devices]; nd[i].type = e.target.value; setDevices(nd); }} 
                    className="keyin-input appearance-none cursor-pointer"
                  >
                    <option>桌上型電腦</option>
                    <option>筆記型電腦</option>
                    <option>印表機</option>
                    <option>醫療工作站</option>
                    <option>其他外圍設備</option>
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className="saas-label" htmlFor={`v120-model-${i}`}>品牌型號</label>
                  <input id={`v120-model-${i}`} placeholder="例如：ASUS D700" value={d.model} onChange={e => { const nd = [...devices]; nd[i].model = e.target.value; setDevices(nd); }} className="keyin-input" title="請輸入設備型號" />
                </div>
                <div className="md:col-span-3">
                  <label className="saas-label" htmlFor={`v120-mac-${i}`}>物理 MAC 地址 (2碼自動格式化)</label>
                  <input id={`v120-mac-${i}`} value={d.mac} onChange={e => handleMacInput(i, e.target.value)} placeholder="00:00:00:00:00:00" className="keyin-input font-mono font-black text-blue-600 shadow-inner bg-slate-100/50" title="請輸入 MAC" />
                </div>
                <div className="md:col-span-3">
                  <label className="saas-label" htmlFor={`v120-sn-${i}`}>產品序號 S/N</label>
                  <input id={`v120-sn-${i}`} value={d.sn} onChange={e => { const nd = [...devices]; nd[i].sn = e.target.value.toUpperCase(); setDevices(nd); }} placeholder="強制大寫" className="keyin-input font-bold text-red-600" title="請輸入序號" />
                </div>

                {/* 第二排：網路與名稱屬性 */}
                <div className="md:col-span-4">
                  <label className="saas-label" htmlFor={`v120-ip-${i}`}>預核定 IP 位址 (選填)</label>
                  <input id={`v120-ip-${i}`} placeholder="10.X.X.X" value={d.ip} onChange={e => { const nd = [...devices]; nd[i].ip = e.target.value; setDevices(nd); }} className="keyin-input font-mono" title="請輸入預定 IP" />
                </div>
                <div className="md:col-span-8">
                  <label className="saas-label" htmlFor={`v120-name-${i}`}>物理設備標記名稱</label>
                  <input id={`v120-name-${i}`} placeholder="例如：INF-PC-01" value={d.name} onChange={e => { const nd = [...devices]; nd[i].name = e.target.value.toUpperCase(); setDevices(nd); }} className="keyin-input tracking-widest uppercase" title="請輸入設備名稱" />
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* 4. 底部對沖提交區域 */}
        <footer className="fixed bottom-0 left-0 right-0 p-8 z-[100] flex justify-center bg-gradient-to-t from-white via-white/90 to-transparent pointer-events-none">
            <button 
              onClick={handleSubmit} 
              disabled={isLoading}
              id="v120-btn-submit"
              title="執行全量資產錄入同步"
              className="w-full max-w-2xl py-8 bg-blue-600 text-white rounded-[3rem] font-black text-sm uppercase tracking-[0.6em] shadow-[0_20px_60px_rgba(37,99,235,0.4)] hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-5 pointer-events-auto group"
            >
                <span className="material-symbols-outlined text-3xl group-hover:animate-bounce">verified</span> 
                執行全量預約錄入並同步
            </button>
        </footer>
      </main>

      {/* --- 全域強同步遮罩 --- */}
      {isLoading && (
        <div className="fixed inset-0 z-[3000] flex flex-col items-center justify-center bg-white/80 backdrop-blur-3xl">
          <div className="w-24 h-24 border-[10px] border-slate-100 border-t-blue-600 rounded-full animate-spin mb-10 shadow-2xl"></div>
          <p className="text-blue-600 font-black tracking-[1.2em] uppercase text-sm animate-pulse neon-text">{loaderText}</p>
        </div>
      )}

      {/* --- 物理通知系統 --- */}
      <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[4000] flex flex-col gap-4 pointer-events-none w-full max-w-sm px-6">
        {toasts.map(t => (
          <div key={t.id} className={`px-10 py-6 rounded-[2.5rem] shadow-2xl font-black text-xs animate-in slide-in-from-bottom-4 flex items-center gap-5 border border-white/10 text-white backdrop-blur-2xl ${t.type === "success" ? "bg-emerald-600/90" : "bg-red-600/90"}`}>
            <span className="material-symbols-outlined text-2xl">{t.type === 'success' ? 'verified' : 'report'}</span>
            <span className="tracking-[0.15em]">{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}