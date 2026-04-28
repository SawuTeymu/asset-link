"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { approveAsset, rejectAsset } from "@/lib/actions/assets";

/**
 * ==========================================
 * 檔案：src/app/pending/page.tsx
 * 狀態：V300.1 Medical M3 (無內聯樣式版)
 * 修復項目：移除 inline style，採用 CSS 類別控制動畫延遲。
 * ==========================================
 */

export default function PendingPage() {
  const router = useRouter();
  const [pendingList, setPendingList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loaderText, setLoaderText] = useState("行政同步中...");
  const [searchQuery, setSearchQuery] = useState("");
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" }[]>([]);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const fetchPending = useCallback(async () => {
    const isAuth = sessionStorage.getItem("asset_link_admin_auth");
    if (isAuth !== "true") { router.push("/"); return; }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from("assets_pending").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setPendingList(data || []);
    } catch { showToast("連線中斷", "error"); }
    finally { setIsLoading(false); }
  }, [router, showToast]);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  const handleApprove = async (item: any) => {
    setIsProcessing(true); setLoaderText("核定中...");
    try {
      await approveAsset(item.id, item.核定ip || "", item.主要mac || "", item.產品序號 || item.sn || "");
      showToast("行政核定成功", "success"); fetchPending();
    } catch { showToast("核定失敗", "error"); }
    finally { setIsProcessing(false); }
  };

  const handleReject = async (item: any) => {
    if (!confirm("確定要退回此單？")) return;
    setIsProcessing(true);
    try {
      await rejectAsset(item.id, "資訊室管理員退回");
      showToast("案件已退回", "error"); fetchPending();
    } catch { showToast("退件失敗", "error"); }
    finally { setIsProcessing(false); }
  };

  return (
    <div className="bg-background text-on-background font-body-md antialiased min-h-screen relative overflow-x-hidden">
      <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries" async></script>
      <style dangerouslySetInnerHTML={{ __html: `
        .clinical-glass { background: rgba(255, 255, 255, 0.6); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.3); }
        .inner-glow { box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.4); }
        .bg-gradient-custom { background: radial-gradient(at 0% 0%, #e1e0ff 0%, transparent 50%), radial-gradient(at 100% 100%, #cce5ff 0%, transparent 50%), #faf8ff; background-attachment: fixed; }
        .delay-2s { animation-delay: -2s; }
        .delay-4s { animation-delay: -4s; }
      `}} />

      <div className="bg-gradient-custom min-h-screen w-full fixed inset-0 -z-10"></div>

      <aside className="h-screen w-64 fixed left-0 top-0 z-40 border-r border-white/20 bg-white/60 backdrop-blur-xl flex flex-col py-6 px-4 gap-2 shadow-xl">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white mb-8 mx-auto">ERI</div>
          <nav className="flex-1 space-y-1">
              <button onClick={() => router.push("/admin")} className="w-full text-left p-3 hover:bg-slate-100 rounded-lg">首頁</button>
              <button className="w-full text-left p-3 bg-sky-500/10 text-sky-700 border-r-4 border-sky-600 font-bold">待核定矩陣</button>
          </nav>
      </aside>

      <main className="ml-64 p-8">
        <header className="mb-10 flex justify-between items-end">
          <div><h1 className="text-3xl font-bold text-sky-800">ERI 待核定矩陣</h1><p className="text-slate-500">當前有 {pendingList.length} 件預約事項待簽核。</p></div>
        </header>

        <div className="grid grid-cols-3 gap-6">
           <div className="clinical-glass rounded-2xl p-6 inner-glow shadow-lg relative overflow-hidden">
              <h3 className="font-bold text-sky-800 mb-4">狀態統計</h3>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-secondary w-[82%]"></div></div>
              <p className="text-xs text-slate-500 mt-2">已處理: 82% | 待辦: {pendingList.length} 件</p>
           </div>

           {pendingList.map((item, idx) => (
             <div key={item.id} className="clinical-glass rounded-2xl p-6 inner-glow flex flex-col justify-between hover:shadow-2xl transition-all">
                <div className="space-y-4">
                   <div className="flex justify-between"><span className="text-[10px] font-bold text-slate-400">ID: {item.id}</span></div>
                   <div><p className="font-bold text-lg">{item.廠商名稱 || "內部人員"}</p><p className="text-xs text-primary font-bold">{item.使用單位}</p></div>
                   <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                      <div className="flex justify-between"><span className="text-[10px] text-slate-500">核定 IP</span><code className="text-sm font-black text-primary">{item.核定ip}</code></div>
                      <div className="flex justify-between mt-2"><span className="text-[10px] text-slate-500">主要 MAC</span><code className="text-[10px] text-slate-400">{item.主要mac}</code></div>
                   </div>
                </div>
                <div className="mt-6 flex gap-2">
                   <button onClick={() => handleReject(item)} id={`rej-${idx}-${Math.random().toString(36).substr(2, 2)}`} className="flex-1 py-2 rounded-lg border border-error text-error text-xs font-bold">退回</button>
                   <button onClick={() => handleApprove(item)} id={`app-${idx}-${Math.random().toString(36).substr(2, 2)}`} className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold shadow-md">核定結案</button>
                </div>
             </div>
           ))}
        </div>
      </main>

      <div className="fixed top-[-10%] right-[-5%] w-[40vw] h-[40vw] bg-sky-100/30 rounded-full blur-[120px] -z-20 delay-2s"></div>
      <div className="fixed bottom-[-10%] left-[-5%] w-[30vw] h-[30vw] bg-emerald-100/20 rounded-full blur-[100px] -z-20 delay-4s"></div>
    </div>
  );
}