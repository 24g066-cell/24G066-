/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  initAuth,
  googleSignIn,
  logout,
  getAccessToken
} from './lib/firebase';
import {
  fetchPitchingSessions,
  saveAllPitchingSessions,
  appendPitchingSession
} from './lib/googleSheets';
import { Pitcher, PitchingSession } from './types';
import {
  Activity,
  Plus,
  Compass,
  FileSpreadsheet,
  LogOut,
  Sparkles,
  AlertCircle,
  Database,
  Radio,
  Share2,
  Calendar,
  Layers,
  ChevronRight,
  Target
} from 'lucide-react';
import SheetSettings from './components/SheetSettings';
import PitchingCounter from './components/PitchingCounter';
import PixelScoreSync from './components/PixelScoreSync';
import StatsDashboard from './components/StatsDashboard';
import { motion, AnimatePresence } from 'motion/react';

// 鈴鹿大学ピッチャーの初期プリセットデータ
const DEFAULT_PITCHERS: Pitcher[] = [
  { id: 'suzuka-1', name: '南 投手', number: '11', hand: 'Right' },
  { id: 'suzuka-2', name: '中西 投手', number: '18', hand: 'Right' },
  { id: 'suzuka-3', name: '伊藤 投手', number: '14', hand: 'Left' },
  { id: 'suzuka-4', name: '山中 投手', number: '17', hand: 'Right' },
  { id: 'suzuka-5', name: '森 投手', number: '16', hand: 'Left' },
  { id: 'suzuka-6', name: '坂 投手', number: '19', hand: 'Right' },
];

// ISO日付から「年-W週」の週コードを取得する
function getWeekCode(dateStr: string): string {
  const date = new Date(dateStr);
  const tempDate = new Date(date.valueOf());
  tempDate.setDate(tempDate.getDate() + 4 - (tempDate.getDay() || 7));
  const yearStart = new Date(tempDate.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((tempDate.valueOf() - yearStart.valueOf()) / 86400000) + 1) / 7);
  const formattedWeek = weekNo < 10 ? `0${weekNo}` : `${weekNo}`;
  return `${tempDate.getFullYear()}-W${formattedWeek}`;
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // 投手リスト & セッションデータ
  const [pitchers, setPitchers] = useState<Pitcher[]>(DEFAULT_PITCHERS);
  const [sessions, setSessions] = useState<PitchingSession[]>([]);
  const [currentWeek, setCurrentWeek] = useState<string>('');

  // スプレッドシート連携
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<boolean>(false);

  // UI ナビゲーション
  const [activeTab, setActiveTab] = useState<'dashboard' | 'counter' | 'pixel' | 'settings'>('dashboard');

  // 初期化時の週の設定とシート情報の復元
  useEffect(() => {
    // 現在の週コードを設定 (2026年7月6日の場合は 2026-W28)
    const todayCode = getWeekCode('2026-07-06');
    setCurrentWeek(todayCode);

    // ローカルストレージから連携中のスプレッドシートIDを復元
    const savedSheetId = localStorage.getItem('pitcher_log_sheet_id');
    const savedSheetUrl = localStorage.getItem('pitcher_log_sheet_url');
    if (savedSheetId) {
      setSpreadsheetId(savedSheetId);
    }
    if (savedSheetUrl) {
      setSpreadsheetUrl(savedSheetUrl);
    }

    // ローカルの仮ピッチングセッションを復元
    const savedSessions = localStorage.getItem('pitcher_local_sessions');
    if (savedSessions) {
      setSessions(JSON.parse(savedSessions));
    }

    // Firebase Auth リスナー初期化
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        setNeedsAuth(false);
        setAuthLoading(false);
        // ログイン成功時にスプレッドシートからデータをフェッチ
        if (savedSheetId) {
          loadSessionsFromSheets(accessToken, savedSheetId);
        }
      },
      () => {
        setNeedsAuth(true);
        setAuthLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Google Sheets からデータ読み込み
  const loadSessionsFromSheets = async (accessToken: string, sheetId: string) => {
    try {
      const fetched = await fetchPitchingSessions(accessToken, sheetId);
      if (fetched) {
        setSessions(fetched);
        localStorage.setItem('pitcher_local_sessions', JSON.stringify(fetched));
      }
    } catch (err) {
      console.error('Google Sheetsからのデータロードに失敗しました:', err);
    }
  };

  // ログイン処理
  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setNeedsAuth(false);
        
        // 保存されていたスプレッドシートがあれば読み込み
        if (spreadsheetId) {
          await loadSessionsFromSheets(result.accessToken, spreadsheetId);
        }
      }
    } catch (err) {
      console.error('Login failed:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // ログアウト処理
  const handleLogout = async () => {
    if (window.confirm('ログアウトしますか？')) {
      await logout();
      setUser(null);
      setToken(null);
      setNeedsAuth(true);
      setActiveTab('dashboard');
    }
  };

  // スプレッドシートの選択・連携
  const handleSelectSpreadsheet = async (id: string, url: string) => {
    setSpreadsheetId(id);
    setSpreadsheetUrl(url);
    localStorage.setItem('pitcher_log_sheet_id', id);
    localStorage.setItem('pitcher_log_sheet_url', url);

    if (token) {
      setSyncing(true);
      await loadSessionsFromSheets(token, id);
      setSyncing(false);
    }
  };

  // スプレッドシート連携解除
  const handleDisconnectSpreadsheet = () => {
    if (window.confirm('スプレッドシートとの連携を解除しますか？ローカルの履歴は残ります。')) {
      setSpreadsheetId(null);
      setSpreadsheetUrl(null);
      localStorage.removeItem('pitcher_log_sheet_id');
      localStorage.removeItem('pitcher_log_sheet_url');
    }
  };

  // 新規投球セッションの追加（手動カウンターからの保存）
  const handleSaveCounterSession = async (newSessionData: Omit<PitchingSession, 'id'>) => {
    const newSession: PitchingSession = {
      ...newSessionData,
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdBy: user?.email || 'ゲスト',
      synced: false
    };

    const updated = [newSession, ...sessions];
    setSessions(updated);
    localStorage.setItem('pitcher_local_sessions', JSON.stringify(updated));

    // もしスプレッドシート連携が有効なら、Sheetsにも直接追加
    if (token && spreadsheetId) {
      try {
        await appendPitchingSession(token, spreadsheetId, newSession);
        // 同期済みフラグをオンにする
        const syncedSessions = updated.map(s => s.id === newSession.id ? { ...s, synced: true } : s);
        setSessions(syncedSessions);
        localStorage.setItem('pitcher_local_sessions', JSON.stringify(syncedSessions));
      } catch (err) {
        console.error('スプレッドシートへの直接追加に失敗しました:', err);
      }
    }

    setActiveTab('dashboard');
  };

  // 外部(Pixel-score AI)からのセッションのインポート
  const handleImportSessions = async (importedList: Omit<PitchingSession, 'id'>[]) => {
    const createdSessions = importedList.map(s => ({
      ...s,
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdBy: user?.email || 'AI同期',
      synced: false
    }));

    // 既存のセッションで同じ日付・同じ投手・同じ週の重複データをマージまたは置換
    // (特にライブ試合連携時など、同じライブ投手のデータは最新のものにアップデートする)
    let updated = [...sessions];
    createdSessions.forEach(newS => {
      const existingIdx = updated.findIndex(
        oldS => oldS.pitcherName === newS.pitcherName && oldS.week === newS.week && oldS.date === newS.date
      );

      if (existingIdx >= 0) {
        // 上書き更新（ライブ更新用）
        updated[existingIdx] = { ...updated[existingIdx], ...newS, id: updated[existingIdx].id };
      } else {
        // 新規追加
        updated = [newS as PitchingSession, ...updated];
      }
    });

    setSessions(updated);
    localStorage.setItem('pitcher_local_sessions', JSON.stringify(updated));

    // Sheets連携済みの場合は一括更新
    if (token && spreadsheetId) {
      try {
        await saveAllPitchingSessions(token, spreadsheetId, updated);
        const synced = updated.map(s => ({ ...s, synced: true }));
        setSessions(synced);
        localStorage.setItem('pitcher_local_sessions', JSON.stringify(synced));
      } catch (err) {
        console.error('Sheetsの一括同期に失敗しました:', err);
      }
    }
  };

  // セッションの削除
  const handleDeleteSession = async (id: string) => {
    const confirmed = window.confirm('このピッチング記録を削除しますか？\n（スプレッドシート連携中の場合、そちらのシートデータも更新されます）');
    if (!confirmed) return;

    const filtered = sessions.filter(s => s.id !== id);
    setSessions(filtered);
    localStorage.setItem('pitcher_local_sessions', JSON.stringify(filtered));

    if (token && spreadsheetId) {
      try {
        setSyncing(true);
        await saveAllPitchingSessions(token, spreadsheetId, filtered);
        setSyncing(false);
      } catch (err) {
        console.error('スプレッドシートの同期に失敗しました:', err);
        setSyncing(false);
      }
    }
  };

  // 手動でスプレッドシート全体を同期
  const handleSyncWithSheets = async () => {
    if (!token || !spreadsheetId) return;
    const confirmed = window.confirm('スプレッドシートの内容を上書きし、現在のアプリ上のデータを完全同期（保存）しますか？');
    if (!confirmed) return;

    setSyncing(true);
    try {
      await saveAllPitchingSessions(token, spreadsheetId, sessions);
      // すべて synced: true にする
      const updated = sessions.map(s => ({ ...s, synced: true }));
      setSessions(updated);
      localStorage.setItem('pitcher_local_sessions', JSON.stringify(updated));
      alert('スプレッドシートとの同期が完了しました！');
    } catch (err) {
      console.error(err);
      alert('スプレッドシートの同期に失敗しました。認証の有効期限が切れている可能性があります。');
    } finally {
      setSyncing(false);
    }
  };

  // 投手陣のインポート
  const handleImportPitchers = (imported: Pitcher[]) => {
    setPitchers(imported);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans antialiased pb-12">
      {/* ログイン・ロード状態 */}
      {authLoading ? (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950">
          <div className="text-center space-y-4">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm font-semibold text-zinc-400">認証情報を読み込み中...</p>
          </div>
        </div>
      ) : needsAuth ? (
        /* ログイン画面 */
        <div className="min-h-screen flex flex-col justify-center items-center px-4 bg-zinc-950">
          <div className="w-full max-w-md bg-zinc-900 rounded-3xl border border-zinc-800 p-8 shadow-xl text-center space-y-6">
            <div className="w-16 h-16 bg-emerald-500 text-zinc-950 rounded-2xl flex items-center justify-center mx-auto shadow-md shadow-emerald-500/20">
              <span className="text-4xl font-black italic tracking-tighter">投</span>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-black text-zinc-100 tracking-tight flex items-center justify-center gap-1">
                PITCH_LOG <span className="text-zinc-600">/</span> <span className="text-emerald-400 font-black">STRIKE</span>
              </h1>
              <p className="text-sm text-zinc-400 leading-relaxed px-4">
                鈴鹿大学の投手陣やチームメイトと、週ごとのストライク率や球数をリアルタイムに記録・共有するクラウドアプリです。
              </p>
            </div>

            <div className="border-t border-zinc-800 pt-6">
              <button
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="gsi-material-button w-full flex items-center justify-center gap-3 py-3 border border-zinc-800 rounded-xl hover:bg-zinc-800 hover:text-zinc-100 font-bold text-zinc-300 text-sm transition-all shadow-sm disabled:opacity-50 cursor-pointer bg-zinc-950"
              >
                <div className="gsi-material-button-icon">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                </div>
                <span>{isLoggingIn ? 'サインイン中...' : 'Googleアカウントでサインイン'}</span>
              </button>
            </div>
            
            <p className="text-[10px] text-zinc-500 leading-normal">
              ※本アプリは Google Sheets と Google Drive にデータを保存・読み込みします。ログイン後にアクセス権限の承認画面が表示されます。
            </p>
          </div>
        </div>
      ) : (
        /* メインアプリケーション画面 */
        <div className="space-y-6">
          {/* 上部グローバルナビゲーションバー */}
          <header className="bg-zinc-950 border-b border-zinc-800 sticky top-0 z-50">
            <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
              {/* ロゴとチーム名 */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-emerald-500 text-zinc-950 rounded-xl flex items-center justify-center font-black italic shadow-md shadow-emerald-500/10">
                  球
                </div>
                <div>
                  <h1 className="text-xl font-black text-emerald-400 tracking-tighter leading-none">
                    PITCH_LOG <span className="text-zinc-600">/</span> <span className="text-zinc-100 font-bold text-sm">SUZUKA UNIV.</span>
                  </h1>
                  <span className="text-[10px] text-zinc-500 font-bold mt-1 inline-block">鈴鹿大学 硬式野球部 強化投手陣</span>
                </div>
              </div>

              {/* ユーザープロフィール・ログアウト */}
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex items-center gap-2">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName} className="w-7 h-7 rounded-full border border-zinc-800" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-7 h-7 bg-zinc-800 text-zinc-300 rounded-full flex items-center justify-center text-xs font-bold">
                      {user.displayName?.[0] || 'U'}
                    </div>
                  )}
                  <span className="text-xs font-bold text-zinc-300">{user.displayName || user.email}</span>
                </div>

                <button
                  onClick={handleLogout}
                  className="p-2 text-zinc-500 hover:text-rose-400 hover:bg-zinc-900 rounded-lg transition-colors cursor-pointer"
                  title="ログアウト"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </header>

          <main className="max-w-6xl mx-auto px-4 space-y-6">
            {/* メインタブ切り替えコントロール */}
            <div className="bg-zinc-900 p-1.5 rounded-2xl border border-zinc-800 flex shadow-sm">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex-1 py-3 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                  activeTab === 'dashboard'
                    ? 'bg-emerald-500 text-zinc-950 shadow-sm font-black'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                }`}
              >
                <Activity className="w-4 h-4" />
                週別ダッシュボード
              </button>
              <button
                onClick={() => setActiveTab('counter')}
                className={`flex-1 py-3 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                  activeTab === 'counter'
                    ? 'bg-emerald-500 text-zinc-950 shadow-sm font-black'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                }`}
              >
                <Plus className="w-4 h-4" />
                投球カウンター
              </button>
              <button
                onClick={() => setActiveTab('pixel')}
                className={`flex-1 py-3 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                  activeTab === 'pixel'
                    ? 'bg-emerald-500 text-zinc-950 shadow-sm font-black'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                }`}
              >
                <Radio className="w-4 h-4" />
                Pixel-score AI 連携
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex-1 py-3 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                  activeTab === 'settings'
                    ? 'bg-emerald-500 text-zinc-950 shadow-sm font-black'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                スプレッドシート連携
              </button>
            </div>

            {/* スプレッドシート未連携アラート */}
            {!spreadsheetId && activeTab !== 'settings' && (
              <div className="bg-amber-950/40 border border-amber-900/50 rounded-2xl p-4 flex items-start gap-3.5 shadow-sm">
                <AlertCircle className="w-5.5 h-5.5 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1 sm:flex sm:items-center sm:justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-amber-200">Google スプレッドシート未連携</h4>
                    <p className="text-xs text-amber-400 leading-relaxed mt-0.5">
                      現在ローカルにのみ保存されています。チームメンバーと「ストライク率」「球数」をクラウド共有するには、シート連携を行ってください。
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('settings')}
                    className="mt-3 sm:mt-0 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm cursor-pointer whitespace-nowrap"
                  >
                    設定を開く
                  </button>
                </div>
              </div>
            )}

            {/* アクティブタブのレンダリング */}
            <div className="relative">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  {activeTab === 'dashboard' && (
                    <StatsDashboard
                      sessions={sessions}
                      pitchers={pitchers}
                      currentWeek={currentWeek}
                      onDeleteSession={handleDeleteSession}
                      onSyncWithSheets={handleSyncWithSheets}
                      spreadsheetId={spreadsheetId}
                    />
                  )}

                  {activeTab === 'counter' && (
                    <PitchingCounter
                      pitchers={pitchers}
                      currentWeek={currentWeek}
                      onSaveSession={handleSaveCounterSession}
                      onCancel={() => setActiveTab('dashboard')}
                    />
                  )}

                  {activeTab === 'pixel' && (
                    <PixelScoreSync
                      pitchers={pitchers}
                      onImportPitchers={handleImportPitchers}
                      onImportSessions={handleImportSessions}
                    />
                  )}

                  {activeTab === 'settings' && token && (
                    <SheetSettings
                      accessToken={token}
                      spreadsheetId={spreadsheetId}
                      spreadsheetUrl={spreadsheetUrl}
                      onSelectSpreadsheet={handleSelectSpreadsheet}
                      onDisconnect={handleDisconnectSpreadsheet}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        </div>
      )}
    </div>
  );
}
