'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  ClipboardCheck, 
  Settings, 
  Code, 
  Megaphone, 
  Headset, 
  UserCheck, 
  History,
  ListChecks,
  ExternalLink,
  Calendar,
  CheckCircle2,
  Database,
  ArrowRightLeft,
  Search,
  FileSearch,
  Upload,
  Download,
  CheckSquare,
  AlertCircle,
  LayoutDashboard,
  Clock,
  ChevronRight,
  ChevronDown,
  LogOut,
  User as UserIcon,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import Image from 'next/image';
import { db, auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, User } from '@/lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  query, 
  getDocs, 
  writeBatch,
  serverTimestamp,
  orderBy
} from 'firebase/firestore';

// --- Types ---

interface ChecklistItem {
  id: number;
  section: string;
  task: string;
  role: string;
  completed: boolean;
  date: string;
}

interface Fund {
  code: string;
  name: string;
  brand: string;
  type: string;
  progress: string;
}

interface HistoryFund {
  code: string;
  name: string;
  effectiveDate: string;
  pmSign: string;
  opsSign: string;
  gmSign: string;
}

interface MappingRule {
  label: string;
  v: string;
  file: string;
  note: string;
}

// --- Initial Data ---

const INITIAL_CHECKLIST: ChecklistItem[] = [
  { id: 3, section: '基金產品商審', task: '產品 PM 初審基金名單', role: 'PM', completed: false, date: '' },
  { id: 5, section: '上架基金資料設定', task: '公開說明書/簡式說明書/投資人須知最新資料確認', role: '股務', completed: false, date: '' },
  { id: 6, section: '上架基金資料設定', task: '基金上架後台參數設定', role: '股務', completed: false, date: '' },
  { id: 7, section: '上架基金資料設定', task: '基金最低申購金額及級距設定', role: '股務', completed: false, date: '' },
  { id: 8, section: '上架基金資料設定', task: '【官網】基金交易路徑測試驗證', role: 'PM', completed: false, date: '' },
  { id: 9, section: '基金優惠設定', task: '基金申購優惠內容與行銷素材提供', role: '行銷', completed: false, date: '' },
  { id: 10, section: '基金優惠設定', task: '通路KOL代碼設定', role: '行銷', completed: false, date: '' },
  { id: 12, section: '網站資料準備', task: '基金品牌介紹、公告上稿', role: '行銷', completed: false, date: '' },
  { id: 11, section: '網站資料準備', task: '基金相關 FAQ 與客問答說明提供', role: '客服', completed: false, date: '' },
  { id: 13, section: '最終核准', task: '核准上架', role: '總經理', completed: false, date: '' },
];

const SCHEDULED_FUNDS: Fund[] = [
  { code: '98638760', name: '統一大中華中小基金(人民幣) (本基金之配息來源可能為本金)', brand: '統一投信', type: '境內', progress: '資料同步中' },
  { code: '98638759', name: '統一大中華中小基金(美元) (本基金之配息來源可能為本金)', brand: '統一投信', type: '境內', progress: '待審核' },
  { code: '98637078', name: '統一大中華中小基金(新台幣) (本基金之配息來源可能為本金)', brand: '統一投信', type: '境內', progress: '待審核' },
  { code: '17605622', name: '統一大滿貫基金-A類型 (本基金有進行遞延手續費之宣導並警語說明)', brand: '統一投信', type: '境內', progress: 'IT對應中' },
  { code: '98638861', name: '統一大滿貫基金-I類型 (本基金有進行遞延手續費之宣導並警語說明)', brand: '統一投信', type: '境內', progress: '待審核' },
  { code: 'C0054008', name: '法盛漢瑞斯全球股票基金R/A USD (本基金之配息來源可能為本金)', brand: '中國信託', type: '境外', progress: '法規審核中' },
];

const HISTORY_FUNDS: HistoryFund[] = [
  { code: '98642082', name: '中國信託科技趨勢多重資產基金-A累積型 (本基金之配息來源可能為本金)', effectiveDate: '2026/03/20', pmSign: '2026/03/12', opsSign: '2026/03/15', gmSign: '2026/03/18' },
  { code: '98640872', name: '富蘭克林華美全球非投資等級債券基金 (本基金之配息來源可能為本金)', effectiveDate: '2026/03/10', pmSign: '2026/03/01', opsSign: '2026/03/05', gmSign: '2026/03/09' },
  { code: 'C0012020', name: '首源亞洲優質債券基金(澳幣) (本基金之配息來源可能為本金)', effectiveDate: '2026/02/25', pmSign: '2026/02/10', opsSign: '2026/02/15', gmSign: '2026/02/22' },
];

const MAPPING_RULES: Record<string, MappingRule[]> = {
  domestic: [
    { label: '基金代號', v: 'v25', file: '境內基本資料', note: '資料主鍵' },
    { label: 'ISIN Code', v: 'v43', file: '境內基本資料', note: '國際編碼' },
    { label: '基金名稱', v: 'v2', file: '境內基本資料', note: '完整顯示名稱' },
    { label: '基金品牌', v: 'v4', file: '境內基本資料', note: '投信名稱' },
    { label: '計價幣別', v: 'v13', file: '境內基本資料', note: '結算幣別' }
  ],
  offshore: [
    { label: '基金代號', v: 'v29', file: '境外基本資料', note: '境外專用代碼' },
    { label: 'ISIN Code', v: 'v42', file: '境外基本資料', note: '境外證券編碼' },
    { label: '基金名稱', v: 'v2', file: '境外基本資料', note: '譯名' },
    { label: '基金品牌', v: 'v31', file: '境外品牌', note: '境外品牌' },
    { label: '計價幣別', v: 'v10', file: '境外基本資料', note: '報價幣別' }
  ]
};

// --- Main Application Component ---

export default function FundPortal() {
  const [activeTab, setActiveTab] = useState('summary');
  const [checklist, setChecklist] = useState<ChecklistItem[]>(INITIAL_CHECKLIST);
  const [scheduledFunds, setScheduledFunds] = useState<Fund[]>(SCHEDULED_FUNDS);
  const [historyFunds, setHistoryFunds] = useState<HistoryFund[]>(HISTORY_FUNDS);
  const [fundType, setFundType] = useState('domestic');
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState<string>('');
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  // --- Firebase Auth & Sync ---

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Sync Checklist
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'session_state/checklist/items'), orderBy('id', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        // Initialize if empty
        const initBatch = async () => {
          try {
            const batch = writeBatch(db);
            INITIAL_CHECKLIST.forEach(item => {
              const docRef = doc(db, 'session_state/checklist/items', item.id.toString());
              batch.set(docRef, { ...item, updatedBy: user.uid });
            });
            await batch.commit();
          } catch (err) {
            console.error("Checklist init error:", err);
          }
        };
        initBatch();
      } else {
        const items = snapshot.docs.map(doc => doc.data() as ChecklistItem);
        setChecklist(items);
      }
    }, (err) => {
      console.error("Checklist sync error:", err);
    });

    return () => unsubscribe();
  }, [user]);

  // Sync History
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'history'), orderBy('archivedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const funds = snapshot.docs.map(doc => doc.data() as HistoryFund);
        setHistoryFunds(funds);
      }
    }, (err) => {
      console.error("History sync error:", err);
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = () => signOut(auth);

  // Checklist toggle logic
  const toggleCheck = async (id: number) => {
    if (!user) {
      alert('請先登入後再進行簽署。');
      return;
    }

    const itemToToggle = checklist.find(i => i.id === id);
    if (!itemToToggle) return;

    const isFinalApproval = id === 13;
    const otherTasksCompleted = checklist.filter(i => i.id !== 13).every(i => i.completed);

    if (isFinalApproval && !otherTasksCompleted && !itemToToggle.completed) {
      alert('請先完成上方所有檢核項目，才能進行最終核准簽署。');
      return;
    }

    const isDone = !itemToToggle.completed;
    const docRef = doc(db, 'session_state/checklist/items', id.toString());
    
    try {
      await setDoc(docRef, {
        ...itemToToggle,
        completed: isDone,
        date: isDone ? new Date().toLocaleDateString('zh-TW') : '',
        updatedBy: user.uid
      }, { merge: true });
    } catch (error) {
      console.error("Update failed:", error);
      alert('簽署失敗，請檢查權限或網路連接。');
    }
  };

  // Progress stats calculation
  const stats = useMemo(() => {
    const total = checklist.length;
    const done = checklist.filter(i => i.completed).length;
    return {
      percent: Math.round((done / total) * 100),
      done,
      total
    };
  }, [checklist]);

  // Derived History Dates
  const availableHistoryDates = useMemo(() => {
    const dates = historyFunds
      .map(f => f.effectiveDate)
      .filter((date, index, self) => date && self.indexOf(date) === index);
    return dates.sort((a, b) => b.localeCompare(a)); // Newest first
  }, [historyFunds]);

  // Use derived selected date to avoid setState in effect
  const activeHistoryDate = selectedHistoryDate || (availableHistoryDates.length > 0 ? availableHistoryDates[0] : '');

  // Filtered History
  const filteredHistory = useMemo(() => {
    if (!activeHistoryDate) return historyFunds;
    return historyFunds.filter(h => h.effectiveDate === activeHistoryDate);
  }, [historyFunds, activeHistoryDate]);

  // Excel Export logic
  const handleExportExcel = () => {
    // Filter data based on search term (matching table UI)
    const filteredData = scheduledFunds.filter(f => 
      f.name.includes(searchTerm) || f.code.includes(searchTerm)
    );

    // Map data to friendly names for Excel columns
    const excelData = filteredData.map(fund => ({
      '類型': fund.type,
      '基金代碼': fund.code,
      '基金全稱 (含投資警語)': fund.name,
      '發行品牌': fund.brand
    }));

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '預定上架清單');

    // Download the file
    XLSX.writeFile(workbook, `預定上架清單_${new Date().toLocaleDateString('zh-TW').replace(/\//g, '-')}.xlsx`);
  };

  // Excel Import logic
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        // Map Excel columns back to Fund interface
        const importedFunds: Fund[] = data.map(row => ({
          type: row['類型'] || '未知',
          code: String(row['基金代碼']) || '00000000',
          name: row['基金全稱 (含投資警語)'] || '未命名基金',
          brand: row['發行品牌'] || '未知品牌',
          progress: '待審核' // Default progress for new imports
        }));

        if (importedFunds.length > 0) {
          setScheduledFunds(importedFunds);
          alert(`成功匯入 ${importedFunds.length} 筆資料！`);
        } else {
          alert('Excel 檔案內沒有合法的資料項目。');
        }
      } catch (err) {
        console.error('Import error:', err);
        alert('匯入失敗，請確認檔案格式是否正確。');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Archive logic
  const handleArchive = async () => {
    console.log("Archive triggered. User:", user?.email, "Stats:", stats);
    
    if (!user) {
      alert('請先登入。');
      return;
    }

    if (stats.percent < 100) {
      alert(`所有檢核項目尚未完成 (${stats.done}/${stats.total})，請先完成簽署再歸檔。`);
      return;
    }

    if (scheduledFunds.length === 0) {
      alert('預定上架清單目前無資料，無法歸檔。');
      return;
    }

    setShowArchiveConfirm(true);
  };

  const executeArchive = async () => {
    if (isArchiving) return;
    setIsArchiving(true);
    setShowArchiveConfirm(false);

    const today = new Date().toLocaleDateString('zh-TW');
    const pmSignDate = checklist.find(i => i.id === 3)?.date || today;
    const opsSignDate = checklist.find(i => i.id === 5)?.date || today;
    const gmSignDate = checklist.find(i => i.id === 13)?.date || today;

    try {
      console.log("Starting Firestore batch...");
      const batch = writeBatch(db);
      
      scheduledFunds.forEach(fund => {
        const recordRef = doc(db, 'history', fund.code);
        batch.set(recordRef, {
          code: fund.code,
          name: fund.name,
          effectiveDate: today,
          pmSign: pmSignDate,
          opsSign: opsSignDate,
          gmSign: gmSignDate,
          archivedAt: serverTimestamp()
        });
      });

      // Reset checklist in Firestore
      checklist.forEach(item => {
        const itemRef = doc(db, 'session_state/checklist/items', item.id.toString());
        batch.update(itemRef, {
          completed: false,
          date: '',
          updatedBy: user.uid
        });
      });

      await batch.commit();
      console.log("Firestore batch committed successfully.");

      // --- Sync to Google Sheets ---
      console.log("Starting Google Sheets sync...");
      try {
        let sheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID?.trim();
        if (sheetId && sheetId.includes('/d/')) {
          const match = sheetId.match(/\/d\/([\w-]+)/);
          if (match) sheetId = match[1];
        }

        const sheetData = scheduledFunds.map(fund => ({
          code: fund.code,
          name: fund.name,
          effectiveDate: today,
          pmSign: pmSignDate,
          opsSign: opsSignDate,
          gmSign: gmSignDate,
        }));

        const sheetRes = await fetch('/api/sheets/append', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            records: sheetData,
            sheetId: sheetId 
          }),
        });

        let sheetResult;
        try {
          sheetResult = await sheetRes.json();
        } catch (jsonErr) {
          console.error("Failed to parse sheet response as JSON", jsonErr);
          throw new Error('試算表 API 回傳格式錯誤 (非 JSON)');
        }

        if (!sheetRes.ok) {
          throw new Error(sheetResult.error || `Sheets API error: ${sheetRes.status}`);
        }

        console.log(`Successfully synced to Google Sheet: ${sheetResult.sheetName}`);
        alert(`歸檔成功！資料已同步至永久歷史庫與試算表 (${sheetResult.sheetName})。`);
      } catch (sheetsErr: any) {
        console.error("Google Sheets sync failed:", sheetsErr);
        alert(`注意：系統進度已重置且 Firestore 歸檔成功，但 Google Sheets 同步失敗：${sheetsErr.message}。`);
      }

      setScheduledFunds([]); 
      setActiveTab('history');
    } catch (error: any) {
      console.error("Archive failed:", error);
      alert(`歸檔失敗：${error.message || '未知錯誤'}。請確認是否已有相同代碼之基金已歸檔。`);
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 selection:bg-blue-100 p-3 md:p-6 flex flex-col gap-4 md:gap-6">
      
      {/* Bento Header */}
      <header className="max-w-[1440px] w-full mx-auto flex flex-col md:flex-row items-center justify-between bg-white rounded-[1.5rem] md:rounded-[2rem] p-3 md:p-4 shadow-sm border border-slate-200 sticky top-0 md:top-4 z-50 gap-4">
        <div className="flex items-center gap-3 md:gap-4 w-full md:w-auto">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-700 rounded-lg md:rounded-xl flex items-center justify-center text-white font-black text-lg md:text-xl shadow-lg shadow-blue-200 shrink-0">
            口
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm md:text-lg font-black tracking-tighter leading-none text-slate-800">口袋投顧 | 基金上架審議</h1>
            <p className="text-[8px] md:text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-0.5">Listing Operations v2.0</p>
          </div>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex gap-1">
          {[
            { id: 'summary', label: '審議摘要', icon: <CheckSquare size={14}/> },
            { id: 'scheduled', label: '預定上架', icon: <ListChecks size={14}/> },
            { id: 'history', label: '歷史紀錄', icon: <History size={14}/> },
            { id: 'instructions', label: '任務說明', icon: <AlertCircle size={14}/> },
            { id: 'mapping', label: 'IT 對應表', icon: <Code size={14}/> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === tab.id 
                ? 'bg-blue-50 text-blue-700 border border-blue-100 shadow-sm' 
                : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Mobile Nav (Scrollable) */}
        <nav className="lg:hidden flex w-full overflow-x-auto no-scrollbar gap-1 pb-1">
          {[
            { id: 'summary', label: '摘要', icon: <CheckSquare size={14}/> },
            { id: 'scheduled', label: '清單', icon: <ListChecks size={14}/> },
            { id: 'history', label: '歷史', icon: <History size={14}/> },
            { id: 'instructions', label: '說明', icon: <AlertCircle size={14}/> },
            { id: 'mapping', label: '映射', icon: <Code size={14}/> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap border ${
                activeTab === tab.id 
                ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                : 'bg-white text-slate-500 border-slate-200'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl px-3 py-1.5">
              <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 relative overflow-hidden">
                {user.photoURL ? (
                  <Image 
                    src={user.photoURL} 
                    alt="avatar" 
                    fill 
                    className="object-cover" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <UserIcon size={16} />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black leading-none text-slate-700">{user.displayName || 'User'}</span>
                <span className="text-[8px] font-bold text-slate-400 mt-0.5 flex items-center gap-1">
                  <ShieldCheck size={8} className="text-emerald-500" /> AUTH VERIFIED
                </span>
              </div>
              <button 
                onClick={handleLogout}
                className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-red-500 transition-colors flex items-center justify-center ml-1 shadow-sm"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-700 hover:bg-blue-600 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-blue-200 uppercase tracking-widest active:scale-95"
            >
              登入系統
            </button>
          )}
        </div>
      </header>

      {/* Archive Confirmation Modal */}
      <AnimatePresence>
        {showArchiveConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setShowArchiveConfirm(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="p-8">
                <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6 border border-emerald-100">
                  <Database className="text-emerald-600" size={32} />
                </div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2">確認要歸檔錄入嗎？</h3>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">
                  目前清單中有 <span className="font-black text-emerald-600">{scheduledFunds.length}</span> 筆基金，歸檔後將永久存儲於歷史庫並重置當前檢核進度。
                </p>
              </div>
              <div className="bg-slate-50 p-4 flex gap-3">
                <button 
                  onClick={() => setShowArchiveConfirm(false)}
                  className="flex-1 py-3 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
                >
                  再想想
                </button>
                <button 
                  onClick={executeArchive}
                  className="flex-[2] py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-black shadow-lg shadow-emerald-200 transition-all active:scale-95"
                >
                  確認並存儲
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content (Bento Layout) */}
      <main className="flex-grow max-w-[1440px] w-full mx-auto">
        <AnimatePresence mode="wait">
          {(!user && !isLoading) ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="h-[60vh] flex flex-col items-center justify-center text-center px-6"
            >
              <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-xl shadow-blue-100">
                <ShieldCheck size={40} />
              </div>
              <h2 className="text-3xl font-black text-slate-800 tracking-tighter mb-4">系統存取受限</h2>
              <p className="text-slate-500 max-w-md font-bold leading-relaxed mb-8">
                本系統為口袋投顧內部專用。請先使用 Google 帳號登入，以同步歷史紀錄並進行線上簽署。
              </p>
              <button 
                onClick={handleLogin}
                className="flex items-center gap-3 px-10 py-5 bg-blue-700 hover:bg-blue-600 text-white rounded-3xl text-sm font-black transition-all shadow-2xl shadow-blue-200 uppercase tracking-[0.2em] active:scale-95"
              >
                使用公司帳號登入
              </button>
            </motion.div>
          ) : isLoading ? (
             <div className="h-[60vh] flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
             </div>
          ) : (
            <motion.div
              key={activeTab}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="h-full"
          >
            {/* 1. Summary Bento Grid */}
            {activeTab === 'summary' && (
              <div className="grid grid-cols-12 gap-4 md:gap-6 h-full">
                {/* Progress Card (Col 3) */}
                <div className="col-span-12 lg:col-span-3 bg-blue-700 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 text-white flex flex-col justify-between shadow-xl shadow-blue-200/50 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-24 -mt-24" />
                  
                  <div className="relative z-10">
                    <h3 className="text-[10px] font-black opacity-60 uppercase tracking-[0.2em] mb-3">Project Status</h3>
                    <p className="text-xl md:text-2xl font-black leading-tight tracking-tighter">
                      基金上架審議
                    </p>
                  </div>

                  <div className="relative z-10 py-6 md:py-10 flex flex-col items-center">
                    <div className="relative w-32 h-32 md:w-40 md:h-40">
                      <svg className="w-full h-full transform -rotate-90">
                        {/* Mobile Circles */}
                        <circle cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="10" fill="transparent" className="text-blue-800 md:hidden" />
                        <motion.circle 
                          cx="64" cy="64" r="56" stroke="currentColor" strokeWidth="10" fill="transparent" 
                          strokeDasharray="351.8" 
                          initial={{ strokeDashoffset: 351.8 }}
                          animate={{ strokeDashoffset: 351.8 - (351.8 * stats.percent) / 100 }}
                          transition={{ duration: 1.5, ease: 'easeOut' }}
                          className="text-blue-300 md:hidden" 
                        />

                        {/* Desktop Circles */}
                        <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="14" fill="transparent" className="text-blue-800 hidden md:block" />
                        <motion.circle 
                          cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="14" fill="transparent" 
                          strokeDasharray="440" 
                          initial={{ strokeDashoffset: 440 }}
                          animate={{ strokeDashoffset: 440 - (440 * stats.percent) / 100 }}
                          transition={{ duration: 1.5, ease: 'easeOut' }}
                          className="text-blue-300 shadow-[0_0_15px_rgba(147,197,253,0.5)] hidden md:block" 
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl md:text-4xl font-black tracking-tighter">{stats.percent}%</span>
                        <span className="text-[8px] md:text-[9px] font-bold opacity-60 tracking-[0.2em]">COMPLETE</span>
                      </div>
                    </div>
                    <p className="text-[10px] font-bold opacity-80 mt-4 md:mt-6 bg-blue-800/40 px-3 py-1 rounded-full border border-blue-400/20 uppercase tracking-widest text-center">
                      已簽署 {stats.done} / {stats.total} 項目
                    </p>
                  </div>

                  <button className="relative z-10 w-full py-3 md:py-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl text-[9px] md:text-[10px] font-black transition-all uppercase tracking-[0.2em] mt-2 backdrop-blur-sm">
                    View Full Audit
                  </button>
                </div>

                {/* Checklist Table (Col 9) */}
                <div className="col-span-12 lg:col-span-9 bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                  <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50/50 gap-3">
                    <h4 className="font-black text-slate-800 flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.5)]"></span>
                      基金上架檢核執行表
                    </h4>
                    <span className="text-[9px] md:text-[10px] font-black text-blue-600 bg-blue-50 px-4 py-1.5 rounded-full uppercase tracking-[0.1em] border border-blue-100 ring-4 ring-white">Active Session</span>
                  </div>
                  
                  <div className="flex-grow overflow-y-auto max-h-[500px]">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                      <thead>
                        <tr className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] border-b border-slate-50 sticky top-0 bg-white/80 backdrop-blur-md z-10">
                          <th className="px-6 py-5 w-16 text-center">簽章</th>
                          <th className="px-6 py-5">檢核任務內容</th>
                          <th className="px-6 py-5">權責單位</th>
                          <th className="px-6 py-5 whitespace-nowrap">簽署日期</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {checklist.map(item => {
                          const isFinal = item.id === 13;
                          const isLocked = isFinal && !checklist.filter(i => i.id !== 13).every(i => i.completed);
                          
                          return (
                            <tr 
                              key={item.id} 
                              onClick={() => toggleCheck(item.id)}
                              className={`group cursor-pointer transition-all duration-300 ${
                                item.completed ? 'bg-blue-50/20' : 
                                isLocked ? 'opacity-40 cursor-not-allowed bg-slate-50/10' : 'hover:bg-slate-50/50'
                              }`}
                            >
                              <td className="px-6 py-5">
                                <div className={`mx-auto w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                                  item.completed 
                                  ? 'bg-blue-600 border-blue-600 text-white shadow-lg' 
                                  : isLocked ? 'border-dashed border-slate-300 bg-slate-100' : 'border-slate-200 bg-white group-hover:border-blue-300'
                                }`}>
                                  {item.completed && <CheckCircle2 size={14}/>}
                                  {isLocked && <div className="w-1.5 h-1.5 bg-slate-400 rounded-full" />}
                                </div>
                              </td>
                              <td className="px-6 py-5">
                                <div className="flex flex-col">
                                  <span className={`text-[9px] font-black uppercase tracking-tighter mb-0.5 transition-colors ${
                                    item.completed ? 'text-blue-400' : isLocked ? 'text-slate-300' : 'text-slate-400'
                                  }`}>
                                    {item.section}
                                  </span>
                                  <span className={`text-xs font-bold leading-tight transition-all ${
                                    item.completed ? 'text-slate-300 line-through italic' : isLocked ? 'text-slate-400' : 'text-slate-700'
                                  }`}>
                                    {item.task}
                                    {isLocked && <span className="ml-2 text-[8px] font-normal text-slate-400 italic">(需先完成上方項目)</span>}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-5">
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-full border transition-all ${
                                  item.completed ? 'bg-slate-50 text-slate-300 border-slate-100' : 
                                  isLocked ? 'bg-slate-50 text-slate-300 border-slate-100' : 'bg-white text-slate-500 border-slate-200'
                                }`}>
                                  {item.role}
                                </span>
                              </td>
                              <td className="px-6 py-5">
                                <span className="text-[10px] font-mono text-slate-400 uppercase">
                                  {item.date || '--'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-4 bg-slate-900 text-white flex justify-between items-center mt-auto border-t border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Waiting for review</span>
                    </div>
                    <button 
                      onClick={handleArchive}
                      disabled={isArchiving}
                      className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center gap-2 ${
                        isArchiving ? 'bg-slate-400 cursor-not-allowed' :
                        stats.percent === 100 ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer' : 'bg-blue-600 hover:bg-blue-500 text-white cursor-not-allowed opacity-80'
                      }`}
                    >
                      {isArchiving ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          歸檔中...
                        </>
                      ) : (
                        stats.percent === 100 ? '已完成 (確認歸檔)' : '將於 100% 開放歸檔'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Scheduled List view Style (Adapts Bento) */}
            {activeTab === 'scheduled' && (
              <div className="space-y-4 md:space-y-8 h-full">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white rounded-[1.5rem] md:rounded-[2rem] p-6 md:p-8 shadow-sm border border-slate-200 gap-6">
                  <div>
                    <h2 className="text-xl md:text-3xl font-black text-slate-800 tracking-tighter">預定上架清單</h2>
                    <p className="text-slate-400 text-[10px] md:text-sm font-bold uppercase tracking-widest mt-1">Pipeline Overview</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                    <div className="relative group flex-grow">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16}/>
                      <input 
                        type="text" 
                        placeholder="搜尋代號或名稱..." 
                        className="pl-12 pr-6 py-3 md:py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs md:text-sm w-full lg:w-80 outline-none transition-all focus:bg-white focus:ring-4 focus:ring-blue-100"
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2 md:gap-3 flex-wrap sm:flex-nowrap">
                      <label className="cursor-pointer flex-grow sm:flex-grow-0 text-center">
                        <input 
                          type="file" 
                          accept=".xlsx, .xls" 
                          className="hidden" 
                          onChange={handleImportExcel} 
                        />
                        <div className="flex items-center justify-center gap-2 md:gap-3 px-4 md:px-6 py-2.5 md:py-4 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black transition-all shadow-lg active:scale-95 uppercase tracking-widest whitespace-nowrap">
                          <Upload size={14} className="text-blue-400 md:w-4 md:h-4" />
                          匯入
                        </div>
                      </label>
                      <button 
                        onClick={handleExportExcel}
                        className="flex items-center justify-center gap-2 md:gap-3 px-4 md:px-6 py-2.5 md:py-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black transition-all shadow-sm active:scale-95 uppercase tracking-widest whitespace-nowrap flex-grow sm:flex-grow-0"
                      >
                        <Download size={14} className="text-emerald-500 md:w-4 md:h-4" />
                        匯出
                      </button>
                      
                      {stats.percent === 100 && (
                        <button 
                          onClick={handleArchive}
                          disabled={isArchiving}
                          className="flex items-center justify-center gap-2 md:gap-3 px-4 md:px-6 py-2.5 md:py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black transition-all shadow-lg active:scale-95 uppercase tracking-widest whitespace-nowrap"
                        >
                          <Database size={14} className={isArchiving ? "animate-spin" : ""} />
                          {isArchiving ? '處理中...' : '確認歸檔'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                      <thead>
                        <tr className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] border-b border-slate-50 bg-slate-50/50">
                          <th className="px-6 md:px-8 py-4 md:py-6 w-24 md:w-32">類型</th>
                          <th className="px-6 md:px-8 py-4 md:py-6">基金代碼</th>
                          <th className="px-6 md:px-8 py-4 md:py-6">基金全稱 (含投資警語)</th>
                          <th className="px-6 md:px-8 py-4 md:py-6">發行品牌</th>
                          <th className="px-6 md:px-8 py-4 md:py-6 text-center">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {scheduledFunds.filter(f => f.name.includes(searchTerm) || f.code.includes(searchTerm)).map((fund, idx) => (
                          <motion.tr 
                            key={idx} 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="group hover:bg-blue-50/30 transition-colors cursor-pointer"
                          >
                            <td className="px-6 md:px-8 py-4 md:py-6">
                              <span className={`px-2 py-0.5 md:px-3 md:py-1 rounded-lg text-[8px] md:text-[9px] font-black uppercase tracking-widest border border-blue-100/50 ${
                                fund.type === '境內' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600 border-purple-100'
                              }`}>
                                {fund.type}
                              </span>
                            </td>
                            <td className="px-6 md:px-8 py-4 md:py-6">
                              <span className="text-[10px] md:text-[11px] font-mono font-black text-slate-400"># {fund.code}</span>
                            </td>
                            <td className="px-6 md:px-8 py-4 md:py-6">
                              <div className="flex flex-col">
                                <span className="text-xs md:text-sm font-black text-slate-700 group-hover:text-blue-700 transition-colors">
                                  {fund.name}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 md:px-8 py-4 md:py-6">
                              <span className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                {fund.brand}
                              </span>
                            </td>
                            <td className="px-6 md:px-8 py-4 md:py-6 text-center">
                              <a 
                                href="https://sites.google.com/cmoneyfund.com.tw/report/%E9%A6%96%E9%A0%81"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mx-auto w-8 h-8 md:w-9 md:h-9 rounded-lg md:rounded-xl bg-slate-50 text-slate-300 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                              >
                                <ChevronRight size={16}/>
                              </a>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 3. History view (Adapts Bento) */}
            {activeTab === 'history' && (
              <div className="space-y-4 md:space-y-6 h-full">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-8 shadow-sm border border-slate-200 gap-4">
                  <div>
                    <h2 className="text-xl md:text-3xl font-black text-slate-800 tracking-tighter">歷史上架紀錄</h2>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px] md:text-[10px] mt-1">Archive Repository</p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-4 flex-1 justify-center w-full lg:max-w-xl">
                    <div className="relative group w-full">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" size={16}/>
                      <select 
                        className="pl-12 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold w-full outline-none transition-all focus:bg-white focus:ring-4 focus:ring-blue-100 text-slate-600 appearance-none cursor-pointer"
                        value={activeHistoryDate}
                        onChange={(e) => setSelectedHistoryDate(e.target.value)}
                      >
                        {availableHistoryDates.length === 0 ? (
                          <option value="">暫無歷史紀錄</option>
                        ) : (
                          availableHistoryDates.map(date => (
                            <option key={date} value={date}>{date}</option>
                          ))
                        )}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                        <ChevronDown className="text-slate-300" size={14} />
                      </div>
                      <div className="absolute left-1/2 -translate-x-1/2 -top-3 hidden sm:block">
                        <span className="text-[8px] font-black text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-widest border border-blue-100">篩選生效基準日</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full lg:w-auto">
                    <button 
                      onClick={() => {
                        let sheetId = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID?.trim();
                        if (sheetId) {
                          // Handle case where user might have pasted the full URL
                          if (sheetId.includes('/d/')) {
                            const match = sheetId.match(/\/d\/([\w-]+)/);
                            if (match) sheetId = match[1];
                          } else if (sheetId.startsWith('http')) {
                            // Extract last part of URL if it looks like an ID
                            const parts = sheetId.split('/');
                            sheetId = parts.filter(p => p.length > 20 && !p.includes('.'))[0] || sheetId;
                          }
                          
                          const targetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
                          console.log('Opening Sheets URL:', targetUrl);
                          window.open(targetUrl, '_blank', 'noopener,noreferrer');
                        } else {
                          alert('系統尚未設定 Google Sheets ID，請在 Secrets 中設定 NEXT_PUBLIC_GOOGLE_SHEET_ID');
                        }
                      }}
                      className="flex-grow lg:flex-grow-0 flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 md:px-8 md:py-4 rounded-2xl md:rounded-3xl text-[10px] md:text-xs font-black shadow-lg transition-all active:scale-95 uppercase tracking-widest"
                      title="檢視歷史紀錄留存 (Google Sheets)"
                    >
                      <FileSearch size={16}/> 檢視歷史紀錄留存
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[600px]">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] uppercase tracking-[0.25em] font-black text-slate-400 border-b border-slate-100">
                          <th className="p-6 md:p-8">基金資訊內容</th>
                          <th className="p-6 md:p-8 text-center border-l border-slate-100">GM</th>
                          <th className="p-6 md:p-8 border-l border-slate-100 whitespace-nowrap">生效日期</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filteredHistory.map((h, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="p-6 md:p-8">
                              <div className="font-black text-slate-800 text-base md:text-lg tracking-tight line-clamp-2 md:line-clamp-none">{h.name}</div>
                              <div className="inline-block bg-slate-100 text-slate-400 px-2 py-0.5 rounded text-[9px] md:text-[10px] font-mono font-black mt-2 uppercase tracking-tighter">ID: {h.code}</div>
                            </td>
                            <td className="p-6 md:p-8 text-center border-l border-slate-50">
                              <CheckCircle2 size={16} className="text-emerald-500 mx-auto" />
                              <span className="text-[8px] md:text-[9px] font-mono text-slate-300 font-bold mt-1 block">{h.gmSign}</span>
                            </td>
                            <td className="p-6 md:p-8 border-l border-slate-50">
                              <div className="inline-flex items-center gap-2 md:gap-3 bg-blue-50 text-blue-700 px-3 py-2 md:px-4 md:py-2.5 rounded-xl md:rounded-2xl border border-blue-100 font-black text-[10px] md:text-xs tracking-tight">
                                <Calendar size={12} className="text-blue-400" /> {h.effectiveDate}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 4. Instructions view */}
            {activeTab === 'instructions' && (
              <div className="space-y-6 h-full max-w-[1200px] mx-auto pb-12">
                <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-[100px] -mr-32 -mt-32" />
                  <div className="relative z-10">
                    <h2 className="text-4xl font-black tracking-tighter leading-tight italic uppercase">Role Assignments</h2>
                    <p className="text-blue-400 text-sm font-bold uppercase tracking-widest mt-2 flex items-center gap-2">
                       <span className="w-8 h-[1px] bg-blue-400"></span> 基金上架各單位任務範疇
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* PM */}
                  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 hover:border-blue-200 transition-all group">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-black group-hover:scale-110 transition-transform">PM</div>
                      <h4 className="text-xl font-black text-slate-800">產品經理 (PM)</h4>
                    </div>
                    <ul className="space-y-4">
                      {['初審基金名單', '確認哪些產品適合於公司銷售', '依據嘉實資訊源，確認前台基金代號與基金名稱'].map((t, i) => (
                        <li key={i} className="flex gap-3 text-sm font-bold text-slate-600">
                          <CheckCircle2 size={16} className="text-blue-500 shrink-0 mt-0.5" />
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Operations */}
                  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 hover:border-blue-200 transition-all group">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center font-black group-hover:scale-110 transition-transform">OPS</div>
                      <h4 className="text-xl font-black text-slate-800">股務人員</h4>
                    </div>
                    <ul className="space-y-4">
                      {['獲取公開說明書/簡式說明書/投資人須知等最新資料', '執行後台基金上架設定', '設定基金最低申購金額及級距', '確認官網基金已可正常開戶交易'].map((t, i) => (
                        <li key={i} className="flex gap-3 text-sm font-bold text-slate-600">
                          <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Marketing */}
                  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 hover:border-blue-200 transition-all group">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center font-black group-hover:scale-110 transition-transform">MKT</div>
                      <h4 className="text-xl font-black text-slate-800">行銷人員</h4>
                    </div>
                    <ul className="space-y-4">
                      {['確認行銷素材與活動頁面', '提供基金銷售通路KOL代碼設定'].map((t, i) => (
                        <li key={i} className="flex gap-3 text-sm font-bold text-slate-600">
                          <CheckCircle2 size={16} className="text-purple-500 shrink-0 mt-0.5" />
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* CS */}
                  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 hover:border-blue-200 transition-all group">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center font-black group-hover:scale-110 transition-transform">CS</div>
                      <h4 className="text-xl font-black text-slate-800">客服人員</h4>
                    </div>
                    <ul className="space-y-4">
                      {['確認客服中心 FAQ 是否須新增說明', '了解新上架基金之基礎屬性以應對客訴'].map((t, i) => (
                        <li key={i} className="flex gap-3 text-sm font-bold text-slate-600">
                          <CheckCircle2 size={16} className="text-amber-500 shrink-0 mt-0.5" />
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* GM */}
                  <div className="bg-slate-50 p-8 rounded-[2.5rem] shadow-inner border border-slate-200 col-span-1 md:col-span-2 group">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black group-hover:rotate-12 transition-transform">GM</div>
                      <h4 className="text-2xl font-black text-slate-800 tracking-tight">總經理</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {['檢視各單位完成進度', '同意核准上架'].map((t, i) => (
                        <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center gap-4 shadow-sm">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-black italic">
                            0{i+1}
                          </div>
                          <span className="text-sm font-black text-slate-700">{t}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 5. Mapping view (Adapts Bento) */}
            {activeTab === 'mapping' && (
              <div className="space-y-4 md:space-y-6 h-full">
                <div className="bg-slate-900 rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 text-white flex flex-col lg:flex-row justify-between items-center gap-6 md:gap-10 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-64 h-64 bg-blue-600/10 rounded-full blur-[100px] -ml-32 -mt-32" />
                  
                  <div className="relative z-10 flex flex-col sm:flex-row items-center gap-4 md:gap-8 text-center sm:text-left">
                    <div className="p-4 md:p-6 bg-blue-600 rounded-[1.5rem] md:rounded-[2rem] shadow-[0_0_40px_rgba(37,99,235,0.3)]">
                      <Database className="w-8 h-8 md:w-10 md:h-10" />
                    </div>
                    <div>
                      <h2 className="text-xl md:text-3xl font-black tracking-tighter leading-tight">嘉實資訊源：欄位映射規範</h2>
                      <p className="text-slate-500 text-[10px] md:text-sm font-bold uppercase tracking-widest mt-1">Central Definition Registry v1.4</p>
                    </div>
                  </div>
                  
                  <div className="relative z-10 flex bg-slate-800/50 backdrop-blur-md rounded-2xl md:rounded-3xl p-1 md:p-1.5 gap-1 md:gap-1.5 border border-slate-700/50">
                    <button 
                      onClick={() => setFundType('domestic')}
                      className={`px-4 md:px-8 py-2 md:py-3 rounded-xl md:rounded-[1.25rem] text-[9px] md:text-[10px] font-black uppercase tracking-[0.15em] transition-all whitespace-nowrap ${
                        fundType === 'domestic' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      境內系統
                    </button>
                    <button 
                      onClick={() => setFundType('offshore')}
                      className={`px-4 md:px-8 py-2 md:py-3 rounded-xl md:rounded-[1.25rem] text-[9px] md:text-[10px] font-black uppercase tracking-[0.15em] transition-all whitespace-nowrap ${
                        fundType === 'offshore' ? 'bg-white text-slate-900 shadow-xl' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      境外系統
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[500px]">
                      <thead>
                        <tr className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] border-b border-slate-50 bg-slate-50/50">
                          <th className="px-6 md:px-8 py-4 md:py-6">資料來源</th>
                          <th className="px-6 md:px-8 py-4 md:py-6">欄位名稱</th>
                          <th className="px-6 md:px-8 py-4 md:py-6 text-blue-600">V-CODE</th>
                          <th className="px-6 md:px-8 py-4 md:py-6">業務備註</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {MAPPING_RULES[fundType].map((item, idx) => (
                          <tr key={idx} className="group hover:bg-blue-50/30 transition-colors">
                            <td className="px-6 md:px-8 py-4 md:py-6">
                              <div className="flex items-center gap-2 md:gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                                <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.file}</span>
                              </div>
                            </td>
                            <td className="px-6 md:px-8 py-4 md:py-6">
                              <span className="text-base md:text-xl font-black text-slate-800 group-hover:text-blue-700 transition-colors tracking-tight">
                                {item.label}
                              </span>
                            </td>
                            <td className="px-6 md:px-8 py-4 md:py-6">
                              <span className="text-[11px] md:text-sm font-mono font-black text-blue-500 bg-blue-50 px-2 md:px-3 py-0.5 md:py-1 rounded-lg border border-blue-100">
                                {item.v}
                              </span>
                            </td>
                            <td className="px-6 md:px-8 py-4 md:py-6">
                              <div className="flex items-center gap-2 text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                <Search size={10} className="md:w-3 md:h-3 opacity-40" />
                                {item.note}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Developer Guidelines - Keep as a full width bento block */}
                <div className="bg-blue-50 rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-10 border border-blue-100 flex flex-col md:flex-row items-center gap-6 md:gap-8 shadow-inner shadow-blue-200/20">
                  <div className="p-3 md:p-4 bg-white rounded-2xl text-blue-600 shadow-lg shrink-0">
                    <LayoutDashboard className="w-6 h-6 md:w-8 md:h-8" />
                  </div>
                  <div className="space-y-2 text-center md:text-left">
                     <h5 className="text-[9px] md:text-[10px] font-black text-blue-600 uppercase tracking-[0.3em]">Developer Guidelines</h5>
                     <p className="text-[11px] md:text-xs font-bold text-blue-900 leading-relaxed tracking-tight">
                       重要事項：境內調用 <code className="bg-blue-100 font-mono text-[10px] px-1.5 py-0.5 rounded">GetTWFundInfo1</code>，境外調用 <code className="bg-blue-100 font-mono text-[10px] px-1.5 py-0.5 rounded">GetFundInfo1</code>。<br className="hidden md:block"/>
                       若混用將導致數據結構錯位，上架前必須以此規範進行單元測試。
                     </p>
                  </div>
                </div>
              </div>
            )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bento Footer */}
      <footer className="max-w-[1440px] w-full mx-auto flex flex-col md:flex-row justify-between items-center py-4 px-6 md:px-10 bg-white border border-slate-200 rounded-[1.5rem] md:rounded-[2rem] text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-[0.25em] shadow-sm gap-4">
        <div className="flex flex-col sm:flex-row gap-4 md:gap-6 items-center text-center">
          <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-200" /> Compliance v11409-01</span>
          <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-slate-200" /> Security Level: High</span>
        </div>
        <div className="opacity-60 text-center md:text-right">
          © 2026 POCKET INVESTMENT CONSULTING. ALL RIGHTS RESERVED. INTERNAL ONLY.
        </div>
      </footer>

      {/* Global Style Overrides */}
      <style jsx global>{`
        .italic-serif-headers th {
          font-family: var(--font-sans);
          font-style: italic;
          opacity: 0.6;
        }
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}

