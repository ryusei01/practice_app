# デプロイメント手順

## 自動デプロイ設定

### フロントエンド (Cloudflare Pages)

**リポジトリ**: https://github.com/ryusei01/practice_app

**ビルド設定**:
- Framework preset: None
- Build command: `cd frontend && npm install --legacy-peer-deps && npx expo export --platform web`
- Build output directory: `frontend/dist`
- Root Directory: (空欄)

**環境変数**:
```
EXPO_PUBLIC_API_URL=https://practiceapp-production.up.railway.app/api/v1
```

**自動デプロイ**: `master`ブランチへのプッシュで自動デプロイ

### バックエンド (Railway)

**リポジトリ**: https://github.com/ryusei01/practice_app

**環境変数**: Railway の環境変数を設定
- DATABASE_URL
- SECRET_KEY
- STRIPE_SECRET_KEY
- SMTP_USER
- SMTP_PASSWORD
- その他 `.env.example` 参照

**自動デプロイ**: `master`ブランチへのプッシュで自動デプロイ

## デプロイフロー

1. ローカルで開発
2. `git add .`
3. `git commit -m "..."`
4. `git push origin master`
5. 自動的にCloudflare Pages + Railwayにデプロイ

## カスタムドメイン設定

### Cloudflare Pages
1. Pages → プロジェクト → **Custom domains**
2. **Set up a custom domain**
3. ドメインを入力（例: `yourdomain.com`）
4. DNSレコードが自動設定される

## トラブルシューティング

### ビルドが失敗する場合

1. Cloudflare Pagesのログを確認
2. `npm install --legacy-peer-deps`が実行されているか確認
3. 環境変数が正しく設定されているか確認

### API接続エラー

1. `EXPO_PUBLIC_API_URL`が正しいか確認
2. バックエンドがデプロイされているか確認
3. CORSエラーの場合、バックエンドのCORS設定を確認
