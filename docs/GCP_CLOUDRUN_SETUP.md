# Google Cloud Run セットアップ手順

## 前提条件

- Google アカウントがあること
- [gcloud CLI](https://cloud.google.com/sdk/docs/install) がインストール済みであること

### Windows での注意（CMD と Bash の違い）

**コマンドプロンプト（`cmd.exe`）では、行末の `\` による改行継続は使えません**（Linux / macOS の bash 向けの記法です）。`\` の次の行が「別のコマンド」として解釈され、`run.googleapis.com` などが実行されようとしてエラーになります。

次のどちらかで進めてください。

- **PowerShell** を開く（推奨）— このドキュメント内の **PowerShell** 用ブロックがそのまま使えます。
- **1行にまとめたコマンド**をコピーする（下記「すべての環境で使える1行」）。

**よくあるミス（コマンドプロンプト `cmd.exe`）**

- マークダウンの**コードブロックの枠**（バッククォート 3 つだけの行や、`powershell` / `bash` と書かれた開始行）をコピーに含めないでください。**ターミナルに貼ると**「認識されません」**になります。**
- Bash の **`PROJECT_ID=$(gcloud ...)`** や **`${PROJECT_ID}`** は **cmd では動きません**。変数が空のまま `gcloud` に渡り、`INVALID_ARGUMENT` や **`Unknown service account`**（メールアドレスに `@${PROJECT_ID}` の文字がそのまま含まれる等）になります。
- **Bash 用のブロックは cmd では使わない**。PowerShell を開くか、セクション 4 の **cmd 用**のコマンドを使ってください。

### PowerShell（Cursor / VS Code の統合ターミナル含む）での注意

- **`gcloud` が「認識されない」**: Cloud SDK のインストーラが **PATH に追加していない**ウィンドウで開いていることが多いです。次のいずれかで対処してください。
  - **スタートメニュー**から **「Google Cloud SDK Shell」** を開き、その窓で `gcloud` を実行する（PATH が通った状態で起動します）。
  - いまの PowerShell セッションだけ PATH を足す（ユーザー標準インストール時の例）:

```powershell
$env:Path = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin;$env:Path"
gcloud --version
```

  パスが違う場合はエクスプローラで `gcloud.cmd` を検索し、その **`bin` フォルダ**を上の `Path` に使います。

- **プロンプト行やエラー全文を貼らない**: `PS D:\...>` や `発生場所 行:1 ...`、`+ CategoryInfo ...` などをコピーすると、PowerShell がそれを**コマンドとして実行**し、`単項演算子 '+'` や `Get-Process` 関連のエラーになります。**`gcloud ...` の行だけ**を貼るか、手で打ってください。
- **行頭の `PS` に注意**: 行が **`PS ` で始まる**と、PowerShell は **`PS` を `Get-Process`（省略形）** と解釈することがあります。プロンプトごと貼らないでください。

---

## 1. GCP プロジェクト作成・初期設定

**既に [GCP コンソール](https://console.cloud.google.com/) でプロジェクトを作成している場合**は、`gcloud projects create` は不要です。コンソールのプロジェクト選択で表示されている **プロジェクト ID**（名前ではない）をメモし、下の `gcloud config set project` にその ID を指定してください。請求先の紐付けもコンソールで済ませていれば、そのまま **2** へ進めます。

```bash
# ログイン
gcloud auth login

# プロジェクト作成（まだ無い場合のみ。プロジェクトIDは全世界でユニークである必要あり）
# gcloud projects create quiz-marketplace-prod --name="AIPracticeBook"

# 作成した（または既存の）プロジェクトをデフォルトに設定（<PROJECT_ID> を実際のIDに置き換え）
gcloud config set project <PROJECT_ID>

# 請求先アカウントを紐付け（GCP コンソールで確認）
# https://console.cloud.google.com/billing
```

**プロジェクト ID とプロジェクト番号**: GCP には **プロジェクト ID**（例: `my-app-prod` のような文字列）と **プロジェクト番号**（例: `123456789012` のような数字）があります。`gcloud config set project` には必ず **ID** を指定してください。番号だけを設定すると、`The value of core/project property is set to project number` のようなエラーになることがあります。コンソールの「プロジェクトの設定」やプロジェクト選択ダイアログで **ID** 列を確認するか、`gcloud projects list` で `PROJECT_ID` 列を確認してください。修正例: `gcloud config set project 実際のプロジェクトID`。その場しのぎならコマンドに `--project=実際のプロジェクトID` を付けても動きます。

## 2. 必要な API を有効化

**すべての環境で使える1行（CMD / PowerShell / bash 共通）:**

```text
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
```

bash では次のように複数行でも同じ意味です（`\` は bash のみ）:

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com
```

## 3. Artifact Registry リポジトリを作成（Docker イメージ保存先）

**1行（推奨）:**

```text
gcloud artifacts repositories create quiz-marketplace --repository-format=docker --location=asia-northeast1 --description="Quiz Marketplace backend images"
```

## 4. サービスアカウントの作成と権限付与

GitHub Actions から Cloud Run にデプロイするためのサービスアカウントを作成します。

**既に `github-actions-deploy` が存在する場合**（`already exists` / `Resource ... conflict`）: **作成コマンドはスキップ**し、権限付与（未設定なら）とキー作成だけ行ってください。存在確認: `gcloud iam service-accounts list --project=あなたのプロジェクトID`

**PowerShell（Windows 推奨）** — 「Windows PowerShell」を開き、リポジトリのルートなど作業したいディレクトリで実行。**コマンドプロンプト（黒い cmd）ではこのブロックは使えません。**

Cursor / VS Code の統合ターミナルなどで **`gcloud` が認識されない**ときは、**次の2行を必ず先に**実行してから続きに進んでください（`gcloud --version` でバージョンが表示されれば OK）。

```powershell
$env:Path = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin;$env:Path"
gcloud --version
```

表示されない場合は **Google Cloud SDK Shell** を使うか、エクスプローラで `gcloud.cmd` を探してその `bin` を `Path` に追加してください（「PowerShell（Cursor / VS Code…）での注意」参照）。

```powershell
$PROJECT_ID = (gcloud config get-value project).Trim()

gcloud iam service-accounts create github-actions-deploy --display-name="GitHub Actions Deploy"

gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:github-actions-deploy@$PROJECT_ID.iam.gserviceaccount.com" --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:github-actions-deploy@$PROJECT_ID.iam.gserviceaccount.com" --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:github-actions-deploy@$PROJECT_ID.iam.gserviceaccount.com" --role="roles/iam.serviceAccountUser"

gcloud iam service-accounts keys create gcp-sa-key.json --iam-account="github-actions-deploy@$PROJECT_ID.iam.gserviceaccount.com"
```

（上の `create` が「既に存在」で失敗したら、その1行だけ飛ばして続行してかまいません。）

**コマンドプロンプト（cmd）でしか使えない場合** — `プロジェクトID` を実際の ID（例: `aipracticebook`）に置き換え。**作成済みなら `service-accounts create` の行だけ省略。**

```text
set PROJECT_ID=プロジェクトID

gcloud iam service-accounts create github-actions-deploy --display-name="GitHub Actions Deploy"

gcloud projects add-iam-policy-binding %PROJECT_ID% --member="serviceAccount:github-actions-deploy@%PROJECT_ID%.iam.gserviceaccount.com" --role="roles/run.admin"

gcloud projects add-iam-policy-binding %PROJECT_ID% --member="serviceAccount:github-actions-deploy@%PROJECT_ID%.iam.gserviceaccount.com" --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding %PROJECT_ID% --member="serviceAccount:github-actions-deploy@%PROJECT_ID%.iam.gserviceaccount.com" --role="roles/iam.serviceAccountUser"

gcloud iam service-accounts keys create gcp-sa-key.json --iam-account="github-actions-deploy@%PROJECT_ID%.iam.gserviceaccount.com"
```

**Bash（macOS / Linux / Git Bash）**

```bash
gcloud iam service-accounts create github-actions-deploy --display-name="GitHub Actions Deploy"

PROJECT_ID=$(gcloud config get-value project)

gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:github-actions-deploy@${PROJECT_ID}.iam.gserviceaccount.com" --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:github-actions-deploy@${PROJECT_ID}.iam.gserviceaccount.com" --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:github-actions-deploy@${PROJECT_ID}.iam.gserviceaccount.com" --role="roles/iam.serviceAccountUser"

gcloud iam service-accounts keys create gcp-sa-key.json --iam-account="github-actions-deploy@${PROJECT_ID}.iam.gserviceaccount.com"
```

> **重要**: `gcp-sa-key.json` の内容を GitHub Secrets の `GCP_SA_KEY` に登録後、ファイルは削除してください。
> このファイルを git にコミットしてはいけません。

## 5. GitHub Secrets の登録

GitHub リポジトリの Settings → Secrets and variables → Actions で以下を登録:

| Secret 名 | 値 |
|---|---|
| `GCP_SA_KEY` | `gcp-sa-key.json` の内容（JSON全体） |
| `GCP_PROJECT_ID` | GCP のプロジェクト ID（例: `quiz-marketplace-prod`。コンソールで作成したプロジェクトの ID と一致させる） |
| `SUPABASE_URL` | Supabase の URL |
| `SUPABASE_KEY` | Supabase の anon key |
| `SUPABASE_SERVICE_KEY` | Supabase の service role key |
| `DATABASE_URL` | Supabase の PostgreSQL 接続文字列 |
| `SECRET_KEY` | JWT 署名用シークレットキー（ランダム文字列） |
| `STRIPE_SECRET_KEY` | Stripe のシークレットキー |
| `STRIPE_PUBLISHABLE_KEY` | Stripe の公開キー |
| `STRIPE_WEBHOOK_SECRET` | Stripe の Webhook シークレット |
| `SMTP_USER` | Gmail アドレス |
| `SMTP_PASSWORD` | Gmail アプリパスワード |
| `GOOGLE_CLIENT_ID` | Google OAuth クライアントID |
| `CORS_ORIGINS` | カンマ区切りでフロントのオリジン（例: `https://ai-practice-book.com,https://www.ai-practice-book.com,https://aipracticebook.pages.dev`）。**本番ドメインを必ず含める**（含めないとブラウザが CORS で API を拒否する） |

**Ollama（任意）**: GCP 上に推論用ホストを置き、`OLLAMA_BASE_URL` を API から届ける手順は [GCP_OLLAMA_SETUP.md](./GCP_OLLAMA_SETUP.md) を参照。利用する場合のみ GitHub Actions のシークレットを追加すれば、デプロイ後に Cloud Run へマージされます。

| Secret 名（任意） | 値の例 |
|---|---|
| `OLLAMA_BASE_URL` | `http://10.128.0.3:11434`（VPC 内の Ollama。インターネット公開しないこと） |
| `OLLAMA_LEARNING_PLAN_MODEL` | 未設定ならアプリ既定（例: `gpt-oss-20b`） |
| `OLLAMA_COPYRIGHT_CHECK_MODEL` | 同上 |
| `OLLAMA_VISION_MODEL` | 同上 |
| `OLLAMA_TEXT_GENERATION_MODEL` | 同上 |

VPC コネクタを API に付ける場合は、`gcloud run deploy` / `services update` に `--vpc-connector` と `--vpc-egress` を追加する必要があります（詳細は上記 Ollama 手順書）。

## 6. 初回デプロイ（手動）

GitHub Actions を実行する前に、初回だけ手動でデプロイして Cloud Run サービスを作成します。リポジトリのルート（`backend` フォルダがある階層）で実行してください。

**PowerShell（Windows 推奨）**

```powershell
$PROJECT_ID = (gcloud config get-value project).Trim()

gcloud builds submit ./backend --tag "asia-northeast1-docker.pkg.dev/$PROJECT_ID/quiz-marketplace/api:latest"

gcloud run deploy quiz-marketplace-api --image "asia-northeast1-docker.pkg.dev/$PROJECT_ID/quiz-marketplace/api:latest" --region asia-northeast1 --platform managed --allow-unauthenticated --memory 512Mi --cpu 1 --min-instances 0 --max-instances 10 --set-env-vars "ENABLE_ML=false,DEBUG=false,APP_NAME=QuizMarketplace"
```

**Bash**

```bash
PROJECT_ID=$(gcloud config get-value project)

gcloud builds submit ./backend --tag asia-northeast1-docker.pkg.dev/${PROJECT_ID}/quiz-marketplace/api:latest

gcloud run deploy quiz-marketplace-api --image asia-northeast1-docker.pkg.dev/${PROJECT_ID}/quiz-marketplace/api:latest --region asia-northeast1 --platform managed --allow-unauthenticated --memory 512Mi --cpu 1 --min-instances 0 --max-instances 10 --set-env-vars "ENABLE_ML=false,DEBUG=false,APP_NAME=QuizMarketplace"
```

初回デプロイ後、環境変数の残りは GCP コンソールまたは GitHub Actions 経由で設定します。

## 7. デプロイ確認

```text
gcloud run services describe quiz-marketplace-api --region asia-northeast1 --format="value(status.url)"
```

表示された URL を使ってヘルスチェック（`<SERVICE_URL>` を置き換え）:

```text
curl https://<SERVICE_URL>/health
```

---

## 費用の目安

- **月 200 万リクエスト以下**: 完全無料
- **超過後**: $0.40 / 100 万リクエスト
- **メモリ (512MB)**: 360,000 GB秒/月まで無料
- **CPU**: 180,000 vCPU秒/月まで無料

低〜中トラフィックであれば実質 $0 で運用可能です。
