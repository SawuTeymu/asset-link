
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/**
 * ==========================================
 * 檔案：src/app/keyin/page.tsx
 * 狀態：V300.3 Medical M3 (RWD 手機模式版)
 * ==========================================
 */

export default function KeyinPage() {
  const router = useRouter();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
    if (!metadata.unit || !metadata.applicant) {
      setToasts([{ id: Date.now(), msg: "請填寫單位與人員", type: "error" }]); return;
    }
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 1500));
    setDevices([{ type: "桌上型電腦", model: "", sn: "", mac: "", ip: "", name: "" }]);
    setIsLoading(false);
    setToasts([{ id: Date.now(), msg: "預約錄入成功", type: "success" }]);
  };

  return (
    <div className="min-h-screen text-on-surface font-body-md overflow-x-hidden relative bg-[#faf8ff] antialiased">
      <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries" async></script>
      <style dangerouslySetInnerHTML={{ __html: `
        .clinical-glass { background: rgba(255, 255, 255, 0.75); backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.5); }
        .crystal-input { width: 100%; background: rgba(255, 255, 255, 0.5); border: 1px solid rgba(203, 213, 225, 0.8); border-radius: 0.5rem; padding: 12px 16px; font-size: 14px; outline: none; }
        .crystal-input:focus { border-color: #006194; box-shadow: 0 0 0 2px rgba(0, 97, 148, 0.2); }
      `}} />

      {/* 🚀 手機版遮罩 */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-sky-900/20 backdrop-blur-sm z-[45] md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* TopNavBar */}
      <nav className="sticky top-0 w-full flex justify-between items-center px-4 md:px-6 h-16 bg-white/70 backdrop-blur-xl border-b border-white/40 shadow-sm z-40">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-sky-800 p-1">
             <span className="material-symbols-outlined">menu</span>
          </button>
          <span className="text-lg md:text-xl font-bold bg-gradient-to-r from-sky-700 to-sky-500 bg-clip-text text-transparent truncate max-w-[200px] md:max-w-none">Vendor Portal</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/")} className="material-symbols-outlined text-slate-500 hover:text-sky-600">logout</button>
          <img alt="User" className="h-8 w-8 rounded-full border border-sky-100 hidden sm:block" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAtEHQm-ZzIEoIi31GFpkrjNbmYClcVWiOR8tfPVRFW8snxGFJmy8eEaOx3wXFDHwGue8GCifx88G47wJH7oV9mXA1qotMDvfuBiLo02nr05ie-d-0qHpsyxNyUeacnwmPZnR4PhNkmYkpcJI3_Hnw3Tg_AO619Ujap5o9s4s3e5UBiC3spul_ibpp45IUMSphLADu7sNgP4wztyZUPwYONMsWI55r5D4Iy1qKrzlmTy5069THuH9PONYstGnG_cxxOsF1GHYkuOao" />
        </div>
      </nav>

      <div className="flex">
        {/* SideNavBar (RWD) */}
        <aside className={`w-64 fixed left-0 top-0 h-screen pt-16 border-r border-white/30 bg-white/80 backdrop-blur-2xl p-6 z-50 transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
          <div className="flex justify-between items-center mb-8">
            <p className="text-lg font-black text-sky-800">廠商作業</p>
            <button className="md:hidden text-slate-500" onClick={() => setIsMobileMenuOpen(false)}><span className="material-symbols-outlined">close</span></button>
          </div>
          <nav className="space-y-2">
             <button className="w-full text-left p-3 bg-sky-50 text-sky-700 rounded-xl font-bold border-l-4 border-sky-600">預約錄入</button>
          </nav>
        </aside>

        {/* Main Canvas (RWD) */}
        <main className="w-full md:ml-64 p-4 md:p-8">
          <header className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 truncate">廠商作業區 : {vendorName}</h1>
            <p className="text-xs md:text-sm text-slate-500 mt-1">請填寫行政資訊與實體 MAC 參數</p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* 行政資訊 */}
            <section className="col-span-1 lg:col-span-4">
              <div className="clinical-glass rounded-2xl p-5 md:p-8 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                  <span className="material-symbols-outlined text-blue-600">info</span>
                  <h2 className="text-lg font-bold text-slate-800">行政資訊</h2>
                </div>
                <div className="space-y-4">
                   <div><label className="text-xs font-bold text-slate-500 mb-1 block">裝機日期</label><input type="date" value={metadata.date} onChange={e => setMetadata({...metadata, date: e.target.value})} className="crystal-input" /></div>
                   <div className="grid grid-cols-2 gap-3">
                     <div>
                       <label className="text-xs font-bold text-slate-500 mb-1 block">院區</label>
                       <select value={metadata.area} onChange={e => setMetadata({...metadata, area: e.target.value})} className="crystal-input">
                         {["總院區","東院區","南院區"].map(v => <option key={v} value={v}>{v}</option>)}
                       </select>
                     </div>
                     <div><label className="text-xs font-bold text-slate-500 mb-1 block">樓層</label><input type="text" value={metadata.floor} onChange={e => setMetadata({...metadata, floor: e.target.value})} placeholder="如: 12F" className="crystal-input" /></div>
                   </div>
                   <div><label className="text-xs font-bold text-slate-500 mb-1 block">單位全稱</label><input type="text" value={metadata.unit} onChange={e => setMetadata({...metadata, unit: e.target.value})} placeholder="如: 護理部" className="crystal-input" /></div>
                   <div><label className="text-xs font-bold text-slate-500 mb-1 block">填報人 (#分機)</label><input type="text" value={metadata.applicant} onChange={e => setMetadata({...metadata, applicant: e.target.value})} placeholder="姓名#1234" className="crystal-input" /></div>
                </div>
              </div>
            </section>

            {/* 技術參數 Table (手機橫向滑動) */}
            <section className="col-span-1 lg:col-span-8 flex flex-col">
               <div className="clinical-glass rounded-2xl p-5 md:p-8 shadow-sm flex flex-col flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                     <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-emerald-600">dns</span>
                        <h2 className="text-lg font-bold text-slate-800">設備技術參數</h2>
                     </div>
                     <button onClick={() => setDevices([...devices, { type: "桌上型電腦", model: "", sn: "", mac: "", ip: "", name: "" }])} className="text-blue-600 font-bold bg-blue-50 px-4 py-2 rounded-lg self-start sm:self-auto">+ 新增設備</button>
                  </div>
                  
                  {/* 🚀 Table RWD Wrapper */}
                  <div className="overflow-x-auto w-full flex-1">
                    <table className="w-full text-left min-w-[600px]">
                      <thead><tr className="text-xs text-slate-500 border-b border-slate-200">
                        <th className="pb-3 px-2">類型</th><th className="pb-3 px-2">序號 (大寫)</th><th className="pb-3 px-2">MAC (自動對沖)</th><th className="pb-3 px-2 text-right">操作</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {devices.map((d, i) => (
                          <tr key={i} className="hover:bg-slate-50/50">
                            <td className="py-3 px-2"><select value={d.type} onChange={e => { const nd = [...devices]; nd[i].type = e.target.value; setDevices(nd); }} className="w-full bg-transparent border border-slate-200 rounded p-2 text-sm outline-none"><option>桌上型電腦</option><option>筆記型電腦</option><option>印表機</option></select></td>
                            <td className="py-3 px-2"><input placeholder="SN" value={d.sn} onChange={e => { const nd = [...devices]; nd[i].sn = e.target.value.toUpperCase(); setDevices(nd); }} className="w-full bg-transparent border border-slate-200 rounded p-2 text-sm font-mono text-red-600 outline-none" /></td>
                            <td className="py-3 px-2"><input placeholder="MAC" value={d.mac} onChange={e => handleMacInput(i, e.target.value)} className="w-full bg-transparent border border-slate-200 rounded p-2 text-sm font-mono text-blue-600 outline-none" /></td>
                            <td className="py-3 px-2 text-right">{devices.length > 1 && <button onClick={() => setDevices(devices.filter((_, idx) => idx !== i))} className="text-red-500 p-2"><span className="material-symbols-outlined text-sm">delete</span></button>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button onClick={handleSubmit} disabled={isLoading} className="mt-6 w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-md hover:bg-blue-700 active:scale-95 transition-all">
                    {isLoading ? "同步中..." : "提交預約核准"}
                  </button>
               </div>
            </section>
          </div>
        </main>
      </div>

      {toasts.map(t => (
        <div key={t.id} className="fixed bottom-6 right-4 md:bottom-10 md:right-8 z-[6000] px-6 py-3 rounded-lg shadow-lg font-bold text-xs flex items-center gap-2 bg-slate-800 text-white animate-in slide-in-from-right-4">
          <span className="material-symbols-outlined text-sm">{t.type === 'success' ? 'check_circle' : 'error'}</span> {t.msg}
        </div>
      ))}
    </div>
  );
}