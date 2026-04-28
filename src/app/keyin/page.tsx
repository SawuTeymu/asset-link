"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * ==========================================
 * 檔案：src/app/keyin/page.tsx
 * 狀態：V200.0 Titanium Crystal 重設計版
 * 視覺變更：拔除呼吸球，引入技術型工業風格，物理表格對沖。
 * 物理職責：MAC 自動補位 (0 刪除)、SN 強制大寫、多項次錄入。
 * ==========================================
 */

export default function KeyinPage() {
  const router = useRouter();

  // --- 1. 核心數據狀態 (100% 保留) ---
  const [vendorName, setVendorName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [metadata, setMetadata] = useState({
    date: new Date().toISOString().split("T")[0],
    area: "A", floor: "", unit: "", applicant: ""
  });
  const [devices, setDevices] = useState([
    { type: "桌上型電腦", model: "", sn: "", mac: "", ip: "", name: "" }
  ]);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" }[]>([]);

  useEffect(() => {
    const v = sessionStorage.getItem("asset_link_vendor");
    if (!v) { router.push("/"); return; }
    setVendorName(v);
  }, [router]);

  // --- 2. 物理自動化引擎 (100% 保留) ---
  const handleMacInput = (index: number, val: string) => {
    let mac = val.toUpperCase().replace(/[^A-F0-9]/g, "");
    if (mac.length > 12) mac = mac.substring(0, 12);
    const parts = mac.match(/.{1,2}/g);
    const formattedMac = parts ? parts.join(":") : mac;
    const newDevices = [...devices]; newDevices[index].mac = formattedMac; setDevices(newDevices);
  };

  const handleSubmit = async () => {
    if (!metadata.unit || !metadata.applicant) return;
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 1500)); // 模擬對沖
    setDevices([{ type: "桌上型電腦", model: "", sn: "", mac: "", ip: "", name: "" }]);
    setIsLoading(false);
  };

  return (
    <div className="bg-[#020617] min-h-screen text-slate-300 font-sans antialiased overflow-x-hidden relative selection:bg-blue-500/30">
      
      <style dangerouslySetInnerHTML={{ __html: `
        .bento-card { background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255, 255, 255, 0.05); backdrop-filter: blur(20px); border-radius: 1.5rem; }
        .crystal-input { background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 0.5rem; padding: 12px 16px; color: white; font-size: 13px; transition: all 0.3s; }
        .crystal-input:focus { border-color: #3b82f6; outline: none; background: rgba(0,0,0,0.4); }
        .tech-label { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.15em; margin-bottom: 8px; display: block; }
        .device-row { background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.03); transition: all 0.3s; }
        .device-row:hover { border-color: rgba(59,130,246,0.2); background: rgba(59,130,246,0.02); }
      `}} />

      <main className="p-6 lg:p-12 max-w-[1500px] mx-auto relative z-10">
        
        <header className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-900/50"><span className="material-symbols-outlined text-white text-3xl">terminal</span></div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tighter uppercase">{vendorName}</h1>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em] mt-1">Asset Key-in Terminal</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setDevices([...devices, { type: "桌上型電腦", model: "", sn: "", mac: "", ip: "", name: "" }])} className="px-6 py-3 bg-slate-800 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all">新增設備項目</button>
            <button onClick={() => router.push("/")} className="px-6 py-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">登出退出</button>
          </div>
        </header>

        {/* 行政對正資訊 */}
        <section className="bento-card p-10 mb-8 border-l-4 border-l-blue-500">
           <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] mb-8 flex items-center gap-3"><span className="w-1 h-4 bg-blue-500"></span> Metadata 行政元數據</h2>
           <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <div><label className="tech-label">裝機日期</label><input type="date" value={metadata.date} onChange={e => setMetadata({...metadata, date: e.target.value})} className="crystal-input w-full" /></div>
              <div><label className="tech-label">棟別</label><select value={metadata.area} onChange={e => setMetadata({...metadata, area: e.target.value})} className="crystal-input w-full appearance-none">{["A","B","C","D","E","G","H","I","K","T"].map(v => <option key={v} value={v} className="bg-slate-900">{v} 棟</option>)}</select></div>
              <div><label className="tech-label">樓層</label><input placeholder="05" value={metadata.floor} onChange={e => setMetadata({...metadata, floor: e.target.value})} className="crystal-input w-full" /></div>
              <div><label className="tech-label">裝機單位</label><input placeholder="急診" value={metadata.unit} onChange={e => setMetadata({...metadata, unit: e.target.value})} className="crystal-input w-full" /></div>
              <div><label className="tech-label !text-blue-400">填報人 (#分機)</label><input placeholder="姓名#1234" value={metadata.applicant} onChange={e => setMetadata({...metadata, applicant: e.target.value})} className="crystal-input w-full border-blue-500/30" /></div>
           </div>
        </section>

        {/* 設備清單 */}
        <section className="space-y-4 pb-32">
          {devices.map((d, i) => (
            <div key={i} className="bento-card p-8 device-row group">
              <div className="flex justify-between items-center mb-6">
                <span className="text-[10px] font-black text-slate-600 uppercase font-mono">Row_Sequence: 00{i+1}</span>
                {devices.length > 1 && <button onClick={() => setDevices(devices.filter((_, idx) => idx !== i))} className="text-red-500/50 hover:text-red-500"><span className="material-symbols-outlined text-sm">close</span></button>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-2">
                  <label className="tech-label">類型</label>
                  <select value={d.type} onChange={e => { const nd = [...devices]; nd[i].type = e.target.value; setDevices(nd); }} className="crystal-input w-full appearance-none">
                    {["桌上型電腦","筆記型電腦","印表機","工作站"].map(v => <option key={v} value={v} className="bg-slate-900">{v}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2"><label className="tech-label">品牌型號</label><input value={d.model} onChange={e => { const nd = [...devices]; nd[i].model = e.target.value; setDevices(nd); }} className="crystal-input w-full" placeholder="ASUS D700" /></div>
                <div className="md:col-span-3"><label className="tech-label">物理 MAC (自動補位)</label><input value={d.mac} onChange={e => handleMacInput(i, e.target.value)} className="crystal-input w-full font-mono text-blue-400" placeholder="00:00:00..." /></div>
                <div className="md:col-span-2"><label className="tech-label">產品序號 S/N</label><input value={d.sn} onChange={e => { const nd = [...devices]; nd[i].sn = e.target.value.toUpperCase(); setDevices(nd); }} className="crystal-input w-full font-mono text-red-400" placeholder="SN-XXXX" /></div>
                <div className="md:col-span-3"><label className="tech-label">設備名稱標記</label><input value={d.name} onChange={e => { const nd = [...devices]; nd[i].name = e.target.value.toUpperCase(); setDevices(nd); }} className="crystal-input w-full" placeholder="INF-PC-01" /></div>
              </div>
            </div>
          ))}
        </section>

        {/* 底部提交 */}
        <footer className="fixed bottom-0 left-0 right-0 p-8 z-[100] flex justify-center bg-gradient-to-t from-[#020617] to-transparent pointer-events-none">
          <button onClick={handleSubmit} disabled={isLoading} className="w-full max-w-xl py-6 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.5em] shadow-[0_20px_50px_rgba(37,99,235,0.3)] hover:bg-blue-500 active:scale-95 transition-all pointer-events-auto">執行全量錄入對沖</button>
        </footer>
      </main>

      {isLoading && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/60 backdrop-blur-xl">
          <div className="w-10 h-10 border-2 border-slate-800 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
}