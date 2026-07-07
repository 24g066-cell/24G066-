/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { RefreshCw, Send, Radio, Sparkles, CheckCircle, Database, HelpCircle, AlertCircle, Play, Square } from 'lucide-react';
import { Pitcher, PitchingSession } from '../types';

interface PixelScoreSyncProps {
  pitchers: Pitcher[];
  onImportPitchers: (imported: Pitcher[]) => void;
  onImportSessions: (sessions: Omit<PitchingSession, 'id'>[]) => void;
}

export default function PixelScoreSync({
  pitchers,
  onImportPitchers,
  onImportSessions
}: PixelScoreSyncProps) {
  const [loadingPitchers, setLoadingPitchers] = useState(false);
  const [loadingTextParse, setLoadingTextParse] = useState(false);
  const [copypasteText, setCopypasteText] = useState('');
  const [orgSyncMessage, setOrgSyncMessage] = useState<string | null>(null);
  const [parseMessage, setParseMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // リアルタイム試合データ連携の状態
  const [liveSyncActive, setLiveSyncActive] = useState(false);
  const [liveGame, setLiveGame] = useState<any>(null);
  const [lastLivePitches, setLastLivePitches] = useState<number>(0);

  // 鈴鹿大学 Pixel-score 組織からピッチャーをフェッチしてインポート
  const handleSyncOrganization = async () => {
    setLoadingPitchers(true);
    setOrgSyncMessage(null);
    try {
      const res = await fetch('/api/pixel-score/organization');
      const data = await res.json();
      
      if (data.pitchers && data.pitchers.length > 0) {
        onImportPitchers(data.pitchers);
        setOrgSyncMessage(`鈴鹿大学硬式野球部（Pixel-score ID: 1373）から ${data.pitchers.length} 名のピッチャー情報を取得・同期しました！`);
      } else {
        setOrgSyncMessage('ピッチャー情報が見つかりませんでした。デフォルトプリセットを読み込みました。');
      }
    } catch (error) {
      console.error(error);
      setOrgSyncMessage('連携エラーが発生しました。オフラインモード（プリセット投手陣）を適用します。');
    } finally {
      setLoadingPitchers(false);
    }
  };

  // AI テキスト解析インポートの処理
  const handleTextParse = async () => {
    if (!copypasteText.trim()) return;
    setLoadingTextParse(true);
    setParseMessage(null);
    try {
      const res = await fetch('/api/parse-stats-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: copypasteText })
      });

      if (!res.ok) {
        throw new Error('解析サーバーからエラーが返されました。');
      }

      const data = await res.json();
      if (data.sessions && data.sessions.length > 0) {
        onImportSessions(data.sessions);
        setParseMessage({
          type: 'success',
          text: `AIがテキストから投球記録を ${data.sessions.length} 件抽出してインポートしました！投手: ${data.sessions.map((s: any) => s.pitcherName).join(', ')}`
        });
        setCopypasteText('');
      } else {
        setParseMessage({
          type: 'error',
          text: 'テキストから投球スタッツを検出できませんでした。より具体的な球数やストライク率を含む試合メモを入力してください。'
        });
      }
    } catch (error: any) {
      console.error(error);
      setParseMessage({ type: 'error', text: `AI解析中にエラーが発生しました: ${error.message || '不明なエラー'}` });
    } finally {
      setLoadingTextParse(false);
    }
  };

  // リアルタイム試合データシミュレーターのポーリング
  useEffect(() => {
    let intervalId: any;

    const fetchLiveStatus = async () => {
      try {
        const res = await fetch('/api/live-game/status');
        const data = await res.json();
        if (data.status === 'ok') {
          setLiveGame(data.game);
          
          // リアルタイム反映: 投球数が変わった場合、自動的にアプリ上のセッションとして親コンポーネントに反映させる
          // (親側で「ライブゲーム用のテンポラリセッション」として保持できるように、イベントデータを監視可能にする)
          if (liveSyncActive && data.game.active && data.game.totalPitches > 0) {
            // 親に伝えるライブ用セッション（今週のデータとして仮統合）
            const liveSession: Omit<PitchingSession, 'id'> = {
              week: '2026-W28', // 現在設定中の週
              pitcherId: data.game.pitcherId,
              pitcherName: `${data.game.pitcherName} [LIVE]`,
              date: new Date().toISOString().split('T')[0],
              totalPitches: data.game.totalPitches,
              strikes: data.game.strikes,
              balls: data.game.balls,
              fouls: data.game.fouls,
              strikeRate: data.game.totalPitches > 0 
                ? Math.round((data.game.strikes / data.game.totalPitches) * 1000) / 10 
                : 0,
              notes: `【試合データリアルタイム同期】${data.game.gameName} | 相手打者: ${data.game.batterName} | ${data.game.inning}`
            };

            // 親側へリアルタイムにスタッツを即座に反映させるため
            // (1球ごとに親のライブセッション状態を上書き)
            onImportSessions([liveSession]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch live game status:', err);
      }
    };

    if (liveSyncActive) {
      fetchLiveStatus();
      // 3秒ごとにステータスをポーリング
      intervalId = setInterval(fetchLiveStatus, 3000);
    } else {
      // 非アクティブ時に状態をクリア
      fetchLiveStatus();
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [liveSyncActive]);

  // リアルタイム同期の開始・停止切り替え
  const toggleLiveSync = async () => {
    const nextState = !liveSyncActive;
    setLiveSyncActive(nextState);
    
    try {
      // サーバー側のシミュレーターをON/OFF
      await fetch('/api/live-game/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: nextState })
      });
    } catch (err) {
      console.error(err);
    }
  };

  // シミュレーターのリセット
  const handleResetSimulator = async () => {
    if (!window.confirm('シミュレーターをイニング1、0球にリセットしますか？')) return;
    try {
      const res = await fetch('/api/live-game/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true })
      });
      const data = await res.json();
      if (data.status === 'ok') {
        setLiveGame(data.game);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. リアルタイム試合データ連携機能 (Pixel-score Live Connection) */}
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-950 to-emerald-950/40 rounded-3xl text-zinc-100 p-6 shadow-md border border-zinc-800/80">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 relative">
              <Radio className={`w-6 h-6 ${liveSyncActive ? 'animate-pulse text-emerald-300' : ''}`} />
              {liveSyncActive && (
                <span className="absolute top-1 right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-zinc-100">リアルタイム試合データ連携</h3>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/20">
                  SUZUKA UNIV. SPECIAL
                </span>
              </div>
              <p className="text-xs text-zinc-400">試合中の投球（B/S/F/速さ）をリアルタイムで取得しスタッツに反映</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handleResetSimulator}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 rounded-xl text-xs font-bold transition-all border border-zinc-700/80 cursor-pointer"
            >
              シミュレータ初期化
            </button>
            <button
              onClick={toggleLiveSync}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5 ${
                liveSyncActive 
                  ? 'bg-rose-600 hover:bg-rose-500 text-white' 
                  : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black'
              }`}
            >
              {liveSyncActive ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {liveSyncActive ? 'ライブ同期停止' : 'ライブ同期開始'}
            </button>
          </div>
        </div>

        {liveGame ? (
          <div className="bg-zinc-950/60 rounded-2xl p-4 border border-zinc-800/80 space-y-4">
            {/* 試合基本情報 */}
            <div className="flex justify-between items-center border-b border-zinc-800/60 pb-3">
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Match Game</span>
                <h4 className="text-sm font-semibold text-zinc-200">{liveGame.gameName}</h4>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Inning</span>
                <p className="text-sm font-black text-emerald-400">{liveGame.inning}</p>
              </div>
            </div>

            {/* 現在の打席状況 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              {/* 投手 vs 打者 */}
              <div className="space-y-1">
                <div>
                  <span className="text-[9px] font-bold text-zinc-500 uppercase block">Pitcher</span>
                  <span className="font-extrabold text-zinc-100 text-base">{liveGame.pitcherName}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-zinc-500 uppercase block">Batter</span>
                  <span className="font-medium text-zinc-400 text-sm">{liveGame.batterName}</span>
                </div>
              </div>

              {/* BSO カウント */}
              <div className="flex flex-col items-center justify-center py-2 bg-zinc-900/40 rounded-lg">
                <div className="flex items-center gap-4 text-xs font-black font-mono">
                  <div className="flex items-center gap-1">
                    <span className="text-rose-500 w-3">B</span>
                    <div className="flex gap-1">
                      {[1, 2, 3].map(i => (
                        <div key={i} className={`w-3 h-3 rounded-full border ${i <= liveGame.count.balls ? 'bg-rose-500 border-rose-500' : 'border-zinc-800'}`}></div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-emerald-500 w-3">S</span>
                    <div className="flex gap-1">
                      {[1, 2].map(i => (
                        <div key={i} className={`w-3 h-3 rounded-full border ${i <= liveGame.count.strikes ? 'bg-emerald-400 border-emerald-400' : 'border-zinc-800'}`}></div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-red-500 w-3">O</span>
                    <div className="flex gap-1">
                      {[1, 2].map(i => (
                        <div key={i} className={`w-3 h-3 rounded-full border ${i <= liveGame.count.outs ? 'bg-red-500 border-red-500' : 'border-zinc-800'}`}></div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* ライブ統計 */}
              <div className="text-center md:text-right">
                <div className="inline-block bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-1.5">
                  <div className="text-xl font-black text-emerald-400 font-mono">
                    {liveGame.totalPitches > 0 
                      ? Math.round((liveGame.strikes / liveGame.totalPitches) * 1000) / 10 
                      : 0}%
                  </div>
                  <div className="text-[9px] text-zinc-400 font-bold uppercase">現在ストライク率 ({liveGame.totalPitches}球)</div>
                </div>
              </div>
            </div>

            {/* リアルタイムステータスメッセージ */}
            <div className="text-xs bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800/80 text-center text-zinc-400">
              {liveSyncActive ? (
                <span className="flex items-center justify-center gap-2 text-emerald-400 font-semibold">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  試合中ピッチログをリアルタイムで取得中... 3秒ごとに自動反映されます。
                </span>
              ) : (
                <span>「ライブ同期開始」をオンにすると、三重大学戦のリアルタイム投球データ（B/S/F/速さ）が3秒毎に加算されます。</span>
              )}
            </div>
          </div>
        ) : (
          <div className="py-4 text-center text-xs text-zinc-500">
            ライブ試合データをロード中...
          </div>
        )}
      </div>

      {/* 2. 鈴鹿大学ピッチャー情報同期 (Pixel-score API) */}
      <div className="bg-zinc-900 rounded-3xl border border-zinc-800 p-6 shadow-sm">
        <div className="flex items-start gap-4 justify-between">
          <div>
            <h3 className="font-bold text-zinc-100 text-base mb-1 flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-400" />
              鈴鹿大学 投手陣リスト同期
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-4">
              鈴鹿大学硬式野球部が登録する Pixel-score 組織（ID: 1373）の公式投手メンバーを同期し、アプリへ一括読み込みします。
            </p>
          </div>
          <button
            onClick={handleSyncOrganization}
            disabled={loadingPitchers}
            className="px-4 py-2 text-xs font-black text-zinc-950 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 rounded-xl transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingPitchers ? 'animate-spin' : ''}`} />
            メンバー同期
          </button>
        </div>

        {orgSyncMessage && (
          <div className="mt-3 p-3 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-start gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <span>{orgSyncMessage}</span>
          </div>
        )}

        <div className="mt-4 border border-zinc-800 rounded-2xl p-3.5 bg-zinc-950/40">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">現在同期されている投手陣 ({pitchers.length}名)</span>
          <div className="flex flex-wrap gap-2">
            {pitchers.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1 text-xs font-semibold bg-zinc-900 border border-zinc-800 text-zinc-200 px-3 py-1 rounded-lg">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                {p.name} {p.number ? `(#${p.number})` : ''}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 3. AI テキスト解析インポート */}
      <div className="bg-zinc-900 rounded-3xl border border-zinc-800 p-6 shadow-sm">
        <h3 className="font-bold text-zinc-100 text-base mb-1 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          AI投球データパース (コピペで自動入力)
        </h3>
        <p className="text-xs text-zinc-400 leading-relaxed mb-4">
          Pixel-scoreや他サイト、LINEなどで共有された「試合結果」「ピッチメモ」などのテキストをそのまま貼り付けると、AIが球数やストライク率を自動的に解析し、各投手の週別スタッツとしてインポートします。
        </p>

        <div className="space-y-3">
          <textarea
            value={copypasteText}
            onChange={(e) => setCopypasteText(e.target.value)}
            rows={4}
            placeholder="ここに野球の投球スタッツテキストを貼り付けてください。&#13;&#10;例:「南が登板、球数52球、ストライク34、ボール18、ストライク率65.3%。非常に調子が良かった」など、自由な形式でOKです！"
            className="w-full px-4 py-3 text-xs bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-zinc-100 leading-relaxed placeholder-zinc-600"
          />

          {parseMessage && (
            <div className={`p-3 text-xs rounded-xl flex items-start gap-2 ${
              parseMessage.type === 'success' 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
            }`}>
              {parseMessage.type === 'success' 
                ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" /> 
                : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />}
              <span>{parseMessage.text}</span>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-[10px] text-zinc-500">
              ※ 解析されたデータは「今週 (2026-W28)」にインポートされます。
            </span>
            <button
              onClick={handleTextParse}
              disabled={loadingTextParse || !copypasteText.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-zinc-100 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-xl transition-all cursor-pointer border border-zinc-700"
            >
              <Sparkles className="w-3.5 h-3.5" />
              AIで解析・インポート
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
