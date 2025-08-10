# スプレッドシート to Notion 同期トラブルシューティングガイド

## 症状
onEdit関数は実行され正常に完了しているが、同期処理が行われていない。

## 修正内容

### 1. onEdit関数の修正
- TriggerManagerの呼び出しを有効化
- 非同期処理に対応
- より詳細なログ出力を追加

### 2. デバッグ機能の追加
以下の関数がindex.tsに追加されました：

#### `runDiagnostics()`
システム全体の診断を実行します。
```javascript
runDiagnostics()
```

#### `testConfiguration()`
設定情報をテストします。
```javascript
testConfiguration()
```

#### `testTriggerManager()`
TriggerManagerの動作をテストします。
```javascript
testTriggerManager()
```

#### `testOnEditManually(rowNumber)`
手動でonEdit処理をテストします。
```javascript
testOnEditManually(2)  // 2行目をテスト
```

## 診断手順

### Step 1: システム診断の実行
1. Google Apps Scriptエディタを開く
2. Apps Script実行環境で以下を実行：
```javascript
runDiagnostics()
```

### Step 2: 設定確認
診断結果を確認し、以下をチェック：
- 必要なシートが存在するか
- 設定値が正しく設定されているか
- Notion APIトークンが設定されているか

### Step 3: 手動テスト
```javascript
testOnEditManually(2)
```

### Step 4: 実際のonEdit確認
1. スプレッドシートのA列（チェックボックス列）をクリック
2. チェックを入れる
3. ログを確認

## よくある問題と解決策

### 1. チェックボックス列が認識されない
**確認点:**
- チェックボックスがA列（1列目）にあることを確認
- セルの形式がチェックボックスになっていることを確認

### 2. 設定が読み込まれない
**確認点:**
- `config`シートが存在することを確認
- DATABASE_ID, PROJECT_NAME, VERSIONが設定されていることを確認

### 3. Notion APIトークンが設定されていない
**解決策:**
```javascript
// GASエディタで実行
PropertiesService.getScriptProperties().setProperty('NOTION_API_TOKEN', 'your_token_here');
```

### 4. カラムマッピングが読み込まれない
**確認点:**
- `import_column`シートが存在することを確認
- マッピング設定が正しい形式で入力されていることを確認

## ログの確認方法

### GAS実行トランスクリプトの確認
1. Apps Scriptエディタで「実行」→「実行トランスクリプト」
2. onEdit実行時のログを確認

### コンソールログの確認
1. `console.log()`の出力を確認
2. エラーメッセージを確認

## 重要な設定項目

### スプレッドシート構造
```
A列: チェックボックス（同期トリガー）
B列: Notion Page ID（主キー）
C列以降: データ列
```

### 必要なシート
- `import_data`: データ行
- `import_column`: カラムマッピング設定
- `config`: システム設定

### GASプロパティ
```
NOTION_API_TOKEN: Notion APIトークン
```

## 次のステップ

修正後は以下の手順で動作確認：

1. `runDiagnostics()`でシステム状態を確認
2. 設定に問題がある場合は修正
3. `testOnEditManually(2)`で手動テスト
4. 実際のチェックボックス操作でテスト
5. Notionデータベースで結果を確認

問題が継続する場合は、診断結果のログを確認し、具体的なエラーメッセージに基づいて対処してください。
