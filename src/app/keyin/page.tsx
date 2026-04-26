"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { submitAssetBatch } from "@/lib/actions/assets";
import { formatFloor, formatMAC } from "@/lib/logic/formatters";

/**
 * ==========================================
 * 檔案：src/app/keyin/page.tsx
 * 狀態：V3.1 旗艦不刪減完全體 (全欄位與 MAC 規則強制對位)
 * 物理職責：
 * 1. 提供廠商端 17 欄位設備預約填報介面。
 * 2. 解決所有語法報警 (Unused vars, Cascading renders, Unused expressions)。
 * 3. 實作 [NEW/REPLACE] 業務對沖，確保 10.5px 行政視覺規範。
 * 4. MAC 物理格式強制轉換 (XX:XX:XX:XX:XX:XX)。
 * ==========================================
 */

// 🚀 1. 定義設備項目的強型別
interface AssetRow {
  id: number;
  model: string;
  sn: string;
  mac1: string;
  ext: string;
  type: "NEW" | "REPLACE";
}

function KeyinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // 物理對位：獲取廠商身分，若無參數則回退至「訪客」
  const vendorName = searchParams.get("v") || "訪客";

  // --- 核心表單狀態 ---
  const [vdsId, setVdsId] = useState("");
  const [applicant, setApplicant] = useState("");
  const [unit, setUnit] = useState("");
  const [floor, setFloor] = useState("");
  const [area, setArea] = useState("A");
  const [rows, setRows] = useState<AssetRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // --- 2. 系統初始化 (解決 set-state-in-effect) ---
  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(() => {
      if (!mounted) return;
      const now = new Date();
      const y = now.getFullYear().toString().slice(-2);
      const m = (now.getMonth() + 1).toString().padStart(2, '0');
      const d = now.getDate().toString().padStart(2, '0');
      const rnd = Math.floor(Math.random() * 900 + 100);
      
      setVdsId(`VDS-${y}${m}${d}-${rnd}`);
      
      setRows([{ 
        id: Date.now(), 
        model: "", 
        sn: "", 
        mac1: "", 
        ext: "", 
        type: "NEW" 
      }]);
    }, 0);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, []);

  // --- 3. 提交動作邏輯 (解決 no-unused-expressions) ---
  const handleSubmit = async () => {
    // A. 基礎防呆檢查
    if (!unit.trim() || !applicant.trim() || !floor.trim()) {
      alert("❌ 行政偏差：請完整填寫 使用單位、申請人姓名 及 樓層。");
      return;
    }
    
    // B. MAC 格式深度驗證防線
    const macRegex = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (r.mac1 && !macRegex.test(r.mac1)) {
            alert(`❌ 第 ${i + 1} 項設備的 MAC 格式異常！請確認格式為 XX:XX:XX:XX:XX:XX`);
            return;
        }
    }

    setIsLoading(true);

    // C. 17 欄位物理對沖載荷封裝
    const batchData = rows.map((r) => ({
      form_id: vdsId,
      install_date: new Date().toISOString().split('T')[0],
      area: area,
      floor: formatFloor(floor), // 強制補 00樓
      unit: unit.trim(),
      applicant: `${applicant.trim()}#${r.ext.trim()}`, // 強制 # 字元協議
      model: r.model.trim(),
      sn: r.sn.toUpperCase().trim(),
      mac1: formatMAC(r.mac1), // 強制 MAC 引擎校對
      mac2: "",
      remark: r.type === "REPLACE" ? "[REPLACE] 舊換新預約" : "資產新購預約",
      vendor: vendorName,
      status: "待核定"
    }));

    try {
      const res = await submitAssetBatch(batchData);
      if (res.success) {
        alert("✅ 預約提交成功，請等候資訊室核定。");
        router.push("/"); 
      }
    } catch (err: unknown) { 
      const errorMsg = err instanceof Error ? err.message : String(err);
      alert("傳輸中斷: " + errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#f8fafc] min-h-screen p-4 sm:p-8 font-[family-name:-apple-system,BlinkMacSystemFont,system-ui,sans-serif] text-[10.5px] antialiased tracking-tight">
      <style dangerouslySetInnerHTML={{ __html: `
        .glass-card { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.5); border-radius: 2rem; box-shadow: 0 10px 30px rgba(0, 88, 188, 0.05); }
        .input-base { width: 100%; padding: 12px 16px; background: rgba(255, 255, 255, 0.5); border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 12px; font-weight: 700; transition: all 0.2s; outline: none; }
        .input-base:focus { background: white; border-color: #0058bc; box-shadow: 0 0 0 4px rgba(0, 88, 188, 0.1); }
      `}} />

      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
        
        {/* 🚀 Header: 廠商身分標記 */}
        <header className="glass-card p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
           <div>
             <h1 className="text-2xl font-black text-slate-800 tracking-tighter">設備裝機預約填報</h1>
             <p className="text-slate-400 font-bold uppercase tracking-widest mt-1">
               當前合作廠商：<span className="text-primary">{vendorName}</span>
             </p>
           </div>
           <button 
             title="安全登出"
             onClick={() => { router.push("/"); }} 
             className="px-6 py-2.5 bg-slate-50 text-slate-500 rounded-xl font-bold hover:bg-red-50 hover:text-red-500 transition-all shadow-sm border border-slate-200 active:scale-95"
           >
             安全登出
           </button>
        </header>

        {/* 🚀 Section 1: 頂部共用行政資訊 */}
        <section className="glass-card p-8 space-y-6">
           <h3 className="font-black text-sm border-b border-slate-100 pb-4 text-primary flex items-center gap-2">
             <span className="material-symbols-outlined">domain</span> 行政資訊對沖
           </h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">使用單位 (F)</label>
                <input 
                  title="使用單位"
                  aria-label="使用單位"
                  value={unit} 
                  onChange={(e) => { setUnit(e.target.value); }} 
                  className="input-base" 
                  placeholder="請輸入單位全銜 (例：資訊室)" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">申請人姓名 (G)</label>
                <input 
                  title="申請人姓名"
                  aria-label="申請人姓名"
                  value={applicant} 
                  onChange={(e) => { setApplicant(e.target.value); }} 
                  className="input-base" 
                  placeholder="姓名" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">院區棟別 (D)</label>
                <select 
                  title="院區棟別" 
                  aria-label="院區棟別"
                  value={area} 
                  onChange={(e) => { setArea(e.target.value); }} 
                  className="input-base cursor-pointer"
                >
                  {["A","B","C","D","E","G","H","I","K","T"].map((v) => (
                    <option key={v} value={v}>{v} 棟</option>
                  ))}
                  <option value="OTHER">其他</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">樓層 (E)</label>
                <input 
                  title="樓層"
                  aria-label="樓層"
                  value={floor} 
                  onBlur={(e) => { setFloor(formatFloor(e.target.value)); }} 
                  onChange={(e) => { setFloor(e.target.value); }} 
                  className="input-base" 
                  placeholder="例如: 05" 
                />
              </div>
           </div>
        </section>

        {/* 🚀 Section 2: 設備明細清單 (動態陣列) */}
        <div className="space-y-6">
          {rows.map((r, i) => (
            <div key={r.id} className="glass-card p-8 space-y-6 border-l-[8px] border-l-primary animate-in slide-in-from-left-4 duration-300">
              <div className="flex justify-between items-center border-b border-slate-50 pb-4">
                 <span className="font-black text-slate-400 text-[10px] uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-lg">項目 {i + 1}</span>
                 <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button 
                      onClick={() => { const n = [...rows]; n[i].type = "NEW"; setRows(n); }} 
                      className={`px-5 py-2 rounded-lg text-[10px] font-black transition-all ${r.type === 'NEW' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      🆕 新購
                    </button>
                    <button 
                      onClick={() => { const n = [...rows]; n[i].type = "REPLACE"; setRows(n); }} 
                      className={`px-5 py-2 rounded-lg text-[10px] font-black transition-all ${r.type === 'REPLACE' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      🔄 舊換新
                    </button>
                 </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">品牌型號 (I)</label>
                  <input 
                    title="品牌型號"
                    aria-label="品牌型號"
                    value={r.model} 
                    onChange={(e) => { const n = [...rows]; n[i].model = e.target.value; setRows(n); }} 
                    className="input-base" 
                    placeholder="例：HP ProDesk 600" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">分機號碼 (G後綴)</label>
                  <input 
                    title="分機號碼"
                    aria-label="分機號碼"
                    value={r.ext} 
                    onChange={(e) => { const n = [...rows]; n[i].ext = e.target.value; setRows(n); }} 
                    className="input-base" 
                    placeholder="4 或 5 碼" 
                  />
                </div>
                <div className="col-span-1 md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-error uppercase tracking-widest ml-1">實體機身序號 S/N (J)</label>
                  <input 
                    title="產品序號"
                    aria-label="產品序號"
                    value={r.sn} 
                    onChange={(e) => { const n = [...rows]; n[i].sn = e.target.value.toUpperCase(); setRows(n); }} 
                    className="input-base font-mono text-error uppercase tracking-widest bg-red-50/20" 
                    placeholder="請輸入 12 碼序號" 
                    maxLength={12} 
                  />
                </div>
                
                {/* 🚀 MAC 物理位址：格式化引擎掛載 */}
                <div className="col-span-1 md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-1">主要網路位址 MAC (K)</label>
                  <input 
                    title="MAC 位址"
                    aria-label="MAC 位址"
                    value={r.mac1} 
                    onChange={(e) => { 
                        const n = [...rows]; 
                        // 在輸入時即時轉大寫並過濾無效字元
                        n[i].mac1 = e.target.value.toUpperCase().replace(/[^0-9A-F:-]/g, ''); 
                        setRows(n); 
                    }} 
                    onBlur={(e) => {
                        const n = [...rows];
                        // 失去焦點時，物理觸發 12碼冒號 格式化引擎
                        n[i].mac1 = formatMAC(e.target.value);
                        setRows(n);
                    }}
                    className="input-base font-mono text-primary uppercase tracking-widest" 
                    placeholder="XX:XX:XX:XX:XX:XX" 
                    maxLength={17}
                  />
                </div>
              </div>
              
              {/* 移除按鈕 (僅在有多筆設備時顯示) */}
              {rows.length > 1 && (
                <div className="flex justify-end pt-2">
                  <button 
                    title="移除設備"
                    onClick={() => { setRows(rows.filter((row) => row.id !== r.id)); }} 
                    className="px-4 py-2 text-[10px] font-black text-red-500 bg-red-50 rounded-xl hover:bg-red-100 transition-all active:scale-95"
                  >
                    移除此設備
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* 🚀 Section 3: 底部操作區 */}
        <div className="space-y-4">
           <button 
             onClick={() => { setRows([...rows, { id: Date.now(), model: "", sn: "", mac1: "", ext: "", type: "NEW" }]); }} 
             className="w-full py-6 border-2 border-dashed border-blue-200 text-primary bg-blue-50/30 rounded-[2rem] font-black hover:bg-blue-50 hover:border-blue-300 transition-all active:scale-[0.98] text-xs uppercase tracking-widest flex items-center justify-center gap-3"
           >
              <span className="material-symbols-outlined text-xl">add_circle</span> 新增一筆設備
           </button>

           <button 
             onClick={() => { handleSubmit(); }} 
             disabled={isLoading} 
             className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black shadow-2xl shadow-slate-900/30 active:scale-[0.98] transition-all text-sm uppercase tracking-[0.3em] flex items-center justify-center gap-3 disabled:opacity-50"
           >
              {isLoading ? (
                <><span className="material-symbols-outlined animate-spin">refresh</span> 數據封裝對沖中...</>
              ) : (
                <><span className="material-symbols-outlined">cloud_upload</span> 確認提交預約</>
              )}
           </button>
        </div>

      </div>

      {/* 🚀 物理防呆：全域 Loading 遮罩 */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-3 pointer-events-none w-full max-w-[320px] px-5">
        {isLoading && (
          <div className="px-6 py-4 bg-primary text-white rounded-2xl shadow-2xl font-black text-[11px] flex items-center gap-3 border border-white/20 animate-pulse">
            <span className="material-symbols-outlined text-sm">storage</span>
            <span>正在對沖雲端資料庫...</span>
          </div>
        )}
      </div>
    </div>
  );
}

// 🚀 以 Suspense 包裝，安全獲取 URL 參數 (v=廠商名稱)
export default function App() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc] gap-6">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-xl"></div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">初始化環境...</p>
      </div>
    }>
      <KeyinContent />
    </Suspense>
  );
}