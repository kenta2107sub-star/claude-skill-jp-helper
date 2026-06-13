# claude-skill-jp-helper

Claudeデスクトップアプリで `/` を入力すると、スラッシュコマンドの一覧と日本語説明をポップアップ表示するmacOSオーバーレイアプリです。

## 動作環境

- macOS 13 (Ventura) 以降
- Node.js 18 以降
- Claudeデスクトップアプリ（[anthropic.com](https://www.anthropic.com/download) からダウンロード）

## セットアップ

### 1. リポジトリをクローン

```bash
git clone https://github.com/kenta2107sub-star/claude-skill-jp-helper.git
cd claude-skill-jp-helper
```

### 2. 依存関係をインストール＆ビルド

```bash
cd electron
npm install
npm run build
```

### 3. 入力監視の権限を付与

グローバルキーフック（`uiohook-napi`）の動作に**入力監視**の権限が必要です。

1. **システム設定** → **プライバシーとセキュリティ** → **入力監視** を開く
2. **ターミナル**（アプリを起動するシェル）を追加して有効にする

> ⚠️ この権限がないとキー入力を検知できず、ポップアップが表示されません。

### 4. アプリを起動

```bash
# electron/ ディレクトリ内で実行
npx electron .
```

Claudeデスクトップアプリを開いて `/` を入力すると、コマンド一覧がポップアップ表示されます。

## 自動起動の設定（オプション）

ログイン時に自動起動させるには、LaunchAgentに登録します。

1. 以下の内容で `~/Library/LaunchAgents/com.yourname.claude-jp-helper.plist` を作成します（パスは実際の環境に合わせてください）：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.yourname.claude-jp-helper</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/npx</string>
    <string>electron</string>
    <string>/path/to/claude-skill-jp-helper/electron</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
</dict>
</plist>
```

2. LaunchAgentを登録します：

```bash
launchctl load ~/Library/LaunchAgents/com.yourname.claude-jp-helper.plist
```

## 仕組み

- `uiohook-napi` でOSレベルのキー入力をグローバルにフック
- `lsappinfo` でフロントモストアプリがClaudeかどうかを判定
- Claudeがアクティブなときのみ `/` 入力を検知してポップアップを表示
- `data/commands.json` からコマンド一覧を読み込む

## ファイル構成

```
claude-skill-jp-helper/
├── electron/
│   ├── src/
│   │   ├── main.ts        — メインプロセス（キー監視・ウィンドウ制御）
│   │   ├── commands.ts    — コマンド辞書の検索
│   │   └── preload.ts     — レンダラーブリッジ
│   ├── renderer/
│   │   ├── popup.html
│   │   └── popup.css
│   ├── package.json
│   └── tsconfig.json
└── data/
    └── commands.json      — コマンド辞書（追加・編集可能）
```

## コマンド辞書のカスタマイズ

`data/commands.json` を編集してコマンドの説明を追加・変更できます：

```json
[
  {
    "command": "/clear",
    "category": "基本操作",
    "description": "画面をクリアする",
    "detail": "現在の会話画面を消去します。会話履歴は保持されます。"
  }
]
```

変更後はアプリの再起動のみで反映されます（再ビルド不要）。

## トラブルシューティング

**ポップアップが表示されない**
- 入力監視の権限を確認してください（[セットアップ手順3](#3-入力監視の権限を付与)）
- Claudeデスクトップアプリがアクティブ（フォアグラウンド）な状態で `/` を入力してください

**フォルダを移動・リネームした後にポップアップが出なくなった**
- フォルダパスが変わると、macOSは別のアプリとして認識し入力監視権限がリセットされます
- **システム設定** → **プライバシーとセキュリティ** → **入力監視** を開き、新しいパスのElectronを追加・有効化してください
- リストに自動追加されない場合は、アプリを起動したままシステム設定を開くとダイアログが表示されることがあります

**`npm install` でエラーが出る**
- Node.js 18 以上がインストールされているか確認：`node --version`
- Xcode Command Line Tools が必要な場合があります：`xcode-select --install`

## ライセンス

MIT
