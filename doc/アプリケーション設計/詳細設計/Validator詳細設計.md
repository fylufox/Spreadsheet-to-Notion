# Validator モジュール詳細設計

## 1. 概要

### 1.1 役割
データ検証を担当する静的クラス。スプレッドシートデータの形式チェック、必須項目チェック、Notionプロパティとの互換性チェック、型ガード機能を提供する。

### 1.2 設計パターン
- **静的クラス設計:** インスタンス化不要、純粋関数による検証
- **型ガード実装:** TypeScript型システムとの統合
- **詳細エラー情報:** 修正方法を含む具体的なエラーメッセージ
- **バッチ検証対応:** 大量データの効率的な検証

## 2. 主要メソッド

### 2.1 validateRowData(rowData: any[], mappings: ColumnMapping[]): ValidationResult
**概要:** 行データの包括的検証（型安全性・必須項目・データ整合性）
```typescript
static validateRowData(rowData: any[], mappings: ColumnMapping[]): ValidationResult {
  Logger.startTimer('Validator.validateRowData');
  
  try {
    const errors: string[] = [];
    
    // 基本構造チェック
    if (!Array.isArray(rowData)) {
      errors.push('Row data must be an array');
      return { valid: false, errors };
    }
    
    if (!Array.isArray(mappings)) {
      errors.push('Mappings must be an array');
      return { valid: false, errors };
    }
    
    // 各マッピングに対する検証
    mappings.forEach((mapping, index) => {
      if (!mapping.isTarget) return;
      
      try {
        const columnIndex = DataMapper.getColumnIndex(mapping.spreadsheetColumn);
        const value = rowData[columnIndex];
        
        // 必須項目チェック
        if (mapping.isRequired && this.isEmptyValue(value)) {
          errors.push(`${mapping.spreadsheetColumn}: Required field is empty`);
          return;
        }
        
        // 空値の場合は型チェックスキップ
        if (this.isEmptyValue(value)) {
          return;
        }
        
        // データ型検証
        const typeError = this.validateDataType(value, mapping.dataType, mapping.spreadsheetColumn);
        if (typeError) {
          errors.push(typeError);
        }
        
        // 文字列長制限チェック
        if (typeof value === 'string' && value.length > CONSTANTS.VALIDATION.MAX_STRING_LENGTH) {
          errors.push(`${mapping.spreadsheetColumn}: Text too long (max ${CONSTANTS.VALIDATION.MAX_STRING_LENGTH} characters)`);
        }
      } catch (error) {
        errors.push(`${mapping.spreadsheetColumn}: Validation error - ${error instanceof Error ? error.message : String(error)}`);
      }
    });
    
    const result = { valid: errors.length === 0, errors };
    
    Logger.debug('Row validation completed', {
      valid: result.valid,
      errorCount: errors.length,
      mappingCount: mappings.filter(m => m.isTarget).length
    });
    
    return result;
  } catch (error) {
    Logger.logError('Validator.validateRowData', error);
    return {
      valid: false,
      errors: [`Validation process failed: ${error instanceof Error ? error.message : String(error)}`]
    };
  } finally {
    Logger.endTimer('Validator.validateRowData');
  }
}
```

### 2.2 validateDataType(value: any, dataType: string, columnName: string): string | null
**概要:** 型ガード機能付きデータ型検証
```typescript
private static validateDataType(value: any, dataType: string, columnName: string): string | null {
  if (this.isEmptyValue(value)) {
    return null; // 空値は型チェック対象外
  }
  
  try {
    switch (dataType) {
      case CONSTANTS.DATA_TYPES.NUMBER:
        if (!this.isValidNumber(value)) {
          return `${columnName}: Must be a valid number (input: ${value})`;
        }
        break;
        
      case CONSTANTS.DATA_TYPES.DATE:
        if (!this.isValidDate(value)) {
          return `${columnName}: Must be a valid date format (input: ${value})`;
        }
        break;
        
      case CONSTANTS.DATA_TYPES.URL:
        if (!this.isValidUrl(value)) {
          return `${columnName}: Must be a valid URL (input: ${value})`;
        }
        break;
        
      case CONSTANTS.DATA_TYPES.EMAIL:
        if (!this.isValidEmail(value)) {
          return `${columnName}: Must be a valid email address (input: ${value})`;
        }
        break;
        
      case CONSTANTS.DATA_TYPES.PHONE_NUMBER:
        if (!this.isValidPhoneNumber(value)) {
          return `${columnName}: Must be a valid phone number (input: ${value})`;
        }
        break;
        
      case CONSTANTS.DATA_TYPES.CHECKBOX:
        if (!this.isValidBoolean(value)) {
          return `${columnName}: Must be true/false or checkbox value (input: ${value})`;
        }
        break;
        
      case CONSTANTS.DATA_TYPES.MULTI_SELECT:
        if (!this.isValidMultiSelect(value)) {
          return `${columnName}: Must be comma-separated values (input: ${value})`;
        }
        break;
        
      case CONSTANTS.DATA_TYPES.TITLE:
      case CONSTANTS.DATA_TYPES.RICH_TEXT:
      case CONSTANTS.DATA_TYPES.SELECT:
        // 文字列型は基本的にそのまま通す
        break;
        
      default:
        return `${columnName}: Unsupported data type: ${dataType}`;
    }
    
    return null;
  } catch (error) {
    return `${columnName}: Type validation failed - ${error instanceof Error ? error.message : String(error)}`;
  }
}
```

### 2.3 型ガード関数群

#### isValidNumber(value: any): value is number
```typescript
private static isValidNumber(value: any): value is number {
  if (typeof value === 'number') {
    return !isNaN(value) && isFinite(value);
  }
  
  if (typeof value === 'string') {
    const num = parseFloat(value.trim());
    return !isNaN(num) && isFinite(num);
  }
  
  return false;
}
```

#### isValidDate(value: any): boolean
```typescript
private static isValidDate(value: any): boolean {
  if (value instanceof Date) {
    return !isNaN(value.getTime());
  }
  
  if (typeof value === 'number') {
    // Excelシリアル値対応 (1900-9999年の範囲)
    return value > 0 && value < 2958466;
  }
  
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return false;
    
    // ISO 8601形式チェック
    if (CONSTANTS.VALIDATION.DATE_ISO_REGEX.test(trimmed)) {
      const date = new Date(trimmed);
      return !isNaN(date.getTime());
    }
    
    // その他の一般的な日付形式
    const dateFormats = [
      /^\d{2}\/\d{2}\/\d{4}$/,         // MM/DD/YYYY
      /^\d{4}\/\d{2}\/\d{2}$/,         // YYYY/MM/DD
      /^\d{2}-\d{2}-\d{4}$/,           // MM-DD-YYYY
      /^\d{4}\.\d{2}\.\d{2}$/          // YYYY.MM.DD
    ];
    
    const isFormatValid = dateFormats.some(format => format.test(trimmed));
    if (isFormatValid) {
      const date = new Date(trimmed);
      return !isNaN(date.getTime());
    }
  }
  
  return false;
}
```

#### isValidUrl(value: any): boolean
```typescript
private static isValidUrl(value: any): boolean {
  if (typeof value !== 'string') return false;
  
  const trimmed = value.trim();
  if (trimmed === '') return false;
  
  try {
    const url = new URL(trimmed);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}
```

#### isValidEmail(value: any): boolean
```typescript
private static isValidEmail(value: any): boolean {
  if (typeof value !== 'string') return false;
  
  const trimmed = value.trim();
  if (trimmed === '') return false;
  
  // RFC 5322準拠の簡易版正規表現
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(trimmed);
}
```

### 2.4 validateConfig(config: SystemConfig): ValidationResult
**概要:** システム設定の包括的検証
```typescript
static validateConfig(config: SystemConfig): ValidationResult {
  Logger.startTimer('Validator.validateConfig');
  
  try {
    const errors: string[] = [];
    
    // 必須項目チェック
    if (!config.databaseId) {
      errors.push('Database ID is required');
    } else if (!this.isValidDatabaseId(config.databaseId)) {
      errors.push('Invalid database ID format');
    }
    
    if (!config.apiToken) {
      errors.push('API token is required');
    } else if (!this.isValidApiToken(config.apiToken)) {
      errors.push('Invalid API token format');
    }
    
    if (!config.projectName) {
      errors.push('Project name is required');
    } else if (config.projectName.length > CONSTANTS.VALIDATION.MAX_PROJECT_NAME_LENGTH) {
      errors.push(`Project name too long (max ${CONSTANTS.VALIDATION.MAX_PROJECT_NAME_LENGTH} characters)`);
    }
    
    // 任意項目の検証
    if (config.webhookUrl && !this.isValidUrl(config.webhookUrl)) {
      errors.push('Invalid webhook URL format');
    }
    
    const result = { valid: errors.length === 0, errors };
    
    Logger.debug('Config validation completed', {
      valid: result.valid,
      errorCount: errors.length
    });
    
    return result;
  } catch (error) {
    Logger.logError('Validator.validateConfig', error);
    return {
      valid: false,
      errors: [`Config validation failed: ${error instanceof Error ? error.message : String(error)}`]
    };
  } finally {
    Logger.endTimer('Validator.validateConfig');
  }
}
```

### 2.5 バッチ検証・ユーティリティメソッド

#### validateBatchData(batchData: any[][], mappings: ColumnMapping[]): BatchValidationResult
```typescript
static validateBatchData(batchData: any[][], mappings: ColumnMapping[]): BatchValidationResult {
  Logger.startTimer('Validator.validateBatchData');
  
  try {
    const results: BatchValidationResult = {
      valid: [],
      invalid: [],
      totalCount: batchData.length
    };
    
    batchData.forEach((rowData, index) => {
      try {
        const result = this.validateRowData(rowData, mappings);
        if (result.valid) {
          results.valid.push({
            rowIndex: index,
            rowData: rowData,
            result: result
          });
        } else {
          results.invalid.push({
            rowIndex: index,
            rowData: rowData,
            errors: result.errors
          });
        }
      } catch (error) {
        results.invalid.push({
          rowIndex: index,
          rowData: rowData,
          errors: [error instanceof Error ? error.message : String(error)]
        });
      }
    });
    
    Logger.info('Batch validation completed', {
      totalCount: results.totalCount,
      validCount: results.valid.length,
      invalidCount: results.invalid.length
    });
    
    return results;
  } catch (error) {
    Logger.logError('Validator.validateBatchData', error);
    throw new ValidationError(
      'Batch validation failed',
      [error instanceof Error ? error.message : String(error)]
    );
  } finally {
    Logger.endTimer('Validator.validateBatchData');
  }
}
```

#### isEmptyValue(value: any): boolean
```typescript
private static isEmptyValue(value: any): boolean {
  return value === null || 
         value === undefined || 
         value === '' || 
         value === 'null' || 
         value === 'undefined' ||
         (typeof value === 'string' && value.trim() === '');
}
```

#### isValidDatabaseId(databaseId: string): boolean
```typescript
private static isValidDatabaseId(databaseId: string): boolean {
  if (typeof databaseId !== 'string') return false;
  
  // UUID v4形式 (ハイフンありまたはなし)
  const dbIdRegex = /^[a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}$/i;
  return dbIdRegex.test(databaseId.replace(/-/g, ''));
}
```

#### isValidApiToken(apiToken: string): boolean
```typescript
private static isValidApiToken(apiToken: string): boolean {
  if (typeof apiToken !== 'string') return false;
  
  // secret_ で始まる50文字以上
  return apiToken.startsWith('secret_') && apiToken.length >= 50;
}
```

## 3. 型定義

```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];
}

interface BatchValidationResult {
  valid: Array<{
    rowIndex: number;
    rowData: any[];
    result: ValidationResult;
  }>;
  invalid: Array<{
    rowIndex: number;
    rowData: any[];
    errors: string[];
  }>;
  totalCount: number;
}

interface SystemConfig {
  databaseId: string;
  apiToken: string;
  projectName: string;
  webhookUrl?: string;
}

class ValidationError extends Error {
  constructor(
    message: string,
    public errors: string[]
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

## 4. エラーハンドリング

### 4.1 ValidationError
```typescript
class ValidationError extends Error {
  constructor(
    message: string,
    public errors: string[]
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

### 4.2 エラーパターン
- **型不一致エラー:** 期待される型と異なる値
- **必須項目エラー:** 必須フィールドの未設定
- **形式エラー:** URL・メール・日付等の形式違反
- **範囲外エラー:** 許可範囲を超える値
- **長さ制限エラー:** 文字列長・配列長の上限超過

### 4.3 詳細エラー情報
- **修正方法:** 具体的な修正指示
- **期待値:** 正しい形式・値の例示
- **現在値:** 問題のある入力値の表示

## 5. パフォーマンス特性

### 5.1 計算量
- validateRowData: O(n) (nはマッピング数)
- validateBatchData: O(n×m) (n行数, mマッピング数)
- 型ガード関数: O(1) (定数時間)

### 5.2 最適化
- 正規表現の事前コンパイル
- 早期リターンによる不要処理回避
- メモリ効率的なエラー収集

## 6. テスト戦略

### 6.1 単体テスト (Validator.test.ts)
- 各データ型の正常値・異常値検証
- 境界値テスト（最大長・最小値等）
- 型ガード関数の動作確認
- エラーメッセージの内容確認

### 6.2 統合テスト
- 実スプレッドシートデータでの検証
- Notionプロパティとの互換性確認
- 大量データ検証のパフォーマンス

## 7. 設計考慮事項

### 7.1 型安全性
- TypeScript strict mode対応
- 型ガード関数による実行時検証
- null安全な実装

### 7.2 ユーザビリティ
- 分かりやすいエラーメッセージ
- 修正方法の具体的な提示
- 複数エラーの一括表示

### 7.3 拡張性
- 新データ型の追加容易性
- カスタム検証ルールの挿入
- 国際化対応の準備

## 8. 関連モジュール

### 8.1 依存関係
- **Constants:** 検証ルール・正規表現定数
- **Logger:** 処理ログ・パフォーマンス計測
- **types/index.ts:** 型定義

### 8.2 使用箇所
- **DataMapper:** データ変換前の事前検証
- **TriggerManager:** 同期処理での入力検証
- **ConfigManager:** 設定値の整合性確認
