# claude-skill-jp-helper

Claudeデスクトップアプリでスラッシュコマンドを入力した際に、日本語の説明をポップアップ表示するmacOSオーバーレイアプリです。

## スクリーンショット

Claudeアプリで `/` を入力すると、コマンド一覧が日本語で表示されます。

## 動作環境

- macOS 13以降
- Node.js 18以降
- Claudeデスクトップアプリ

## セットアップ

### 1. 依存関係のインストール

```bash
cd electron
npm install
```

### 2. ビルド

```bash
npm run build
```

### 3. アクセシビリティ権限の付与

「システム設定」→「プライバシーとセキュリティ」→「アクセシビリティ」にElectronアプリを追加してください。

### 4. 起動

```bash
npx electron .
```

## LaunchAgent（自動起動）

起動時に自動でアプリを立ち上げるには、LaunchAgentとして登録します。

```bash
# ~/Library/LaunchAgents/ に plist を配置して登録
launchctl load ~/Library/LaunchAgents/com.yourname.claude-jp-helper.plist
```

## 仕組み

- `uiohook-napi` でOSレベルのキー入力をグローバルにフック
- `lsappinfo` でフロントモストアプリがClaudeかどうかを判定
- Claudeがアクティブな場合のみポップアップを表示

## ファイル構成

```
claude-skill-jp-helper/
├── electron/
│   ├── src/
│   │   ├── main.ts       — メインプロセス（キー監視・ウィンドウ制御）
│   │   ├── commands.ts   — コマンド辞書の検索
│   │   └── preload.ts    — レンダラーブリッジ
│   └── renderer/
│       ├── popup.html
│       └── popup.css
└── data/
    └── commands.json     — コマンド辞書（追加・編集可能）
```

## コマンド辞書のカスタマイズ

`data/commands.json` を編集することでコマンドの説明を追加・変更できます。

```json
[
  {
    "command": "/clear",
    "description": "画面をクリアする",
    "detail": "現在の会話画面を消去します。会話履歴は保持されます。"
  }
]
```

## ライセンス

MIT
