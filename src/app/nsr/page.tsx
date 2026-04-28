"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  getNsrList, 
  submitNsrData, 
  settleNsrRecord,
  updateNsrStatus,
  deleteNsrRecord
} from "@/lib/actions/nsr";
import { formatFloor } from "@/lib/logic/formatters";
import { calculateNsrPrice } from "@/lib/logic/pricing";

/**
 * ==========================================
 * 檔案：src/app/nsr/page.tsx
 * 狀態：V300.1 Medical M3 (型別對沖修復版)
 * 修復項目：
 * 1. Line 495: 校正 calculateNsrPrice 引數順序 (Fix TS2345)。
 * 2. 移除所有 inline style，將 SVG 與動力球延遲移至 CSS。
 * ==========================================
 */

interface NsrRecord {
  id: string; date: string; area: string; floor: string; unit: string; user: string; ext: string; points: number; type: string; desc: string; total: number; status: string; 
}

export default function NsrAdminPage() {
  const router = useRouter();
  const [globalNsrData, setGlobalNsrData] = useState<NsrRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loaderText, setLoaderText] = useState("初始化中...");
  const [formData, setFormData] = useState({ id: "", date: "", area: "A 區", floor: "", unit: "", userWithExt: "", points: 1, type: "CAT 6", reason: "" });
  const [settleItem, setSettleItem] = useState<NsrRecord | null>(null);
  const [isAddonWork, setIsAddonWork] = useState(false);
  const [usePanel, setUsePanel] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" | "info" }[]>([]);

  const showToast = useCallback((msg: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setLoaderText("對沖 115 矩陣...");
    try {
      const data = await getNsrList();
      const mapped = (data || []).map((r: any) => ({
        id: r.申請單號, date: r.申請日期, area: r.棟別, floor: r.樓層,
        unit: r.申請單位, user: r.申請人, ext: r.連絡電話, points: r.需求數量, 
        type: r.線材規格, desc: r.施工事由, total: r.行政核銷總額, status: r.處理狀態
      }));
      setGlobalNsrData(mapped as NsrRecord[]);
    } catch { showToast("數據對沖失敗", "error"); }
    finally { setIsLoading(false); }
  }, [showToast]);

  useEffect(() => {
    const auth = sessionStorage.getItem("asset_link_admin_auth");
    if (auth !== "true") { router.push("/"); return; }
    refreshData();
  }, [router, refreshData]);

  const handleIdInput = (val: string) => {
    const id = val.toUpperCase();
    setFormData(prev => ({ ...prev, id }));
    if (id.startsWith("C01") && id.length === 15) {
      const parsedDate = `${id.substring(3, 7)}-${id.substring(7, 9)}-${id.substring(9, 11)}`;
      setFormData(prev => ({ ...prev, date: parsedDate }));
      showToast("日期物理對正成功", "success");
    }
  };

  const handleNsrSubmit = async () => {
    if (!formData.id || !formData.unit || !formData.userWithExt) return showToast("欄位殘缺", "error");
    setIsLoading(true);
    const [user, ext] = formData.userWithExt.split("#");
    try {
      await submitNsrData({
        form_id: formData.id, request_date: formData.date, area: formData.area, floor: formatFloor(formData.floor),
        dept_code: "N/A", unit: formData.unit, applicant: user, phone: ext || "", qty: formData.points, cable_type: formData.type, reason: formData.reason
      });
      showToast("錄入成功", "success");
      setFormData({ id: "", date: "", area: "A 區", floor: "", unit: "", userWithExt: "", points: 1, type: "CAT 6", reason: "" });
      refreshData();
    } catch { showToast("寫入失敗", "error"); }
    finally { setIsLoading(false); }
  };

  const handleExportDispatch = async (item: NsrRecord) => {
    const content = `【ALink 派工】\n單號：${item.id}\n日期：${item.date}\n單位：${item.unit}\n地點：${item.area} ${item.floor}F\n需求：${item.desc}`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = `派工_${item.id}.txt`; link.click();
    await updateNsrStatus(item.id, "已派工"); refreshData();
  };

  const handleSettleCommit = async () => {
    if (!settleItem) return;
    setIsLoading(true);
    try {
      await settleNsrRecord({
        form_id: settleItem.id, isAddon: isAddonWork, usePanel: usePanel,
        finishRemark: `核銷：${isAddonWork ? "加成 " : ""}${usePanel ? "+面板" : ""}`
      });
      setSettleItem(null); refreshData();
    } catch { showToast("結算失敗", "error"); }
    finally { setIsLoading(false); }
  };

  const pendingPool = globalNsrData.filter(r => ["未處理", "待處理", "已派工"].includes(r.status));
  const settlePool = globalNsrData.filter(r => r.status === "已完工");
  const totalSettledAmount = globalNsrData.reduce((acc, curr) => acc + (curr.total || 0), 0);

  return (
    <div className="medical-gradient min-h-screen text-on-surface font-body-md antialiased flex relative overflow-x-hidden">
      <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries" async></script>
      <style dangerouslySetInnerHTML={{ __html: `
        .medical-gradient { background: radial-gradient(circle at top right, #e0f2fe 0%, #faf8ff 100%); }
        .clinical-glass { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.3); }
        .inner-glow { box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.4); }
        .zebra-glass tr:nth-child(even) { background: rgba(255, 255, 255, 0.2); }
        .vital-line { opacity: 0.3; stroke: #006194; stroke-width: 2; fill: none; }
        .fill-secondary { fill: #006c49; }
      `}} />

      {/* SideNavBar 簡化版介面 */}
      <aside className="w-64 fixed left-0 top-0 h-screen border-r border-white/20 clinical-glass flex flex-col p-6 z-50">
          <h2 className="text-xl font-bold text-sky-900 mb-8">ALink NSR</h2>
          <nav className="flex-1 space-y-2">
              <button onClick={() => router.push("/admin")} className="w-full text-left p-3 hover:bg-white/40 rounded-lg font-bold">首頁儀表板</button>
              <button className="w-full text-left p-3 bg-sky-600 text-white rounded-lg shadow-lg">施工結算池</button>
          </nav>
      </aside>

      <main className="ml-64 flex-1 p-8">
        <header className="mb-8 flex justify-between items-end">
          <div><h1 className="text-3xl font-bold text-primary">NSR 建設與結算中樞</h1><p className="text-slate-500">當前有 {pendingPool.length} 項施工任務待對沖。</p></div>
        </header>

        <div className="grid grid-cols-12 gap-6">
          <section className="col-span-4 clinical-glass rounded-xl p-8 inner-glow shadow-xl">
             <h2 className="text-lg font-bold mb-6">需求錄入</h2>
             <div className="space-y-4">
                <input id="nsr-form-id" title="單號" value={formData.id} onChange={e => handleIdInput(e.target.value)} placeholder="C01XXXXXXXXXXXX" className="w-full p-3 rounded-lg border border-slate-200" />
                <div className="grid grid-cols-2 gap-3">
                   <select id="nsr-area" title="區域" value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})} className="p-3 rounded-lg border border-slate-200">
                     {["A 區","B 區","C 區","兒醫","本院"].map(v => <option key={v} value={v}>{v}</option>)}
                   </select>
                   <input id="nsr-floor" title="樓層" placeholder="4F" value={formData.floor} onChange={e => setFormData({...formData, floor: e.target.value})} className="p-3 rounded-lg border border-slate-200" />
                </div>
                <input id="nsr-unit" title="單位" placeholder="申請單位" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full p-3 rounded-lg border border-slate-200" />
                <input id="nsr-user" title="申請人" placeholder="姓名#分機" value={formData.userWithExt} onChange={e => setFormData({...formData, userWithExt: e.target.value})} className="w-full p-3 rounded-lg border border-slate-200" />
                <button onClick={handleNsrSubmit} className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:brightness-110">提交行政對沖</button>
             </div>
          </section>

          <section className="col-span-8 space-y-6">
             <div className="clinical-glass rounded-xl p-6 inner-glow overflow-hidden">
                <h3 className="font-bold text-sky-800 mb-4">施工監控池 ({pendingPool.length})</h3>
                <table className="w-full zebra-glass">
                   <thead><tr className="text-left text-xs text-slate-400 uppercase">
                     <th className="p-4">案件資訊</th><th className="p-4">狀態</th><th className="p-4 text-right">操作</th>
                   </tr></thead>
                   <tbody>{pendingPool.map(item => (
                     <tr key={item.id}>
                       <td className="p-4"><strong>{item.id}</strong><br/><span className="text-xs">{item.unit} / {item.points} 點</span></td>
                       <td className="p-4 text-xs font-bold text-sky-600">{item.status}</td>
                       <td className="p-4 text-right">
                         <button onClick={() => handleExportDispatch(item)} className="p-2 text-primary hover:bg-sky-50 rounded">派工</button>
                         <button onClick={() => updateNsrStatus(item.id, "已完工").then(refreshData)} className="p-2 text-secondary hover:bg-emerald-50 rounded">完工</button>
                         <button onClick={() => deleteNsrRecord(item.id).then(refreshData)} className="p-2 text-error hover:bg-red-50 rounded">刪除</button>
                       </td>
                     </tr>
                   ))}</tbody>
                </table>
             </div>

             <div className="clinical-glass p-6 rounded-xl inner-glow bg-white/40">
                <div className="flex justify-between items-baseline mb-4">
                   <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">115 年度財務對沖總額</h2>
                   <span className="text-2xl font-black text-primary">${totalSettledAmount.toLocaleString()}</span>
                </div>
                <div className="space-y-3">
                   {settlePool.map(item => (
                     <div key={item.id} onClick={() => setSettleItem(item)} className="flex justify-between items-center p-4 bg-white/50 rounded-xl border border-white hover:border-sky-300 cursor-pointer transition-all">
                        <div><p className="text-sm font-bold">{item.unit}</p><p className="text-[10px] text-slate-400">{item.id} · {item.type}</p></div>
                        <button className="text-xs bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold">算帳</button>
                     </div>
                   ))}
                </div>
             </div>
          </section>
        </div>

        {/* 🚀 SVG 修正：移除 inline style 並加入類別 */}
        <div className="mt-8 h-24 w-full rounded-2xl overflow-hidden relative border border-white/40 clinical-glass">
          <svg className="absolute bottom-0 right-0 w-2/3 h-full" preserveAspectRatio="none" viewBox="0 0 400 100">
            <path className="vital-line" d="M0,80 L40,80 L50,20 L60,80 L100,80 L110,95 L120,80 L200,80 L215,10 L230,80 L300,80 L310,60 L320,80 L400,80" />
          </svg>
        </div>
      </main>

      {/* 🚀 結算 Modal 修正：校正 calculateNsrPrice 傳入順序 (規格, 點位, 加成, 面板) */}
      {settleItem && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-sky-900/30 backdrop-blur-md">
          <div className="clinical-glass p-10 rounded-[2.5rem] max-w-md w-full shadow-2xl animate-in zoom-in-95">
            <h4 className="text-xl font-bold text-sky-900 mb-8 text-center">年度合約計價結算</h4>
            <div className="space-y-4 bg-white/40 p-6 rounded-2xl border border-slate-100 mb-8">
                <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={isAddonWork} onChange={e => setIsAddonWork(e.target.checked)} className="w-5 h-5 rounded" /><span className="text-sm font-bold">符合加成施工條件</span></label>
                <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={usePanel} onChange={e => setUsePanel(e.target.checked)} className="w-5 h-5 rounded" /><span className="text-sm font-bold">加購 24 埠 PANEL (+$1,000)</span></label>
                <div className="pt-4 border-t border-slate-100 text-center">
                    <p className="text-[10px] text-slate-400 uppercase font-black">預估結算金額</p>
                    {/* 🚀 Fix TS2345: (spec: string, points: number, ...) */}
                    <p className="text-4xl font-black text-primary mt-1">
                        ${calculateNsrPrice(settleItem.type, settleItem.points, isAddonWork, usePanel).toLocaleString()}
                    </p>
                </div>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setSettleItem(null)} className="flex-1 py-3 bg-white border border-slate-200 rounded-xl font-bold">取消</button>
              <button onClick={handleSettleCommit} className="flex-[2] py-3 bg-primary text-white rounded-xl font-bold shadow-lg">確認入庫</button>
            </div>
          </div>
        </div>
      )}

      {(isLoading) && (
        <div className="fixed inset-0 z-[5000] flex flex-col items-center justify-center bg-white/60 backdrop-blur-md">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-primary rounded-full animate-spin mb-4"></div>
          <p className="text-primary font-black tracking-widest text-[10px] uppercase animate-pulse">{loaderText}</p>
        </div>
      )}
    </div>
  );
}