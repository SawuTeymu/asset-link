"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { checkIpConflict, submitInternalIssue } from "@/lib/actions/assets";
import { formatFloor, formatMAC } from "@/lib/logic/formatters";

// 🚀 引入共用模組
import AdminSidebar from "@/components/layout/AdminSidebar";
import TopNavbar from "@/components/layout/TopNavbar";

/**
 * ==========================================
 * 檔案：src/app/internal/page.tsx
 * 狀態：V2.0 模組化完全體 (DRY 重構版 + ESLint 綠燈)
 * 物理職責：內部人員直通結案庫之快速通道、實時 IP 防撞、17 欄位強同步
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
    type: "桌上型電腦",
    model: "",
    sn: "",
    mac1: "",
    mac2: "",
    ip: "",
    name: "",
    remark: ""
  });

  // --- 2. UI 狀態管理 ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loaderText, setLoaderText] = useState("");
  const [toast, setToast] = useState<{ id: number; msg: string; type: "success" | "error" } | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportContent, setReportContent] = useState("");

  // --- 3. 物理工具函式 ---
  const showToast = useCallback((msg: string, type: "success" | "error" = "error") => {
    const id = Date.now();
    setToast({ id, msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const handleLogout = useCallback(() => {
    if (confirm("確定結束管理工作並安全登出？")) {
      sessionStorage.removeItem("asset_link_admin_auth");
      router.push("/");
    }
  }, [router]);

  // --- 4. 實體驗證與初始化 ---
  useEffect(() => {
    const isAuth = sessionStorage.getItem("asset_link_admin_auth");
    if (!isAuth) { router.push("/"); }
  }, [router]);

  // --- 5. 設備標記名稱自動演算 (Auto-Naming Engine) ---
  useEffect(() => {
    const { area, floor, ext, ip } = formData;
    if (!area || !floor || !ip) return;

    let floorPart = floor.replace("樓", "").padStart(2, "0");
    if (floor.toUpperCase().startsWith("B")) {
        const bMatch = floor.toUpperCase().match(/B[1-3]/);
        floorPart = bMatch ? bMatch[0] : floor.toUpperCase();
    }

    let extNum = ext.includes("#") ? ext.split("#")[1] : ext;
    extNum = extNum.replace(/[^0-9]/g, "");
    if (extNum.length === 4) extNum = "1" + extNum;
    let extPart = extNum.padStart(5, "0");
    if (extPart === "00000" && extNum === "") extPart = "00000";

    const ipParts = ip.split(".");
    let nameResult = formData.name;
    if (ipParts.length === 4 && ipParts[3] !== "") {
      const lastOctet = ipParts[3].padStart(3, "0");
      nameResult = `${area}${floorPart}-${extPart}-${lastOctet}`.toUpperCase();
    }

    if (nameResult !== formData.name) {
      setFormData((prev) => ({ ...prev, name: nameResult }));
    }
  }, [formData.area, formData.floor, formData.ext, formData.ip, formData.name]);

  // --- 6. 提交與物理入庫 (Submit & Sync) ---
  const submitDirect = async () => {
    const { date, sn, ip, name, unit, floor } = formData;
    if (!date || !sn || !ip || !name || !unit || !floor) {
      return showToast("❌ 必填行政欄位缺失 (日期, 樓層, 單位, 序號, IP, 名稱)", "error");
    }

    setIsLoading(true);
    setLoaderText("掃描全院 IP 衝突...");

    try {
      // A. IP 防撞檢測
      const { conflict, source } = await checkIpConflict(ip, false);

      if (conflict) {
        setIsLoading(false);
        return showToast(`⚠️ IP 衝突！該位址已被 [${source}] 佔用。`, "error");
      }

      setLoaderText("物理入庫與結案對沖中...");
      
      // B. 構建物理裝載包
      const payload = {
        installDate: formData.date,
        area: formData.area,
        floor: formData.floor, // 後端與 Action 會執行 formatFloor
        unit: formData.unit,
        ext: formData.ext,
        type: formData.type,
        model: formData.model,
        sn: formData.sn.toUpperCase(),
        mac1: formData.mac1,
        mac2: formData.mac2,
        ip: formData.ip,
        name: formData.name,
        remark: formData.remark || "資產室內部核發"
      };

      // C. 寫入 Supabase
      const { success } = await submitInternalIssue(payload);

      if (success) {
        generateReport(payload);
        showToast("✅ 資產已完成物理入庫並結案", "success");
      }
    } catch (err: unknown) {
      showToast(`❌ 傳輸失敗：${err instanceof Error ? err.message : String(err)}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  // --- 7. 回執單生成與複製 ---
  const generateReport = (pkg: Record<string, string>) => {
    const txt = `【內部快速配發行政回執】
產生時間：${new Date().toLocaleString()}
同步狀態：已物理同步至歷史資料庫 (A-Q 17欄)

[1. 行政主表資料]
配發標記：${pkg.name}
部署位置：${pkg.area}棟 ${pkg.floor}
使用單位：${pkg.unit}
姓名/分機：${pkg.ext || '未提供'}

[2. 設備資產明細]
設備類型：${pkg.type}
品牌型號：${pkg.model || '未提供'}
設備序號：${pkg.sn}
分配 IP：${pkg.ip}
物理位址：${pkg.mac1 || '未提供'} (主)

系統聲明：本報告為行政結案憑證，請留存備查。`;
    
    setReportContent(txt);
    setReportModalOpen(true);
  };

  const copyReport = () => {
    navigator.clipboard.writeText(reportContent).then(() => {
      showToast("✅ 行政報告已複製至剪貼簿", "success");
    }).catch(() => {
      showToast("❌ 複製失敗，請手動全選複製", "error");
    });
  };

  const closeReportAndReset = () => {
    setReportModalOpen(false);
    const preservedDate = formData.date;
    setFormData({
      date: preservedDate,
      area: "A", floor: "", unit: "", ext: "", type: "桌上型電腦",
      model: "", sn: "", mac1: "", mac2: "", ip: "", name: "", remark: ""
    });
  };

  return (
    <div className="bg-[#f7f9fb] min-h-screen pb-10 font-[family-name:-apple-system,BlinkMacSystemFont,system-ui,sans-serif] text-[10.5px] text-[#1d1d1f] antialiased tracking-[-0.015em]">
      <style dangerouslySetInnerHTML={{ __html: `
        .glass-card { background: rgba(255, 255, 255, 0.45); backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px); border: 1px solid rgba(255, 255, 255, 0.6); box-shadow: 0 10px 40px rgba(0, 88, 188, 0.04); }
        .info-label { position: absolute; top: -7px; left: 12px; background: #fff; padding: 0 6px; font-size: 9px; font-weight: 800; color: #86868b; z-index: 10; letter-spacing: 0.05em; border-radius: 4px; border: 1px solid rgba(0,0,0,0.05); }
        .compact-input { background: rgba(255, 255, 255, 0.6); border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 12px; padding: 12px 16px; width: 100%; transition: all 0.2s; font-weight: 700; outline: none; }
        .compact-input:focus { background: white; border-color: #0058bc; box-shadow: 0 0 0 4px rgba(0, 88, 188, 0.1); }
      `}} />

      {/* 🚀 模組化側邊欄 */}
      <AdminSidebar currentRoute="/internal" isOpen={isSidebarOpen} onLogout={handleLogout} />

      <main className="lg:ml-64 px-4 lg:px-10 mt-6 max-w-5xl mx-auto space-y-6 flex flex-col min-h-screen pt-12">
        
        {/* 🚀 模組化頂部導覽列 */}
        <TopNavbar 
          title="內部緊急配發通道" 
          subtitle="Infrastructure Control"
          onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          showSearch={false}
        />

        <div className="mb-4">
            <p className="font-bold text-slate-500 text-sm">管理與手動執行 17 欄位行政強同步結案作業，繞過廠商審核流程。</p>
        </div>

        <section className="glass-card p-8 grid grid-cols-1 md:grid-cols-2 gap-8 relative pt-10 border-l-[6px] border-l-emerald-500 rounded-[2rem]">
          <div className="relative">
            <label className="info-label text-blue-600">裝機日期 (C)</label>
            <input type="date" title="裝機日期" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="compact-input" />
          </div>
          <div className="relative">
            <label className="info-label text-blue-600">院區棟別 (D)</label>
            <select title="院區棟別" value={formData.area} onChange={e => setFormData({ ...formData, area: e.target.value })} className="compact-input">
                {["A","B","C","D","E","G","H","I","K","T"].map(v => <option key={v} value={v}>{v} 棟</option>)}
            </select>
          </div>
          <div className="relative md:col-span-2">
            <label className="info-label text-blue-600">樓層區域 (E)</label>
            <input type="text" title="樓層區域" value={formData.floor} onBlur={e => setFormData({ ...formData, floor: formatFloor(e.target.value) })} onChange={e => setFormData({ ...formData, floor: e.target.value })} placeholder="例如：05 或 B1" className="compact-input" />
          </div>
          <div className="relative">
            <label className="info-label">使用單位 (F)</label>
            <input type="text" title="使用單位" value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} placeholder="護理站、藥劑科..." className="compact-input" />
          </div>
          <div className="relative">
            <label className="info-label">申請人#分機 (G)</label>
            <input type="text" title="申請人與分機" value={formData.ext} onChange={e => setFormData({ ...formData, ext: e.target.value })} placeholder="姓名#分機" className="compact-input" />
          </div>
        </section>

        <section className="glass-card p-8 space-y-8 relative pt-10 border-l-[6px] border-l-slate-900 rounded-[2rem]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="relative">
                <label className="info-label">資產類型 (H)</label>
                <select title="資產類型" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} className="compact-input">
                    <option value="桌上型電腦">桌上型電腦</option><option value="筆記型電腦">筆記型電腦</option>
                    <option value="印表機">印表機</option><option value="行政周邊">行政周邊</option>
                </select>
            </div>
            <div className="relative">
                <label className="info-label">品牌型號 (I)</label>
                <input type="text" title="品牌型號" value={formData.model} onChange={e => setFormData({ ...formData, model: e.target.value })} placeholder="例如：HP ProDesk 600" className="compact-input" />
            </div>
          </div>
          <div className="relative">
              <label className="info-label text-red-500 font-black">產品序號 S/N (J)</label>
              <input type="text" title="產品序號" value={formData.sn} maxLength={12} onChange={e => setFormData({ ...formData, sn: e.target.value.toUpperCase() })} className="compact-input font-mono uppercase tracking-widest bg-red-50/30 text-red-700" placeholder="嚴格 12 位元" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="relative">
                <label className="info-label text-blue-600 font-bold">主要 MAC (K)</label>
                <input type="text" title="主要 MAC" value={formData.mac1} onChange={e => setFormData({ ...formData, mac1: formatMAC(e.target.value) })} className="compact-input font-mono uppercase text-blue-700" placeholder="XX:XX:XX:XX:XX:XX" maxLength={17} />
             </div>
             <div className="relative">
                <label className="info-label text-emerald-600 font-bold">無線 MAC (L)</label>
                <input type="text" title="無線 MAC" value={formData.mac2} onChange={e => setFormData({ ...formData, mac2: formatMAC(e.target.value) })} className="compact-input font-mono uppercase text-emerald-700" placeholder="若無則留空" maxLength={17} />
             </div>
          </div>
          <div className="relative">
              <label className="info-label text-slate-500">行政備註</label>
              <textarea title="備註" value={formData.remark} onChange={e => setFormData({ ...formData, remark: e.target.value })} rows={2} className="compact-input" placeholder="可填寫特殊配發原因..." />
          </div>
        </section>

        <section className="glass-card p-8 bg-blue-50/10 space-y-8 relative pt-10 border-dashed border-blue-200 rounded-[2rem]">
          <div className="relative">
              <label className="info-label text-blue-600 font-bold">核定 IP 位址 (N)</label>
              <input type="text" title="核定 IP" value={formData.ip} onChange={e => setFormData({ ...formData, ip: e.target.value })} className="compact-input font-mono text-base font-bold text-blue-800 bg-blue-50/30" placeholder="10.x.x.x" />
          </div>
          <div className="relative">
              <label className="info-label text-emerald-600 font-bold">自動標記名稱 (M)</label>
              <input type="text" title="設備標記名稱" value={formData.name} readOnly className="compact-input bg-emerald-50/30 font-mono text-sm uppercase tracking-tight text-emerald-800 outline-none" placeholder="系統自動演算中..." />
          </div>
        </section>

        <button onClick={submitDirect} disabled={isLoading} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black shadow-xl shadow-slate-900/20 active:scale-95 transition-all text-sm tracking-[0.3em] uppercase flex items-center justify-center gap-2 disabled:opacity-50">
          {isLoading ? <span className="material-symbols-outlined animate-spin">refresh</span> : <span className="material-symbols-outlined text-[18px]">verified</span>}
          執行物理入庫結案
        </button>

      </main>

      {/* 🚀 行政回執單彈窗 */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center bg-slate-900/50 backdrop-blur-md p-4 fade-enter">
          <div className="glass-card w-full max-w-2xl rounded-[2rem] p-8 shadow-2xl flex flex-col bg-white/95 border-t-[8px] border-t-emerald-500">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-emerald-600 text-[28px]">receipt_long</span>
                      <h3 className="text-slate-800 text-xl font-black tracking-tight">內部行政回執單</h3>
                  </div>
                  <button onClick={closeReportAndReset} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-colors">
                      <span className="material-symbols-outlined text-sm">close</span>
                  </button>
              </div>
              <div className="flex-1 bg-slate-50/50 rounded-2xl border border-slate-200/50 shadow-inner p-2 mb-6">
                  <textarea title="回執單內容" readOnly value={reportContent} className="w-full h-64 text-[11.5px] font-mono p-4 bg-transparent border-none focus:ring-0 text-slate-700 leading-relaxed outline-none resize-none"></textarea>
              </div>
              <div className="flex justify-end gap-3">
                  <button onClick={copyReport} className="px-6 py-3.5 bg-white border border-slate-200 text-slate-700 text-xs font-black rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-colors uppercase tracking-widest shadow-sm flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">content_copy</span> 複製內容
                  </button>
                  <button onClick={closeReportAndReset} className="px-8 py-3.5 bg-slate-900 text-white text-xs font-black rounded-xl shadow-lg active:scale-95 transition-all uppercase tracking-widest">
                      完成並關閉
                  </button>
              </div>
          </div>
        </div>
      )}

      {/* 強同步遮罩 */}
      {isLoading && (
        <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-white/80 backdrop-blur-xl">
           <div className="w-12 h-12 border-4 border-primary-fixed border-t-primary rounded-full animate-spin mb-4"></div>
           <p className="text-[12px] font-black text-primary uppercase tracking-widest mt-4">{loaderText}</p>
        </div>
      )}

      {/* 通知系統 */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[1100] flex flex-col gap-3 pointer-events-none w-full max-w-[320px] px-5">
        {toast && (
          <div className={`px-6 py-4 rounded-3xl shadow-2xl font-black text-[11px] animate-bounce flex items-center gap-3 border border-white/20 pointer-events-auto text-white ${toast.type === "success" ? "bg-slate-900" : "bg-red-600"}`}>
            <span className="material-symbols-outlined text-base">{toast.type === "success" ? "check_circle" : "error"}</span>
            <span>{toast.msg}</span>
          </div>
        )}
      </div>
    </div>
  );
}