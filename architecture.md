# アーキテクチャ設計

## 全体構成

```
┌──────────────────────────────────────────────────────┐
│  ClaudeJP.app（Electronアプリ）                        │
│                                                      │
│  main.ts          — アプリ起動、キー監視、ウィンドウ制御  │
│  commands.ts      — コマンド辞書の読み込み・検索        │
│  preload.ts       — レンダラーとのブリッジ              │
│  popup.html/css   — ポップアップのUI                   │
│                                                      │
│  グローバルキーフック（uiohook-napi）                   │
│  ・OSレベルのキーダウンイベントを監視                    │
│  ・「/」以降の入力を追跡してコマンド候補を絞り込む         │
└──────────────────────────────────────────────────────┘
```

## ディレクトリ構造

```
claude-skill-jp-helper/
├── electron/
│   ├── src/
│   │   ├── main.ts          — メインプロセス（キー監視・ウィンドウ制御統合）
│   │   ├── commands.ts      — 辞書検索ロジック
│   │   └── preload.ts       — レンダラーとのブリッジ
│   ├── renderer/
│   │   ├── popup.html
│   │   └── popup.css
│   ├── package.json
│   └── tsconfig.json
├── data/
│   └── commands.json        — コマンド辞書
├── requirements.md
├── architecture.md
└── README.md
```

## データフロー

```
1. Electronアプリ起動（LaunchAgentまたは手動）
   └→ uIOhookによるグローバルキーフック開始
   └→ lsappinfoによるフロントモストアプリ監視開始（ポーリング）

2. キーダウンイベント受信
   └→ フロントモストアプリがClaudeかチェック
   └→ 「/」が押されたら追跡開始（trackedText = "/"）
   └→ 以降のキー入力をtrackedTextに追記

3. テキスト変化時
   └→ commands.ts で前方一致検索
   └→ 候補があればポップアップウィンドウを表示・更新
   └→ 候補がなければポップアップを非表示

4. ポップアップウィンドウ
   └→ 画面右下に固定表示（BrowserWindow, alwaysOnTop: "pop-up-menu"）
   └→ コマンド名 + 日本語説明の一覧を表示
   └→ setVisibleOnAllWorkspaces(true) で全Spaceに表示

5. フロントモスト監視（ポーリング 100ms〜1000ms）
   └→ ClaudeからフォーカスがでたらtrackedTextをリセットしポップアップを非表示
   └→ lsappinfo を使用（osascriptはLaunchAgentコンテキストで動作しないため）
```

## フロントモスト検出

```
lsappinfo front                          → アクティブアプリのASN取得
lsappinfo info -only bundleID <ASN>     → CFBundleIdentifier取得
```

osascriptはLaunchAgentコンテキストでは権限エラーで空文字を返すため使用不可。

## コマンド辞書フォーマット（commands.json）

```json
[
  {
    "command": "/clear",
    "description": "画面をクリアする",
    "detail": "現在の会話画面を消去します。会話履歴は保持されます。"
  }
]
```
