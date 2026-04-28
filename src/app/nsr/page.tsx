"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getNsrList, submitNsrData, settleNsrRecord, updateNsrStatus, deleteNsrRecord } from "@/lib/actions/nsr";
import { formatFloor } from "@/lib/logic/formatters";
import { calculateNsrPrice } from "@/lib/logic/pricing";

/**
 * ==========================================
 * 檔案：src/app/nsr/page.tsx
 * 狀態：V300.3 Medical M3 (RWD 手機模式版)
 * ==========================================
 */
interface NsrRecord { id: string; date: string; area: string; floor: string; unit: string; user: string; ext: string; points: number; type: string; desc: string; total: number; status: string; }

export default function NsrAdminPage() {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [globalNsrData, setGlobalNsrData] = useState<NsrRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState({ id: "", date: "", area: "A 區", floor: "", unit: "", userWithExt: "", points: 1, type: "CAT 6", reason: "" });
  const [settleItem, setSettleItem] = useState<NsrRecord | null>(null);
  const [isAddonWork, setIsAddonWork] = useState(false);
  const [usePanel, setUsePanel] = useState(false);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getNsrList();
      const mapped = (data || []).map((r: any) => ({ id: r.申請單號, date: r.申請日期, area: r.棟別, floor: r.樓層, unit: r.申請單位, user: r.申請人, ext: r.連絡電話, points: r.需求數量, type: r.線材規格, desc: r.施工事由, total: r.行政核銷總額, status: r.處理狀態 }));
      setGlobalNsrData(mapped as NsrRecord[]);
    } catch (err) { console.error(err); } finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem("asset_link_admin_auth") !== "true") { router.push("/"); return; }
    refreshData();
  }, [router, refreshData]);

  const handleIdInput = (val: string) => {
    const id = val.toUpperCase(); setFormData(prev => ({ ...prev, id }));
    if (id.startsWith("C01") && id.length === 15) setFormData(prev => ({ ...prev, date: `${id.substring(3, 7)}-${id.substring(7, 9)}-${id.substring(9, 11)}` }));
  };

  const handleNsrSubmit = async () => {
    if (!formData.id || !formData.unit) return;
    setIsLoading(true);
    const [user, ext] = formData.userWithExt.split("#");
    try {
      await submitNsrData({ form_id: formData.id, request_date: formData.date, area: formData.area, floor: formatFloor(formData.floor), dept_code: "N/A", unit: formData.unit, applicant: user, phone: ext || "", qty: formData.points, cable_type: formData.type, reason: formData.reason });
      setFormData({ id: "", date: "", area: "A 區", floor: "", unit: "", userWithExt: "", points: 1, type: "CAT 6", reason: "" });
      refreshData();
    } finally { setIsLoading(false); }
  };

  const handleSettleCommit = async () => {
    if (!settleItem) return;
    setIsLoading(true);
    try {
      await settleNsrRecord({ form_id: settleItem.id, isAddon: isAddonWork, usePanel: usePanel, finishRemark: `核銷：${isAddonWork ? "加成 " : ""}${usePanel ? "+面板" : ""}` });
      setSettleItem(null); refreshData();
    } finally { setIsLoading(false); }
  };

  const pendingPool = globalNsrData.filter(r => ["未處理", "待處理", "已派工"].includes(r.status));
  const settlePool = globalNsrData.filter(r => r.status === "已完工");

  return (
    <div className="bg-[#faf8ff] text-slate-800 font-body-md min-h-screen flex relative overflow-x-hidden antialiased">
      <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries" async></script>
      <style dangerouslySetInnerHTML={{ __html: `.clinical-glass { background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.4); } .zebra-glass tr:nth-child(even) { background: rgba(0,0,0,0.02); }`}} />

      {isMobileMenuOpen && <div className="fixed inset-0 bg-sky-900/20 backdrop-blur-sm z-[45] md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>}

      <aside className={`w-64 fixed left-0 top-0 h-screen border-r border-white/40 clinical-glass flex flex-col p-6 z-50 transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-black text-sky-800">ALink NSR</h2>
            <button className="md:hidden text-slate-500" onClick={() => setIsMobileMenuOpen(false)}><span className="material-symbols-outlined">close</span></button>
          </div>
          <nav className="flex-1 space-y-2">
              <button onClick={() => router.push("/admin")} className="w-full text-left p-3 hover:bg-slate-100 rounded-lg font-bold text-slate-600">首頁儀表板</button>
              <button className="w-full text-left p-3 bg-blue-600 text-white rounded-lg shadow-md font-bold">施工結算池</button>
          </nav>
      </aside>

      <main className="w-full md:ml-64 flex-1 flex flex-col min-h-screen">
        <header className="px-4 md:px-8 py-4 bg-white/60 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 flex items-center gap-4">
           <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-sky-800"><span className="material-symbols-outlined">menu</span></button>
           <h1 className="text-xl font-bold text-sky-800">NSR 建設中樞</h1>
        </header>

        <div className="p-4 md:p-8 grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* 左側：需求錄入 */}
          <section className="col-span-1 xl:col-span-4 clinical-glass rounded-2xl p-5 md:p-8 shadow-sm">
             <h2 className="text-lg font-bold mb-6 text-slate-800 border-b border-slate-200 pb-3">需求錄入</h2>
             <div className="space-y-4">
                <input value={formData.id} onChange={e => handleIdInput(e.target.value)} placeholder="單號 (C01...)" className="w-full p-3 rounded-lg border border-slate-200 bg-white/50 focus:ring-2 focus:ring-blue-500 outline-none font-mono" />
                <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full p-3 rounded-lg border border-slate-200 bg-white/50 focus:ring-2 focus:ring-blue-500 outline-none" />
                <div className="grid grid-cols-2 gap-3">
                   <select value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})} className="p-3 rounded-lg border border-slate-200 bg-white/50 focus:ring-2 focus:ring-blue-500 outline-none">
                     {["A 區","B 區","C 區","兒醫"].map(v => <option key={v} value={v}>{v}</option>)}
                   </select>
                   <input placeholder="樓層" value={formData.floor} onChange={e => setFormData({...formData, floor: e.target.value})} className="p-3 rounded-lg border border-slate-200 bg-white/50 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <input placeholder="申請單位" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full p-3 rounded-lg border border-slate-200 bg-white/50 focus:ring-2 focus:ring-blue-500 outline-none" />
                <button onClick={handleNsrSubmit} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 mt-2 shadow-sm">提交行政對沖</button>
             </div>
          </section>

          {/* 右側：監控池與結算 */}
          <section className="col-span-1 xl:col-span-8 flex flex-col gap-6">
             {/* 施工監控池 (RWD Table) */}
             <div className="clinical-glass rounded-2xl p-5 md:p-6 shadow-sm flex-1">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-blue-600">vitals</span>施工監控池 ({pendingPool.length})</h3>
                <div className="overflow-x-auto">
                  <table className="w-full zebra-glass min-w-[500px]">
                     <thead><tr className="text-left text-xs text-slate-500 border-b border-slate-200"><th className="p-3">案件資訊</th><th className="p-3">狀態</th><th className="p-3 text-right">操作</th></tr></thead>
                     <tbody>{pendingPool.map(item => (
                       <tr key={item.id}>
                         <td className="p-3"><p className="font-bold font-mono">{item.id}</p><p className="text-xs text-slate-500">{item.unit} / {item.points} 點</p></td>
                         <td className="p-3"><span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded">{item.status}</span></td>
                         <td className="p-3 text-right flex justify-end gap-1">
                           <button onClick={() => updateNsrStatus(item.id, "已完工").then(refreshData)} className="p-2 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100"><span className="material-symbols-outlined text-sm">check_circle</span></button>
                           <button onClick={() => deleteNsrRecord(item.id).then(refreshData)} className="p-2 bg-red-50 text-red-600 rounded hover:bg-red-100"><span className="material-symbols-outlined text-sm">delete</span></button>
                         </td>
                       </tr>
                     ))}</tbody>
                  </table>
                </div>
             </div>

             {/* 財務對沖 */}
             <div className="clinical-glass rounded-2xl p-5 md:p-6 shadow-sm bg-white/60 border-t-4 border-t-emerald-500">
                <h3 className="font-bold text-slate-800 mb-4">待財務核銷 ({settlePool.length})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                   {settlePool.map(item => (
                     <div key={item.id} onClick={() => setSettleItem(item)} className="flex justify-between items-center p-4 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 cursor-pointer shadow-sm">
                        <div className="overflow-hidden pr-2"><p className="text-sm font-bold truncate">{item.unit}</p><p className="text-[10px] text-slate-400 font-mono truncate">{item.id}</p></div>
                        <button className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-bold flex-shrink-0">算帳</button>
                     </div>
                   ))}
                 </div>
             </div>
          </section>
        </div>
      </main>

      {/* 結算 Modal (RWD) */}
      {settleItem && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-6 bg-slate-900/40 backdrop-blur-sm">
          <div className="clinical-glass p-6 md:p-10 rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95 bg-white">
            <h4 className="text-xl font-black text-slate-800 mb-6 text-center">合約計價結算</h4>
            <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200 mb-6">
                <p className="text-xs font-bold text-slate-500 text-center font-mono">{settleItem.id}</p>
                <label className="flex items-center gap-3"><input type="checkbox" checked={isAddonWork} onChange={e => setIsAddonWork(e.target.checked)} className="w-5 h-5 rounded border-slate-300" /><span className="text-sm font-bold">符合加成施工條件</span></label>
                <label className="flex items-center gap-3"><input type="checkbox" checked={usePanel} onChange={e => setUsePanel(e.target.checked)} className="w-5 h-5 rounded border-slate-300" /><span className="text-sm font-bold">加購 24 埠 PANEL (+$1,000)</span></label>
                <div className="pt-4 border-t border-slate-200 text-center">
                    <p className="text-[10px] text-slate-400 uppercase font-bold">結算金額</p>
                    <p className="text-3xl font-black text-emerald-600 mt-1">${calculateNsrPrice(settleItem.type, settleItem.points, isAddonWork, usePanel).toLocaleString()}</p>
                </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setSettleItem(null)} className="flex-1 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600">取消</button>
              <button onClick={handleSettleCommit} className="flex-[2] py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-md">確認入庫</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}