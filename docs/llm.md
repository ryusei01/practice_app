# LLM / 翻訳プロバイダまとめ（本プロジェクト）

このドキュメントは、本プロジェクトで利用している **LLM（テキスト/画像）** と **翻訳系** のプロバイダ構成を把握するためのメモです。  
（PDF生成は LLM ではなく ReportLab によるサーバー内生成です）

## LLM（クラウド）: フォールバック順

バックエンドは、クラウド LLM を **Gemini → Hugging Face Inference Providers → Groq** の順でフォールバックします。

- **実装**: `backend/app/services/llm_router.py`
- **設定例**: `backend/.env.example`

### 1) Gemini（Google Generative Language API）

- **用途**
  - テキスト生成（学習プラン、問題生成など）
  - 画像入力の生成（OCR/画像から問題生成など）
- **環境変数**
  - `GEMINI_API_KEY`
  - `GEMINI_MODEL`（例: `gemini-2.0-flash`）
  - `GEMINI_VISION_MODEL`（例: `gemini-2.0-flash`）
- **備考**
  - `llm_router.py` 内で `generateContent` を呼び出します。

### 2) Hugging Face Inference Providers（OpenAI互換のルータ）

- **用途**
  - テキスト生成（Gemini が失敗/未設定のときの代替）
  - 画像入力の生成（Gemini が失敗/未設定のときの代替）
- **環境変数**
  - `HF_TOKEN`
  - `HF_CHAT_MODEL`（例: `meta-llama/Llama-3.2-3B-Instruct:fastest`）
  - `HF_VISION_MODEL`（例: `llava-hf/llava-1.5-7b-hf:fastest`）
- **備考**
  - `llm_router.py` 内で OpenAI 互換 `POST /chat/completions` 形式で呼びます。

### 3) Groq（OpenAI互換）

- **用途**
  - テキスト生成（上記が失敗/未設定のときの代替）
  - 画像入力の生成（上記が失敗/未設定のときの代替）
- **環境変数**
  - `GROQ_API_KEY`
  - `GROQ_MODEL`（例: `llama-3.1-8b-instant`）
  - `GROQ_VISION_MODEL`（例: `llama-3.2-11b-vision-preview`）
- **備考**
  - `llm_router.py` 内で OpenAI 互換 `POST /chat/completions` 形式で呼びます。

## LLM を使うAPI（バックエンド）

LLM連携の主なAPIは `backend/app/api/ai_llm.py`（`/api/v1/ai/...`）側にあります。

- **実装**: `backend/app/api/ai_llm.py`
- **内部呼び出し**: `backend/app/services/llm_router.py`

例（代表）:
- `POST /api/v1/ai/generate-learning-plan`
- `POST /api/v1/ai/generate-from-image`
- `POST /api/v1/ai/generate-from-text`

## 翻訳系（バックエンド）

翻訳系は用途や設定に応じて複数の実装が存在します。

- **関連ファイル**
  - `backend/app/api/translate.py`
  - `backend/app/services/textbook_translator.py`
  - `backend/app/services/google_web_translator.py`
  - `backend/app/services/local_translator.py`

### Ollama（ローカル翻訳のオプション）

クラウドを使わずローカルで翻訳したい場合に利用します（設定時のみ）。

- **環境変数（例）**: `backend/.env.example`
  - `OLLAMA_BASE_URL`（例: `http://localhost:11434`）
  - `OLLAMA_TRANSLATION_MODEL`（例: `llama3.2:1b`）

## フロントエンド側の関連

フロントエンドは基本的にバックエンドのAPIを叩きます（LLMキーはフロントに置きません）。

- **APIクライアント**: `frontend/src/api/client.ts`
  - `Constants.expoConfig?.extra?.apiUrl` → `EXPO_PUBLIC_API_URL` の順に参照
- **設定**: `frontend/app.config.js`
  - `extra.apiUrl` が `EXPO_PUBLIC_API_URL` を参照
- **設定例**: `frontend/.env.example`

