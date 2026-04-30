"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { approveAsset, rejectAsset, checkIpConflict } from "@/lib/actions/assets";
import { supabase } from "@/lib/supabase";

import styles from "./pending.module.css";

/**
 * ==========================================
 * 檔案：src/app/pending/page.tsx
 * 狀態：V300.51 潔淨規範版 (消除 Inline Style)
 * 職責：
 * 1. 消除警告：將 icon 的 inline style 替換為 styles.iconFill，符合嚴格的開發規範。
 * 2. 實體對齊：100% 鎖定「資產」表，並確保顯示分離後的「姓名」與「分機」。
 * 3. 快取破防：直接從前端 Client 直連 Supabase 獲取資料。
 * ==========================================
 */

export default function PendingPage() {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingList, setPendingList] = useState<any[]>([]);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" }[]>([]);

  const [processingSn, setProcessingSn] = useState<string | null>(null);
  const [approvalData, setApprovalData] = useState({ ip: "", deviceName: "", type: "桌上型電腦" });
  const [rejectReason, setRejectReason] = useState("");
  const [ipConflictMsg, setIpConflictMsg] = useState<string | null>(null);

  const showToast = useCallback((msg: string, type: "success" | "error") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const fetchPending = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("資產")
        .select("*")
        .eq("狀態", "待核定")
        .order("建立時間", { ascending: true });

      if (error) throw error;

      const formattedData = (data || []).map((r) => ({
        formId: String(r.案件編號 || ""),
        date: String(r.裝機日期 || ""),
        area: String(r.棟別 || ""), 
        floor: String(r.樓層 || ""),
        unit: String(r.使用單位 || ""),
        applicantName: String(r.姓名 || ""),
        applicantExt: String(r.分機 || ""),
        model: String(r.品牌型號 || ""),
        sn: String(r.產品序號 || ""),
        mac1: String(r.主要mac || ""),
        mac2: String(r.無線mac || ""),
        status: String(r.狀態 || ""),
        vendor: String(r.來源廠商 || ""),
        remark: String(r.備註 || "")
      }));

      setPendingList(formattedData);
    } catch (err: any) {
      showToast(err.message || "清單載入失敗，請檢查系統連線", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const isAuth = sessionStorage.getItem("asset_link_admin_auth");
    if (isAuth !== "true") { router.push("/"); return; }
    fetchPending();
  }, [router, fetchPending]);

  const handleIpBlur = async () => {
    if (!approvalData.ip) { setIpConflictMsg(null); return; }
    const isConflicted = await checkIpConflict(approvalData.ip);
    setIpConflictMsg(isConflicted ? `注意：IP ${approvalData.ip} 在系統中已被配發` : null);
  };

  const handleApprove = async (sn: string) => {
    if (!approvalData.ip || !approvalData.deviceName) { showToast("請完整填寫核定 IP 與設備名稱", "error"); return; }
    setIsLoading(true);
    try {
      await approveAsset(sn, approvalData.ip, approvalData.deviceName, approvalData.type);
      showToast("核發作業完成，案件已發還廠商確認", "success");
      setProcessingSn(null);
      setApprovalData({ ip: "", deviceName: "", type: "桌上型電腦" });
      setIpConflictMsg(null);
      fetchPending();
    } catch (err: any) {
      showToast(`核發失敗: ${err.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async (sn: string) => {
    if (!rejectReason) { showToast("請填寫退回原因", "error"); return; }
    setIsLoading(true);
    try {
      await rejectAsset(sn, rejectReason);
      showToast("案件已退回給廠商修正", "success");
      setProcessingSn(null);
      setRejectReason("");
      fetchPending();
    } catch (err: any) {
      showToast(`退回失敗: ${err.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen text-slate-800 antialiased flex relative overflow-x-hidden ${styles.medicalGradient}`}>
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      {isMobileMenuOpen && <div className="fixed inset-0 bg-sky-900/20 backdrop-blur-sm z-[45] md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>}

      <aside className={`w-64 fixed left-0 top-0 h-screen border-r border-white/40 ${styles.clinicalGlass} flex flex-col p-6 z-50 transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
          <div className="flex items-center gap-3 mb-10 px-2">
             <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg">
               {/* 🚀 物理修正：移除 inline style，套用 styles.iconFill */}
               <span className={`material-symbols-outlined ${styles.iconFill}`}>hub</span>
             </div>
             <h2 className="text-xl font-black text-sky-900 tracking-tighter uppercase">ALink 總控台</h2>
          </div>
          <nav className="flex-1 space-y-2">
              <button onClick={() => router.push("/admin")} className="w-full text-left p-4 rounded-2xl font-bold text-slate-600 hover:bg-white/60 flex items-center gap-3 transition-all"><span className="material-symbols-outlined text-base">dashboard</span> 儀表板首頁</button>
              <button className="w-full text-left p-4 rounded-2xl font-bold bg-blue-600 text-white shadow-md flex items-center gap-3 transition-all"><span className="material-symbols-outlined text-base">assignment_turned_in</span> 行政審核</button>
              <button onClick={() => router.push("/nsr")} className="w-full text-left p-4 rounded-2xl font-bold text-slate-600 hover:bg-white/60 flex items-center gap-3 transition-all"><span className="material-symbols-outlined text-base">account_balance_wallet</span> 網點計價結算</button>
              <button onClick={() => router.push("/internal")} className="w-full text-left p-4 rounded-2xl font-bold text-slate-600 hover:bg-white/60 flex items-center gap-3 transition-all"><span className="material-symbols-outlined text-base">bolt</span> 內部直通入庫</button>
          </nav>
          <div className="mt-auto pt-6 border-t border-slate-200/50"><button onClick={() => router.push("/")} className="w-full flex items-center gap-3 p-4 text-slate-400 font-bold hover:text-red-600 transition-colors"><span className="material-symbols-outlined text-base">logout</span> 登出系統</button></div>
      </aside>

      <main className="w-full md:ml-64 flex-1 flex flex-col min-h-screen">
        <header className="px-6 py-5 bg-white/60 backdrop-blur-xl border-b border-slate-200/50 sticky top-0 z-30 flex items-center justify-between shadow-sm">
           <div className="flex items-center gap-4">
             <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-sky-800 p-1"><span className="material-symbols-outlined">menu</span></button>
             <h1 className="text-lg font-black text-sky-800 uppercase tracking-widest">Administrative Approval</h1>
           </div>
           <button onClick={fetchPending} className="text-slate-400 hover:text-blue-600 transition-colors bg-white p-2 rounded-lg border border-slate-100 shadow-sm flex items-center gap-2 text-xs font-bold"><span className="material-symbols-outlined text-sm">sync</span> 資料更新</button>
        </header>

        <div className="p-6 md:p-10 max-w-[1200px] mx-auto w-full flex-1">
          <div className="mb-8">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">待核定案件清單</h2>
            <p className="text-sm text-slate-500 font-bold mt-2 uppercase tracking-widest">廠商預約審查與網路參數配置</p>
          </div>

          <div className="space-y-6">
            {pendingList.length === 0 && !isLoading && (
              <div className={`${styles.clinicalGlass} rounded-3xl p-12 text-center shadow-sm`}>
                <span className="material-symbols-outlined text-4xl text-slate-300 mb-4">check_circle</span>
                <p className="text-slate-400 font-bold tracking-widest uppercase">目前所有案件皆已處理完畢</p>
              </div>
            )}

            {pendingList.map((item) => (
              <div key={item.sn} className={`${styles.clinicalGlass} rounded-3xl p-6 shadow-sm flex flex-col md:flex-row gap-6 transition-all hover:border-blue-200`}>
                
                <div className="flex-1 space-y-4 border-b md:border-b-0 md:border-r border-slate-200/60 pb-6 md:pb-0 md:pr-6">
                   <div className="flex items-center justify-between mb-4">
                     <span className="px-3 py-1 bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-widest rounded-lg border border-blue-200">{item.vendor}</span>
                     <span className="text-xs font-bold text-slate-400">{item.date}</span>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-4">
                     <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">部署單位</p>
                       <p className="font-bold text-slate-800">{item.unit}</p>
                       <p className="text-xs text-slate-500">{item.area} {item.floor}</p>
                     </div>
                     <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">聯絡人員</p>
                       <p className="font-bold text-slate-800">{item.applicantName} <span className="text-slate-400 text-xs font-normal">#{item.applicantExt}</span></p>
                     </div>
                     <div className="col-span-2 mt-2">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">設備硬體參數</p>
                       <p className="font-bold text-slate-800">{item.model} <span className="text-xs text-slate-400 font-normal">({item.status})</span></p>
                       <p className="text-xs font-mono text-red-600 font-bold mt-1">S/N: {item.sn}</p>
                       <p className="text-xs font-mono text-blue-600 font-bold">主要 MAC: {item.mac1}</p>
                       {item.remark && <p className="text-xs text-slate-500 mt-2 bg-slate-50 p-2 rounded-md border border-slate-100">備註：{item.remark}</p>}
                     </div>
                   </div>
                </div>

                <div className="w-full md:w-[380px] flex flex-col justify-center">
                  {processingSn !== item.sn && processingSn !== `reject_${item.sn}` ? (
                    <div className="flex flex-col gap-3">
                      <button onClick={() => { setProcessingSn(item.sn); setApprovalData({ ip: "", deviceName: item.sn, type: item.model.includes('印表') ? '印表機' : '桌上型電腦' }); }} className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-black uppercase tracking-[0.2em] text-xs shadow-md hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-sm">verified_user</span> 進行核發作業
                      </button>
                      <button onClick={() => { setProcessingSn(`reject_${item.sn}`); setRejectReason(""); }} className="w-full py-3 bg-white border border-slate-200 text-red-500 rounded-xl font-black uppercase tracking-[0.2em] text-xs hover:bg-red-50 transition-all flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-sm">assignment_return</span> 退回修正
                      </button>
                    </div>
                  ) : processingSn === item.sn ? (
                    <div className="space-y-4 p-5 bg-white/60 rounded-2xl border border-blue-200 shadow-sm">
                      <div><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">核定 IP 地址</label><input value={approvalData.ip} onChange={e => setApprovalData({...approvalData, ip: e.target.value})} onBlur={handleIpBlur} className={styles.crystalInput} placeholder="10.X.X.X" />{ipConflictMsg && <p className="text-[10px] text-red-500 font-bold mt-1.5 animate-pulse">{ipConflictMsg}</p>}</div>
                      <div><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">系統登錄名稱</label><input value={approvalData.deviceName} onChange={e => setApprovalData({...approvalData, deviceName: e.target.value.toUpperCase()})} className={styles.crystalInput} /></div>
                      <div className="flex gap-2 pt-2"><button onClick={() => handleApprove(item.sn)} disabled={isLoading || !!ipConflictMsg} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-bold text-xs shadow-md hover:bg-blue-700 disabled:opacity-50 transition-colors">確認核發</button><button onClick={() => setProcessingSn(null)} className="py-2.5 px-4 bg-slate-200 text-slate-700 rounded-lg font-bold text-xs hover:bg-slate-300 transition-colors">取消</button></div>
                    </div>
                  ) : (
                    <div className="space-y-4 p-5 bg-white/60 rounded-2xl border border-red-200 shadow-sm">
                      <div><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">退回原因說明</label><textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} className={`${styles.crystalInput} min-h-[80px] resize-none`} placeholder="請簡述需要廠商修正的問題..." /></div>
                      <div className="flex gap-2 pt-2"><button onClick={() => handleReject(item.sn)} disabled={isLoading} className="flex-1 py-2.5 bg-red-500 text-white rounded-lg font-bold text-xs shadow-md hover:bg-red-600 disabled:opacity-50 transition-colors">確認退回</button><button onClick={() => setProcessingSn(null)} className="py-2.5 px-4 bg-slate-200 text-slate-700 rounded-lg font-bold text-xs hover:bg-slate-300 transition-colors">取消</button></div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {isLoading && (
        <div className={styles.loaderOverlay}><div className={styles.spinner}></div><p className="text-blue-600 font-black text-[10px] uppercase mt-6 tracking-[0.5em] animate-pulse">資料處理中...</p></div>
      )}

      <div className="fixed bottom-10 right-8 z-[9000] flex flex-col gap-3">
        {toasts.map(t => (
          <div key={t.id} className={styles.toastBase}>
            <span className="material-symbols-outlined text-sm">
              {t.type === 'success' ? 'check_circle' : 'report'}
            </span> 
            <span className="tracking-wide">{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}