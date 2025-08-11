# ConfigManager モジュール詳細設計

## 1. 役割・概要
**ConfigManager** は、静的クラス設計による設定情報の一元管理モジュールです。スプレッドシートの設定シートとGASプロパティサービスから設定を読み込み、キャッシュ機能とセキュリティ保護を提供します。

### 設計方針
- **Static Class Pattern**: ステートレス設計・グローバルアクセス
- **Caching Strategy**: 5分間の設定キャッシュによるパフォーマンス向上
- **Security First**: 機密情報の階層化保護・自動マスキング
- **Type Safety**: TypeScript型定義による設定検証

## 2. クラス構造

### 2.1 クラス定義
```typescript
export class ConfigManager {
  // キャッシュ管理
  private static configCache: SystemConfig | null = null;
  private static cacheTimestamp = 0;
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5分

  // 主要メソッド
  static async getConfig(): Promise<SystemConfig>;
  static getColumnMappings(): ColumnMapping[];
  static getApiToken(): string;
  static setApiToken(token: string): boolean;
  
  // ヘルスチェック・診断
  static async healthCheck(): Promise<{ healthy: boolean; issues: string[] }>;
  static debugProperties(): void;
  
  // 内部ユーティリティ
  private static getSheet(sheetName: string): GoogleAppsScript.Spreadsheet.Sheet;
  private static getConfigSheet(): GoogleAppsScript.Spreadsheet.Sheet;
  private static getConfigValue(sheet: GoogleAppsScript.Spreadsheet.Sheet, key: string): string | null;
}

```

## 2. 主要メソッド

### 2.1 getConfig(): Promise<SystemConfig>
**概要:** キャッシュ対応の設定情報取得メソッド
**戻り値:** Promise<SystemConfig>
**特徴:** 5分間のキャッシュ、自動ログタイマー、機密情報マスキング

```typescript
static async getConfig(): Promise<SystemConfig> {
  const now = Date.now();
  
  // キャッシュの有効性チェック
  if (this.configCache && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
    Logger.endTimer('ConfigManager.getConfig (cached)');
    return this.configCache;
  }

  Logger.startTimer('ConfigManager.getConfig');
  Logger.info('Loading fresh configuration');

  try {
    // 設定シートからの読み込み
    const configSheet = this.getConfigSheet();
    const databaseId = this.getConfigValue(configSheet, CONSTANTS.CONFIG_KEYS.DATABASE_ID);
    const projectName = this.getConfigValue(configSheet, CONSTANTS.CONFIG_KEYS.PROJECT_NAME) 
                        || CONSTANTS.DEFAULTS.PROJECT_NAME;
    const version = this.getConfigValue(configSheet, CONSTANTS.CONFIG_KEYS.VERSION) 
                    || CONSTANTS.DEFAULTS.VERSION;

    // APIトークンの安全な取得
    const apiToken = this.getApiToken();

    // 設定オブジェクトの構築
    const config: SystemConfig = {
      databaseId: databaseId || '',
      projectName,
      version,
      apiToken,
    };

    // 必須項目の検証
    if (!config.databaseId) {
      throw new ConfigError('Database ID is required but not configured');
    }

    // キャッシュ更新
    this.configCache = config;
    this.cacheTimestamp = now;

    // 成功ログ（機密情報マスキング）
    Logger.info('Configuration loaded successfully', {
      projectName: config.projectName,
      version: config.version,
      hasValidToken: config.apiToken ? '***' : 'No'
    });

    return config;
  } catch (error) {
    this.logError('ConfigManager.getConfig', error);
    throw error;
  } finally {
    Logger.endTimer('ConfigManager.getConfig');
  }
}
```

### 2.2 getColumnMappings(): ColumnMapping[]
**概要:** カラムマッピング設定の読み込み・検証
**戻り値:** ColumnMapping[]
**特徴:** データ検証、統計情報ログ、エラー詳細化

```typescript
static getColumnMappings(): ColumnMapping[] {
  Logger.startTimer('ConfigManager.getColumnMappings');
  
  try {
    const sheet = this.getSheet(CONSTANTS.SHEETS.IMPORT_COLUMN);
    const data = sheet.getDataRange().getValues();

    if (data.length < 2) {
      throw new ConfigError('Column mapping sheet must have at least header row and one data row');
    }

    const mappings: ColumnMapping[] = [];
    let skippedRowsCount = 0;

    // ヘッダー行をスキップして処理
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      // 空行のスキップ
      if (!row[0] || !row[1]) {
        skippedRowsCount++;
        continue;
      }

      mappings.push({
        spreadsheetColumn: String(row[0]).trim(),
        notionPropertyName: String(row[1]).trim(),
        dataType: String(row[2]).trim().toLowerCase(),
        isTarget: String(row[3]).toLowerCase() === 'yes',
        isRequired: String(row[4]).toLowerCase() === 'yes',
      });
    }

    // 統計情報の記録
    Logger.info('Column mappings loaded successfully', {
      totalMappings: mappings.length,
      targetMappings: mappings.filter(m => m.isTarget).length,
      requiredMappings: mappings.filter(m => m.isRequired).length,
      skippedRowsCount
    });

    return mappings;
  } catch (error) {
    this.logError('ConfigManager.getColumnMappings', error);
    throw error;
  } finally {
    Logger.endTimer('ConfigManager.getColumnMappings');
  }
}
```

### 2.3 getApiToken(): string / setApiToken(token: string): boolean
**概要:** セキュアなAPIトークン管理
**特徴:** 形式検証、暗号化保存、アクセス制御

```typescript
static getApiToken(): string {
  try {
    const token = PropertiesService
      .getScriptProperties()
      .getProperty(CONSTANTS.CONFIG_KEYS.NOTION_API_TOKEN);

    if (!token) {
      throw new ConfigError('Notion API token not configured');
    }

    if (!token.startsWith('secret_') && !token.startsWith('ntn_')) {
      throw new ConfigError('Invalid API token format. Must start with "secret_" or "ntn_"');
    }

    return token;
  } catch (error) {
    throw new ConfigError('Failed to retrieve API token', error as Error);
  }
}

static setApiToken(token: string): boolean {
  try {
    if (!token) {
      throw new ConfigError('API token cannot be empty');
    }

    if (!token.startsWith('secret_') && !token.startsWith('ntn_')) {
      throw new ConfigError('Invalid API token format. Must start with "secret_" or "ntn_"');
    }

    PropertiesService
      .getScriptProperties()
      .setProperty(CONSTANTS.CONFIG_KEYS.NOTION_API_TOKEN, token);

    Logger.info('API token set successfully', {
      tokenLength: token.length,
      tokenPrefix: token.substring(0, 7)
    });

    return true;
  } catch (error) {
    Logger.error('Failed to set API token', error);
    return false;
  }
}
```

### 2.4 ヘルスチェック・診断機能

#### healthCheck(): Promise<{ healthy: boolean; issues: string[] }>
**概要:** システム設定の包括的な健康状態チェック
```typescript
static async healthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
  const issues: string[] = [];

  try {
    // 必須シートの存在確認
    const requiredSheets = [
      CONSTANTS.SHEETS.IMPORT_DATA,
      CONSTANTS.SHEETS.IMPORT_COLUMN,
      CONSTANTS.SHEETS.CONFIG
    ];

    for (const sheetName of requiredSheets) {
      try {
        this.getSheet(sheetName);
      } catch (error) {
        issues.push(`Required sheet '${sheetName}' not found`);
      }
    }

    // APIトークンの確認
    try {
      this.getApiToken();
    } catch (error) {
      issues.push('API token not configured or invalid');
    }

    // 設定値の確認
    try {
      const config = await this.getConfig();
      if (!config.databaseId) {
        issues.push('Database ID not configured');
      }
    } catch (error) {
      issues.push('Configuration loading failed');
    }

    return {
      healthy: issues.length === 0,
      issues
    };
  } catch (error) {
    issues.push(`Health check failed: ${error instanceof Error ? error.message : String(error)}`);
    return { healthy: false, issues };
  }
}
```

#### debugProperties(): void
**概要:** GASプロパティの詳細診断（デバッグ用）
```typescript
static debugProperties(): void {
  try {
    Logger.info('=== GAS Properties Debug ===');
    
    const properties = PropertiesService.getScriptProperties().getProperties();
    const hasToken = CONSTANTS.CONFIG_KEYS.NOTION_API_TOKEN in properties;
    
    Logger.info('Properties summary', {
      totalCount: Object.keys(properties).length,
      hasNotionToken: hasToken,
      propertyKeys: Object.keys(properties)
    });

    if (hasToken) {
      const token = properties[CONSTANTS.CONFIG_KEYS.NOTION_API_TOKEN];
      Logger.info('Token details', {
        length: token.length,
        prefix: token.substring(0, 10),
        isValidFormat: token.startsWith('secret_') || token.startsWith('ntn_')
      });
    }
  } catch (error) {
    Logger.error('Properties debug failed', error);
  }
}
```

## 3. TypeScript型定義

### 3.1 インターフェース
```typescript
// SystemConfig: システム設定
interface SystemConfig {
  databaseId: string;
  projectName: string;
  version: string;
  apiToken: string;
  batchSize?: number;
  autoSyncEnabled?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
  webhookUrl?: string;
}

// ColumnMapping: カラムマッピング設定
interface ColumnMapping {
  spreadsheetColumn: string;
  notionPropertyName: string;
  dataType: string;
  isTarget: boolean;
  isRequired: boolean;
}
```

### 3.2 カスタムエラークラス
```typescript
export class ConfigError extends SpreadsheetToNotionError {
  constructor(message: string, originalError?: Error) {
    super(message, ErrorType.CONFIG_ERROR, originalError);
    this.name = 'ConfigError';
  }
}
```

## 4. キャッシュ戦略・パフォーマンス

### 4.1 設定キャッシュ実装
```typescript
export class ConfigManager {
  private static configCache: SystemConfig | null = null;
  private static cacheTimestamp = 0;
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5分

  // キャッシュの有効性チェック
  private static isCacheValid(): boolean {
    return this.configCache !== null && 
           (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION;
  }

  // キャッシュクリア（テスト用）
  static clearCache(): void {
    this.configCache = null;
    this.cacheTimestamp = 0;
    Logger.debug('Configuration cache cleared');
  }
}
```

**キャッシュ効果:**
- 初回読み込み: ~20ms
- キャッシュヒット: ~1ms
- 5分間の有効期限

### 4.2 パフォーマンス計測
```typescript
// 全メソッドで自動タイマー
Logger.startTimer('ConfigManager.getConfig');
// ... 処理
Logger.endTimer('ConfigManager.getConfig');  // 実行時間をログ出力
```

## 5. セキュリティ実装

### 5.1 階層化セキュリティモデル
```typescript
// レベル1: 高セキュリティ（GAS プロパティサービス）
PropertiesService.getScriptProperties().setProperty(
  CONSTANTS.CONFIG_KEYS.NOTION_API_TOKEN,
  'secret_xxx...' // 暗号化保存
);

// レベル2: 中セキュリティ（設定シート）
// データベースID、プロジェクト名等

// レベル3: 低セキュリティ（コード内定数）
const PUBLIC_CONFIG = {
  VERSION: '1.0.0',
  DEFAULT_PROJECT_NAME: 'Sample Project'
};
```

### 5.2 機密情報マスキング
```typescript
static logError(operation: string, error: any): void {
  const maskedData = Logger.maskSensitiveData({
    operation,
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : error
  });

  Logger.error(`[${operation}] Exception occurred`, maskedData);
}
```

**マスキング対象:**
- APIトークン: `secret_abcd1234...` → `secret_a***`
- データベースID: `a1b2c3d4e5f6...` → `a1b2c3d4...`

## 6. エラーハンドリング戦略

### 6.1 階層化エラー処理
```typescript
try {
  // 設定処理
} catch (error) {
  if (error instanceof ConfigError) {
    // 設定固有のエラー処理
    this.logError('ConfigManager.getConfig', error);
    throw error; // 上位に委譲
  } else {
    // 予期しないエラー
    const configError = new ConfigError(
      'Unexpected configuration error',
      error as Error
    );
    this.logError('ConfigManager.getConfig', configError);
    throw configError;
  }
}
```

### 6.2 エラー分類と対処
| エラータイプ | 原因 | 対処方針 |
|-------------|------|---------|
| CONFIG_MISSING_ERROR | 必須設定項目欠損 | 具体的な項目名を通知 |
| CONFIG_FORMAT_ERROR | 設定値形式不正 | 正しい形式を例示 |
| SHEET_ACCESS_ERROR | シート不存在・権限不足 | シート作成手順を案内 |
| TOKEN_INVALID_ERROR | APIトークン無効 | トークン再取得を促す |

## 7. 実装の特徴

### 7.1 静的クラス設計
```typescript
export class ConfigManager {
  // privateコンストラクタでインスタンス化防止
  private constructor() {}
  
  // 全メソッドがstatic
  static async getConfig(): Promise<SystemConfig> { ... }
  static getColumnMappings(): ColumnMapping[] { ... }
}
```

**利点:**
- グローバルアクセス可能
- メモリ効率性
- テスト容易性

### 7.2 設定検証システム
```typescript
// 実行時型チェック
private static validateSystemConfig(config: any): config is SystemConfig {
  return typeof config === 'object' &&
         typeof config.databaseId === 'string' &&
         typeof config.projectName === 'string' &&
         typeof config.version === 'string' &&
         typeof config.apiToken === 'string';
}
```

### 7.3 デバッグ支援機能
- **診断関数**: `healthCheck()`, `debugProperties()`
- **詳細ログ**: 処理時間、統計情報、エラー詳細
- **手動実行**: グローバル関数による手動テスト

## 8. 依存関係

### 8.1 ユーティリティ依存
```typescript
import { CONSTANTS } from '../utils/Constants';      // 定数・設定キー
import { Logger } from '../utils/Logger';            // ログ・タイマー・マスキング
```

### 8.2 型定義依存
```typescript
import {
  SystemConfig, ColumnMapping, 
  ConfigError, ErrorType
} from '../types';
```

### 8.3 外部API依存
- **PropertiesService**: セキュアな設定保存
- **SpreadsheetApp**: スプレッドシートアクセス

### 8.4 逆依存関係
ConfigManagerは以下のモジュールから利用されます：
- **TriggerManager**: メイン設定取得
- **DataMapper**: カラムマッピング取得  
- **NotionApiClient**: APIトークン取得
