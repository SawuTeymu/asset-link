"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * ==========================================
 * 檔案：src/app/keyin/page.tsx
 * 狀態：V300.2 Medical M3 (無內聯樣式版)
 * 修復項目：移除 inline style，轉向類別驅動樣式。
 * ==========================================
 */

export default function KeyinPage() {
  const router = useRouter();

  // --- 1. 核心數據狀態 ---
  const [vendorName, setVendorName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [metadata, setMetadata] = useState({ date: new Date().toISOString().split("T")[0], area: "總院區", floor: "", unit: "", applicant: "" });
  const [devices, setDevices] = useState([{ type: "桌上型電腦", model: "", sn: "", mac: "", ip: "", name: "" }]);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" }[]>([]);

  useEffect(() => {
    const v = sessionStorage.getItem("asset_link_vendor");
    if (!v) { router.push("/"); return; }
    setVendorName(v);
  }, [router]);

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
    await new Promise(r => setTimeout(r, 1500));
    setDevices([{ type: "桌上型電腦", model: "", sn: "", mac: "", ip: "", name: "" }]);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen text-on-surface font-body-md overflow-x-hidden relative clinical-bg antialiased">
      <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries" async></script>
      
      {/* 🚀 物理脫離：將 inline style 轉移至此 */}
      <style dangerouslySetInnerHTML={{ __html: `
        .clinical-bg { background: radial-gradient(at 0% 0%, #e1e0ff 0%, transparent 50%), radial-gradient(at 100% 100%, #cce5ff 0%, transparent 50%), #faf8ff; background-attachment: fixed; }
        .clinical-glass { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.2); }
        .icon-fill { font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
        .delay-2s { animation-delay: -2s; }
      `}} />

      <nav className="sticky top-0 w-full flex justify-between items-center px-6 h-16 bg-white/60 backdrop-blur-xl border-b border-white/20 shadow-sm z-50">
        <span className="text-xl font-bold bg-gradient-to-r from-sky-700 to-sky-500 bg-clip-text text-transparent">MedTech Vendor Portal</span>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/")} className="material-symbols-outlined text-slate-500">logout</button>
          <img alt="Admin" className="h-8 w-8 rounded-full" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAtEHQm-ZzIEoIi31GFpkrjNbmYClcVWiOR8tfPVRFW8snxGFJmy8eEaOx3wXFDHwGue8GCifx88G47wJH7oV9mXA1qotMDvfuBiLo02nr05ie-d-0qHpsyxNyUeacnwmPZnR4PhNkmYkpcJI3_Hnw3Tg_AO619Ujap5o9s4s3e5UBiC3spul_ibpp45IUMSphLADu7sNgP4wztyZUPwYONMsWI55r5D4Iy1qKrzlmTy5069THuH9PONYstGnG_cxxOsF1GHYkuOao" />
        </div>
      </nav>

      <div className="flex">
        <aside className="w-64 fixed left-0 top-0 h-screen pt-16 border-r border-white/20 bg-white/70 backdrop-blur-2xl p-6">
          <p className="text-lg font-black text-sky-800 mb-8">管理後台</p>
          <nav className="space-y-1">
             <button className="w-full text-left p-3 bg-sky-50 text-sky-700 rounded-xl font-bold">廠商預約錄入</button>
          </nav>
        </aside>

        <main className="ml-64 w-full p-8">
          <header className="mb-8"><h1 className="text-3xl font-bold text-on-surface">廠商預約錄入 : {vendorName}</h1></header>

          <div className="grid grid-cols-12 gap-6">
            <section className="col-span-5 space-y-6">
              <div className="clinical-glass rounded-2xl p-8 shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                  {/* 🚀 修復：使用 .icon-fill 類別 */}
                  <span className="material-symbols-outlined text-primary icon-fill">info</span>
                  <h2 className="text-lg font-bold">行政資訊表單</h2>
                </div>
                <div className="space-y-4">
                   <div><label className="text-xs font-bold text-slate-500" htmlFor="v300-date">裝機日期</label><input id="v300-date" type="date" value={metadata.date} onChange={e => setMetadata({...metadata, date: e.target.value})} className="w-full p-3 rounded-lg border border-slate-200" /></div>
                   <div><label className="text-xs font-bold text-slate-500" htmlFor="v300-unit">單位</label><input id="v300-unit" type="text" value={metadata.unit} onChange={e => setMetadata({...metadata, unit: e.target.value})} className="w-full p-3 rounded-lg border border-slate-200" /></div>
                   <div><label className="text-xs font-bold text-slate-500" htmlFor="v300-app">填報人</label><input id="v300-app" type="text" value={metadata.applicant} onChange={e => setMetadata({...metadata, applicant: e.target.value})} className="w-full p-3 rounded-lg border border-slate-200" /></div>
                </div>
              </div>
            </section>

            <section className="col-span-7">
               <div className="clinical-glass rounded-2xl p-8 shadow-xl border-white/30 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-6">
                     <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-secondary icon-fill">settings_input_component</span>
                        <h2 className="text-lg font-bold">設備技術參數</h2>
                     </div>
                     <button onClick={() => setDevices([...devices, { type: "桌上型電腦", model: "", sn: "", mac: "", ip: "", name: "" }])} className="text-primary font-bold">+ 新增</button>
                  </div>
                  <table className="w-full">
                    <thead><tr className="text-left text-xs text-slate-400"><th>類型</th><th>序號</th><th>MAC</th><th className="text-right">操作</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {devices.map((d, i) => (
                        <tr key={i}>
                          <td className="py-4"><input value={d.type} onChange={e => { const nd = [...devices]; nd[i].type = e.target.value; setDevices(nd); }} className="w-full bg-transparent outline-none text-sm" /></td>
                          <td className="py-4"><input value={d.sn} onChange={e => { const nd = [...devices]; nd[i].sn = e.target.value.toUpperCase(); setDevices(nd); }} className="w-full bg-transparent outline-none text-sm font-mono text-red-600" /></td>
                          <td className="py-4"><input value={d.mac} onChange={e => handleMacInput(i, e.target.value)} className="w-full bg-transparent outline-none text-sm font-mono text-blue-600" /></td>
                          <td className="py-4 text-right">{devices.length > 1 && <button onClick={() => setDevices(devices.filter((_, idx) => idx !== i))} className="text-red-500">刪除</button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button onClick={handleSubmit} className="mt-auto w-full py-4 bg-primary text-white rounded-xl font-bold shadow-lg">提交核准</button>
               </div>
            </section>
          </div>
        </main>
      </div>

      {isLoading && <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-white/60 backdrop-blur-md"><div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>}
    </div>
  );
}