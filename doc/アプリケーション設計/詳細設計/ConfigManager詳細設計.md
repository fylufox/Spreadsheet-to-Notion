# ConfigManager モジュール詳細設計

## 1. 役割
システム設定情報の取得・管理を行う。スプレッドシートの設定シートとGASプロパティサービスから設定を読み込み、統合された設定オブジェクトを提供する。

## 2. 関数

### 2.1 getConfig()
**概要:** システム設定情報を取得
**引数:** なし
**戻り値:** `Promise<SystemConfig>`
**処理内容:**
1. 設定シートからデータベースID等を取得
2. GASプロパティからAPIトークンを取得
3. 設定の検証・統合

```javascript
async function getConfig() {
  try {
    const configSheet = getConfigSheet();
    const config = {
      databaseId: getConfigValue(configSheet, 'DATABASE_ID'),
      projectName: getConfigValue(configSheet, 'PROJECT_NAME'),
      version: getConfigValue(configSheet, 'VERSION'),
      apiToken: getApiToken()
    };
    
    validateConfig(config);
    return config;
    
  } catch (error) {
    throw new ConfigError('Failed to load configuration', error);
  }
}
```

### 2.2 getApiToken()
**概要:** Notion APIトークンを安全に取得
**引数:** なし
**戻り値:** `string`
**処理内容:**
1. GASプロパティサービスからトークン取得
2. トークンの存在・形式チェック

```javascript
function getApiToken() {
  const token = PropertiesService
    .getScriptProperties()
    .getProperty('NOTION_API_TOKEN');
    
  if (!token) {
    throw new ConfigError('Notion API token not configured');
  }
  
  if (!token.startsWith('secret_')) {
    throw new ConfigError('Invalid API token format');
  }
  
  return token;
}
```

### 2.3 getColumnMappings()
**概要:** カラムマッピング設定を取得
**引数:** なし
**戻り値:** `Array<ColumnMapping>`

```javascript
function getColumnMappings() {
  const mappingSheet = getSheet(CONSTANTS.SHEETS.IMPORT_COLUMN);
  const data = mappingSheet.getDataRange().getValues();
  
  // ヘッダー行をスキップして処理
  return data.slice(1).map(row => ({
    spreadsheetColumn: row[0],
    notionPropertyName: row[1],
    dataType: row[2],
    isTarget: row[3] === 'Yes',
    isRequired: row[4] === 'Yes'
  }));
}
```

### 2.4 setApiToken(token)
**概要:** Notion APIトークンを設定
**引数:**
- `token` (string): 設定するAPIトークン
**戻り値:** `boolean` (設定成功可否)

```javascript
function setApiToken(token) {
  try {
    if (!token || !token.startsWith('secret_')) {
      throw new ConfigError('Invalid API token format');
    }
    
    PropertiesService
      .getScriptProperties()
      .setProperty('NOTION_API_TOKEN', token);
    
    return true;
  } catch (error) {
    Logger.error('Failed to set API token', error);
    return false;
  }
}
```

### 2.5 getConfigSheet()
**概要:** 設定シートを取得
**引数:** なし
**戻り値:** `Sheet`

```javascript
function getConfigSheet() {
  return getSheet(CONSTANTS.SHEETS.CONFIG);
}
```

### 2.6 getSheet(sheetName)
**概要:** 指定名のシートを取得
**引数:**
- `sheetName` (string): シート名
**戻り値:** `Sheet`

```javascript
function getSheet(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(sheetName);
  
  if (!sheet) {
    throw new ConfigError(`Required sheet '${sheetName}' not found`);
  }
  
  return sheet;
}
```

### 2.7 getConfigValue(sheet, key)
**概要:** 設定シートから特定の設定値を取得
**引数:**
- `sheet` (Sheet): 設定シート
- `key` (string): 設定キー
**戻り値:** `string | null`

```javascript
function getConfigValue(sheet, key) {
  const data = sheet.getDataRange().getValues();
  
  for (const row of data) {
    if (row[0] === key) {
      return row[1];
    }
  }
  
  return null;
}
```

### 2.8 validateConfig(config)
**概要:** 設定情報の検証
**引数:**
- `config` (SystemConfig): 検証対象の設定
**戻り値:** `boolean`

```javascript
function validateConfig(config) {
  const requiredFields = ['databaseId', 'apiToken'];
  
  for (const field of requiredFields) {
    if (!config[field]) {
      throw new ConfigError(`Required configuration '${field}' is missing`);
    }
  }
  
  // データベースIDの形式チェック
  if (!config.databaseId.match(/^[a-f0-9]{32}$/)) {
    throw new ConfigError('Invalid database ID format');
  }
  
  return true;
}
```

### 2.9 updateConfigValue(key, value)
**概要:** 設定値を更新
**引数:**
- `key` (string): 設定キー
- `value` (string): 設定値
**戻り値:** `boolean`

```javascript
function updateConfigValue(key, value) {
  try {
    const sheet = getConfigSheet();
    const data = sheet.getDataRange().getValues();
    
    let rowIndex = -1;
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === key) {
        rowIndex = i + 1; // 1-indexed
        break;
      }
    }
    
    if (rowIndex === -1) {
      // 新規追加
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, 1, 2).setValues([[key, value]]);
    } else {
      // 既存更新
      sheet.getRange(rowIndex, 2).setValue(value);
    }
    
    return true;
  } catch (error) {
    Logger.error('Failed to update config value', { key, value, error });
    return false;
  }
}
```

## 3. データ構造

```typescript
interface SystemConfig {
  databaseId: string;
  projectName: string;
  version: string;
  apiToken: string;
}

interface ColumnMapping {
  spreadsheetColumn: string;
  notionPropertyName: string;
  dataType: string;
  isTarget: boolean;
  isRequired: boolean;
}

class ConfigError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'ConfigError';
  }
}
```

## 4. プロパティ/変数

```javascript
const CONFIG_MANAGER = {
  // キャッシュされた設定（パフォーマンス向上用）
  cachedConfig: null,
  cacheExpiry: 0,
  
  // キャッシュ有効期間（ミリ秒）
  CACHE_DURATION: 5 * 60 * 1000, // 5分
  
  // 必須設定項目
  REQUIRED_CONFIG_KEYS: [
    'DATABASE_ID',
    'PROJECT_NAME'
  ],
  
  // デフォルト設定値
  DEFAULT_VALUES: {
    VERSION: '1.0.0',
    PROJECT_NAME: 'Notion Import Project'
  }
};
```

## 5. エラーハンドリング

### 5.1 処理可能なエラー
- 設定ファイル不正（CONFIG_FORMAT_ERROR）
- 必須項目欠損（CONFIG_MISSING_ERROR）
- APIトークン無効（TOKEN_INVALID_ERROR）
- シートアクセスエラー（SHEET_ACCESS_ERROR）

### 5.2 エラー処理方針
- 設定エラーは即座にユーザーに通知
- 修復可能な設定は自動修復を試行
- 詳細なエラー情報をログに記録

## 6. セキュリティ考慮事項

### 6.1 認証情報保護
- APIトークンはGASプロパティサービスで暗号化保存
- ログ出力時はトークンをマスク
- 設定シートには機密情報を保存しない

### 6.2 アクセス制御
- 設定変更はスプレッドシート所有者のみ
- APIトークンの読み取りは必要最小限に制限

## 7. 依存関係

### 7.1 依存モジュール
- Logger: ログ出力
- Constants: 定数定義

### 7.2 外部依存
- PropertiesService: GAS設定保存
- SpreadsheetApp: スプレッドシートアクセス

## 8. テスト観点

### 8.1 単体テスト項目
- 正常な設定取得
- 設定項目欠損時のエラー
- 不正なAPIトークン形式の検出
- シート不存在時のエラー

### 8.2 統合テスト項目
- 実際のスプレッドシートでの設定取得
- GASプロパティサービスとの連携
