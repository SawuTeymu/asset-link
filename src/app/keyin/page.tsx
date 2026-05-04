"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getVendorProgress, vendorConfirmAsset, submitAssetBatch, withdrawVendorAsset } from "@/lib/actions/assets";
import { updateVendorPassword } from "@/lib/actions/users";
import styles from "./keyin.module.css";

/**
 * ==========================================
 * 檔案：src/app/keyin/page.tsx
 * 狀態：V400.10 廠商日誌防護完整版 (舊換新邏輯改為 IP)
 * 職責：
 * 1. 業務規則升級：舊換新作業改為強制填寫「舊機 IP」，更符合實務操作。
 * 2. 自動標籤封裝：舊換新會自動產生 [REPLACE] 汰換舊機IP 標籤以對接後端。
 * 3. 載入修正還原：被退回的案件能自動解析字串，精準還原舊機 IP 欄位。
 * 4. 縮短 SN：採用 A + 月日(4碼) + 隨機(4碼) 精簡格式。
 * ==========================================
 */

interface DeviceState {
  actionType: "新機" | "舊換新";
  type: string;
  model: string;
  sn: string;
  mac: string;
  mac2: string;
  remark: string;
  oldIp: string;
}

export default function KeyinPage() {
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<"entry" | "progress" | "account">("entry");
  const [isDefaultPassword, setIsDefaultPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [vendorName, setVendorName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [buildingOptions, setBuildings] = useState<any[]>([]);

  const [metadata, setMetadata] = useState({ date: new Date().toISOString().split("T")[0], area: "", floor: "", unit: "", applicantName: "", applicantExt: "" });
  const [devices, setDevices] = useState<DeviceState[]>([{ actionType: "新機", type: "桌上型電腦", model: "", sn: "", mac: "", mac2: "", remark: "", oldIp: "" }]);
  const [pendingRecords, setPendingRecords] = useState<any[]>([]);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: "success" | "error" | "info" }[]>([]);

  const showToast = useCallback((msg: string, type: "success" | "error" | "info") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const fetchBuildings = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("buildings").select("*").eq("是否啟用", true).order("排序權重", { ascending: true });
      if (error) throw error;
      setBuildings(data || []);
      if (data && data.length > 0 && !metadata.area) setMetadata(prev => ({ ...prev, area: data[0].棟別名稱 }));
    } catch (err) { console.error("棟別同步異常"); }
  }, [metadata.area]);

  const fetchPendingRecords = useCallback(async (vName: string) => {
    if (!vName) return;
    setIsLoading(true);
    try {
      const data = await getVendorProgress(vName);
      setPendingRecords(data || []);
    } catch (err: any) {
      showToast(err.message || "進度數據讀取失敗，請重新整理頁面", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const v = sessionStorage.getItem("asset_link_vendor");
    const isDef = sessionStorage.getItem("asset_link_vendor_default_pwd") === "true"; 
    
    if (!v) { router.push("/"); return; }
    setVendorName(v);
    
    if (isDef) {
      setIsDefaultPassword(true);
      setActiveTab("account");
    }

    fetchBuildings();
    if (activeTab === "progress" && !isDef) fetchPendingRecords(v);
  }, [router, activeTab, fetchBuildings, fetchPendingRecords]);

  const handleMacInput = (index: number, val: string, macField: "mac" | "mac2") => {
    let macStr = val.toUpperCase().replace(/[^A-F0-9]/g, "");
    if (macStr.length > 12) macStr = macStr.substring(0, 12);
    const parts = macStr.match(/.{1,2}/g);
    const formattedMac = parts ? parts.join(":") : macStr;
    const newDevices = [...devices]; 
    newDevices[index][macField] = formattedMac; 
    setDevices(newDevices);
  };

  const handleSubmit = async () => {
    if (isLoading) return;
    if (!metadata.area || !metadata.unit || !metadata.applicantName) { 
      showToast("請完整填寫行政資料 (包含姓名)", "error"); 
      return; 
    }

    // 強制驗證：若為舊換新，必須輸入舊機 IP
    for (let i = 0; i < devices.length; i++) {
      if (devices[i].actionType === "舊換新" && !devices[i].oldIp.trim()) {
        showToast(`第 ${i + 1} 項設備為「舊換新」，請務必填寫欲汰換的舊機 IP`, "error");
        return;
      }
    }

    setIsLoading(true);
    try {
      const processedDevices = devices.map(d => {
        let finalSn = d.sn.trim().toUpperCase();
        if (!finalSn) {
          // 縮短 S/N：改為 A + 月日(4碼) + 隨機英數(4碼) = 總共 10 碼
          const randomHex = Math.floor(Math.random() * 65535).toString(16).toUpperCase().padStart(4, '0');
          const dateStr = metadata.date.replace(/-/g, '').substring(4); 
          finalSn = `A${dateStr}-${randomHex}`; 
        }
        return { ...d, sn: finalSn };
      });

      const payload = processedDevices.map(d => ({
        form_id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ID-${Date.now()}`,
        install_date: metadata.date,
        area: metadata.area,
        floor: metadata.floor,
        unit: metadata.unit,
        applicantName: metadata.applicantName.trim(),
        applicantExt: metadata.applicantExt.trim(),
        model: d.model || "未提供",
        sn: d.sn,
        mac1: d.mac,
        mac2: d.mac2 || "",
        remark: d.actionType === "舊換新" ? `[REPLACE] 汰換舊機IP: ${d.oldIp}。${d.remark}` : d.remark,
        vendor: vendorName,
        status: "待核定",
        old_ip: d.actionType === "舊換新" ? d.oldIp : undefined
      }));

      await submitAssetBatch(payload);

      setDevices([{ actionType: "新機", type: "桌上型電腦", model: "", sn: "", mac: "", mac2: "", remark: "", oldIp: "" }]);
      showToast("預約錄入成功，已送交資訊中心", "success");
      setActiveTab("progress");
    } catch (err: any) {
      console.error("提交失敗", err);
      showToast(`寫入失敗: ${err.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePending = async (sn: string) => {
    if (!confirm("確定要撤回此筆預約申請嗎？")) return;
    setIsLoading(true);
    try {
      await withdrawVendorAsset(sn, vendorName);
      showToast("申請已成功撤回", "success");
      fetchPendingRecords(vendorName);
    } catch (err: any) {
      showToast(err.message || "撤回失敗", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadFix = async (sn: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from("資產").select("*").eq("產品序號", sn).single();
      if (error) throw error;
      
      const remarkStr = data.備註 || "";
      const oldIpMatch = remarkStr.match(/\[REPLACE\] 汰換舊機IP: ([^。]+)。/);
      const isReplace = !!oldIpMatch;
      const parsedOldIp = oldIpMatch ? oldIpMatch[1] : "";
      const cleanRemark = remarkStr.replace(/\[REPLACE\] 汰換舊機IP: [^。]+。/, "").trim();

      setMetadata({
        date: data.裝機日期,
        area: data.棟別,
        floor: data.樓層,
        unit: data.使用單位,
        applicantName: data.姓名,
        applicantExt: data.分機
      });
      
      setDevices([{
        actionType: isReplace ? "舊換新" : "新機",
        type: data.設備類型 || "桌上型電腦",
        model: data.品牌型號 || "",
        sn: data.產品序號,
        mac: data.主要mac || "",
        mac2: data.無線mac || "",
        remark: cleanRemark,
        oldIp: parsedOldIp
      }]);
      
      setActiveTab("entry");
      showToast("已載入案件，請修正錯誤後重新提交", "info");
    } catch (err) {
      showToast("載入修正資料失敗", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async (sn: string) => {
    if (!confirm("確認已完成現場設定並要歸檔此案件嗎？")) return;
    setIsLoading(true);
    try {
      await vendorConfirmAsset(sn);
      showToast("設備已確認並正式歸檔", "success");
      fetchPendingRecords(vendorName);
    } catch (err: any) {
      showToast(`結案失敗: ${err.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      showToast("密碼長度安全限制：至少需 6 碼", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("兩次密碼輸入不一致，請重新確認", "error");
      return;
    }
    if (newPassword === "123456") {
      showToast("新密碼不可與預設密碼相同", "error");
      return;
    }

    setIsLoading(true);
    try {
      const res = await updateVendorPassword(vendorName, newPassword);
      if (res.success) {
        sessionStorage.removeItem("asset_link_vendor_default_pwd");
        setIsDefaultPassword(false);
        showToast("密碼更新成功！系統安全鎖定已解除。", "success");
        setNewPassword("");
        setConfirmPassword("");
        setActiveTab("entry");
      } else {
        showToast(res.message || "密碼更新失敗，請聯繫資訊中心", "error");
      }
    } catch (err: any) {
      showToast(`發生異常: ${err.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("asset_link_vendor");
    sessionStorage.removeItem("asset_link_vendor_default_pwd");
    router.push("/");
  };

  return (
    <div className={`min-h-screen text-slate-800 font-body-md overflow-x-hidden relative ${styles.medicalGradient} antialiased`}>
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      {isMobileMenuOpen && <div className="fixed inset-0 bg-sky-900/20 backdrop-blur-sm z-[45] md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>}

      <nav className="sticky top-0 w-full flex justify-between items-center px-4 md:px-6 h-16 bg-white/70 backdrop-blur-xl border-b border-white/40 shadow-sm z-40">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-sky-800 p-1"><span className="material-symbols-outlined">menu</span></button>
          <span className="text-lg md:text-xl font-black text-sky-800 tracking-tight truncate max-w-[250px]">Vendor Portal</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleLogout} className="flex items-center gap-1 font-bold text-slate-500 hover:text-red-500 transition-colors">
            <span className="material-symbols-outlined text-base">logout</span><span className="hidden md:inline text-xs">登出</span>
          </button>
        </div>
      </nav>

      <div className="flex">
        <aside className={`w-64 fixed left-0 top-0 h-screen pt-16 border-r border-white/30 bg-white/80 backdrop-blur-2xl p-6 z-50 transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
          <div className="flex justify-between items-center mb-8 px-2 font-black text-sky-800 uppercase tracking-widest"><p className="text-sm">ALink 作業區</p></div>
          <nav className="space-y-2">
             <button onClick={() => { if(!isDefaultPassword) { setActiveTab("entry"); setIsMobileMenuOpen(false); } }} className={`w-full text-left p-4 rounded-2xl font-bold transition-all flex items-center gap-3 ${activeTab === 'entry' ? 'bg-sky-50 text-sky-700 border-l-4 border-sky-600 shadow-sm' : 'text-slate-600 hover:bg-slate-50'} ${isDefaultPassword ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}>
               <span className={`material-symbols-outlined text-sm ${styles.iconFill}`}>edit_square</span>預約錄入
             </button>
             <button onClick={() => { if(!isDefaultPassword) { setActiveTab("progress"); setIsMobileMenuOpen(false); } }} className={`w-full text-left p-4 rounded-2xl font-bold transition-all flex items-center gap-3 ${activeTab === 'progress' ? 'bg-sky-50 text-sky-700 border-l-4 border-sky-600 shadow-sm' : 'text-slate-600 hover:bg-slate-50'} ${isDefaultPassword ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}>
               <span className={`material-symbols-outlined text-sm ${styles.iconFill}`}>hourglass_top</span>進度查詢
             </button>
             <div className="my-4 border-t border-slate-200/50"></div>
             <button onClick={() => { setActiveTab("account"); setIsMobileMenuOpen(false); }} className={`w-full text-left p-4 rounded-2xl font-bold transition-all flex items-center gap-3 ${activeTab === 'account' ? 'bg-sky-50 text-sky-700 border-l-4 border-sky-600 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
               <span className={`material-symbols-outlined text-sm ${styles.iconFill}`}>manage_accounts</span>帳號安全
               {isDefaultPassword && <span className="ml-auto w-2 h-2 rounded-full bg-red-500 animate-ping"></span>}
             </button>
          </nav>
        </aside>

        <main className="w-full md:ml-64 p-4 md:p-8">
          <header className="mb-10">
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
              {activeTab === 'entry' && `廠商錄入 : ${vendorName}`}
              {activeTab === 'progress' && '審核進度追蹤'}
              {activeTab === 'account' && '帳號安全中心'}
            </h1>
            <p className="text-xs md:text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">Administrative Asset Interface</p>
          </header>

          {activeTab === 'account' && (
            <div className={`${styles.clinicalGlass} rounded-3xl p-6 md:p-8 shadow-sm flex flex-col animate-in slide-in-from-bottom-4 max-w-2xl mx-auto`}>
               <div className="flex items-center gap-2 mb-8 border-b border-slate-100 pb-4">
                 <span className={`material-symbols-outlined text-blue-600 ${styles.iconFill}`}>manage_accounts</span>
                 <h2 className="text-lg font-bold text-slate-800 tracking-tight">廠商身分認證與密碼管理</h2>
               </div>
               {isDefaultPassword && (
                 <div className="mb-6 p-4 bg-amber-50 text-amber-700 rounded-2xl border border-amber-200 flex items-start gap-3">
                   <span className={`material-symbols-outlined text-lg ${styles.iconFill} animate-pulse`}>warning</span>
                   <div>
                     <h3 className="text-[12px] font-black tracking-widest uppercase mb-1">系統作業權限鎖定中</h3>
                     <p className="text-[11px] font-bold">偵測到您正在使用系統預設密碼 (123456) 登入。為保障雙方資產與網路資料安全，請立即設定您的專屬新密碼以解鎖各項作業功能。</p>
                   </div>
                 </div>
               )}
               <div className="space-y-5">
                 <div><label className={styles.inputLabel}>帳號所屬實體 (Vendor Entity)</label><input type="text" value={vendorName} disabled className={`${styles.crystalInput} opacity-70 bg-slate-100 cursor-not-allowed text-slate-500 font-black`} /></div>
                 <div><label className={styles.inputLabel}>設定新密碼 (New Password)</label><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="請輸入最少 6 碼長度之新密碼" className={`${styles.crystalInput} tracking-widest`} /></div>
                 <div><label className={styles.inputLabel}>確認新密碼 (Confirm Password)</label><input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="請再次輸入新密碼以進行核對" className={`${styles.crystalInput} tracking-widest`} onKeyDown={e => { if (e.key === 'Enter') handleUpdatePassword(); }} /></div>
               </div>
               <div className="mt-8 pt-6 border-t border-slate-100">
                 <button onClick={handleUpdatePassword} disabled={isLoading || !newPassword || !confirmPassword} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-[0.3em] text-sm shadow-xl shadow-blue-900/20 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3">
                   {isLoading ? <> <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> <span>系統變更中...</span> </> : <><span className={`material-symbols-outlined text-[18px] ${styles.iconFill}`}>lock_reset</span> <span>儲存變更並解鎖系統</span></>}
                 </button>
               </div>
            </div>
          )}

          {activeTab === 'entry' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in zoom-in-95 duration-500">
              <section className="col-span-1 lg:col-span-4">
                <div className={`${styles.clinicalGlass} rounded-3xl p-6 md:p-8 shadow-sm`}>
                  <div className="flex items-center gap-2 mb-8 border-b border-slate-100 pb-4"><span className={`material-symbols-outlined text-blue-600 ${styles.iconFill}`}>info</span><h2 className="text-lg font-bold text-slate-800 tracking-tight">行政基本資料</h2></div>
                  <div className="space-y-5">
                     <div><label className={styles.inputLabel}>裝機日期</label><input type="date" value={metadata.date} onChange={e => setMetadata({...metadata, date: e.target.value})} className={styles.crystalInput} /></div>
                     <div className="grid grid-cols-2 gap-4">
                       <div><label className={styles.inputLabel}>所屬棟別</label><select value={metadata.area} onChange={e => setMetadata({...metadata, area: e.target.value})} className={styles.crystalInput}>{buildingOptions.map(v => <option key={v.棟別代碼} value={v.棟別名稱}>{v.棟別名稱}</option>)}</select></div>
                       <div><label className={styles.inputLabel}>樓層</label><input type="text" value={metadata.floor} onChange={e => setMetadata({...metadata, floor: e.target.value.toUpperCase()})} placeholder="如: 05F" className={styles.crystalInput} /></div>
                     </div>
                     <div><label className={styles.inputLabel}>單位全稱</label><input type="text" value={metadata.unit} onChange={e => setMetadata({...metadata, unit: e.target.value})} placeholder="如: 資訊組" className={styles.crystalInput} /></div>
                     <div className="grid grid-cols-2 gap-4">
                       <div><label className={styles.inputLabel}>聯絡人姓名</label><input type="text" value={metadata.applicantName} onChange={e => setMetadata({...metadata, applicantName: e.target.value})} placeholder="如: 王小明" className={styles.crystalInput} /></div>
                       <div><label className={styles.inputLabel}>分機號碼</label><input type="text" value={metadata.applicantExt} onChange={e => setMetadata({...metadata, applicantExt: e.target.value})} placeholder="如: 1234" className={styles.crystalInput} /></div>
                     </div>
                  </div>
                </div>
              </section>

              <section className="col-span-1 lg:col-span-8 flex flex-col">
                 <div className={`${styles.clinicalGlass} rounded-3xl p-6 md:p-8 shadow-sm flex flex-col flex-1`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-slate-100 pb-4">
                       <div className="flex items-center gap-2"><span className={`material-symbols-outlined text-emerald-600 ${styles.iconFill}`}>dns</span><h2 className="text-lg font-bold text-slate-800 tracking-tight">設備詳細資訊</h2></div>
                       <button onClick={() => setDevices([...devices, { actionType: "新機", type: "桌上型電腦", model: "", sn: "", mac: "", mac2: "", remark: "", oldIp: "" }])} className="text-blue-600 font-black text-[10px] uppercase tracking-[0.2em] bg-blue-50 px-5 py-2.5 rounded-xl hover:bg-blue-100 transition-all border border-blue-100 shadow-sm">+ 新增設備節點</button>
                    </div>
                    
                    <div className="flex flex-col gap-5 w-full">
                      {devices.map((d, i) => (
                        <div key={i} className={styles.deviceItemBlock}>
                          <div className={styles.rowGrid}>
                            <div>
                              <label className={styles.inputLabel}>作業類型</label>
                              <select value={d.actionType} onChange={e => { const nd = [...devices]; nd[i].actionType = e.target.value as "新機"|"舊換新"; if (nd[i].actionType === '新機') nd[i].oldIp = ''; setDevices(nd); }} className={`${styles.crystalInput} ${d.actionType === '舊換新' ? 'bg-amber-50 border-amber-200 text-amber-800' : ''}`}>
                                <option value="新機">新設機台</option>
                                <option value="舊換新">舊換新 (汰換)</option>
                              </select>
                            </div>
                            <div><label className={styles.inputLabel}>設備類型</label><select value={d.type} onChange={e => { const nd = [...devices]; nd[i].type = e.target.value; setDevices(nd); }} className={styles.crystalInput}><option>桌上型電腦</option><option>筆記型電腦</option><option>印表機</option><option>醫療儀器</option><option>其他設備</option></select></div>
                            <div><label className={styles.inputLabel}>品牌型號</label><input placeholder="品牌型號" value={d.model} onChange={e => { const nd = [...devices]; nd[i].model = e.target.value; setDevices(nd); }} className={styles.crystalInput} /></div>
                          </div>
                          
                          <div className={styles.rowGrid}>
                            <div><label className={styles.inputLabel}>新設備 S/N (留空自動產生)</label><input placeholder="留空將自動產生" value={d.sn} onChange={e => { const nd = [...devices]; nd[i].sn = e.target.value.toUpperCase(); setDevices(nd); }} className={`${styles.crystalInput} font-mono text-red-600`} /></div>
                            <div><label className={styles.inputLabel}>主要 MAC</label><input placeholder="有線 MAC" value={d.mac} onChange={e => handleMacInput(i, e.target.value, "mac")} className={`${styles.crystalInput} font-mono text-blue-600`} /></div>
                            <div><label className={styles.inputLabel}>無線 MAC (可選)</label><input placeholder="無線" value={d.mac2} onChange={e => handleMacInput(i, e.target.value, "mac2")} className={`${styles.crystalInput} font-mono text-slate-400`} /></div>
                          </div>

                          {d.actionType === '舊換新' && (
                            <div className="w-full bg-amber-50 p-4 rounded-xl border border-amber-200 mt-1 animate-in fade-in zoom-in-95 duration-200">
                               <label className={`${styles.inputLabel} text-amber-800 flex items-center gap-1`}>
                                 <span className="material-symbols-outlined text-[14px]">warning</span> 請輸入欲汰換之舊設備 IP (必填)
                               </label>
                               <input placeholder="輸入舊機 IP，系統將於新機核准時自動作廢該舊機..." value={d.oldIp} onChange={e => { const nd = [...devices]; nd[i].oldIp = e.target.value.trim(); setDevices(nd); }} className={`${styles.crystalInput} font-mono border-amber-300 shadow-inner mt-1`} />
                            </div>
                          )}

                          <div className="w-full mt-1">
                             <label className={styles.inputLabel}>設備備註</label>
                             <input placeholder="補充說明" value={d.remark} onChange={e => { const nd = [...devices]; nd[i].remark = e.target.value; setDevices(nd); }} className={styles.crystalInput} />
                          </div>

                          {devices.length > 1 && <button onClick={() => setDevices(devices.filter((_, idx) => idx !== i))} className={styles.removeBtn}><span className="material-symbols-outlined text-[14px]">close</span></button>}
                        </div>
                      ))}
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-100">
                       <button onClick={handleSubmit} disabled={isLoading} className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-[0.3em] text-sm shadow-xl shadow-blue-900/20 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3">
                         {isLoading ? <> <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> <span>系統處理中...</span> </> : <span>提交預約核准</span>}
                       </button>
                    </div>
                 </div>
              </section>
            </div>
          )}

          {activeTab === 'progress' && (
             <div className={`${styles.clinicalGlass} rounded-3xl p-6 md:p-8 shadow-sm flex flex-col min-h-[500px] animate-in slide-in-from-right-4`}>
                <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2"><span className={`material-symbols-outlined text-amber-500 ${styles.iconFill}`}>hourglass_empty</span><h2 className="text-lg font-bold text-slate-800 tracking-tight">廠商案件總覽 (含歷史)</h2></div>
                  <button onClick={() => fetchPendingRecords(vendorName)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 hover:text-blue-600 transition-colors bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm"><span className="material-symbols-outlined text-sm">sync</span> 重新整理</button>
                </div>
                
                <div className="hidden lg:block overflow-x-auto w-full">
                  <table className="w-full text-left min-w-[900px]">
                    <thead>
                      <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                        <th className="pb-4 px-4 w-[200px]">設備登錄名稱</th>
                        <th className="pb-4 px-4">部署單位 / 棟別</th>
                        <th className="pb-4 px-4">設備參數 / IP狀態</th>
                        <th className="pb-4 px-4">案件狀態</th>
                        <th className="pb-4 px-4 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                      {pendingRecords.map((record, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-all">
                          <td className="p-4 align-top">
                            {record.assignedName ? (
                              <span className="font-mono text-sm font-black text-blue-700">{record.assignedName}</span>
                            ) : (
                              <span className="font-mono text-xs text-slate-500">S/N: {record.sn}</span>
                            )}
                          </td>
                          <td className="p-4 font-bold align-top">
                            <p className="text-slate-800">{record.unit}</p>
                            <p className="text-[10px] text-slate-400 font-normal uppercase mt-0.5">{record.area} | {record.floor} | {record.date}</p>
                            <p className="text-[10px] text-slate-500 font-normal mt-0.5">{record.applicantName} #{record.applicantExt}</p>
                          </td>
                          <td className="p-4 align-top">
                            <p className="font-bold text-slate-600">{record.model}</p>
                            <p className="text-[10px] font-mono text-slate-500 uppercase mt-0.5">MAC: <span className="font-black text-blue-600">{record.mac1}</span></p>
                            {record.assignedIp && (
                              <p className="text-[10px] font-bold text-emerald-600 mt-1.5 bg-emerald-50 inline-block px-2 py-0.5 rounded border border-emerald-100">核發 IP: {record.assignedIp}</p>
                            )}
                          </td>
                          <td className="p-4 align-top">
                            {record.status === '待核定' && <span className="bg-amber-100 text-amber-700 text-[10px] px-3 py-1.5 rounded-full border border-amber-200 font-black uppercase tracking-widest shadow-sm">審核中</span>}
                            {record.status === '已退回(待修正)' && (
                              <div className="flex flex-col items-start gap-1">
                                <span className="bg-red-100 text-red-700 text-[10px] px-3 py-1.5 rounded-full border border-red-200 font-black uppercase tracking-widest shadow-sm">已退回</span>
                                <span className="text-[10px] text-red-600 font-bold bg-red-50 px-2 py-1 rounded border border-red-100">原因: {record.rejectReason}</span>
                              </div>
                            )}
                            {record.status === '已核定(待確認)' && <span className="bg-blue-100 text-blue-700 text-[10px] px-3 py-1.5 rounded-full border border-blue-200 font-black uppercase tracking-widest shadow-sm">已核發</span>}
                            {record.status === '已結案' && <span className="bg-emerald-100 text-emerald-700 text-[10px] px-3 py-1.5 rounded-full border border-emerald-200 font-black uppercase tracking-widest shadow-sm">歸檔完畢</span>}
                          </td>
                          <td className="p-4 align-top text-right">
                            <div className="flex flex-col items-end gap-2">
                               {record.status === '待核定' && <button onClick={() => handleDeletePending(record.sn)} className="text-[10px] font-black uppercase tracking-widest px-4 py-2 border border-slate-200 text-red-500 rounded-xl hover:bg-red-50 hover:border-red-200 transition-all shadow-sm bg-white">撤回申請</button>}
                               {record.status === '已退回(待修正)' && <button onClick={() => handleLoadFix(record.sn)} className="text-[10px] font-black uppercase tracking-widest px-4 py-2 border border-amber-200 text-amber-600 rounded-xl hover:bg-amber-50 hover:border-amber-300 transition-all shadow-sm bg-white flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">edit_document</span> 載入修正</button>}
                               {record.status === '已核定(待確認)' && <button onClick={() => handleConfirm(record.sn)} className="text-[10px] font-black uppercase tracking-widest px-4 py-2 border border-transparent text-white bg-emerald-500 rounded-xl hover:bg-emerald-600 transition-all shadow-sm flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">verified</span> 確認結案</button>}
                               {record.status === '已結案' && <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">不適用操作</span>}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {pendingRecords.length === 0 && !isLoading && <tr><td colSpan={5} className="py-20 text-center text-slate-400 font-bold italic">目前無任何案件紀錄。</td></tr>}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 gap-5 lg:hidden w-full">
                  {pendingRecords.map((record, idx) => (
                    <div key={idx} className={styles.deviceItemBlock}>
                      <div className="flex justify-between items-center border-b border-slate-200/60 pb-3 mb-3">
                        {record.assignedName ? (
                          <span className="font-mono text-base font-black text-blue-700">{record.assignedName}</span>
                        ) : (
                          <span className="font-mono text-sm font-black text-slate-400">S/N: {record.sn}</span>
                        )}
                        <div>
                          {record.status === '待核定' && <span className="bg-amber-100 text-amber-700 text-[10px] px-3 py-1.5 rounded-full border border-amber-200 font-black uppercase tracking-widest shadow-sm">審核中</span>}
                          {record.status === '已退回(待修正)' && <span className="bg-red-100 text-red-700 text-[10px] px-3 py-1.5 rounded-full border border-red-200 font-black uppercase tracking-widest shadow-sm">已退回</span>}
                          {record.status === '已核定(待確認)' && <span className="bg-blue-100 text-blue-700 text-[10px] px-3 py-1.5 rounded-full border border-blue-200 font-black uppercase tracking-widest shadow-sm">已核發</span>}
                          {record.status === '已結案' && <span className="bg-emerald-100 text-emerald-700 text-[10px] px-3 py-1.5 rounded-full border border-emerald-200 font-black uppercase tracking-widest shadow-sm">歸檔完畢</span>}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                           <label className={styles.inputLabel}>部署單位 / 聯絡人</label>
                           <div className="bg-white/60 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700">
                             {record.unit} ({record.area} {record.floor})
                             <span className="text-slate-500 mt-1 block">{record.applicantName} #{record.applicantExt}</span>
                           </div>
                        </div>
                        <div>
                           <label className={styles.inputLabel}>設備參數</label>
                           <div className="bg-white/60 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-700">
                             {record.model}
                             <span className="text-blue-600 font-mono mt-1 block tracking-widest">{record.mac1}</span>
                           </div>
                        </div>
                        
                        {record.assignedIp && (
                           <div className="col-span-1 sm:col-span-2">
                             <label className={styles.inputLabel}>核定 IP</label>
                             <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm font-black text-emerald-600 font-mono tracking-widest text-center shadow-sm">
                               {record.assignedIp}
                             </div>
                           </div>
                        )}
                        {record.status === '已退回(待修正)' && (
                           <div className="col-span-1 sm:col-span-2">
                             <label className={styles.inputLabel}>退回原因</label>
                             <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs font-bold text-red-600 shadow-sm">
                               {record.rejectReason}
                             </div>
                           </div>
                        )}
                      </div>

                      <div className="mt-2 pt-4 border-t border-slate-200/60 flex flex-col gap-2">
                         {record.status === '待核定' && <button onClick={() => handleDeletePending(record.sn)} className="w-full py-3.5 bg-white border border-slate-200 text-red-500 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-50 transition-all shadow-sm">撤回預約申請</button>}
                         {record.status === '已退回(待修正)' && <button onClick={() => handleLoadFix(record.sn)} className="w-full py-3.5 bg-amber-500 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-amber-600 transition-all shadow-sm flex items-center justify-center gap-2"><span className="material-symbols-outlined text-[16px]">edit_document</span> 載入案件重新修正</button>}
                         {record.status === '已核定(待確認)' && <button onClick={() => handleConfirm(record.sn)} className="w-full py-3.5 bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-sm flex items-center justify-center gap-2"><span className="material-symbols-outlined text-[16px]">verified</span> 確認設定並結案</button>}
                         {record.status === '已結案' && <div className="w-full py-3.5 bg-slate-100 text-slate-400 rounded-xl font-black text-xs uppercase tracking-widest text-center border border-slate-200">此案件已封存</div>}
                      </div>
                    </div>
                  ))}
                  {pendingRecords.length === 0 && !isLoading && <div className="py-20 text-center text-slate-400 font-bold italic">目前無任何案件紀錄。</div>}
                </div>
             </div>
          )}
        </main>
      </div>

      {isLoading && <div className={styles.loaderOverlay}><div className={styles.spinner}></div><p className="text-blue-600 font-black text-[10px] uppercase mt-6 tracking-[0.5em] animate-pulse">系統處理中...</p></div>}
      <div className="fixed bottom-10 right-8 z-[9000] flex flex-col gap-3">{toasts.map(t => <div key={t.id} className={styles.toastBase}><span className={`material-symbols-outlined text-sm ${styles.iconFill} ${t.type === 'success' ? 'text-emerald-400' : t.type === 'error' ? 'text-red-400' : 'text-blue-400'}`}>{t.type === 'success' ? 'check_circle' : t.type === 'error' ? 'error' : 'info'}</span><span className="tracking-wide">{t.msg}</span></div>)}</div>
    </div>
  );
}