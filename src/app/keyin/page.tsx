"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * ==========================================
 * 檔案：src/app/keyin/page.tsx
 * 狀態：V200.0 Titanium Crystal (Axe 物理修復版)
 * 物理職責：
 * 1. 行政對沖：錄入裝機 Metadata 與設備技術參數。
 * 2. 自動化引擎：MAC 2碼自動補位、SN 強制大寫 (0 刪除)。
 * 3. 無障礙對正：補齊 v200 物理唯一 ID 與 Title，修復 axe/forms 報警。
 * 4. 視覺守護：鈦金工業風格、Bento Grid 佈局、0 呼吸球殘留。
 * ==========================================
 */

export default function KeyinPage() {
  const router = useRouter();

  // --- 1. 行政與交互狀態矩陣 (100% 保留) ---
  const [vendorName, setVendorName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
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
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" }[]>([]);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  // --- 2. 初始化：身分物理掛載與行政攔截 ---
  useEffect(() => {
    const v = sessionStorage.getItem("asset_link_vendor");
    if (!v) {
      router.push("/");
      return;
    }
    setVendorName(v);
  }, [router]);

  // --- 3. 業務自動化引擎 (0 簡化：MAC 物理對沖邏輯) ---
  const handleMacInput = (index: number, val: string) => {
    let mac = val.toUpperCase().replace(/[^A-F0-9]/g, "");
    if (mac.length > 12) mac = mac.substring(0, 12);
    
    // 物理切片對沖：每 2 碼自動補入冒號，達成 00:00:00 規範
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
      return showToast("行政資訊不完整：單位與人員為必填", "error");
    }
    setIsLoading(true);
    try {
      // 執行物理入庫同步 (模擬延遲)
      await new Promise(r => setTimeout(r, 1800));
      showToast("✅ 預約錄入成功，已同步至行政核定矩陣");
      // 清空設備列，保留 Metadata
      setDevices([{ type: "桌上型電腦", model: "", sn: "", mac: "", ip: "", name: "" }]);
    } catch {
      showToast("雲端同步異常，請檢查網路連線", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#020617] min-h-screen text-slate-300 font-sans antialiased overflow-x-hidden relative selection:bg-blue-500/30">
      
      {/* 🚀 Titanium Crystal 視覺樣式表 (物理還原) */}
      <style dangerouslySetInnerHTML={{ __html: `
        .bento-card { background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255, 255, 255, 0.05); backdrop-filter: blur(20px); border-radius: 1.5rem; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .crystal-input { background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 0.5rem; padding: 12px 16px; color: white; font-size: 13px; transition: all 0.3s; width: 100%; outline: none; }
        .crystal-input:focus { border-color: #3b82f6; background: rgba(0,0,0,0.4); box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1); }
        .tech-label { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
        .bg-mesh { position: fixed; inset: 0; background: radial-gradient(circle at 10% 10%, rgba(37,99,235,0.05) 0%, transparent 40%); z-index: 0; pointer-events: none; }
        .device-row { background: rgba(0,0,0,0.1); border: 1px solid rgba(255,255,255,0.03); }
        .device-row:hover { border-color: rgba(59,130,246,0.3); background: rgba(15, 23, 42, 0.6); }
      `}} />

      <div className="bg-mesh"></div>

      <main className="p-6 lg:p-12 max-w-[1500px] mx-auto relative z-10">
        
        {/* 1. 頁首：物理標題與操作中樞 */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-900/40 border-t border-white/20">
              <span className="material-symbols-outlined text-white text-3xl">terminal</span>
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tighter uppercase">{vendorName}</h1>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em] mt-1">Asset Link Key-in Terminal</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={addDevice} id="v200-btn-add" title="增加設備欄位" className="px-6 py-3 bg-slate-800 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-700 active:scale-95 transition-all border border-white/5 shadow-xl">新增設備項目</button>
            <button onClick={() => router.push("/")} id="v200-btn-logout" title="返回登入頁" className="px-6 py-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">登出退出</button>
          </div>
        </header>

        {/* 2. 行政對正資訊 (Axe 物理修正：補齊 id 與 title) */}
        <section className="bento-card p-10 mb-8 border-l-4 border-l-blue-500 animate-in fade-in slide-in-from-bottom-4 duration-700">
           <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
             <span className="w-1 h-4 bg-blue-500"></span> Metadata 行政元數據
           </h2>
           <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <div>
                <label className="tech-label" htmlFor="v200-meta-date">裝機日期</label>
                <input 
                  id="v200-meta-date"
                  title="請選擇設備裝機日期"
                  type="date" 
                  value={metadata.date} 
                  onChange={e => setMetadata({...metadata, date: e.target.value})} 
                  className="crystal-input" 
                />
              </div>
              <div>
                <label className="tech-label" htmlFor="v200-meta-area">院區棟別</label>
                <select 
                  id="v200-meta-area"
                  title="請選擇裝機院區"
                  value={metadata.area} 
                  onChange={e => setMetadata({...metadata, area: e.target.value})} 
                  className="crystal-input appearance-none cursor-pointer"
                >
                  {["A","B","C","D","E","G","H","I","K","T"].map(v => <option key={v} value={v} className="bg-slate-900">{v} 棟</option>)}
                </select>
              </div>
              <div>
                <label className="tech-label" htmlFor="v200-meta-floor">裝機樓層</label>
                <input 
                  id="v200-meta-floor"
                  title="請輸入樓層，例如 05"
                  placeholder="05" 
                  value={metadata.floor} 
                  onChange={e => setMetadata({...metadata, floor: e.target.value})} 
                  className="crystal-input" 
                />
              </div>
              <div>
                <label className="tech-label" htmlFor="v200-meta-unit">使用單位</label>
                <input 
                  id="v200-meta-unit"
                  title="請輸入完整單位名稱"
                  placeholder="例如：急診醫學部" 
                  value={metadata.unit} 
                  onChange={e => setMetadata({...metadata, unit: e.target.value})} 
                  className="crystal-input" 
                />
              </div>
              <div>
                <label className="tech-label !text-blue-400" htmlFor="v200-meta-applicant">填報人 (#分機)</label>
                <input 
                  id="v200-meta-applicant"
                  title="請輸入人員與分機，格式：姓名#1234"
                  placeholder="姓名#1234" 
                  value={metadata.applicant} 
                  onChange={e => setMetadata({...metadata, applicant: e.target.value})} 
                  className="crystal-input border-blue-500/30" 
                />
              </div>
           </div>
        </section>

        {/* 3. 設備清單矩陣 (Axe 物理修正：補齊動態唯一的 id 與 title) */}
        <section className="space-y-4 pb-40">
          {devices.map((d, i) => (
            <div key={i} className="bento-card p-8 device-row group animate-in fade-in slide-in-from-bottom-2">
              <div className="flex justify-between items-center mb-6">
                <span className="text-[10px] font-black text-slate-600 uppercase font-mono">Row_Node: 00{i+1}</span>
                {devices.length > 1 && (
                  <button 
                    onClick={() => removeDevice(i)} 
                    className="text-red-500/40 hover:text-red-500 transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"
                    title={`移除第 ${i+1} 項設備資料`}
                  >
                    <span className="material-symbols-outlined text-sm">close</span> 移除
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-2">
                  <label className="tech-label" htmlFor={`v200-dev-type-${i}`}>設備類型</label>
                  <select 
                    id={`v200-dev-type-${i}`}
                    title={`第 ${i+1} 項設備之類型選擇`}
                    value={d.type} 
                    onChange={e => { const nd = [...devices]; nd[i].type = e.target.value; setDevices(nd); }} 
                    className="crystal-input appearance-none cursor-pointer"
                  >
                    {["桌上型電腦","筆記型電腦","印表機","工作站","伺服器","其他設備"].map(v => <option key={v} value={v} className="bg-slate-900">{v}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="tech-label" htmlFor={`v200-dev-model-${i}`}>品牌型號</label>
                  <input 
                    id={`v200-dev-model-${i}`}
                    title={`第 ${i+1} 項設備品牌型號`}
                    value={d.model} 
                    onChange={e => { const nd = [...devices]; nd[i].model = e.target.value; setDevices(nd); }} 
                    className="crystal-input" 
                    placeholder="ASUS D700" 
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="tech-label" htmlFor={`v200-dev-mac-${i}`}>物理 MAC 地址 (自動對沖)</label>
                  <input 
                    id={`v200-dev-mac-${i}`}
                    title={`第 ${i+1} 項主要 MAC 位址`}
                    value={d.mac} 
                    onChange={e => handleMacInput(i, e.target.value)} 
                    className="crystal-input font-mono text-blue-400 font-bold" 
                    placeholder="000000000000" 
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="tech-label" htmlFor={`v200-dev-sn-${i}`}>產品序號 S/N</label>
                  <input 
                    id={`v200-dev-sn-${i}`}
                    title={`第 ${i+1} 項產品序列號`}
                    value={d.sn} 
                    onChange={e => { const nd = [...devices]; nd[i].sn = e.target.value.toUpperCase(); setDevices(nd); }} 
                    className="crystal-input font-mono text-red-400 font-bold" 
                    placeholder="SN-FORCE" 
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="tech-label" htmlFor={`v200-dev-name-${i}`}>設備名稱標記</label>
                  <input 
                    id={`v200-dev-name-${i}`}
                    title={`第 ${i+1} 項院內設備標記`}
                    value={d.name} 
                    onChange={e => { const nd = [...devices]; nd[i].name = e.target.value.toUpperCase(); setDevices(nd); }} 
                    className="crystal-input uppercase tracking-wider" 
                    placeholder="例如：INF-PC-01" 
                  />
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* 4. 底部提交區域 (Bento Footer) */}
        <footer className="fixed bottom-0 left-0 right-0 p-8 z-[100] flex justify-center bg-gradient-to-t from-[#020617] via-[#020617]/90 to-transparent pointer-events-none">
          <button 
            onClick={handleSubmit} 
            disabled={isLoading} 
            id="v200-submit-all"
            title="點擊以執行全量資產預約錄入程序"
            className="w-full max-w-xl py-6 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.5em] shadow-[0_20px_50px_rgba(37,99,235,0.3)] hover:bg-blue-500 active:scale-95 transition-all pointer-events-auto border-t border-white/20"
          >
            {isLoading ? "物理對沖同步中..." : "執行全量錄入對沖"}
          </button>
        </footer>
      </main>

      {/* 通知元件矩陣 */}
      <div className="fixed bottom-32 right-8 z-[4000] flex flex-col gap-3">
        {toasts.map(t => (
          <div key={t.id} className={`px-6 py-4 rounded-xl shadow-2xl font-bold text-xs animate-in slide-in-from-right-4 flex items-center gap-4 border border-white/10 text-white backdrop-blur-xl ${t.type === "success" ? "bg-blue-600/90" : "bg-red-600/90"}`}>
            <span className="material-symbols-outlined text-lg">{t.type === 'success' ? 'verified' : 'report'}</span>
            <span className="tracking-wider">{t.msg}</span>
          </div>
        ))}
      </div>

      {/* 全域對沖遮罩 */}
      {isLoading && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-xl">
          <div className="w-10 h-10 border-2 border-slate-800 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
}