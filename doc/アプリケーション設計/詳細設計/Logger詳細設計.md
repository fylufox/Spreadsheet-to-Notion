# Logger モジュール詳細設計

## 1. 概要

### 1.1 役割
ログ管理を担当する静的クラス。デバッグ情報、エラー情報、パフォーマンス計測、実行状況の記録を行う。ErrorManagerの機能を統合し、包括的なログ管理を提供する。

### 1.2 設計パターン
- **静的クラス設計:** インスタンス化不要、グローバルアクセス
- **レベル別ログ管理:** DEBUG, INFO, WARN, ERROR の4段階
- **パフォーマンス計測:** タイマー機能による処理時間計測
- **構造化ログ:** 検索・分析しやすい形式でのログ出力

## 2. 主要メソッド

### 2.1 ログレベル別出力メソッド

#### debug(message: string, data?: any): void
```typescript
static debug(message: string, data?: any): void {
  if (this.currentLogLevel <= LogLevel.DEBUG) {
    this.writeLog(LogLevel.DEBUG, message, data);
  }
}
```

#### info(message: string, data?: any): void
```typescript
static info(message: string, data?: any): void {
  if (this.currentLogLevel <= LogLevel.INFO) {
    this.writeLog(LogLevel.INFO, message, data);
  }
}
```

#### warn(message: string, data?: any): void
```typescript
static warn(message: string, data?: any): void {
  if (this.currentLogLevel <= LogLevel.WARN) {
    this.writeLog(LogLevel.WARN, message, data);
  }
}
```

#### error(message: string, data?: any): void
```typescript
static error(message: string, data?: any): void {
  if (this.currentLogLevel <= LogLevel.ERROR) {
    this.writeLog(LogLevel.ERROR, message, data);
  }
}
```

### 2.2 エラー専用ログメソッド

#### logError(context: string, error: any, additionalData?: any): void
```typescript
static logError(context: string, error: any, additionalData?: any): void {
  const errorData = {
    context,
    timestamp: new Date().toISOString(),
    errorType: error?.constructor?.name || 'Unknown',
    message: error?.message || String(error),
    stack: error?.stack || null,
    additionalData
  };
  
  // エラー詳細の解析
  if (error instanceof Error) {
    errorData.name = error.name;
    
    // 特定エラータイプの追加情報
    if (error.name === 'NotionApiError') {
      errorData.statusCode = (error as any).statusCode;
      errorData.responseBody = (error as any).responseBody;
    } else if (error.name === 'ValidationError') {
      errorData.validationErrors = (error as any).errors;
    }
  }
  
  this.writeLog(LogLevel.ERROR, `Error in ${context}`, errorData);
  
  // クリティカルエラーの場合は特別な処理
  if (this.isCriticalError(error)) {
    this.handleCriticalError(context, errorData);
  }
}
```

#### logWarning(context: string, message: string, data?: any): void
```typescript
static logWarning(context: string, message: string, data?: any): void {
  this.writeLog(LogLevel.WARN, `Warning in ${context}: ${message}`, data);
}
```

### 2.3 パフォーマンス計測メソッド

#### startTimer(label: string): void
```typescript
static startTimer(label: string): void {
  this.timers.set(label, {
    startTime: Date.now(),
    label
  });
  
  if (this.currentLogLevel <= LogLevel.DEBUG) {
    this.debug(`Timer started: ${label}`);
  }
}
```

#### endTimer(label: string): number
```typescript
static endTimer(label: string): number {
  const timer = this.timers.get(label);
  if (!timer) {
    this.warn(`Timer not found: ${label}`);
    return 0;
  }
  
  const duration = Date.now() - timer.startTime;
  this.timers.delete(label);
  
  this.info(`Timer completed: ${label}`, {
    duration: `${duration}ms`,
    startTime: new Date(timer.startTime).toISOString()
  });
  
  // パフォーマンス統計に記録
  this.recordPerformanceMetric(label, duration);
  
  return duration;
}
```

#### recordPerformanceMetric(operation: string, duration: number): void
```typescript
private static recordPerformanceMetric(operation: string, duration: number): void {
  if (!this.performanceStats.has(operation)) {
    this.performanceStats.set(operation, {
      count: 0,
      totalTime: 0,
      minTime: Infinity,
      maxTime: 0,
      avgTime: 0
    });
  }
  
  const stats = this.performanceStats.get(operation)!;
  stats.count++;
  stats.totalTime += duration;
  stats.minTime = Math.min(stats.minTime, duration);
  stats.maxTime = Math.max(stats.maxTime, duration);
  stats.avgTime = stats.totalTime / stats.count;
  
  // 異常に遅い処理を警告
  if (duration > CONSTANTS.PERFORMANCE.SLOW_OPERATION_THRESHOLD) {
    this.warn(`Slow operation detected: ${operation}`, {
      duration: `${duration}ms`,
      threshold: `${CONSTANTS.PERFORMANCE.SLOW_OPERATION_THRESHOLD}ms`
    });
  }
}
```

### 2.4 ログ出力・管理メソッド

#### writeLog(level: LogLevel, message: string, data?: any): void
```typescript
private static writeLog(level: LogLevel, message: string, data?: any): void {
  const timestamp = new Date().toISOString();
  const logEntry: LogEntry = {
    timestamp,
    level: LogLevel[level],
    message,
    data: data ? this.sanitizeLogData(data) : undefined
  };
  
  // コンソール出力
  this.outputToConsole(logEntry);
  
  // ログバッファに保存
  this.logBuffer.push(logEntry);
  
  // バッファサイズ制限
  if (this.logBuffer.length > CONSTANTS.LOG.MAX_BUFFER_SIZE) {
    this.logBuffer.shift();
  }
  
  // エラーレベルの場合は即座にスプレッドシートに記録
  if (level >= LogLevel.ERROR) {
    this.writeToSpreadsheet(logEntry);
  }
}
```

#### sanitizeLogData(data: any): any
```typescript
private static sanitizeLogData(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  const sanitized = { ...data };
  
  // 機密情報をマスク
  const sensitiveKeys = ['apiToken', 'password', 'secret', 'token', 'key'];
  sensitiveKeys.forEach(key => {
    if (key in sanitized) {
      sanitized[key] = this.maskSensitiveValue(sanitized[key]);
    }
  });
  
  // 循環参照を防ぐ
  try {
    JSON.stringify(sanitized);
    return sanitized;
  } catch (error) {
    return '[Circular Reference or Invalid Object]';
  }
}
```

#### maskSensitiveValue(value: any): string
```typescript
private static maskSensitiveValue(value: any): string {
  const str = String(value);
  if (str.length <= 4) {
    return '****';
  }
  return `${str.substring(0, 2)}****${str.substring(str.length - 2)}`;
}
```

### 2.5 ログ分析・レポート機能

#### getPerformanceReport(): PerformanceReport
```typescript
static getPerformanceReport(): PerformanceReport {
  const report: PerformanceReport = {
    generatedAt: new Date().toISOString(),
    operations: []
  };
  
  this.performanceStats.forEach((stats, operation) => {
    report.operations.push({
      operation,
      count: stats.count,
      totalTime: stats.totalTime,
      avgTime: Math.round(stats.avgTime * 100) / 100,
      minTime: stats.minTime,
      maxTime: stats.maxTime
    });
  });
  
  // 平均時間でソート
  report.operations.sort((a, b) => b.avgTime - a.avgTime);
  
  return report;
}
```

#### getRecentLogs(count: number = 100): LogEntry[]
```typescript
static getRecentLogs(count: number = 100): LogEntry[] {
  return this.logBuffer.slice(-count);
}
```

#### clearLogs(): void
```typescript
static clearLogs(): void {
  this.logBuffer = [];
  this.performanceStats.clear();
  this.timers.clear();
  this.info('Log buffer and performance stats cleared');
}
```

#### exportLogs(): string
```typescript
static exportLogs(): string {
  const exportData = {
    exportedAt: new Date().toISOString(),
    logLevel: LogLevel[this.currentLogLevel],
    logs: this.logBuffer,
    performanceStats: Object.fromEntries(this.performanceStats)
  };
  
  return JSON.stringify(exportData, null, 2);
}
```

## 3. 型定義

```typescript
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: any;
}

interface TimerEntry {
  startTime: number;
  label: string;
}

interface PerformanceStats {
  count: number;
  totalTime: number;
  minTime: number;
  maxTime: number;
  avgTime: number;
}

interface PerformanceReport {
  generatedAt: string;
  operations: Array<{
    operation: string;
    count: number;
    totalTime: number;
    avgTime: number;
    minTime: number;
    maxTime: number;
  }>;
}
```

## 4. クラス内部状態

```typescript
class Logger {
  private static currentLogLevel: LogLevel = LogLevel.INFO;
  private static logBuffer: LogEntry[] = [];
  private static timers: Map<string, TimerEntry> = new Map();
  private static performanceStats: Map<string, PerformanceStats> = new Map();
  
  // 設定メソッド
  static setLogLevel(level: LogLevel): void {
    this.currentLogLevel = level;
    this.info(`Log level changed to: ${LogLevel[level]}`);
  }
  
  static getLogLevel(): LogLevel {
    return this.currentLogLevel;
  }
}
```

## 5. エラーハンドリング

### 5.1 クリティカルエラー対応
```typescript
private static isCriticalError(error: any): boolean {
  if (error?.name === 'NotionApiError' && error?.statusCode === 401) {
    return true; // 認証エラー
  }
  
  if (error?.message?.includes('quota exceeded')) {
    return true; // API制限エラー
  }
  
  return false;
}

private static handleCriticalError(context: string, errorData: any): void {
  // 重要なエラーは即座にスプレッドシートに記録
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ErrorLog');
    if (sheet) {
      sheet.appendRow([
        errorData.timestamp,
        'CRITICAL',
        context,
        errorData.message,
        JSON.stringify(errorData.additionalData || {})
      ]);
    }
  } catch (logError) {
    console.error('Failed to log critical error to spreadsheet:', logError);
  }
}
```

### 5.2 ログ出力エラー対応
```typescript
private static outputToConsole(logEntry: LogEntry): void {
  try {
    const output = `[${logEntry.timestamp}] ${logEntry.level}: ${logEntry.message}`;
    
    switch (logEntry.level) {
      case 'DEBUG':
        console.log(output, logEntry.data || '');
        break;
      case 'INFO':
        console.info(output, logEntry.data || '');
        break;
      case 'WARN':
        console.warn(output, logEntry.data || '');
        break;
      case 'ERROR':
        console.error(output, logEntry.data || '');
        break;
    }
  } catch (error) {
    // コンソール出力失敗は無視（無限ループ防止）
  }
}
```

## 6. パフォーマンス特性

### 6.1 計算量
- ログ出力: O(1) (バッファサイズ制限により)
- タイマー操作: O(1) (Map操作)
- パフォーマンス統計: O(1) (集計更新)

### 6.2 メモリ管理
- ログバッファ制限: 最大1000件
- タイマー自動クリーンアップ
- 統計データの圧縮保存

## 7. 設定・カスタマイズ

### 7.1 ログレベル設定
```typescript
// 本番環境: INFO以上のみ
Logger.setLogLevel(LogLevel.INFO);

// 開発環境: 全ログ出力
Logger.setLogLevel(LogLevel.DEBUG);

// エラーのみ: ERROR以上のみ
Logger.setLogLevel(LogLevel.ERROR);
```

### 7.2 パフォーマンス監視設定
```typescript
// 遅い処理の閾値設定
CONSTANTS.PERFORMANCE = {
  SLOW_OPERATION_THRESHOLD: 5000, // 5秒
  VERY_SLOW_OPERATION_THRESHOLD: 10000 // 10秒
};
```

## 8. 使用例

### 8.1 基本的なログ出力
```typescript
Logger.info('Process started', { userId: 'user123', action: 'sync' });
Logger.warn('Validation warning', { field: 'email', value: 'invalid@' });
Logger.error('API request failed', { endpoint: '/pages', statusCode: 404 });
```

### 8.2 パフォーマンス計測
```typescript
Logger.startTimer('data-processing');
// 処理実行
const duration = Logger.endTimer('data-processing');
console.log(`Processing took ${duration}ms`);
```

### 8.3 エラー処理とログ
```typescript
try {
  await NotionApiClient.createPage(databaseId, pageData);
} catch (error) {
  Logger.logError('TriggerManager.syncToNotion', error, {
    databaseId,
    pageCount: pageData.length
  });
  throw error;
}
```

## 9. テスト戦略

### 9.1 単体テスト (Logger.test.ts)
- ログレベル別出力テスト
- タイマー機能テスト
- データサニタイズテスト
- パフォーマンス統計テスト

### 9.2 統合テスト
- 実際のエラー処理でのログ出力
- 長時間実行でのメモリ使用量
- 大量ログ出力のパフォーマンス

## 10. 関連モジュール

### 10.1 使用箇所
- **全モジュール:** 統一的なログ出力
- **TriggerManager:** 処理進行状況の記録
- **NotionApiClient:** API通信エラーの詳細記録
- **DataMapper:** データ変換処理の追跡
- **Validator:** 検証エラーの詳細記録
- **ConfigManager:** 設定変更の記録

### 10.2 外部依存
- **console:** ブラウザ・サーバーコンソール出力
- **SpreadsheetApp:** エラーログシート書き込み
- **JSON:** 構造化データのシリアライズ
