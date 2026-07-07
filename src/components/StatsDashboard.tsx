/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { Calendar, TrendingUp, BarChart2, Activity, User, Eye, Trash2, CloudLightning } from 'lucide-react';
import { PitchingSession, Pitcher } from '../types';

interface StatsDashboardProps {
  sessions: PitchingSession[];
  pitchers: Pitcher[];
  currentWeek: string;
  onDeleteSession: (id: string) => void;
  onSyncWithSheets: () => void;
  spreadsheetId: string | null;
}

export default function StatsDashboard({
  sessions,
  pitchers,
  currentWeek,
  onDeleteSession,
  onSyncWithSheets,
  spreadsheetId
}: StatsDashboardProps) {
  const [selectedGraphPitcher, setSelectedGraphPitcher] = useState<string>('all');
  const [dashboardWeek, setDashboardWeek] = useState<string>(currentWeek);

  // 利用可能なユニークな週のリストを取得
  const availableWeeks = Array.from(new Set(sessions.map(s => s.week)))
    .sort((a, b) => b.localeCompare(a)); // 新しい週を上にする

  if (!availableWeeks.includes(currentWeek)) {
    availableWeeks.unshift(currentWeek);
  }

  // 選択された週のセッション
  const filteredSessions = sessions.filter(s => s.week === dashboardWeek);

  // 1. 【投手別 選択週のストライク率比較データ】
  const strikeRateData = filteredSessions.map(s => ({
    name: s.pitcherName.replace(' [LIVE]', ''),
    'ストライク率(%)': s.strikeRate,
    '総球数': s.totalPitches,
  })).sort((a, b) => b['ストライク率(%)'] - a['ストライク率(%)']);

  // 2. 【特定投手の週別ストライク率推移データ】
  const getPitcherHistoryData = () => {
    if (selectedGraphPitcher === 'all') return [];
    
    // 対象投手の全セッションを古い順に並び替え
    const pitcherSessions = sessions
      .filter(s => s.pitcherId === selectedGraphPitcher)
      .sort((a, b) => a.week.localeCompare(b.week));

    return pitcherSessions.map(s => ({
      name: s.week,
      'ストライク率(%)': s.strikeRate,
      '球数': s.totalPitches,
    }));
  };

  const pitcherHistoryData = getPitcherHistoryData();
  const targetPitcherObj = pitchers.find(p => p.id === selectedGraphPitcher);

  return (
    <div className="space-y-8">
      {/* 週の選択とサマリーカード */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900 p-6 rounded-3xl border border-zinc-800 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Calendar className="w-5.5 h-5.5 text-emerald-400" />
            週別ピッチングレコード
          </h2>
          <p className="text-xs text-zinc-400">週に1回の測定・集計データを切り替えて確認できます</p>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <select
            value={dashboardWeek}
            onChange={(e) => setDashboardWeek(e.target.value)}
            className="px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm flex-1 sm:flex-none cursor-pointer"
          >
            {availableWeeks.map((wk) => (
              <option key={wk} value={wk} className="bg-zinc-900">
                {wk.substring(0, 4)}年 第{wk.substring(6)}週
              </option>
            ))}
          </select>
          
          {spreadsheetId && (
            <button
              onClick={onSyncWithSheets}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-xl text-xs font-black transition-all shadow-sm flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <CloudLightning className="w-3.5 h-3.5" />
              Sheetsに今すぐ同期
            </button>
          )}
        </div>
      </div>

      {/* 選択された週のセッション一覧 */}
      <div className="bg-zinc-900 rounded-3xl border border-zinc-800 p-6 shadow-sm">
        <h3 className="font-bold text-zinc-100 text-base mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-400" />
          {dashboardWeek.substring(0, 4)}年 第{dashboardWeek.substring(6)}週 の投球記録 ({filteredSessions.length}件)
        </h3>

        {filteredSessions.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-zinc-800 rounded-2xl">
            <p className="text-sm text-zinc-500">この週のピッチングデータはまだ記録されていません。</p>
            <p className="text-xs text-zinc-500 mt-1">「投球カウンター」や「AI解析インポート」を使ってデータを記録してください。</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                className="bg-zinc-950/40 rounded-2xl p-4 border border-zinc-800/80 flex flex-col justify-between space-y-3 group hover:border-emerald-500/30 transition-all shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-extrabold px-2 py-0.5 rounded-full">
                      {session.pitcherName}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono block mt-1.5">{session.date}</span>
                  </div>
                  
                  <button
                    onClick={() => onDeleteSession(session.id)}
                    className="p-1.5 text-zinc-500 hover:text-rose-400 rounded-lg hover:bg-rose-950/30 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                    title="削除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center py-2 bg-zinc-900/40 rounded-xl border border-zinc-800/40">
                  <div>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase">ストライク率</p>
                    <p className="text-lg font-black text-emerald-400 font-mono">{session.strikeRate}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase">球数</p>
                    <p className="text-lg font-bold text-zinc-200 font-mono">{session.totalPitches}球</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase">S / B</p>
                    <p className="text-xs font-bold text-zinc-400 font-mono mt-1">{session.strikes}/{session.balls}</p>
                  </div>
                </div>

                {session.notes && (
                  <div className="text-[11px] text-zinc-400 bg-zinc-900/40 p-2 rounded-xl border border-zinc-800/50 line-clamp-2" title={session.notes}>
                    {session.notes}
                  </div>
                )}
                
                <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1.5 border-t border-zinc-800/60">
                  <span>記録: {session.createdBy || 'ゲスト'}</span>
                  <span className={`inline-flex items-center gap-0.5 font-semibold ${session.synced ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {session.synced ? '● Sheets同期済' : '○ 未同期'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 視覚化グラフダッシュボード */}
      {filteredSessions.length > 0 && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* グラフ1: 投手別のストライク率・球数の比較 */}
          <div className="bg-zinc-900 rounded-3xl border border-zinc-800 p-6 shadow-sm">
            <h3 className="font-bold text-zinc-100 text-sm mb-4 flex items-center gap-1.5">
              <BarChart2 className="w-4.5 h-4.5 text-emerald-400" />
              今週のストライク率・球数 比較
            </h3>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={strikeRateData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                  <XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} />
                  <YAxis stroke="#71717a" fontSize={11} domain={[0, 100]} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px', color: '#fff' }}
                    labelStyle={{ fontWeight: 'bold' }}
                  />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: '11px', pt: 10 }} />
                  <Bar dataKey="ストライク率(%)" fill="#10b981" radius={[4, 4, 0, 0]} barSize={25} />
                  <Bar dataKey="総球数" fill="#52525b" radius={[4, 4, 0, 0]} barSize={10} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* グラフ2: 投手個人のストライク率・球数の推移 */}
          <div className="bg-zinc-900 rounded-3xl border border-zinc-800 p-6 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-zinc-100 text-sm flex items-center gap-1.5">
                <TrendingUp className="w-4.5 h-4.5 text-emerald-400" />
                個人の週別ストライク率推移
              </h3>
              
              <select
                value={selectedGraphPitcher}
                onChange={(e) => setSelectedGraphPitcher(e.target.value)}
                className="px-2.5 py-1 text-xs font-bold bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-zinc-900">投手を選択...</option>
                {pitchers.map((p) => (
                  <option key={p.id} value={p.id} className="bg-zinc-900">{p.name}</option>
                ))}
              </select>
            </div>

            {selectedGraphPitcher === 'all' ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-zinc-500">
                <User className="w-8 h-8 text-zinc-600 mb-2" />
                <p className="text-xs">投手を選択すると、週ごとのストライク率の推移が折れ線グラフで表示されます。</p>
              </div>
            ) : pitcherHistoryData.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-zinc-500 text-center">
                <p className="text-xs">「{targetPitcherObj?.name}」投手の履歴データがありません。</p>
                <p className="text-[10px] text-zinc-600 mt-1">複数の週にわたってピッチングデータを記録すると推移が表示されます。</p>
              </div>
            ) : (
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={pitcherHistoryData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                    <XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} />
                    <YAxis stroke="#71717a" fontSize={11} domain={[0, 100]} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px', color: '#fff' }}
                    />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: '11px', pt: 10 }} />
                    <Line
                      type="monotone"
                      dataKey="ストライク率(%)"
                      stroke="#10b981"
                      strokeWidth={3}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="球数"
                      stroke="#71717a"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
