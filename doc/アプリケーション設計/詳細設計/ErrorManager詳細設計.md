# ErrorManager モジュール詳細設計

## 1. 役割
エラーの分類、ログ記録、ユーザー通知を統合的に管理する。エラーの種類に応じた適切な処理とメッセージ表示を行う。

## 2. 関数

### 2.1 handleError(error, context)
**概要:** エラーの統合処理
**引数:**
- `error` (Error): 発生したエラー
- `context` (string | object): エラー発生コンテキスト
**戻り値:** `ErrorHandlingResult`

```javascript
function handleError(error, context = {}) {
  try {
    // エラー分類
    const errorType = classifyError(error);
    
    // ログ記録
    Logger.error(`${errorType}: ${error.message}`, {
      context,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    // ユーザー通知
    const userMessage = generateUserMessage(errorType, error);
    showErrorDialog(userMessage);
    
    // リトライ判定
    const retryInfo = shouldRetry(errorType, error);
    
    return {
      handled: true,
      errorType,
      canRetry: retryInfo.canRetry,
      retryDelay: retryInfo.delay
    };
    
  } catch (handlingError) {
    // エラーハンドリング自体でエラーが発生した場合
    console.error('Error in error handling:', handlingError);
    showErrorDialog('システムエラーが発生しました。管理者にお問い合わせください。');
    
    return { handled: false };
  }
}
```

### 2.2 classifyError(error)
**概要:** エラーの分類
**引数:**
- `error` (Error): 分類対象エラー
**戻り値:** `string` (エラータイプ)

```javascript
function classifyError(error) {
  if (error instanceof ValidationError) {
    return 'VALIDATION_ERROR';
  }
  
  if (error instanceof ConfigError) {
    return 'CONFIG_ERROR';
  }
  
  if (error instanceof ApiError) {
    return classifyApiError(error);
  }
  
  if (error.message?.includes('rate limit')) {
    return 'RATE_LIMIT_ERROR';
  }
  
  if (error.message?.includes('unauthorized') || error.message?.includes('403')) {
    return 'AUTH_ERROR';
  }
  
  if (error.message?.includes('not found') || error.message?.includes('404')) {
    return 'NOT_FOUND_ERROR';
  }
  
  if (error.message?.includes('network') || error.message?.includes('timeout')) {
    return 'NETWORK_ERROR';
  }
  
  if (error.message?.includes('permission') || error.message?.includes('access')) {
    return 'PERMISSION_ERROR';
  }
  
  return 'UNKNOWN_ERROR';
}
```

### 2.3 classifyApiError(apiError)
**概要:** API エラーの詳細分類
**引数:**
- `apiError` (ApiError): API エラー
**戻り値:** `string` (詳細エラータイプ)

```javascript
function classifyApiError(apiError) {
  switch (apiError.statusCode) {
    case 400:
      return 'API_BAD_REQUEST';
    case 401:
      return 'API_UNAUTHORIZED';
    case 403:
      return 'API_FORBIDDEN';
    case 404:
      return 'API_NOT_FOUND';
    case 429:
      return 'API_RATE_LIMITED';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'API_SERVER_ERROR';
    default:
      return 'API_UNKNOWN_ERROR';
  }
}
```

### 2.4 generateUserMessage(errorType, error)
**概要:** ユーザー向けエラーメッセージ生成
**引数:**
- `errorType` (string): エラータイプ
- `error` (Error): エラーオブジェクト
**戻り値:** `string` (ユーザー向けメッセージ)

```javascript
function generateUserMessage(errorType, error) {
  const baseMessages = {
    'VALIDATION_ERROR': 'データの形式に問題があります',
    'CONFIG_ERROR': '設定に問題があります。設定を確認してください',
    'RATE_LIMIT_ERROR': 'APIの利用制限に達しました。しばらく待ってから再試行してください',
    'AUTH_ERROR': '認証に失敗しました。APIトークンを確認してください',
    'NOT_FOUND_ERROR': '指定されたデータベースまたはページが見つかりません',
    'NETWORK_ERROR': 'ネットワーク接続に問題があります。接続を確認してください',
    'PERMISSION_ERROR': '操作に必要な権限がありません。アクセス権限を確認してください',
    'API_BAD_REQUEST': 'リクエストに問題があります。データを確認してください',
    'API_UNAUTHORIZED': 'APIトークンが無効です。新しいトークンを設定してください',
    'API_FORBIDDEN': 'この操作は許可されていません。データベースの権限を確認してください',
    'API_NOT_FOUND': 'データベースまたはページが見つかりません。IDを確認してください',
    'API_RATE_LIMITED': 'API利用制限に達しました。1分程度待ってから再試行してください',
    'API_SERVER_ERROR': 'Notionサーバーで問題が発生しています。しばらく待ってから再試行してください',
    'UNKNOWN_ERROR': '予期しないエラーが発生しました'
  };
  
  let message = baseMessages[errorType] || baseMessages['UNKNOWN_ERROR'];
  
  // 詳細情報の追加
  if (errorType === 'VALIDATION_ERROR' && error.errors) {
    message += '\n\n詳細:\n' + error.errors.join('\n');
  }
  
  if (errorType === 'CONFIG_ERROR' && error.errors) {
    message += '\n\n詳細:\n' + error.errors.join('\n');
  }
  
  // 解決方法の提案
  const suggestion = getSuggestion(errorType);
  if (suggestion) {
    message += '\n\n対処方法:\n' + suggestion;
  }
  
  return message;
}
```

### 2.5 getSuggestion(errorType)
**概要:** エラータイプに応じた解決方法の提案
**引数:**
- `errorType` (string): エラータイプ
**戻り値:** `string | null`

```javascript
function getSuggestion(errorType) {
  const suggestions = {
    'VALIDATION_ERROR': '・データの形式を確認してください\n・必須項目が入力されているか確認してください',
    'CONFIG_ERROR': '・configシートの設定を確認してください\n・APIトークンが正しく設定されているか確認してください',
    'AUTH_ERROR': '・Notion Integrationが正しく作成されているか確認してください\n・APIトークンを再生成してください',
    'NOT_FOUND_ERROR': '・データベースIDが正しいか確認してください\n・データベースがIntegrationと共有されているか確認してください',
    'NETWORK_ERROR': '・インターネット接続を確認してください\n・しばらく待ってから再試行してください',
    'PERMISSION_ERROR': '・スプレッドシートの編集権限があるか確認してください\n・NotionデータベースがIntegrationと共有されているか確認してください'
  };
  
  return suggestions[errorType] || null;
}
```

### 2.6 showErrorDialog(message)
**概要:** エラーダイアログの表示
**引数:**
- `message` (string): 表示するメッセージ
**戻り値:** なし

```javascript
function showErrorDialog(message) {
  try {
    SpreadsheetApp.getUi().alert(
      'エラー',
      message,
      SpreadsheetApp.getUi().Buttons.OK
    );
  } catch (uiError) {
    // UI表示に失敗した場合はコンソールログにフォールバック
    console.error('UI Error:', uiError);
    console.error('Original message:', message);
  }
}
```

### 2.7 shouldRetry(errorType, error)
**概要:** リトライ可能かどうかの判定
**引数:**
- `errorType` (string): エラータイプ
- `error` (Error): エラーオブジェクト
**戻り値:** `RetryInfo`

```javascript
function shouldRetry(errorType, error) {
  const retryableErrors = [
    'RATE_LIMIT_ERROR',
    'NETWORK_ERROR',
    'API_RATE_LIMITED',
    'API_SERVER_ERROR'
  ];
  
  const canRetry = retryableErrors.includes(errorType);
  
  let delay = 0;
  if (canRetry) {
    switch (errorType) {
      case 'RATE_LIMIT_ERROR':
      case 'API_RATE_LIMITED':
        delay = 60000; // 1分
        break;
      case 'NETWORK_ERROR':
        delay = 5000; // 5秒
        break;
      case 'API_SERVER_ERROR':
        delay = 30000; // 30秒
        break;
      default:
        delay = 10000; // 10秒
    }
  }
  
  return { canRetry, delay };
}
```

### 2.8 logError(error, context)
**概要:** エラーの詳細ログ記録
**引数:**
- `error` (Error): エラーオブジェクト
- `context` (object): コンテキスト情報
**戻り値:** なし

```javascript
function logError(error, context = {}) {
  const errorData = {
    message: error.message,
    name: error.name,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    context: context,
    userAgent: Utilities.getUserAgent && Utilities.getUserAgent(),
    sessionId: Session.getTemporaryActiveUserKey && Session.getTemporaryActiveUserKey()
  };
  
  // 機密情報のマスク
  const sanitizedData = sanitizeErrorData(errorData);
  
  Logger.error('Error occurred', sanitizedData);
  
  // 重要なエラーは別途記録
  if (isCriticalError(error)) {
    recordCriticalError(sanitizedData);
  }
}
```

### 2.9 sanitizeErrorData(errorData)
**概要:** エラーデータから機密情報を除去
**引数:**
- `errorData` (object): エラーデータ
**戻り値:** `object` (サニタイズ済みデータ)

```javascript
function sanitizeErrorData(errorData) {
  const sanitized = JSON.parse(JSON.stringify(errorData));
  
  // APIトークンのマスク
  if (sanitized.context && sanitized.context.apiToken) {
    sanitized.context.apiToken = maskSensitiveData(sanitized.context.apiToken);
  }
  
  // スタックトレースから機密情報を除去
  if (sanitized.stack) {
    sanitized.stack = sanitized.stack.replace(
      /secret_[a-zA-Z0-9]+/g, 
      'secret_***'
    );
  }
  
  return sanitized;
}
```

### 2.10 maskSensitiveData(data)
**概要:** 機密データのマスク処理
**引数:**
- `data` (string): マスク対象データ
**戻り値:** `string` (マスク済みデータ)

```javascript
function maskSensitiveData(data) {
  if (typeof data !== 'string' || data.length <= 8) {
    return '***';
  }
  
  return data.substring(0, 8) + '***';
}
```

### 2.11 isCriticalError(error)
**概要:** 重要なエラーかどうかの判定
**引数:**
- `error` (Error): エラーオブジェクト
**戻り値:** `boolean`

```javascript
function isCriticalError(error) {
  const criticalPatterns = [
    'PERMISSION_ERROR',
    'CONFIG_ERROR',
    'AUTH_ERROR'
  ];
  
  const errorType = classifyError(error);
  return criticalPatterns.includes(errorType);
}
```

### 2.12 recordCriticalError(errorData)
**概要:** 重要なエラーの特別記録
**引数:**
- `errorData` (object): エラーデータ
**戻り値:** なし

```javascript
function recordCriticalError(errorData) {
  try {
    // 重要なエラーはスプレッドシートにも記録
    const errorSheet = getOrCreateErrorSheet();
    const timestamp = new Date();
    
    errorSheet.appendRow([
      timestamp,
      errorData.name,
      errorData.message,
      JSON.stringify(errorData.context || {}),
      errorData.sessionId || ''
    ]);
    
  } catch (recordError) {
    console.error('Failed to record critical error:', recordError);
  }
}
```

### 2.13 getOrCreateErrorSheet()
**概要:** エラーログシートの取得または作成
**引数:** なし
**戻り値:** `Sheet`

```javascript
function getOrCreateErrorSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let errorSheet = spreadsheet.getSheetByName('error_log');
  
  if (!errorSheet) {
    errorSheet = spreadsheet.insertSheet('error_log');
    
    // ヘッダー行を設定
    errorSheet.getRange(1, 1, 1, 5).setValues([
      ['Timestamp', 'Error Type', 'Message', 'Context', 'Session ID']
    ]);
    
    // ヘッダー行をフォーマット
    const headerRange = errorSheet.getRange(1, 1, 1, 5);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#f0f0f0');
  }
  
  return errorSheet;
}
```

## 3. データ構造

```typescript
interface ErrorHandlingResult {
  handled: boolean;
  errorType?: string;
  canRetry?: boolean;
  retryDelay?: number;
}

interface RetryInfo {
  canRetry: boolean;
  delay: number;
}

interface ErrorContext {
  rowNumber?: number;
  userId?: string;
  timestamp?: Date;
  operation?: string;
  data?: any;
}

class ConfigError extends Error {
  constructor(message: string, public errors?: string[], public originalError?: Error) {
    super(message);
    this.name = 'ConfigError';
  }
}

class ApiError extends Error {
  constructor(
    message: string, 
    public statusCode: number, 
    public responseBody: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class ValidationError extends Error {
  constructor(message: string, public errors: string[]) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

## 4. プロパティ/変数

```javascript
const ERROR_MANAGER = {
  // エラー履歴（デバッグ用）
  errorHistory: [],
  
  // エラー統計
  errorStats: {
    totalErrors: 0,
    errorsByType: {},
    lastErrorTime: null
  },
  
  // 設定
  CONFIG: {
    MAX_HISTORY_SIZE: 100,
    CRITICAL_ERROR_THRESHOLD: 5, // 5分間に5回で重要度アップ
    LOG_RETENTION_DAYS: 30
  },
  
  // エラータイプの優先度
  ERROR_PRIORITY: {
    'UNKNOWN_ERROR': 1,
    'NETWORK_ERROR': 2,
    'RATE_LIMIT_ERROR': 3,
    'VALIDATION_ERROR': 4,
    'CONFIG_ERROR': 5,
    'AUTH_ERROR': 6,
    'PERMISSION_ERROR': 7
  }
};
```

## 5. エラーハンドリング

### 5.1 自己エラー処理
ErrorManager自体でエラーが発生した場合の処理：
- フォールバック処理による最低限の通知
- 無限ループの防止
- システムの継続性確保

### 5.2 ログレベル管理
```javascript
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};
```

## 6. 監視・分析機能

### 6.1 エラー傾向分析
```javascript
function analyzeErrorTrends() {
  const recentErrors = getRecentErrors(24); // 24時間以内
  
  return {
    totalCount: recentErrors.length,
    frequentTypes: getFrequentErrorTypes(recentErrors),
    timeDistribution: getErrorTimeDistribution(recentErrors),
    suggestions: generateImprovementSuggestions(recentErrors)
  };
}
```

### 6.2 アラート機能
```javascript
function checkErrorThreshold() {
  const recentErrors = getRecentErrors(1); // 1時間以内
  
  if (recentErrors.length >= ERROR_MANAGER.CONFIG.CRITICAL_ERROR_THRESHOLD) {
    sendAlert('エラー頻発アラート', `1時間以内に${recentErrors.length}件のエラーが発生しています`);
  }
}
```

## 7. 依存関係

### 7.1 依存モジュール
- Logger: ログ出力
- ConfigManager: 設定取得

### 7.2 外部依存
- SpreadsheetApp: UI表示、シート操作
- Utilities: ユーザーエージェント取得
- Session: セッション情報取得

## 8. テスト観点

### 8.1 単体テスト項目
- 各エラータイプの分類精度
- ユーザーメッセージの適切性
- リトライ判定の正確性
- 機密情報のマスク処理

### 8.2 統合テスト項目
- 実際のエラーシナリオでの動作
- UI表示の正常性
- ログ記録の整合性
