# Google AdSense Integration

このプロジェクトでは、Web ビルドに Google AdSense スクリプトが自動的に挿入されます。

## 実装方法

Google AdSense スクリプトは、ビルド後に自動的にすべての HTML ファイルに挿入されます。

### 使用されるスクリプト

```html
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9679910712332333"
     crossorigin="anonymous"></script>
```

### ビルドコマンド

```bash
# 開発環境
npm run build:web

# または
npm run export:web
```

これらのコマンドは以下の処理を行います：

1. Expo を使用して Web アプリをビルド
2. `scripts/inject-adsense.js` スクリプトを実行して、すべての HTML ファイルに AdSense スクリプトを挿入

### Cloudflare Pages デプロイ

Cloudflare Pages では、`cloudflare-pages.json` に設定されたビルドコマンドが自動的に実行されます：

```bash
cd frontend && npm install --legacy-peer-deps && npm run build:web
```

### 技術的な詳細

- スクリプト: `frontend/scripts/inject-adsense.js`
- 挿入位置: `<head>` タグの直後
- 対象ファイル: `dist/` ディレクトリ内のすべての `.html` ファイル
- 重複チェック: スクリプトは既に挿入されている場合はスキップされます

### ローカルでの確認

ビルド後、以下のコマンドで AdSense スクリプトが挿入されていることを確認できます：

```bash
cd frontend
grep "adsbygoogle" dist/index.html
```

## 注意事項

- `dist/` ディレクトリはビルド成果物であり、Git にコミットされません
- AdSense スクリプトはビルド時に自動的に挿入されるため、手動で HTML ファイルを編集する必要はありません
- 本番環境では、Cloudflare Pages が自動的にビルドと挿入を行います
