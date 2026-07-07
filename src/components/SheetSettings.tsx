/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Search, Plus, ExternalLink, Link2, FileSpreadsheet, CheckCircle2, RefreshCw } from 'lucide-react';
import { searchPitchingSpreadsheets, createPitchingSpreadsheet } from '../lib/googleSheets';

interface SheetSettingsProps {
  accessToken: string;
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  onSelectSpreadsheet: (id: string, url: string) => void;
  onDisconnect: () => void;
}

export default function SheetSettings({
  accessToken,
  spreadsheetId,
  spreadsheetUrl,
  onSelectSpreadsheet,
  onDisconnect
}: SheetSettingsProps) {
  const [loading, setLoading] = useState(false);
  const [sheetsList, setSheetsList] = useState<{ id: string; name: string }[]>([]);
  const [manualId, setManualId] = useState('');
  const [customTitle, setCustomTitle] = useState('鈴鹿大学ピッチャー陣投球データ記録');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ドライブ上の既存のスプレッドシートを検索
  const handleSearchSheets = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const list = await searchPitchingSpreadsheets(accessToken);
      setSheetsList(list);
      if (list.length === 0) {
        setMessage({ type: 'error', text: 'Googleドライブ内に関連するスプレッドシートが見つかりませんでした。新しく作成するか、共有IDを直接入力してください。' });
      }
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'スプレッドシートの検索に失敗しました。認証状態を確認してください。' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) {
      handleSearchSheets();
    }
  }, [accessToken]);

  // 新規スプレッドシートの作成
  const handleCreateSheet = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const { id, url } = await createPitchingSpreadsheet(accessToken, customTitle);
      onSelectSpreadsheet(id, url);
      setMessage({ type: 'success', text: `スプレッドシート「${customTitle}」を新しく作成しました！` });
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'スプレッドシートの作成に失敗しました。' });
    } finally {
      setLoading(false);
    }
  };

  // 既存のシートIDを手動で連結
  const handleConnectManual = () => {
    if (!manualId.trim()) return;
    const extractedId = extractSpreadsheetId(manualId);
    if (!extractedId) {
      setMessage({ type: 'error', text: '有効なスプレッドシートIDまたはURLを入力してください。' });
      return;
    }
    const url = `https://docs.google.com/spreadsheets/d/${extractedId}/edit`;
    onSelectSpreadsheet(extractedId, url);
    setMessage({ type: 'success', text: 'スプレッドシートをIDから連携しました！' });
  };

  // URLまたは生のIDからIDを抽出するユーティリティ
  const extractSpreadsheetId = (input: string): string | null => {
    const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      return match[1];
    }
    // 生のIDであると仮定
    if (input.trim().length > 15) {
      return input.trim();
    }
    return null;
  };

  return (
    <div className="bg-zinc-900 rounded-3xl border border-zinc-800 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
          <FileSpreadsheet className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-zinc-100">Google スプレッドシート連携</h2>
          <p className="text-sm text-zinc-400">データをチームでリアルタイム共有するためにスプレッドシートと連携します</p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl mb-6 text-sm ${
          message.type === 'success' 
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
        }`}>
          {message.text}
        </div>
      )}

      {spreadsheetId ? (
        // 既に連携されている状態
        <div className="space-y-4">
          <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 flex items-start gap-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-zinc-100">スプレッドシートと連携中</h3>
              <p className="text-xs text-zinc-500 font-mono mt-1 break-all">ID: {spreadsheetId}</p>
              
              <div className="flex flex-wrap gap-3 mt-4">
                <a
                  href={spreadsheetUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black text-zinc-950 bg-emerald-500 rounded-lg hover:bg-emerald-400 transition-colors shadow-sm"
                >
                  シートを開く
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={onDisconnect}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-zinc-300 bg-zinc-800 hover:bg-zinc-750 rounded-lg transition-colors border border-zinc-700/80 cursor-pointer"
                >
                  連携を解除
                </button>
              </div>
            </div>
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed">
            ※ チームの他のメンバーがこのデータにアクセスするには、このスプレッドシートをご自身のGoogleドライブ上でチームメンバーに「共有（編集権限）」してください。他のメンバーは、右側にある「共有用IDから連携」にこのスプレッドシートのIDをペーストすることで、全く同じデータを共有・記録できます。
          </p>
        </div>
      ) : (
        // 連携されていない状態
        <div className="grid md:grid-cols-2 gap-8">
          {/* 左カラム: 新規作成 or 既存から選択 */}
          <div className="space-y-6">
            <div>
              <h3 className="font-bold text-zinc-100 mb-3 flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold">1</span>
                新しいスプレッドシートを作成
              </h3>
              <div className="space-y-3">
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="スプレッドシート名"
                  className="w-full px-4 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-zinc-100"
                />
                <button
                  onClick={handleCreateSheet}
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-black text-zinc-950 bg-emerald-500 hover:bg-emerald-400 rounded-xl disabled:opacity-50 transition-colors cursor-pointer shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  新規スプレッドシートを作成
                </button>
              </div>
            </div>

            <div className="border-t border-zinc-800 pt-6">
              <h3 className="font-bold text-zinc-100 mb-3 flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold">2</span>
                Googleドライブから見つける
              </h3>
              <div className="flex gap-2 mb-3">
                <button
                  onClick={handleSearchSheets}
                  disabled={loading}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-zinc-300 bg-zinc-800 border border-zinc-700 hover:bg-zinc-750 rounded-xl disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  再検索
                </button>
              </div>
              
              <div className="max-h-44 overflow-y-auto border border-zinc-800 bg-zinc-950/40 rounded-2xl divide-y divide-zinc-850">
                {sheetsList.length > 0 ? (
                  sheetsList.map((sheet) => (
                    <button
                      key={sheet.id}
                      onClick={() => onSelectSpreadsheet(sheet.id, `https://docs.google.com/spreadsheets/d/${sheet.id}/edit`)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-800 hover:text-emerald-400 transition-colors flex items-center justify-between group cursor-pointer"
                    >
                      <span className="truncate text-zinc-300 group-hover:text-emerald-400 font-medium">{sheet.name}</span>
                      <Link2 className="w-3.5 h-3.5 text-zinc-500 group-hover:text-emerald-400 shrink-0 ml-2" />
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs text-zinc-500">
                    検索結果がありません（「投球データ」という名前を含むスプレッドシートを自動検知します）
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 右カラム: 手動連携 */}
          <div className="border-l border-zinc-800 pl-0 md:pl-8 flex flex-col justify-start">
            <h3 className="font-bold text-zinc-100 mb-3 flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold">3</span>
              共有用ID/URLから連携
            </h3>
            <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
              チームメイトが作成したスプレッドシートを共有して共同で記録する場合、そのメンバーから共有された「スプレッドシートID」または「スプレッドシートのURL」を入力して接続します。
            </p>
            <div className="space-y-3">
              <input
                type="text"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/... または ID"
                className="w-full px-4 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-zinc-100"
              />
              <button
                onClick={handleConnectManual}
                disabled={!manualId.trim()}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-bold text-emerald-400 bg-zinc-800 hover:bg-zinc-750 rounded-xl disabled:opacity-50 transition-colors cursor-pointer border border-zinc-700"
              >
                <Link2 className="w-4 h-4" />
                スプレッドシートを接続する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
