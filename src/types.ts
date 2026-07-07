/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Pitcher {
  id: string;
  name: string;
  number?: string; // 背番号
  hand?: 'Right' | 'Left'; // 投打
  pixelScorePlayerId?: string; // Pixel-score選手ID
}

export interface PitchingSession {
  id: string; // 一意のセッションID
  week: string; // 週コード 例: "2026-W28" (2026年第28週)
  pitcherId: string;
  pitcherName: string;
  date: string; // YYYY-MM-DD
  totalPitches: number;
  strikes: number;
  balls: number;
  fouls: number;
  strikeRate: number; // ストライク率 (%) = (strikes / totalPitches) * 100
  notes?: string;
  synced?: boolean; // スプレッドシート同期済みフラグ
  createdBy?: string; // 記録したユーザーのEmail
}

export interface PitchLogEntry {
  pitchNumber: number;
  pitchType: string; // ストレート、スライダー、カーブ、チェンジアップ etc
  speed?: number; // 球速 (km/h)
  result: 'strike' | 'ball' | 'foul' | 'hit' | 'out'; // 投球結果
  timestamp: string;
}

export interface LiveGameEvent {
  gameName: string;
  inning: string;
  pitcherName: string;
  batterName: string;
  count: {
    balls: number;
    strikes: number;
    outs: number;
  };
  lastPitch?: PitchLogEntry;
  logs: PitchLogEntry[];
}

export interface SpreadsheetInfo {
  spreadsheetId: string;
  spreadsheetUrl: string;
  sheetName: string;
}
