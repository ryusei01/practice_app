# GCP 上で Ollama（または互換 API）を API から使う

バックエンドは `OLLAMA_BASE_URL` が指すホストに対し、Ollama と同じ **HTTP API**（`/api/generate` 等）で通信します。GCP 上では主に次のどちらかで置きます。

| 方式 | 向いている場合 |
|------|----------------|
| **Compute Engine + Docker（推奨）** | `gpt-oss-20b` などメモリ・ディスクを多く使う。料金と挙動が把握しやすい。 |
| **別 Cloud Run サービス** | 構成は単純だが、大モデルはメモリ上限・コールドスタート・イメージサイズの制約が厳しい。 |

**Cloud Run の API サービス（`quiz-marketplace-api`）からプライベート IP へ届けるには、[Serverless VPC Access](https://cloud.google.com/vpc/docs/configure-serverless-vpc-access) コネクタが必要です。** 同一リージョン（例: `asia-northeast1`）で揃えてください。

---

## 前提（このリポジトリの API）

- 設定は `backend/app/core/config.py` の `OLLAMA_BASE_URL`（環境変数で上書き）。
- 本番で使う場合は **GitHub Secret `OLLAMA_BASE_URL`** を設定し、デプロイ後に Cloud Run に反映されます（`.github/workflows/deploy.yml` のオプション更新ステップ）。
- **11434 をインターネットに晒さない**でください（認証のない Ollama はそのままでは誰でも叩けます）。

---

## 手順 A: Compute Engine で Ollama（推奨）

### 1. API を有効化（未実施なら）

```text
gcloud services enable compute.googleapis.com vpcaccess.googleapis.com --project=YOUR_PROJECT_ID
```

### 2. Serverless VPC Access コネクタ（Cloud Run → VPC）

既存の `default` VPC を使う例（サブネット範囲はプロジェクト内で未使用の `/28` を選ぶ）。

```text
gcloud compute networks vpc-access connectors create run-api-to-vpc --region=asia-northeast1 --network=default --range=10.8.0.0/28 --project=YOUR_PROJECT_ID
```

### 3. Ollama 用 VM

- **マシンタイプ**: モデルに応じてメモリを確保（例: `gpt-oss-20b` は数十 GB 級の想定。不足するとスワップや落ちの原因になります）。
- **GPU**: 任意。付ける場合は該当ゾーンで GPU クォータとドライバ／コンテナ実行時の `--gpus` が必要です。
- 同じ VPC・同じリージョンに配置し、**内部 IP**（例: `10.128.0.3`）をメモします。

VM 起動後（SSH して）:

```bash
sudo apt-get update && sudo apt-get install -y docker.io
sudo usermod -aG docker "$USER"
# 再ログイン後
sudo docker run -d --name ollama --restart unless-stopped -p 11434:11434 -v ollama:/root/.ollama ollama/ollama
sudo docker exec -it ollama ollama pull gpt-oss-20b
```

（モデル名は `.env` の `OLLAMA_*_MODEL` に合わせる。）

### 4. ファイアウォール

**ソースを VPC コネクタのレンジ（上例なら `10.8.0.0/28`）だけ**に限定し、VM のタグ付け先に TCP `11434` を許可します。

```text
gcloud compute firewall-rules create allow-ollama-from-serverless --network=default --direction=INGRESS --action=ALLOW --rules=tcp:11434 --source-ranges=10.8.0.0/28 --target-tags=ollama --project=YOUR_PROJECT_ID
```

VM にネットワークタグ `ollama` を付与してください（コンソールまたは `gcloud compute instances add-tags`）。

### 5. Cloud Run（API）に VPC を接続

デプロイ時に次を付与します（既存サービスなら `gcloud run services update` で同様）。

- `--vpc-connector run-api-to-vpc`
- `--vpc-egress private-ranges-only`（プライベート IP 宛のみコネクタ経由にする典型設定）

**環境変数（GitHub Secrets 推奨）**

| Secret | 例 |
|--------|-----|
| `OLLAMA_BASE_URL` | `http://10.128.0.3:11434`（VM の内部 IP） |
| `OLLAMA_LEARNING_PLAN_MODEL` | 省略可（デフォルト `gpt-oss-20b`） |
| `OLLAMA_COPYRIGHT_CHECK_MODEL` | 同上 |
| `OLLAMA_VISION_MODEL` | 同上 |
| `OLLAMA_TEXT_GENERATION_MODEL` | 同上 |

`deploy.yml` にオプションステップがあるため、上記 Secret を登録するとデプロイ後に `gcloud run services update --update-env-vars` でマージされます。

### 6. 動作確認

Cloud Run のシェルは標準では使えないため、**VM 内**で `curl -s http://127.0.0.1:11434/api/tags`、または一時的に踏み台から内部 URL へ `curl` してください。

---

## 手順 B: Cloud Run で Ollama コンテナ

公式イメージ `ollama/ollama` を別サービス（例: `quiz-marketplace-ollama`）としてデプロイし、`--memory` を大きく取る構成です。**大モデルは Cloud Run のメモリ上限・起動時間・ディスクに注意してください。** 内部専用にする場合は `--ingress internal` や認証付きロードバランサの検討が必要です。

API 側の `OLLAMA_BASE_URL` は、そのサービスに **VPC 内から届く URL**（内部 LB や、同一 VPC 上の別リソース経由）に合わせます。詳細は構成ごとに異なるため、A が安定しやすいです。

---

## 互換 API について

Ollama と同じエンドポイント契約（少なくともバックエンドが呼んでいる `/api/generate` 等）を実装したプロキシや自前サーバでも動作します。URL を `OLLAMA_BASE_URL` に置き換えるだけです。

---

## 関連ドキュメント

- [GCP_CLOUDRUN_SETUP.md](./GCP_CLOUDRUN_SETUP.md) … API の Cloud Run デプロイ本体
- `backend/.env.example` … ローカル用 `OLLAMA_*` の例
