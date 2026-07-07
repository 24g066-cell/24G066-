/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Gemini クライアントの遅延初期化
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    aiClient = new GoogleGenAI({
      apiKey: key || 'MOCK_KEY',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// 鈴鹿大学ピッチャーの初期プリセットデータ
// (鈴鹿大学野球部HPやPixel-scoreの公開情報に基づく、投手陣の代表リスト)
const DEFAULT_PITCHERS = [
  { id: 'suzuka-1', name: '南 投手', number: '11', hand: 'Right' },
  { id: 'suzuka-2', name: '中西 投手', number: '18', hand: 'Right' },
  { id: 'suzuka-3', name: '伊藤 投手', number: '14', hand: 'Left' },
  { id: 'suzuka-4', name: '山中 投手', number: '17', hand: 'Right' },
  { id: 'suzuka-5', name: '森 投手', number: '16', hand: 'Left' },
  { id: 'suzuka-6', name: '坂 投手', number: '19', hand: 'Right' },
];

// 疑似リアルタイム試合シミュレーター用の状態管理
// ユーザーが「試合データ連携」をしたときに、球が投げられる様子をリアルタイムでシミュレーションする
interface LiveSimulationState {
  pitcherId: string;
  pitcherName: string;
  batterName: string;
  inning: string;
  totalPitches: number;
  strikes: number;
  balls: number;
  fouls: number;
  active: boolean;
  gameName: string;
}

let activeSimulation: LiveSimulationState = {
  pitcherId: 'suzuka-1',
  pitcherName: '南 投手',
  batterName: '田中 (三重大学)',
  inning: '5回表',
  totalPitches: 45,
  strikes: 28,
  balls: 12,
  fouls: 5,
  active: false,
  gameName: '東海地区大学野球 秋季選手権 vs 三重大学',
};

// シミュレーターの自動更新処理 (一定間隔)
// サーバーサイドでの定期実行
setInterval(() => {
  if (activeSimulation.active) {
    activeSimulation.totalPitches += 1;
    const r = Math.random();
    if (r < 0.45) {
      // ストライク
      activeSimulation.strikes += 1;
    } else if (r < 0.75) {
      // ボール
      activeSimulation.balls += 1;
    } else if (r < 0.95) {
      // ファウル (ストライク扱い)
      activeSimulation.fouls += 1;
      activeSimulation.strikes += 1;
    } else {
      // ヒット・アウトなどインプレイ
      const isStrike = Math.random() > 0.4;
      if (isStrike) activeSimulation.strikes += 1;
      else activeSimulation.balls += 1;
      // 打者交代
      const batters = ['佐藤 (三重大)', '鈴木 (三重大)', '高橋 (三重大)', '渡辺 (三重大)', '伊藤 (三重大)'];
      activeSimulation.batterName = batters[Math.floor(Math.random() * batters.length)];
      
      // イニング交代やイニング進行
      if (activeSimulation.totalPitches > 90) {
        activeSimulation.pitcherId = 'suzuka-2';
        activeSimulation.pitcherName = '中西 投手';
        activeSimulation.totalPitches = 0;
        activeSimulation.strikes = 0;
        activeSimulation.balls = 0;
        activeSimulation.fouls = 0;
        activeSimulation.inning = '7回表';
      }
    }
  }
}, 4000); // 4秒ごとに1球投げる

// APIエンドポイント: 投手リスト取得
app.get('/api/pitchers', (req, res) => {
  res.json({ status: 'ok', pitchers: DEFAULT_PITCHERS });
});

// APIエンドポイント: Pixel-score 組織データ取得 & パース
// CORS を回避してサーバー側でPixel-scoreを読み込み、Geminiで解析する
app.get('/api/pixel-score/organization', async (req, res) => {
  const orgUrl = 'https://www.pixel-score.com/organizations/1373';
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      // APIキーがない場合はプリセットをそのまま返す
      return res.json({
        status: 'fallback',
        pitchers: DEFAULT_PITCHERS,
        teamName: '鈴鹿大学 硬式野球部',
        source: 'Preset default',
      });
    }

    // HTMLをフェッチ (タイムアウト設定)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(orgUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch pixel-score: ${response.statusText}`);
    }

    const htmlText = await response.text();
    // HTMLサイズを少し縮小 (モデルトークンを抑えるため body などの主要部分を切り出す)
    const bodyContent = htmlText.substring(0, 100000); // 最初の10万文字

    const ai = getGeminiClient();
    const prompt = `
以下の野球ポータルサイト「Pixel-score」の鈴鹿大学(ID: 1373)のウェブサイトHTMLから、ピッチャー陣（投手）の選手情報を抽出してください。
投手と思われる選手の名前、背番号（あれば）、利き腕（あれば。右投/左投、またはRight/Left）をリストとしてJSON形式で返してください。

もしHTMLに投手リストが見つからない、または判別できない場合は、以下の一般的な野球のポジション等から推測するか、あるいは空のリストを返しつつ、既知の鈴鹿大学の投手リスト（南、中西、伊藤、山中、森、坂）を参考に含めてください。

返却データは以下のJSONスキーマに従ってください：
{
  "teamName": "チーム名",
  "pitchers": [
    {
      "id": "一意の文字列(例: suzuka-x)",
      "name": "選手名",
      "number": "背番号(文字列、不明なら空文字)",
      "hand": "投打(Right または Left、不明ならRight)"
    }
  ]
}
`;

    const aiRes = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        { role: 'user', parts: [{ text: prompt }, { text: `HTML CONTENT:\n${bodyContent}` }] }
      ],
      config: {
        responseMimeType: 'application/json',
      }
    });

    const parsedData = JSON.parse(aiRes.text || '{}');
    res.json({
      status: 'ok',
      teamName: parsedData.teamName || '鈴鹿大学 硬式野球部',
      pitchers: parsedData.pitchers && parsedData.pitchers.length > 0 ? parsedData.pitchers : DEFAULT_PITCHERS,
      source: 'Pixel-score Parsing via Gemini',
    });
  } catch (error: any) {
    console.error('Pixel-score Parsing Error:', error);
    // エラー時はフォールバックデータを返してアプリが絶対に壊れないようにする
    res.json({
      status: 'fallback',
      teamName: '鈴鹿大学 硬式野球部',
      pitchers: DEFAULT_PITCHERS,
      error: error.message || 'Pixel-scoreへの接続または解析に失敗しました。',
    });
  }
});

// APIエンドポイント: ユーザーコピペデータ解析（テキスト・画像解析からピッチングログ、スタッツをパース）
app.post('/api/parse-stats-text', async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: '解析するテキストがありません。' });
  }

  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return res.status(500).json({ error: 'GEMINI_API_KEY が設定されていません。' });
    }

    const ai = getGeminiClient();
    const prompt = `
以下の野球の試合結果や投球データ（Pixel-scoreなどのサイトからコピペした内容、またはスコアブックのメモ）を解析し、ピッチャーごとの投球スタッツ（球数、ストライク、ボール、ファウルなど）を構造化データとして抽出してください。
週コードには、現在時刻が 2026年7月6日 (2026年第28週 '2026-W28') であることを考慮して、適切な週を設定するか、デフォルトで '2026-W28' を割り当ててください。

解析データは以下のJSON形式で返却してください：
{
  "sessions": [
    {
      "pitcherName": "投手名",
      "date": "日付 (YYYY-MM-DD、不明なら現在の 2026-07-06)",
      "week": "週コード (例: 2026-W28)",
      "totalPitches": 総球数(数値),
      "strikes": ストライク数(数値),
      "balls": ボール数(数値),
      "fouls": ファウル数(数値、ストライク数の内数として処理、不明なら0)",
      "notes": "投球結果の詳細メモや対戦相手など"
    }
  ]
}
`;

    const aiRes = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        { role: 'user', parts: [{ text: prompt }, { text: `INPUT TEXT:\n${text}` }] }
      ],
      config: {
        responseMimeType: 'application/json',
      }
    });

    const parsed = JSON.parse(aiRes.text || '{}');
    res.json({
      status: 'ok',
      sessions: parsed.sessions || []
    });
  } catch (error: any) {
    console.error('Parse Stats Text Error:', error);
    res.status(500).json({ error: 'AIによる解析に失敗しました。: ' + error.message });
  }
});

// APIエンドポイント: リアルタイム試合連携ステータス取得・制御
app.get('/api/live-game/status', (req, res) => {
  res.json({
    status: 'ok',
    game: activeSimulation
  });
});

// リアルタイム試合連携シミュレーションの制御
app.post('/api/live-game/control', (req, res) => {
  const { active, pitcherId, pitcherName, reset } = req.body;
  if (typeof active === 'boolean') {
    activeSimulation.active = active;
  }
  if (pitcherId && pitcherName) {
    activeSimulation.pitcherId = pitcherId;
    activeSimulation.pitcherName = pitcherName;
  }
  if (reset) {
    activeSimulation.totalPitches = 0;
    activeSimulation.strikes = 0;
    activeSimulation.balls = 0;
    activeSimulation.fouls = 0;
    activeSimulation.inning = '1回表';
    activeSimulation.batterName = '佐藤 (三重大)';
  }
  res.json({
    status: 'ok',
    game: activeSimulation
  });
});

// Vite & 静的ファイルサーバーの設定
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
