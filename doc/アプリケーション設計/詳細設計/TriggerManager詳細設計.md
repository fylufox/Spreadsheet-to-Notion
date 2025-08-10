# TriggerManager モジュール詳細設計

## 1. 役割
スプレッドシートのトリガーイベントを処理し、メインの制御フローを管理する。チェックボックスクリックイベントを検知し、適切な処理を実行する。

## 2. 関数

### 2.1 onEdit(e)
**概要:** スプレッドシート編集時のトリガー関数
**引数:** 
- `e` (Event): 編集イベントオブジェクト
**戻り値:** なし
**処理内容:**
1. 編集位置がチェックボックス列かチェック
2. チェックボックスがONになった場合のみ処理実行
3. セキュリティチェック (アクセス権限確認)
4. 設定情報取得・検証
5. データインポート処理実行

```javascript
function onEdit(e) {
  try {
    // セキュリティチェック
    SecurityManager.validateAccess();
    
    // チェックボックス列の編集かチェック
    if (!isCheckboxColumn(e.range)) return;
    
    // チェックONの場合のみ処理
    if (!e.value) return;
    
    // メイン処理実行
    processImport(e.range.getRow());
    
  } catch (error) {
    ErrorManager.handleError(error, 'onEdit');
  }
}
```

### 2.2 processImport(rowNumber)
**概要:** 指定行のデータインポート処理
**引数:**
- `rowNumber` (number): 処理対象行番号
**戻り値:** `Promise<ImportResult>`
**処理内容:**
1. 行データ取得
2. カラムマッピング取得
3. データ変換・検証
4. Notion API実行
5. 結果の記録・通知

```javascript
async function processImport(rowNumber) {
  const context = { rowNumber, timestamp: new Date() };
  
  try {
    // 設定取得
    const config = await ConfigManager.getConfig();
    const mappings = await ConfigManager.getColumnMappings();
    
    // データ取得・変換
    const rowData = getRowData(rowNumber);
    const notionData = DataMapper.mapToNotionFormat(rowData, mappings);
    
    // 検証
    Validator.validateRowData(rowData, mappings);
    
    // API実行
    const primaryKey = rowData[CONSTANTS.COLUMNS.PRIMARY_KEY];
    let result;
    
    if (primaryKey) {
      result = await NotionApiClient.updatePage(primaryKey, notionData);
    } else {
      result = await NotionApiClient.createPage(config.databaseId, notionData);
      // 主キーを記録
      recordPrimaryKey(rowNumber, result.id);
    }
    
    // 成功通知
    showSuccessMessage('データの連携が完了しました');
    return { success: true, result };
    
  } catch (error) {
    ErrorManager.handleError(error, context);
    return { success: false, error };
  }
}
```

### 2.3 isCheckboxColumn(range)
**概要:** 編集された範囲がチェックボックス列かどうかをチェック
**引数:**
- `range` (Range): 編集された範囲
**戻り値:** `boolean`

```javascript
function isCheckboxColumn(range) {
  return range.getColumn() === CONSTANTS.COLUMNS.CHECKBOX;
}
```

### 2.4 getRowData(rowNumber)
**概要:** 指定行からデータを取得
**引数:**
- `rowNumber` (number): 行番号
**戻り値:** `Array<any>` (行データ)

```javascript
function getRowData(rowNumber) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(CONSTANTS.SHEETS.IMPORT_DATA);
  
  const lastColumn = sheet.getLastColumn();
  const range = sheet.getRange(rowNumber, 1, 1, lastColumn);
  
  return range.getValues()[0];
}
```

### 2.5 recordPrimaryKey(rowNumber, pageId)
**概要:** 作成されたNotionページIDを主キー列に記録
**引数:**
- `rowNumber` (number): 行番号
- `pageId` (string): NotionページID
**戻り値:** なし

```javascript
function recordPrimaryKey(rowNumber, pageId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(CONSTANTS.SHEETS.IMPORT_DATA);
  
  sheet.getRange(rowNumber, CONSTANTS.COLUMNS.PRIMARY_KEY)
    .setValue(pageId);
}
```

### 2.6 showSuccessMessage(message)
**概要:** 成功メッセージをユーザーに表示
**引数:**
- `message` (string): 表示するメッセージ
**戻り値:** なし

```javascript
function showSuccessMessage(message) {
  SpreadsheetApp.getUi().alert('成功', message, SpreadsheetApp.getUi().Buttons.OK);
}
```

## 3. データ構造

```typescript
interface ImportResult {
  success: boolean;
  result?: NotionPageResponse;
  error?: Error;
}

interface ImportContext {
  rowNumber: number;
  timestamp: Date;
  userId?: string;
}

interface Event {
  range: Range;
  value: any;
  oldValue?: any;
  source: Spreadsheet;
  user: User;
}
```

## 4. プロパティ/変数

```javascript
const TRIGGER_MANAGER = {
  // 処理中フラグ (重複実行防止)
  isProcessing: false,
  
  // 最後の処理時刻 (レート制限用)
  lastProcessTime: 0,
  
  // エラー履歴 (デバッグ用)
  errorHistory: []
};
```

## 5. エラーハンドリング

### 5.1 処理可能なエラー
- 設定エラー（CONFIG_ERROR）
- データ検証エラー（VALIDATION_ERROR）
- API接続エラー（API_ERROR）
- 権限エラー（PERMISSION_ERROR）

### 5.2 エラー処理方針
- すべてのエラーはErrorManager.handleError()に委譲
- ユーザーにはわかりやすいメッセージで通知
- 詳細なエラー情報はログに記録

## 6. 依存関係

### 6.1 依存モジュール
- ConfigManager: 設定情報の取得
- DataMapper: データ変換処理
- Validator: データ検証
- NotionApiClient: Notion API通信
- ErrorManager: エラーハンドリング
- SecurityManager: セキュリティチェック

### 6.2 外部依存
- Google Apps Script API
- SpreadsheetApp サービス
- PropertiesService
