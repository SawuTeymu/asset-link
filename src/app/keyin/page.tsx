"use client";

import React, { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { submitAssetBatch, getVendorProgress, vendorConfirmAsset } from "@/lib/actions/assets";
import { formatFloor, formatMAC } from "@/lib/logic/formatters";

/**
 * ==========================================
 * 檔案：src/app/keyin/page.tsx
 * 狀態：V5.6 旗艦完全體 (修復 TS18047 searchParams null 報警)
 * 物理職責：
 * 1. 廠商填報：支援新機配發與舊換新錄入。
 * 2. 進度查詢：對接跨表聯集 API，顯示進行中與已結案之全資料。
 * 3. 動作執行：實作「退回修正」之物理重送與「確認結案」之物理遷移。
 * 4. 型別安全：加入 Null Guard 確保 searchParams 安全讀取。
 * ==========================================
 */

interface AssetRow {
  id: number;
  model: string;
  sn: string;
  originalSn?: string; // 用於儲存被退回的舊序號，供覆蓋使用
  mac1: string;
  mac2: string;
  ext: string;
  oldInfo: string;
  type: "NEW" | "REPLACE";
}

interface ProgressRecord {
  formId: string;
  status: string;
  date: string;
  unit: string;
  sn: string;
  model: string;
  assignedIp?: string;
  assignedName?: string;
  rejectReason?: string;
  mac1?: string;
  mac2?: string;
}

function KeyinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 基礎資訊狀態
  const [vendorName, setVendorName] = useState("");
  const [area, setArea] = useState("本院");
  const [floor, setFloor] = useState("");
  const [unit, setUnit] = useState("");
  const [applicant, setApplicant] = useState("");
  const [installDate, setInstallDate] = useState(new Date().toISOString().split("T")[0]);

  // 資產列狀態
  const [rows, setRows] = useState<AssetRow[]>([
    { id: Date.now(), model: "", sn: "", mac1: "", mac2: "", ext: "", oldInfo: "", type: "NEW" }
  ]);

  // UI 交互狀態
  const [isLoading, setIsLoading] = useState(false);
  const [loaderText, setLoaderText] = useState("處理中...");
  const [isProgressOpen, setIsProgressOpen] = useState(false);
  const [progressData, setProgressData] = useState<ProgressRecord[]>([]);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" }[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; title: string; content: string; onConfirm: () => void; type: 'info' | 'danger' }>({
    isOpen: false, title: "", content: "", onConfirm: () => {}, type: 'info'
  });

  // 初始化 URL 參數 (加入安全守則)
  useEffect(() => {
    if (!searchParams) return; // 🚀 物理修復：TS18047 守衛，防止 searchParams 為 null 時崩潰
    const v = searchParams.get("v");
    const u = searchParams.get("u");
    if (v) setVendorName(v);
    if (u) setUnit(u);
  }, [searchParams]);

  // 通用提示函數
  const showToast = (msg: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  // ----------------------------------------------------------------
  // 核心功能 A：獲取廠商進度 (全資料)
  // ----------------------------------------------------------------
  const fetchProgress = async () => {
    if (!vendorName) {
      showToast("請先輸入廠商名稱", "error");
      return;
    }
    setIsLoading(true);
    setLoaderText("撈取歷史資料中...");
    try {
      const data = await getVendorProgress(vendorName);
      setProgressData(data as ProgressRecord[]);
      setIsProgressOpen(true);
    } catch (error) {
      showToast("無法獲取進度資料", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // ----------------------------------------------------------------
  // 核心功能 B：載入修正 (物理還原)
  // ----------------------------------------------------------------
  const loadForFix = (record: ProgressRecord) => {
    setConfirmDialog({
      isOpen: true,
      title: "載入修正",
      content: `是否將案件 [${record.sn}] 載入表單進行修正？提交後將物理覆蓋原紀錄。`,
      type: 'info',
      onConfirm: () => {
        setUnit(record.unit);
        setRows([{
          id: Date.now(),
          model: record.model,
          sn: record.sn,
          originalSn: record.sn, // 記錄原始序號，以便後端刪除舊紀錄
          mac1: record.mac1 || "",
          mac2: record.mac2 || "",
          ext: "",
          oldInfo: "",
          type: "NEW"
        }]);
        setIsProgressOpen(false);
        showToast("已載入修正資料");
      }
    });
  };

  // ----------------------------------------------------------------
  // 核心功能 C：確認結案 (物理遷移)
  // ----------------------------------------------------------------
  const handleConfirmClose = (record: ProgressRecord) => {
    setConfirmDialog({
      isOpen: true,
      title: "確認配發結果",
      content: `確認 IP [${record.assignedIp}] 與名稱 [${record.assignedName}] 正確無誤並結案？`,
      type: 'info',
      onConfirm: async () => {
        setIsLoading(true);
        setLoaderText("執行結案遷移...");
        try {
          await vendorConfirmAsset(record.sn);
          showToast("結案成功，資料已入庫");
          await fetchProgress(); // 重新整理清單
        } catch (e) {
          showToast("結案失敗", "error");
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  // ----------------------------------------------------------------
  // 核心功能 D：批次提交
  // ----------------------------------------------------------------
  const handleSubmit = async () => {
    if (!vendorName || !unit || !applicant) {
      showToast("請填寫完整基本資訊", "error");
      return;
    }

    const hasEmpty = rows.some(r => !r.model || !r.sn || !r.mac1);
    if (hasEmpty) {
      showToast("資產資訊填寫不完整", "error");
      return;
    }

    setIsLoading(true);
    setLoaderText("提交預約單...");
    const formId = `REQ-${Date.now().toString().slice(-6)}`;

    try {
      const payload = rows.map(r => ({
        form_id: formId,
        install_date: installDate,
        area,
        floor,
        unit,
        applicant,
        model: r.model,
        sn: r.sn,
        original_sn: r.originalSn,
        mac1: r.mac1,
        mac2: r.mac2,
        remark: r.oldInfo || "",
        vendor: vendorName,
        status: "待核定"
      }));

      await submitAssetBatch(payload);
      showToast("提交成功，請等候資訊組核定");
      // 重設表單
      setRows([{ id: Date.now(), model: "", sn: "", mac1: "", mac2: "", ext: "", oldInfo: "", type: "NEW" }]);
    } catch (e) {
      showToast("提交失敗", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // 輔助：資產列操作
  const addRow = () => setRows([...rows, { id: Date.now(), model: "", sn: "", mac1: "", mac2: "", ext: "", oldInfo: "", type: "NEW" }]);
  const removeRow = (id: number) => {
    if (rows.length === 1) return;
    setRows(rows.filter(r => r.id !== id));
  };
  const updateRow = (id: number, field: keyof AssetRow, value: any) => {
    setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24 text-slate-900 font-sans">
      {/* 頂部導航 */}
      <nav className="bg-white border-b sticky top-0 z-50 px-4 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-xl">account_balance_wallet</span>
            </div>
            <h1 className="font-black tracking-tighter text-lg text-slate-800">ASSET-LINK <span className="text-blue-600">V5.6</span></h1>
        </div>
        <button onClick={fetchProgress} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200 transition-colors">
            <span className="material-symbols-outlined text-slate-600 block">history</span>
        </button>
      </nav>

      <main className="max-w-[500px] mx-auto p-4 space-y-6">
        
        {/* 基本資訊區塊 */}
        <section className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span>
                <h2 className="font-black text-slate-800 uppercase tracking-widest text-sm">基本安裝資訊</h2>
            </div>
            <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">維護廠商名稱</label>
                    <input value={vendorName} onChange={e => setVendorName(e.target.value)} placeholder="輸入您的公司名稱" className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-600 font-bold transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">裝機院區</label>
                        <select value={area} onChange={e => setArea(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold">
                            <option>本院</option>
                            <option>兒醫</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">樓層</label>
                        <input value={floor} onChange={e => setFloor(formatFloor(e.target.value))} placeholder="例如: 5F" className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-600 font-bold" />
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-1">使用單位全銜</label>
                    <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="例如: 資訊組" className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-600 font-bold" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">申請人分機</label>
                        <input value={applicant} onChange={e => setApplicant(e.target.value)} placeholder="王大明/1234" className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-600 font-bold" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">裝機日期</label>
                        <input type="date" value={installDate} onChange={e => setInstallDate(e.target.value)} className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 font-bold" />
                    </div>
                </div>
            </div>
        </section>

        {/* 資產明細區塊 */}
        {rows.map((row, index) => (
            <section key={row.id} className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 space-y-5 relative overflow-hidden">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-slate-800 rounded-full"></span>
                        <h2 className="font-black text-slate-800 uppercase tracking-widest text-sm">資產設備 #{index + 1}</h2>
                    </div>
                    {rows.length > 1 && (
                        <button onClick={() => removeRow(row.id)} className="text-red-500 material-symbols-outlined text-lg">delete</button>
                    )}
                </div>

                <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
                    <button onClick={() => updateRow(row.id, 'type', 'NEW')} className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${row.type === 'NEW' ? 'bg-white shadow-md text-blue-600' : 'text-slate-400'}`}>新機配發</button>
                    <button onClick={() => updateRow(row.id, 'type', 'REPLACE')} className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${row.type === 'REPLACE' ? 'bg-white shadow-md text-orange-600' : 'text-slate-400'}`}>舊換新(汰換)</button>
                </div>

                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">品牌型號</label>
                        <input value={row.model} onChange={e => updateRow(row.id, 'model', e.target.value)} placeholder="例如: ASUS D700" className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-600 font-bold" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">產品序號 (SN)</label>
                        <input value={row.sn} onChange={e => updateRow(row.id, 'sn', e.target.value.toUpperCase())} placeholder="掃描或輸入序號" className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-600 font-bold" />
                        {row.originalSn && <p className="text-[10px] text-red-500 font-black mt-1">修正中: 將覆蓋原紀錄 {row.originalSn}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">主要網卡 MAC</label>
                            <input value={row.mac1} onChange={e => updateRow(row.id, 'mac1', formatMAC(e.target.value))} placeholder="有線網路" className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-600 font-bold" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">無線網卡 MAC</label>
                            <input value={row.mac2} onChange={e => updateRow(row.id, 'mac2', formatMAC(e.target.value))} placeholder="無線/選填" className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-600 font-bold" />
                        </div>
                    </div>
                    {row.type === 'REPLACE' && (
                        <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">舊機資訊 (IP/名稱)</label>
                            <input value={row.oldInfo} onChange={e => updateRow(row.id, 'oldInfo', e.target.value)} placeholder="提供舊機 IP 以便封存" className="w-full bg-orange-50 border border-orange-100 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-orange-500 font-bold text-orange-800" />
                        </div>
                    )}
                </div>
            </section>
        ))}

        <button onClick={addRow} className="w-full border-2 border-dashed border-slate-200 rounded-3xl py-6 flex flex-col items-center justify-center gap-1 hover:border-blue-300 hover:bg-blue-50/50 transition-all group">
            <span className="material-symbols-outlined text-slate-300 group-hover:text-blue-500">add_circle</span>
            <span className="text-xs font-black text-slate-400 group-hover:text-blue-600 uppercase tracking-tighter">新增一筆資產明細</span>
        </button>

        <div className="h-4"></div>
      </main>

      {/* 底部操作條 */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-xl border-t z-40 flex gap-3">
          <button onClick={handleSubmit} className="flex-[3] bg-blue-600 text-white rounded-2xl font-black py-4 shadow-lg shadow-blue-200 active:scale-95 transition-transform flex items-center justify-center gap-2">
              <span className="material-symbols-outlined">send</span>提交預約申請
          </button>
      </footer>

      {/* 進度查詢側板 - 全資料顯示 */}
      {isProgressOpen && (
          <div className="fixed inset-0 z-[1000] overflow-hidden">
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsProgressOpen(false)} />
              <div className="absolute inset-y-0 right-0 w-full max-w-[420px] bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                  <div className="p-6 border-b flex justify-between items-center">
                      <h3 className="font-black text-lg flex items-center gap-2"><span className="material-symbols-outlined text-blue-600">manage_search</span> 申請進度與全紀錄</h3>
                      <button onClick={() => setIsProgressOpen(false)} className="material-symbols-outlined text-slate-400">close</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                      {progressData.length === 0 ? (
                          <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                              <span className="material-symbols-outlined text-4xl mb-2">inbox</span>
                              <p className="font-black text-xs uppercase">尚無任何歷史記錄</p>
                          </div>
                      ) : (
                          progressData.map((record, i) => (
                              <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-3 relative overflow-hidden group">
                                  {/* 狀態標籤 */}
                                  <div className="flex justify-between items-start">
                                      <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                          record.status === '已核定(待確認)' ? 'bg-orange-500 text-white animate-pulse' : 
                                          record.status === '退回修正' ? 'bg-red-500 text-white' : 
                                          record.status === '已結案' ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'
                                      }`}>
                                          {record.status}
                                      </div>
                                      <span className="text-[10px] font-bold text-slate-300">{record.date}</span>
                                  </div>
                                  
                                  <div>
                                      <p className="text-xs font-black text-slate-400 uppercase tracking-tighter">案件編號: {record.formId}</p>
                                      <h4 className="font-black text-slate-800 text-sm mt-1">{record.unit} / {record.model}</h4>
                                      <p className="text-[10px] font-bold text-slate-500">SN: {record.sn}</p>
                                  </div>

                                  {/* 根據狀態顯示不同動作 */}
                                  {record.status === '已核定(待確認)' && (
                                      <div className="bg-blue-50 rounded-xl p-3 border border-blue-100 space-y-2">
                                          <div className="flex justify-between text-[10px]">
                                              <span className="font-black text-blue-600 uppercase">核定 IP</span>
                                              <span className="font-bold text-slate-800">{record.assignedIp}</span>
                                          </div>
                                          <div className="flex justify-between text-[10px]">
                                              <span className="font-black text-blue-600 uppercase">設備名稱</span>
                                              <span className="font-bold text-slate-800">{record.assignedName}</span>
                                          </div>
                                          <button onClick={() => handleConfirmClose(record)} className="w-full bg-blue-600 text-white py-2 rounded-lg font-black text-[10px] hover:bg-blue-700 transition-colors">確認無誤並結案</button>
                                      </div>
                                  )}

                                  {record.status === '退回修正' && (
                                      <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                                          <p className="text-[10px] text-red-600 font-black leading-tight mb-2">退回原因: {record.rejectReason}</p>
                                          <button onClick={() => loadForFix(record)} className="w-full bg-red-600 text-white py-2 rounded-lg font-black text-[10px]">載入至表單重新送審</button>
                                      </div>
                                  )}

                                  {record.status === '已結案' && (
                                      <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100 space-y-1">
                                          <div className="flex justify-between text-[10px]">
                                              <span className="font-black text-emerald-600 uppercase">固定 IP</span>
                                              <span className="font-bold text-emerald-800">{record.assignedIp}</span>
                                          </div>
                                          <p className="text-[9px] text-emerald-500 font-black italic">此案件已物理遷移至歷史庫，無法再更動</p>
                                      </div>
                                  )}
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* 全域 Loading */}
      {isLoading && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[2000] flex flex-col items-center justify-center">
              <div className="w-12 h-12 border-4 border-t-blue-600 border-slate-200 rounded-full animate-spin mb-4 shadow-xl"></div>
              <p className="text-white font-black tracking-widest text-sm animate-pulse uppercase">{loaderText}</p>
          </div>
      )}

      {/* 確認對話框 */}
      {confirmDialog.isOpen && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-6">
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setConfirmDialog(prev => ({...prev, isOpen: false}))} />
              <div className="bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl relative animate-in zoom-in-95 duration-200">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${confirmDialog.type === 'danger' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                      <span className="material-symbols-outlined text-3xl">{confirmDialog.type === 'danger' ? 'warning' : 'help'}</span>
                  </div>
                  <h4 className="text-xl font-black text-slate-800 mb-2">{confirmDialog.title}</h4>
                  <p className="text-slate-500 font-bold text-sm mb-8 leading-relaxed">{confirmDialog.content}</p>
                  <div className="flex gap-3">
                      <button onClick={() => setConfirmDialog(prev => ({...prev, isOpen: false}))} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black hover:bg-slate-200 transition-colors">取消</button>
                      <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(prev => ({...prev, isOpen: false})); }} className={`flex-1 py-4 text-white rounded-2xl font-black shadow-lg transition-transform active:scale-95 ${confirmDialog.type === 'danger' ? 'bg-red-600 shadow-red-200' : 'bg-blue-600 shadow-blue-200'}`}>確認執行</button>
                  </div>
              </div>
          </div>
      )}

      {/* Toast 提示容器 */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[4000] flex flex-col gap-3 pointer-events-none w-full max-w-[340px] px-4">
          {toasts.map(t => (
              <div key={t.id} className={`px-6 py-4 rounded-2xl text-xs font-black text-white shadow-2xl animate-in slide-in-from-bottom flex items-center gap-3 ${t.type === 'error' ? 'bg-red-600' : 'bg-slate-900/90 backdrop-blur-md'}`}>
                  <span className="material-symbols-outlined text-base">info</span>
                  <span>{t.msg}</span>
              </div>
          ))}
      </div>
    </div>
  );
}

export default function KeyinPage() {
  return (
    <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="w-10 h-10 border-4 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
    }>
      <KeyinContent />
    </Suspense>
  );
}