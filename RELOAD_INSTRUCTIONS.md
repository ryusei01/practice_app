# アプリに変更を反映させる方法

## 確認済み：コードは正しく動作しています ✅

スタンドアロンテストで確認しました：
- "1つの / ある" vs "ひとつの" → ✅ **正解** (95% 信頼度)
- 数字正規化が正しく動作: "ひとつの" → "1の", "1つの" → "1の"

## 問題：アプリが古いコードをキャッシュしている可能性があります

### 解決方法

#### 方法1: Expo Goアプリ（スマホ）を使っている場合

1. **アプリを完全に閉じる**
   - Expo Goアプリをスワイプして終了させる

2. **Expo Goを再起動**
   - もう一度Expo Goを開く

3. **QRコードを再スキャン**
   - ターミナルに表示されているQRコードをもう一度スキャン

#### 方法2: シミュレーター/エミュレーターを使っている場合

1. **ターミナルで `r` を押す**
   - Expoサーバーが動いているターミナルで `r` キーを押す
   - または、シミュレーターで `Ctrl+R` (Windows) / `Cmd+R` (Mac)

#### 方法3: 完全リセット（上記で解決しない場合）

```bash
# 古いExpoサーバーを全て停止
taskkill /F /PID 474712

# キャッシュをクリアして再起動
cd frontend
npx expo start --clear
```

その後、アプリを完全に閉じて再起動してください。

## デバッグ方法

### 1. コンソールログを確認

アプリで "ひとつの" を送信した後、Expoターミナルに以下のようなログが表示されるはずです：

```
[AI Evaluator] Number normalization: {
  cleanCorrect: "1つの",
  cleanUser: "ひとつの",
  numNormCorrect: "1の",
  numNormUser: "1の",
  match: true
}
```

### 2. ログが表示されない場合

- アプリがまだ古いコードを使っている証拠です
- 上記の「完全リセット」を試してください

### 3. ログは表示されるが、まだ不正解になる場合

- コンソールログの内容をコピーして報告してください
- `match: true` なのに不正解になっている場合は、別の問題があります

## テスト用HTMLファイル

ブラウザで直接テストできます：

```bash
# ブラウザで開く
start test_reading.html
```

これで "1つの / ある" vs "ひとつの" が正解になることが確認できます。

## スタンドアロンテスト実行結果

```bash
$ node test_full_evaluation.js

========================================
Testing: "1つの / ある" vs "ひとつの"
========================================

=== evaluateTextAnswer ===
correctAnswer: 1つの / ある
userAnswer: ひとつの
Patterns: [ '1つの', 'ある' ]

--- Testing pattern: 1つの
1. After normalizeText:
  normCorrect: 1つの
  normUser: ひとつの
2. After removePunctuation:
  cleanCorrect: 1つの
  cleanUser: ひとつの
2.5. After normalizeNumbers:
  numNormCorrect: 1の
  numNormUser: 1の
  match: true

========================================
FINAL RESULT:
========================================
is_correct: true      ← ✅ 正解！
confidence: 0.95      ← 95% 信頼度
feedback: 数字表現が正解です！
exact_match: false
```

## まとめ

**コードに問題はありません。** アプリをリロードすれば正しく動作するはずです。

リロード後も動作しない場合は、Expoターミナルのコンソールログを教えてください。
