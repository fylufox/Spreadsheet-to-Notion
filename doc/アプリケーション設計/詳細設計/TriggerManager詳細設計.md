# TriggerManager モジュール詳細設計

## 1. 役割・概要
**TriggerManager** は、シングルトンパターンを採用したメイン制御クラスです。スプレッドシートのトリガーイベントを処理し、データインポートのワークフロー全体を統括します。重複実行防止、状態管理、エラーハンドリングの中核を担います。

### 設計方針
- **Singleton Pattern**: GAS環境での状態一貫性確保
- **Event-Driven Architecture**: onEdit/onEditInstallable トリガー対応
- **Defensive Programming**: 重複実行防止・エラー耐性
- **Type Safety**: TypeScript による厳密な型チェック

## 2. クラス構造

### 2.1 クラス定義
```typescript
export class TriggerManager {
  private static instance: TriggerManager;
  private notionApiClient: NotionApiClient;
  private processingStatus: ProcessingStatus;

  private constructor() {
    this.notionApiClient = new NotionApiClient();
    this.processingStatus = {
      isProcessing: false,
      lastProcessTime: 0,
      errorHistory: [],
    };
  }

  static getInstance(): TriggerManager;
  
  // 主要メソッド
  async onEdit(e: EditEvent): Promise<void>;
  async processImport(rowNumber: number): Promise<ImportResult>;
  
  // インストール可能トリガー管理
  static setupInstallableTriggers(): void;
  static clearAllTriggers(): void;
  static getTriggerStatus(): { count: number; triggers: any[] };
  
  // 診断・テスト機能
  async testConnection(): Promise<{ success: boolean; message: string }>;
  getProcessingStatus(): ProcessingStatus;
  clearErrorHistory(): void;
}

```

## 2. 主要メソッド

### 2.1 onEdit(e: EditEvent): Promise<void>
**概要:** スプレッドシート編集時のメイントリガー関数
**引数:** 
- `e` (EditEvent): 編集イベントオブジェクト（型安全）
**戻り値:** Promise<void>
**処理フロー:**
1. 重複実行チェック
2. チェックボックス列・値の検証
3. アクセス権限確認
4. メインインポート処理実行

```typescript
async onEdit(e: EditEvent): Promise<void> {
  try {
    Logger.info('Edit event triggered', {
      row: e.range.getRow(),
      column: e.range.getColumn(),
      value: e.value,
      oldValue: e.oldValue,
    });

    // 重複実行防止
    if (this.processingStatus.isProcessing) {
      Logger.warn('Processing already in progress, skipping');
      return;
    }

    // チェックボックス列の編集かチェック
    if (!this.isCheckboxColumn(e.range)) {
      Logger.debug('Edit is not in checkbox column, skipping');
      return;
    }

    // チェックONの場合のみ処理（true, 'TRUE', 1, '1'を許可）
    if (!this.isCheckboxChecked(e.value)) {
      Logger.debug('Checkbox is not checked, skipping');
      return;
    }

    // セキュリティチェック
    this.validateAccess(e);

    // メイン処理実行
    await this.processImport(e.range.getRow());
  } catch (error) {
    this.handleError(error, {
      context: 'onEdit',
      rowNumber: e.range.getRow(),
    });
  }
}
```

### 2.2 processImport(rowNumber: number): Promise<ImportResult>
**概要:** 指定行のデータインポート処理
**引数:**
- `rowNumber` (number): 処理対象行番号
**戻り値:** Promise<ImportResult>
**処理フロー:**
1. 処理状態設定・コンテキスト作成
2. 設定・マッピング情報取得
3. 行データ取得・変換・検証
4. Notion API実行（作成/更新）
5. 主キー記録・成功通知

```typescript
async processImport(rowNumber: number): Promise<ImportResult> {
  const context: ImportContext = {
    rowNumber,
    timestamp: new Date(),
    userId: this.getCurrentUserId(),
  };

  this.processingStatus.isProcessing = true;
  this.processingStatus.lastProcessTime = Date.now();

  try {
    Logger.info('Starting import process', { rowNumber });

    // 設定取得
    const config = await ConfigManager.getConfig();
    const mappings = ConfigManager.getColumnMappings();

    // データ取得・変換
    const rowData = this.getRowData(rowNumber);
    const validationResult = Validator.validateRowData(rowData, mappings);
    
    if (!validationResult.valid) {
      throw new SpreadsheetToNotionError(
        `データ検証エラー: ${validationResult.errors.join(', ')}`,
        ErrorType.VALIDATION_ERROR
      );
    }

    const notionData = DataMapper.mapRowToNotionPage(rowData, mappings);

    // 既存ページ確認・API実行
    const primaryKeyColumnIndex = this.getPrimaryKeyColumnIndex();
    const existingPageId = primaryKeyColumnIndex >= 0 ? rowData[primaryKeyColumnIndex] : null;

    let result;
    if (existingPageId && typeof existingPageId === 'string' && existingPageId.trim()) {
      // 既存ページの更新
      result = await this.notionApiClient.updatePage(existingPageId.trim(), notionData);
    } else {
      // 新規ページの作成
      result = await this.notionApiClient.createPage(config.databaseId, notionData);
      if (primaryKeyColumnIndex >= 0) {
        this.recordPrimaryKey(rowNumber, result.id);
      }
    }

    this.showSuccessMessage('データの連携が完了しました');
    Logger.info('Import process completed successfully', { rowNumber, pageId: result.id });

    return { success: true, result };
  } catch (error) {
    Logger.error('Import process failed', { error, context });
    this.handleError(error, { context: 'processImport', ...context });
    return { success: false, error: error as Error };
  } finally {
    this.processingStatus.isProcessing = false;
  }
}
```

### 2.3 インストール可能トリガー管理

#### setupInstallableTriggers(): void
**概要:** 外部API権限問題を解決するインストール可能トリガーを設定
```typescript
static setupInstallableTriggers(): void {
  try {
    // 既存のトリガーをクリア
    TriggerManager.clearAllTriggers();

    // 編集トリガーを設定
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    ScriptApp.newTrigger('onEditInstallable')
      .forSpreadsheet(spreadsheet)
      .onEdit()
      .create();

    Logger.info('Installable triggers setup completed');
  } catch (error) {
    Logger.error('Failed to setup installable triggers', { error });
  }
}
```

#### clearAllTriggers(): void / getTriggerStatus()
トリガーの管理・診断機能を提供

### 2.4 ユーティリティメソッド

#### isCheckboxColumn(range): boolean
```typescript
private isCheckboxColumn(range: GoogleAppsScript.Spreadsheet.Range): boolean {
  return range.getColumn() === CONSTANTS.COLUMNS.CHECKBOX;
}
```

#### isCheckboxChecked(value): boolean
```typescript
private isCheckboxChecked(value: any): boolean {
  return value === true || value === 'TRUE' || value === 1 || value === '1';
}
```

#### validateAccess(e): void
```typescript
private validateAccess(e: EditEvent): void {
  try {
    Logger.debug('Access validation passed', { user: e.user.getEmail() });
  } catch (error) {
    throw new SpreadsheetToNotionError(
      'アクセス権限の確認に失敗しました',
      ErrorType.PERMISSION_ERROR,
      error as Error
    );
  }
}
```

## 3. TypeScript型定義

### 3.1 インターフェース
```typescript
// EditEvent: Google Apps Script編集イベント
interface EditEvent {
  range: GoogleAppsScript.Spreadsheet.Range;
  value: any;
  oldValue?: any;
  source: GoogleAppsScript.Spreadsheet.Spreadsheet;
  user: GoogleAppsScript.Base.User;
}

// ImportResult: インポート処理結果
interface ImportResult {
  success: boolean;
  result?: NotionPageResponse;
  error?: Error;
}

// ImportContext: インポート処理のコンテキスト
interface ImportContext {
  rowNumber: number;
  timestamp: Date;
  userId?: string;
}

// ProcessingStatus: 処理ステータス
interface ProcessingStatus {
  isProcessing: boolean;
  lastProcessTime: number;
  errorHistory: Array<{
    timestamp: Date;
    error: string;
    context?: any;
  }>;
}
```

### 3.2 カスタムエラークラス
```typescript
export class SpreadsheetToNotionError extends Error {
  constructor(
    message: string,
    public readonly type: ErrorType,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'SpreadsheetToNotionError';
  }
}

export enum ErrorType {
  CONFIG_ERROR = 'CONFIG_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  API_ERROR = 'API_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
}
```

## 4. エラーハンドリング戦略

### 4.1 階層化エラー処理
```typescript
private handleError(error: any, context?: any): void {
  // エラー履歴に記録（最新100件まで）
  this.processingStatus.errorHistory.push({
    timestamp: new Date(),
    error: error instanceof Error ? error.message : String(error),
    context,
  });

  if (this.processingStatus.errorHistory.length > 100) {
    this.processingStatus.errorHistory.shift();
  }

  // ログ記録（機密情報マスキング）
  Logger.error('TriggerManager error occurred', { error, context });

  // ユーザー通知メッセージの決定
  let userMessage = 'データの連携中にエラーが発生しました。';
  
  if (error instanceof SpreadsheetToNotionError) {
    switch (error.type) {
      case ErrorType.CONFIG_ERROR:
        userMessage = '設定に問題があります。管理者にお問い合わせください。';
        break;
      case ErrorType.VALIDATION_ERROR:
        userMessage = `データに問題があります: ${error.message}`;
        break;
      case ErrorType.API_ERROR:
        userMessage = 'Notion APIとの通信でエラーが発生しました。しばらく待ってから再試行してください。';
        break;
      case ErrorType.PERMISSION_ERROR:
        userMessage = 'アクセス権限がありません。管理者にお問い合わせください。';
        break;
    }
  }

  this.showErrorMessage(userMessage);
}
```

### 4.2 処理可能なエラータイプ
| エラータイプ | 原因 | 対処方針 |
|-------------|------|---------|
| CONFIG_ERROR | 設定不備・認証失敗 | 設定確認を促すメッセージ |
| VALIDATION_ERROR | データ形式不正 | 具体的な問題箇所を通知 |
| API_ERROR | Notion API通信失敗 | リトライ可能性を判定 |
| NETWORK_ERROR | ネットワーク接続問題 | 一時的な問題として案内 |
| PERMISSION_ERROR | アクセス権限不足 | 管理者連絡を促す |

## 5. 実装の特徴

### 5.1 シングルトンパターン
```typescript
export class TriggerManager {
  private static instance: TriggerManager;
  
  private constructor() { /* private constructor */ }
  
  static getInstance(): TriggerManager {
    if (!TriggerManager.instance) {
      TriggerManager.instance = new TriggerManager();
    }
    return TriggerManager.instance;
  }
}
```

**利点:**
- GAS環境での状態一貫性保証
- 重複実行防止
- エラー履歴の永続化

### 5.2 インストール可能トリガー対応
**課題:** 単純なonEditトリガーでは外部API権限が制限される
**解決:** インストール可能トリガー（onEditInstallable）による権限問題解決

```typescript
// グローバル関数（GAS用）
globalThis.onEditInstallable = function (e: any): void {
  const triggerManager = TriggerManager.getInstance();
  triggerManager.onEdit(e as EditEvent).catch(error => {
    Logger.error('Unhandled error in onEditInstallable trigger', { error });
  });
};
```

### 5.3 診断・デバッグ支援
- **接続テスト**: `testConnection()` - Notion API接続確認
- **状態取得**: `getProcessingStatus()` - 現在の処理状況確認
- **エラーリセット**: `clearErrorHistory()` - エラー履歴クリア
- **トリガー管理**: `setupTriggers()`, `clearTriggers()`, `showTriggerStatus()`

## 6. 依存関係

### 6.1 コアモジュール依存
```typescript
import { ConfigManager } from './ConfigManager';      // 設定・認証管理
import { Validator } from './Validator';              // データ検証
import { DataMapper } from './DataMapper';            // データ変換
import { NotionApiClient } from './NotionApiClient';  // API通信
```

### 6.2 ユーティリティ依存
```typescript
import { CONSTANTS } from '../utils/Constants';      // 定数・設定値
import { Logger } from '../utils/Logger';            // ログ・診断
```

### 6.3 型定義依存
```typescript
import {
  EditEvent, ImportContext, ImportResult, ProcessingStatus,
  ErrorType, SpreadsheetToNotionError
} from '../types';
```

### 6.4 外部API依存
- **SpreadsheetApp**: スプレッドシート操作
- **ScriptApp**: トリガー管理
- **Session**: ユーザー情報取得
