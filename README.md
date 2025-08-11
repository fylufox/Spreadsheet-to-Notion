# Spreadsheet to Notion 連携システム

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.2-blue.svg)](https://www.typescriptlang.org/)
[![Google Apps Script](https://img.shields.io/badge/Google%20Apps%20Script-V8-green.svg)](https://developers.google.com/apps-script)
[![Notion API](https://img.shields.io/badge/Notion%20API-v1-black.svg)](https://developers.notion.com/)

## 概要

Googleスプレッドシートで管理・加工したデータを、Notionデータベースへ簡単に連携・インポートするためのシステムです。チェックボックスをクリックするだけで、スプレッドシートの行データを自動的にNotionページとして作成できます。

### 主な特徴

- ✅ **ワンクリック連携**: チェックボックス操作で行単位でNotionへデータを送信
- 🔧 **柔軟なマッピング**: スプレッドシートカラムとNotionプロパティの自由な対応付け
- 🛡️ **安全な実行**: 包括的なデータ検証とエラーハンドリング
- 📊 **多様なデータ型対応**: Title、Text、Number、Date、Select等に対応
- 🚀 **高いパフォーマンス**: 設定キャッシュとレート制限対応
- 📝 **充実したログ**: 機密情報をマスキングした詳細ログ機能

### 対象ユーザー

- Googleスプレッドシートでデータ加工を行う方
- Notionでタスクやプロジェクトを管理している方
- 外部データの取得から管理までを効率化したい方
- テンプレートベースでの展開を想定している方

## システム構成

```
┌─────────────────────────────────────────────────────────────┐
│                   Googleスプレッドシート                     │
├─────────────────────────────────────────────────────────────┤
│ [import_data]     [import_column]     [config]             │
│ ┌─────────────┐   ┌─────────────┐    ┌─────────────┐       │
│ │☑│主キー│データ│   │列名│Notion名│型│  │設定名│値    │       │
│ │☐│     │田中│   │名前│Name   │T │  │DB_ID│abc...│       │
│ │☐│     │佐藤│   │年齢│Age    │N │  │     │     │       │
│ └─────────────┘   └─────────────┘    └─────────────┘       │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ onEdit トリガー
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Google Apps Script                        │
├─────────────────────────────────────────────────────────────┤
│ TypeScript + Rollup でビルドされた高性能システム              │
│ ・TriggerManager (メイン制御)                               │
│ ・DataMapper (データ変換)                                   │
│ ・NotionApiClient (API通信)                                │
│ ・Validator (データ検証)                                    │
│ ・Logger (ログ・デバッグ)                                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Notion API v1 (HTTPS)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Notion Database                         │
├─────────────────────────────────────────────────────────────┤
│ 自動作成されたページとプロパティ                             │
└─────────────────────────────────────────────────────────────┘
```

## 機能一覧

### 📥 データインポート機能
- スプレッドシート行データのNotionページ自動作成
- 既存ページの更新（主キー情報がある場合）
- バッチ処理による高速実行

### 🎯 チェックボックストリガー
- A列チェックボックスによる直感的な操作
- リアルタイム処理実行
- 処理状況のB列記録

### 🔗 カラムマッピング
- スプレッドシートとNotionプロパティの柔軟な対応
- 10種類のNotionデータ型に対応
- 必須項目とオプション項目の設定

### 🛡️ 包括的エラーハンドリング
- 詳細なエラー分類と通知
- 機密情報のマスキング
- リトライ機能とレート制限対応

### ⚙️ 設定管理
- セキュアなAPI認証情報管理
- キャッシュ機能による高速アクセス
- 環境別デプロイメント対応

## 技術仕様

### 開発環境
- **言語**: TypeScript 5.9.2
- **ランタイム**: Google Apps Script V8
- **ビルドツール**: Rollup 4.46.2
- **テスト**: Jest 30.0.5 (178テスト全合格)
- **デプロイ**: clasp 3.0.6

### 外部API
- **Notion API**: v1 (2022-06-28)
- **認証**: Bearer Token (Notion Integration)
- **レート制限**: 3リクエスト/秒対応

### 対応データ型
| Notionプロパティ | スプレッドシート | dataType文字列 | 備考 |
|-----------------|------------------|----------------|------|
| Title           | 文字列           | title          | 必須プロパティ |
| Rich Text       | 文字列           | rich_text      | マークダウン対応 |
| Number          | 数値             | number         | 整数・小数対応 |
| Select          | 文字列           | select         | 選択肢と一致必要 |
| Multi-select    | 文字列           | multi_select   | カンマ区切り |
| Date            | 日付             | date           | ISO8601形式 |
| Checkbox        | Boolean          | checkbox       | TRUE/FALSE |
| URL             | URL文字列        | url            | 形式検証あり |
| Email           | メール文字列      | email          | 形式検証あり |
| Phone           | 電話番号文字列    | phone_number   | 形式検証あり |

## セットアップ

### 前提条件
- Googleアカウント
- Notion アカウント
- Node.js >= 22 (開発時)

### 1. プロジェクトのクローン

```bash
git clone https://github.com/fylufox/Spreadsheet-to-Notion.git
cd Spreadsheet-to-Notion
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. Notion Integration の作成

1. [Notion Developers](https://www.notion.so/my-integrations) にアクセス
2. 「New integration」をクリック
3. Integration名を入力し、権限を設定:
   - Read content: ❌ (不要)
   - Update content: ✅ (必要)
   - Insert content: ✅ (必要)
4. Integration Tokenをコピー

### 4. Notionデータベースの準備

1. Notionで新しいデータベースを作成
2. 必要なプロパティを追加 (例: Name[Title], Age[Number], Department[Select])
3. データベースIDをURLから取得 (`https://notion.so/xxx?v=yyy` の `xxx` 部分)
4. IntegrationをデータベースWithin「共有」設定で追加

### 5. Google Apps Script プロジェクトの作成

```bash
# clasp でログイン
npx clasp login

# 新しいGASプロジェクトを作成
npx clasp create --type standalone --title "Spreadsheet-to-Notion"

# 設定ファイルをコピー
cp .clasp.json.example .clasp-dev.json
```

### 6. スプレッドシートの準備

1. 新しいGoogleスプレッドシートを作成
2. 以下の3つのシートを作成:

**import_data シート**:
```
| A (チェックボックス) | B (主キー) | C (名前) | D (年齢) | E (部署) |
|---------------------|------------|----------|----------|----------|
| ☐                   |            | 田中太郎  | 30       | 開発部    |
| ☐                   |            | 佐藤花子  | 25       | 営業部    |
```

**import_column シート**:
```
| スプレッドシートカラム | Notionプロパティ名 | データ型   | 連携対象 | 必須 |
|----------------------|-------------------|-----------|---------|------|
| C                 | Name              | title     | yes     | yes  |
| d                 | Age               | number    | yes     | no   |
| e                 | Department        | select    | yes     | no   |
```

**config シート**:
```
| 設定項目     | 値                    |
|-------------|----------------------|
| DATABASE_ID | your_database_id_here |
| PROJECT_NAME| Sample Project       |
| VERSION     | 1.0.0                |
```

### 7. ビルドとデプロイ

```bash
# ビルド実行
npm run build

# 開発環境にデプロイ
npm run deploy

# または本番環境にデプロイ
npm run deploy:prod
```

### 8. 認証情報の設定

1. Google Apps Script エディタを開く
2. 左側メニューから「プロジェクトの設定」を選択
3. 「スクリプト プロパティ」セクションで以下を追加:
   - プロパティ: `NOTION_API_TOKEN`
   - 値: 手順3で取得したIntegration Token

### 9. トリガーの設定

GAS エディタで以下の関数を実行:

```javascript
setupTriggers()
```

### 10. 動作確認

1. import_data シートでチェックボックスをクリック
2. 正常に動作すればNotionデータベースにページが作成される
3. エラーが発生した場合は詳細なメッセージが表示される

## 使用方法

### 基本的な使い方

1. **データの準備**: import_data シートにインポートしたいデータを入力
2. **マッピングの確認**: import_column シートでカラム対応を確認・調整
3. **インポート実行**: A列のチェックボックスをクリック
4. **結果確認**: Notionデータベースでページが作成されたことを確認

### カラムマッピングの設定

import_column シートで以下を設定:

- **スプレッドシートカラム**: データシートのヘッダー名
- **Notionプロパティ名**: Notionデータベースのプロパティ名
- **データ型**: Notionプロパティのタイプ
- **連携対象**: "yes" でインポート対象、"no" で除外
- **必須**: "yes" で必須項目（空の場合エラー）

### エラーが発生した場合

システムは詳細なエラーメッセージを表示します:

- **設定エラー**: API Token や Database ID の確認
- **データエラー**: 必須項目の入力や形式の確認
- **権限エラー**: Notion Integration の権限確認
- **API エラー**: ネットワーク接続やNotion側の状況確認

## 開発・カスタマイズ

### 開発環境のセットアップ

```bash
# 依存関係インストール
npm install

# 型チェック
npm run lint

# テスト実行
npm run test

# ローカルビルド
npm run build
```

### テストの実行

```bash
# 全テスト実行
npm run test

# カバレッジ付き実行
npm run test -- --coverage

# 特定テストファイルのみ
npm run test ConfigManager.test.ts
```

### デバッグ機能

GAS エディタで以下のデバッグ関数が利用可能:

```javascript
// システム診断
runDiagnostics()             // 全体的な診断
testConfiguration()          // 設定確認
diagnoseProperties()         // プロパティ診断
diagnoseColumnMappingSheet() // カラムマッピング診断

// トリガー管理
setupTriggers()          // トリガー設定
clearTriggers()          // トリガークリア
showTriggerStatus()      // 現在のトリガー状況

// 手動テスト
testOnEditManually()     // onEdit手動テスト
testTriggerManager()     // TriggerManager テスト
```

### 新しいデータ型の追加

1. `src/types/index.ts` で型定義を追加
2. `src/core/DataMapper.ts` で変換ロジックを実装
3. `src/core/Validator.ts` で検証ルールを追加
4. `test/unit/` でテストケースを作成

## トラブルシューティング

### よくある問題と解決方法

**Q: チェックボックスをクリックしても何も起こらない**
- A: トリガーが正しく設定されているか確認してください (`showTriggerStatus()` で確認可能)

**Q: "API Token not configured" エラーが表示される**
- A: スクリプトプロパティに `NOTION_API_TOKEN` が設定されているか確認してください

**Q: "Database not found" エラーが表示される**
- A: config シートの DATABASE_ID が正しいか、Integration がデータベースに共有されているか確認してください

**Q: データ型エラーが発生する**
- A: import_column シートのデータ型設定と、Notionデータベースのプロパティタイプが一致しているか確認してください

**Q: 権限エラーが発生する**
- A: Notion Integration の権限設定を確認し、必要に応じて「Update content」と「Insert content」を有効にしてください

### ログの確認

GAS エディタの「実行数」タブでログを確認できます。機密情報は自動的にマスキングされます。

### サポート

問題が解決しない場合は、以下の情報とともにIssueを作成してください:

- エラーメッセージの詳細
- スプレッドシートの構成
- Notionデータベースのプロパティ構成
- 実行ログ（機密情報は除く）

## ライセンス

このプロジェクトは Apache License 2.0 の下で公開されています。詳細は [LICENSE](LICENSE) ファイルをご覧ください。

## 更新履歴

### v0.0.1 (2025-08-11)
- 初回リリース
- 基本的なデータインポート機能
- 包括的なエラーハンドリング
- TypeScriptベースの高性能実装
