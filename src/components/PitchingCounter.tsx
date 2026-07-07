/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Play, Square, RotateCcw, Save, Trash2, ArrowLeft, Plus, Eye } from 'lucide-react';
import { Pitcher, PitchingSession, PitchLogEntry } from '../types';

interface PitchingCounterProps {
  pitchers: Pitcher[];
  currentWeek: string;
  onSaveSession: (session: Omit<PitchingSession, 'id'>) => void;
  onCancel: () => void;
}

export default function PitchingCounter({
  pitchers,
  currentWeek,
  onSaveSession,
  onCancel
}: PitchingCounterProps) {
  const [selectedPitcher, setSelectedPitcher] = useState<Pitcher | null>(
    pitchers.length > 0 ? pitchers[0] : null
  );
  
  // 投球データの状態
  const [pitchLogs, setPitchLogs] = useState<PitchLogEntry[]>([]);
  const [currentPitchType, setCurrentPitchType] = useState<string>('ストレート');
  const [currentSpeed, setCurrentSpeed] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [showLogs, setShowLogs] = useState<boolean>(false);

  // 統計値の計算
  const totalPitches = pitchLogs.length;
  const strikes = pitchLogs.filter(p => p.result === 'strike' || p.result === 'foul' || p.result === 'out').length;
  const balls = pitchLogs.filter(p => p.result === 'ball' || p.result === 'hit').length;
  const fouls = pitchLogs.filter(p => p.result === 'foul').length;
  const strikeRate = totalPitches > 0 ? Math.round((strikes / totalPitches) * 1000) / 10 : 0;

  // 定番の球種リスト
  const PITCH_TYPES = ['ストレート', 'スライダー', 'カーブ', 'フォーク', 'チェンジアップ', 'カットボール', 'シンカー'];

  // カウントアップ処理
  const handleAddPitch = (result: 'strike' | 'ball' | 'foul' | 'hit' | 'out') => {
    if (!selectedPitcher) return;

    const newEntry: PitchLogEntry = {
      pitchNumber: pitchLogs.length + 1,
      pitchType: currentPitchType,
      speed: currentSpeed ? Number(currentSpeed) : undefined,
      result,
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    setPitchLogs([newEntry, ...pitchLogs]); // 履歴は新しい順
    setCurrentSpeed(''); // 球速をリセット
  };

  // 1手戻る (Undo)
  const handleUndo = () => {
    if (pitchLogs.length === 0) return;
    const confirmUndo = window.confirm('最後の1投を取り消しますか？');
    if (confirmUndo) {
      setPitchLogs(pitchLogs.slice(1));
    }
  };

  // リセット
  const handleReset = () => {
    const confirmReset = window.confirm('すべての記録をクリアしてリセットしますか？（現在のセッションの投球ログが消去されます）');
    if (confirmReset) {
      setPitchLogs([]);
      setCurrentSpeed('');
      setNotes('');
    }
  };

  // 記録を保存・終了
  const handleSaveAndClose = () => {
    if (!selectedPitcher) return;
    if (totalPitches === 0) {
      alert('投球データが記録されていません。ストライクまたはボールをカウントしてください。');
      return;
    }

    const confirmSave = window.confirm(
      `【確認】\n投手: ${selectedPitcher.name}\n球数: ${totalPitches}球\nストライク率: ${strikeRate}%\n\nこのデータを「今週 (${currentWeek})」の記録として保存しますか？`
    );

    if (!confirmSave) return;

    // 球種別の割合や、投球内容などをメモに自動生成して追記
    const pitchTypeSummary = pitchLogs.reduce((acc, curr) => {
      acc[curr.pitchType] = (acc[curr.pitchType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const summaryNotes = Object.entries(pitchTypeSummary)
      .map(([type, count]) => `${type}: ${count}球`)
      .join(', ');

    const finalNotes = notes.trim() 
      ? `${notes.trim()} | [内訳] ${summaryNotes}`
      : `[投球内訳] ${summaryNotes}`;

    onSaveSession({
      week: currentWeek,
      pitcherId: selectedPitcher.id,
      pitcherName: selectedPitcher.name,
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
      totalPitches,
      strikes,
      balls,
      fouls,
      strikeRate,
      notes: finalNotes
    });
  };

  return (
    <div className="space-y-6">
      {/* 上部ヘッダーコントロール */}
      <div className="flex items-center justify-between bg-zinc-900 px-4 py-3 rounded-2xl border border-zinc-800 shadow-sm">
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-100 text-sm font-bold transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          戻る
        </button>
        <div className="text-center">
          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full uppercase tracking-wider border border-emerald-500/20">
            リアルタイム投球カウンター ({currentWeek})
          </span>
        </div>
        <button
          onClick={handleSaveAndClose}
          disabled={totalPitches === 0}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-xl text-sm font-black shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Save className="w-4 h-4" />
          保存して終了
        </button>
      </div>

      {/* ピッチャー選択と投球設定 */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-zinc-900 rounded-3xl border border-zinc-800 p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-zinc-100 text-base">投球セッション設定</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* ピッチャー選択 */}
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">ピッチャー</label>
              <select
                value={selectedPitcher?.id || ''}
                onChange={(e) => {
                  const p = pitchers.find(item => item.id === e.target.value);
                  if (p) setSelectedPitcher(p);
                }}
                disabled={pitchLogs.length > 0} // 投球が始まったら投手変更をロック
                className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-75 cursor-pointer"
              >
                {pitchers.map((p) => (
                  <option key={p.id} value={p.id} className="bg-zinc-900">
                    {p.name} {p.number ? `(#${p.number})` : ''} {p.hand === 'Left' ? '(左投)' : '(右投)'}
                  </option>
                ))}
              </select>
              {pitchLogs.length > 0 && (
                <p className="text-[10px] text-rose-400 mt-1">※投球が記録されているため、投手の変更はロックされています。</p>
              )}
            </div>

            {/* 現在の球種選択 */}
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">球種 (1球ごとに変更可)</label>
              <div className="flex flex-wrap gap-1.5">
                {PITCH_TYPES.slice(0, 4).map((type) => (
                  <button
                    key={type}
                    onClick={() => setCurrentPitchType(type)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      currentPitchType === type
                        ? 'bg-emerald-500 text-zinc-950 shadow-sm font-black'
                        : 'bg-zinc-950 hover:bg-zinc-850 text-zinc-300 border border-zinc-800'
                    }`}
                  >
                    {type}
                  </button>
                ))}
                
                {/* 5番目以降はセレクトボックスにする */}
                <select
                  value={PITCH_TYPES.includes(currentPitchType) && PITCH_TYPES.indexOf(currentPitchType) >= 4 ? currentPitchType : ''}
                  onChange={(e) => {
                    if (e.target.value) setCurrentPitchType(e.target.value);
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg border focus:outline-none cursor-pointer ${
                    PITCH_TYPES.indexOf(currentPitchType) >= 4
                      ? 'bg-emerald-500 text-zinc-950 border-emerald-500 font-bold'
                      : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:bg-zinc-850'
                  }`}
                >
                  <option value="" disabled className="text-zinc-500">その他</option>
                  {PITCH_TYPES.slice(4).map((type) => (
                    <option key={type} value={type} className="bg-zinc-900 text-zinc-100">{type}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* 球速入力 */}
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">球速 (オプション)</label>
              <div className="relative">
                <input
                  type="number"
                  value={currentSpeed}
                  onChange={(e) => setCurrentSpeed(e.target.value)}
                  placeholder="例: 138"
                  className="w-full pl-4 pr-12 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-zinc-100"
                />
                <span className="absolute right-4 top-2 text-xs font-bold text-zinc-500">km/h</span>
              </div>
            </div>

            {/* フリーメモ */}
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">セッションメモ・状態</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="例: ブルペン調整、シート打撃練習 etc."
                className="w-full px-4 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-zinc-100"
              />
            </div>
          </div>
        </div>

        {/* 投球ステータス（統計） */}
        <div className="bg-zinc-900 rounded-3xl text-zinc-100 p-6 shadow-md flex flex-col justify-between border border-zinc-800">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">STATS</span>
              <span className="text-[10px] bg-zinc-950 text-zinc-400 px-2 py-0.5 rounded border border-zinc-800">
                投手: {selectedPitcher?.name || '未選択'}
              </span>
            </div>
            
            <div className="text-center py-4">
              <div className="text-6xl font-black font-mono tracking-tight text-emerald-400">
                {strikeRate}<span className="text-2xl font-bold ml-1">%</span>
              </div>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-1">ストライク率</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 border-t border-zinc-800 pt-4 text-center">
            <div>
              <div className="text-2xl font-extrabold text-zinc-100 font-mono">{totalPitches}</div>
              <div className="text-[10px] text-zinc-500 font-semibold uppercase">総球数</div>
            </div>
            <div>
              <div className="text-2xl font-extrabold text-emerald-400 font-mono">{strikes}</div>
              <div className="text-[10px] text-zinc-500 font-semibold uppercase">ストライク</div>
            </div>
            <div>
              <div className="text-2xl font-extrabold text-rose-400 font-mono">{balls}</div>
              <div className="text-[10px] text-zinc-500 font-semibold uppercase">ボール</div>
            </div>
          </div>
        </div>
      </div>

      {/* リアルタイムカウント大ボタン */}
      <div className="bg-zinc-900 rounded-3xl border border-zinc-800 p-6 shadow-sm">
        <h3 className="font-bold text-zinc-100 text-base mb-4 text-center">
          投球ごとの結果をタップしてカウント (現在選択中: <span className="text-emerald-400 font-black">{currentPitchType}</span>)
        </h3>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* ストライクボタン */}
          <button
            onClick={() => handleAddPitch('strike')}
            disabled={!selectedPitcher}
            className="h-32 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 active:scale-95 font-extrabold text-2xl flex flex-col items-center justify-center gap-1 shadow-md transition-all disabled:opacity-50 cursor-pointer"
          >
            <span className="text-3xl font-black">STRIKE</span>
            <span className="text-xs font-semibold text-zinc-950/80">空振り・見逃し</span>
          </button>

          {/* ボールボタン */}
          <button
            onClick={() => handleAddPitch('ball')}
            disabled={!selectedPitcher}
            className="h-32 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-extrabold text-2xl flex flex-col items-center justify-center gap-1 shadow-md transition-all disabled:opacity-50 cursor-pointer"
          >
            <span className="text-3xl font-black">BALL</span>
            <span className="text-xs font-semibold text-rose-100">外れ球</span>
          </button>

          {/* ファウルボタン */}
          <button
            onClick={() => handleAddPitch('foul')}
            disabled={!selectedPitcher}
            className="h-32 rounded-2xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-extrabold text-2xl flex flex-col items-center justify-center gap-1 shadow-md transition-all disabled:opacity-50 cursor-pointer"
          >
            <span className="text-3xl font-black">FOUL</span>
            <span className="text-xs font-semibold text-amber-100">ファウル (ストライク)</span>
          </button>

          {/* インプレイボタン（ヒット or アウト） */}
          <div className="grid grid-rows-2 gap-2 h-32">
            <button
              onClick={() => handleAddPitch('out')}
              disabled={!selectedPitcher}
              className="rounded-xl bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-100 font-bold text-sm flex flex-col items-center justify-center transition-all disabled:opacity-50 cursor-pointer border border-zinc-700"
            >
              <span>打者凡退 (OUT)</span>
              <span className="text-[10px] text-zinc-400 font-normal">ストライク扱い</span>
            </button>
            <button
              onClick={() => handleAddPitch('hit')}
              disabled={!selectedPitcher}
              className="rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-sm flex flex-col items-center justify-center transition-all disabled:opacity-50 cursor-pointer"
            >
              <span>安打 (HIT)</span>
              <span className="text-[10px] text-blue-100 font-normal">ボール扱い</span>
            </button>
          </div>
        </div>

        {/* 下部コントロール (Undo / Clear / Logs) */}
        <div className="flex items-center justify-between border-t border-zinc-800 mt-6 pt-4">
          <div className="flex gap-2">
            <button
              onClick={handleUndo}
              disabled={pitchLogs.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-zinc-300 hover:bg-zinc-800 border border-zinc-800 rounded-xl disabled:opacity-40 transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              1球戻す
            </button>
            <button
              onClick={handleReset}
              disabled={pitchLogs.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-rose-400 hover:bg-rose-950/20 border border-zinc-800 rounded-xl disabled:opacity-40 transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              クリア
            </button>
          </div>

          <button
            onClick={() => setShowLogs(!showLogs)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-zinc-400 hover:bg-zinc-800 rounded-xl transition-all cursor-pointer"
          >
            <Eye className="w-4 h-4" />
            {showLogs ? '投球ログを隠す' : `投球履歴を表示 (${pitchLogs.length})`}
          </button>
        </div>
      </div>

      {/* 投球履歴の表示 */}
      {showLogs && (
        <div className="bg-zinc-900 rounded-3xl border border-zinc-800 p-6 shadow-sm max-h-72 overflow-y-auto">
          <h4 className="font-bold text-zinc-100 text-sm mb-3">投球ログ一覧（最新順）</h4>
          {pitchLogs.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-4">投球データがありません。カウントを開始してください。</p>
          ) : (
            <div className="divide-y divide-zinc-800">
              {pitchLogs.map((log) => (
                <div key={log.pitchNumber} className="flex items-center justify-between py-2.5 text-xs text-zinc-400">
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-zinc-500 font-mono w-6">#{log.pitchNumber}</span>
                    <span className="font-semibold text-zinc-200 bg-zinc-950 px-2 py-0.5 rounded text-[11px] border border-zinc-800">
                      {log.pitchType}
                    </span>
                    {log.speed && <span className="font-mono text-emerald-400 font-bold">{log.speed} km/h</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500 font-mono">{log.timestamp}</span>
                    <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                      log.result === 'strike' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      log.result === 'ball' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                      log.result === 'foul' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      log.result === 'out' ? 'bg-zinc-800 text-zinc-300' :
                      'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    }`}>
                      {log.result === 'strike' ? 'ストライク' :
                       log.result === 'ball' ? 'ボール' :
                       log.result === 'foul' ? 'ファウル' :
                       log.result === 'out' ? '凡退 (S)' : '安打 (B)'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
