/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PitchingSession } from '../types';

// スプレッドシートのヘッダー定義
const HEADERS = [
  'セッションID',
  '週コード',
  '日付',
  '投手名',
  '投手ID',
  '総球数',
  'ストライク数',
  'ボール数',
  'ファウル数',
  'ストライク率(%)',
  'メモ',
  '記録ユーザー'
];

// Google Drive API: 既存の投球記録スプレッドシートを検索
export const searchPitchingSpreadsheets = async (accessToken: string): Promise<{ id: string; name: string }[]> => {
  try {
    const q = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and name contains 'ピッチャー投球データ'");
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!res.ok) {
      throw new Error('Google Driveの検索に失敗しました。');
    }

    const data = await res.json();
    return data.files || [];
  } catch (error) {
    console.error('searchPitchingSpreadsheets Error:', error);
    return [];
  }
};

// Google Sheets API: 新しい投球記録スプレッドシートを作成
export const createPitchingSpreadsheet = async (accessToken: string, title: string = 'ピッチャー投球データ記録'): Promise<{ id: string; url: string }> => {
  try {
    const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          title
        },
        sheets: [
          {
            properties: {
              title: '投球記録',
              gridProperties: {
                frozenRowCount: 1
              }
            }
          }
        ]
      })
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(`スプレッドシートの作成に失敗しました: ${errData.error?.message || res.statusText}`);
    }

    const data = await res.json();
    const spreadsheetId = data.spreadsheetId;
    const spreadsheetUrl = data.spreadsheetUrl;

    // ヘッダー行を書き込み
    await initSpreadsheetHeaders(accessToken, spreadsheetId);

    return { id: spreadsheetId, url: spreadsheetUrl };
  } catch (error) {
    console.error('createPitchingSpreadsheet Error:', error);
    throw error;
  }
};

// スプレッドシートのヘッダーを初期化
const initSpreadsheetHeaders = async (accessToken: string, spreadsheetId: string): Promise<void> => {
  const range = '投球記録!A1:L1';
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: [HEADERS]
    })
  });
};

// Google Sheets API: スプレッドシートから全投球セッションを取得
export const fetchPitchingSessions = async (accessToken: string, spreadsheetId: string): Promise<PitchingSession[]> => {
  try {
    const range = '投球記録!A2:L2000'; // 最大2000行取得
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!res.ok) {
      throw new Error('スプレッドシートデータの取得に失敗しました。');
    }

    const data = await res.json();
    const rows = data.values || [];

    return rows.map((row: any[]): PitchingSession => {
      return {
        id: row[0] || '',
        week: row[1] || '',
        date: row[2] || '',
        pitcherName: row[3] || '',
        pitcherId: row[4] || '',
        totalPitches: Number(row[5]) || 0,
        strikes: Number(row[6]) || 0,
        balls: Number(row[7]) || 0,
        fouls: Number(row[8]) || 0,
        strikeRate: Number(row[9]) || 0,
        notes: row[10] || '',
        createdBy: row[11] || '',
        synced: true
      };
    });
  } catch (error) {
    console.error('fetchPitchingSessions Error:', error);
    throw error;
  }
};

// Google Sheets API: セッションデータをスプレッドシートに保存（全体上書き）
// ※破壊的操作になるため、呼び出し側で window.confirm 等での確認が必要です
export const saveAllPitchingSessions = async (accessToken: string, spreadsheetId: string, sessions: PitchingSession[]): Promise<void> => {
  try {
    const range = '投球記録!A2:L2000';
    
    // スプレッドシート書き込み用の配列に変換
    const values = sessions.map(s => [
      s.id,
      s.week,
      s.date,
      s.pitcherName,
      s.pitcherId,
      s.totalPitches,
      s.strikes,
      s.balls,
      s.fouls,
      s.strikeRate,
      s.notes || '',
      s.createdBy || ''
    ]);

    // まず古いデータをクリア（最大2000行分）
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:clear`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    // 新しいデータを書き込み
    if (values.length > 0) {
      const writeRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/投球記録!A2?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values
        })
      });

      if (!writeRes.ok) {
        throw new Error('データの更新に失敗しました。');
      }
    }
  } catch (error) {
    console.error('saveAllPitchingSessions Error:', error);
    throw error;
  }
};

// Google Sheets API: 単一のセッションを追加
export const appendPitchingSession = async (accessToken: string, spreadsheetId: string, s: PitchingSession): Promise<void> => {
  try {
    const range = '投球記録!A:L';
    const row = [
      s.id,
      s.week,
      s.date,
      s.pitcherName,
      s.pitcherId,
      s.totalPitches,
      s.strikes,
      s.balls,
      s.fouls,
      s.strikeRate,
      s.notes || '',
      s.createdBy || ''
    ];

    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [row]
      })
    });

    if (!res.ok) {
      throw new Error('セッションの追記に失敗しました。');
    }
  } catch (error) {
    console.error('appendPitchingSession Error:', error);
    throw error;
  }
};
