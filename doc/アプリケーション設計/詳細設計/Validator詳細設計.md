# Validator モジュール詳細設計

## 1. 役割
データの検証を行う。スプレッドシートデータの形式チェック、必須項目チェック、Notionプロパティとの互換性チェックを担当する。

## 2. 関数

### 2.1 validateRowData(rowData, mappings)
**概要:** 行データの検証
**引数:**
- `rowData` (Array): 検証対象の行データ
- `mappings` (Array<ColumnMapping>): カラムマッピング
**戻り値:** `ValidationResult`

```javascript
function validateRowData(rowData, mappings) {
  const errors = [];
  
  mappings.forEach((mapping, index) => {
    if (!mapping.isTarget) return;
    
    const value = rowData[index + CONSTANTS.COLUMNS.DATA_START - 1];
    
    // 必須チェック
    if (mapping.isRequired && (value === null || value === undefined || value === '')) {
      errors.push(`${mapping.spreadsheetColumn}: 必須項目です`);
    }
    
    // データ型チェック
    const typeError = validateDataType(value, mapping.dataType, mapping.spreadsheetColumn);
    if (typeError) {
      errors.push(typeError);
    }
  });
  
  if (errors.length > 0) {
    throw new ValidationError('データ検証エラー', errors);
  }
  
  return { valid: true, errors: [] };
}
```

### 2.2 validateDataType(value, dataType, columnName)
**概要:** 個別値のデータ型検証
**引数:**
- `value` (any): 検証対象値
- `dataType` (string): 期待するデータ型
- `columnName` (string): カラム名（エラーメッセージ用）
**戻り値:** `string | null` (エラーメッセージまたはnull)

```javascript
function validateDataType(value, dataType, columnName) {
  if (value === null || value === undefined || value === '') {
    return null; // 空値は型チェック対象外
  }
  
  switch (dataType) {
    case 'number':
      if (isNaN(parseFloat(value))) {
        return `${columnName}: 数値である必要があります (入力値: ${value})`;
      }
      break;
      
    case 'date':
      if (!isValidDate(value)) {
        return `${columnName}: 有効な日付形式である必要があります (入力値: ${value})`;
      }
      break;
      
    case 'url':
      if (!isValidUrl(value)) {
        return `${columnName}: 有効なURL形式である必要があります (入力値: ${value})`;
      }
      break;
      
    case 'email':
      if (!isValidEmail(value)) {
        return `${columnName}: 有効なメール形式である必要があります (入力値: ${value})`;
      }
      break;
      
    case 'phone_number':
      if (!isValidPhoneNumber(value)) {
        return `${columnName}: 有効な電話番号形式である必要があります (入力値: ${value})`;
      }
      break;
      
    case 'checkbox':
      if (!isValidBoolean(value)) {
        return `${columnName}: true/false または チェック状態である必要があります (入力値: ${value})`;
      }
      break;
  }
  
  return null;
}
```

### 2.3 isValidDate(value)
**概要:** 日付形式の検証
**引数:**
- `value` (any): 検証対象値
**戻り値:** `boolean`

```javascript
function isValidDate(value) {
  if (value instanceof Date) {
    return !isNaN(value.getTime());
  }
  
  if (typeof value === 'number') {
    // Excelシリアル値の場合
    return value > 0 && value < 2958466; // 1900年～9999年の範囲
  }
  
  if (typeof value === 'string') {
    // 様々な日付フォーマットをサポート
    const dateFormats = [
      /^\d{4}-\d{2}-\d{2}$/,           // YYYY-MM-DD
      /^\d{2}\/\d{2}\/\d{4}$/,         // MM/DD/YYYY
      /^\d{4}\/\d{2}\/\d{2}$/,         // YYYY/MM/DD
      /^\d{2}-\d{2}-\d{4}$/,           // MM-DD-YYYY
      /^\d{4}\.\d{2}\.\d{2}$/          // YYYY.MM.DD
    ];
    
    const isFormatValid = dateFormats.some(format => format.test(value));
    if (!isFormatValid) return false;
    
    const date = new Date(value);
    return !isNaN(date.getTime());
  }
  
  return false;
}
```

### 2.4 isValidUrl(value)
**概要:** URL形式の検証
**引数:**
- `value` (any): 検証対象値
**戻り値:** `boolean`

```javascript
function isValidUrl(value) {
  if (typeof value !== 'string') return false;
  
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}
```

### 2.5 isValidEmail(value)
**概要:** メールアドレス形式の検証
**引数:**
- `value` (any): 検証対象値
**戻り値:** `boolean`

```javascript
function isValidEmail(value) {
  if (typeof value !== 'string') return false;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}
```

### 2.6 isValidPhoneNumber(value)
**概要:** 電話番号形式の検証
**引数:**
- `value` (any): 検証対象値
**戻り値:** `boolean`

```javascript
function isValidPhoneNumber(value) {
  if (typeof value !== 'string') return false;
  
  // 数字、ハイフン、括弧、プラス記号、スペースを許可
  const phoneRegex = /^[\d\s\-\(\)\+]+$/;
  return phoneRegex.test(value) && value.replace(/[\s\-\(\)\+]/g, '').length >= 10;
}
```

### 2.7 isValidBoolean(value)
**概要:** ブール値の検証
**引数:**
- `value` (any): 検証対象値
**戻り値:** `boolean`

```javascript
function isValidBoolean(value) {
  if (typeof value === 'boolean') return true;
  
  if (typeof value === 'string') {
    const lowerValue = value.toLowerCase();
    return ['true', 'false', 'yes', 'no', '1', '0', 'on', 'off'].includes(lowerValue);
  }
  
  if (typeof value === 'number') {
    return value === 0 || value === 1;
  }
  
  return false;
}
```

### 2.8 validateConfig(config)
**概要:** システム設定の検証
**引数:**
- `config` (SystemConfig): 検証対象設定
**戻り値:** `ValidationResult`

```javascript
function validateConfig(config) {
  const errors = [];
  
  // 必須項目チェック
  if (!config.databaseId) {
    errors.push('データベースIDが設定されていません');
  } else if (!isValidDatabaseId(config.databaseId)) {
    errors.push('データベースIDの形式が正しくありません');
  }
  
  if (!config.apiToken) {
    errors.push('APIトークンが設定されていません');
  } else if (!isValidApiToken(config.apiToken)) {
    errors.push('APIトークンの形式が正しくありません');
  }
  
  if (!config.projectName) {
    errors.push('プロジェクト名が設定されていません');
  }
  
  if (errors.length > 0) {
    throw new ValidationError('設定検証エラー', errors);
  }
  
  return { valid: true, errors: [] };
}
```

### 2.9 isValidDatabaseId(databaseId)
**概要:** NotionデータベースIDの形式検証
**引数:**
- `databaseId` (string): データベースID
**戻り値:** `boolean`

```javascript
function isValidDatabaseId(databaseId) {
  if (typeof databaseId !== 'string') return false;
  
  // 32文字の16進数文字列
  const dbIdRegex = /^[a-f0-9]{32}$/;
  return dbIdRegex.test(databaseId);
}
```

### 2.10 isValidApiToken(apiToken)
**概要:** Notion APIトークンの形式検証
**引数:**
- `apiToken` (string): APIトークン
**戻り値:** `boolean`

```javascript
function isValidApiToken(apiToken) {
  if (typeof apiToken !== 'string') return false;
  
  // secret_ で始まる形式
  return apiToken.startsWith('secret_') && apiToken.length > 50;
}
```

### 2.11 validateBatchData(batchData, mappings)
**概要:** バッチデータの検証
**引数:**
- `batchData` (Array<Array>): バッチデータ
- `mappings` (Array<ColumnMapping>): カラムマッピング
**戻り値:** `BatchValidationResult`

```javascript
function validateBatchData(batchData, mappings) {
  const results = {
    valid: [],
    invalid: [],
    totalCount: batchData.length
  };
  
  batchData.forEach((rowData, index) => {
    try {
      const result = validateRowData(rowData, mappings);
      results.valid.push({
        rowIndex: index,
        rowData: rowData,
        result: result
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        results.invalid.push({
          rowIndex: index,
          rowData: rowData,
          errors: error.errors
        });
      } else {
        results.invalid.push({
          rowIndex: index,
          rowData: rowData,
          errors: [error.message]
        });
      }
    }
  });
  
  return results;
}
```

### 2.12 validateNotionPropertyValue(value, propertyConfig)
**概要:** Notionプロパティ設定に対する値の検証
**引数:**
- `value` (any): 検証対象値
- `propertyConfig` (PropertyConfig): プロパティ設定
**戻り値:** `string | null`

```javascript
function validateNotionPropertyValue(value, propertyConfig) {
  if (value === null || value === undefined || value === '') {
    return propertyConfig.required ? 'この項目は必須です' : null;
  }
  
  switch (propertyConfig.type) {
    case 'select':
      if (propertyConfig.options) {
        const validOptions = propertyConfig.options.map(opt => opt.name);
        if (!validOptions.includes(String(value))) {
          return `選択可能な値: ${validOptions.join(', ')}`;
        }
      }
      break;
      
    case 'multi_select':
      if (propertyConfig.options) {
        const values = String(value).split(',').map(v => v.trim());
        const validOptions = propertyConfig.options.map(opt => opt.name);
        const invalidValues = values.filter(v => !validOptions.includes(v));
        
        if (invalidValues.length > 0) {
          return `無効な選択肢: ${invalidValues.join(', ')}`;
        }
      }
      break;
      
    case 'number':
      if (propertyConfig.format === 'percent') {
        const num = parseFloat(value);
        if (num < 0 || num > 100) {
          return 'パーセンテージは0-100の範囲で入力してください';
        }
      }
      break;
  }
  
  return null;
}
```

## 3. データ構造

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

interface PropertyConfig {
  type: string;
  required: boolean;
  options?: Array<{ name: string; color: string }>;
  format?: string;
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
const VALIDATOR = {
  // 検証設定
  VALIDATION_RULES: {
    MAX_STRING_LENGTH: 2000,
    MAX_MULTI_SELECT_COUNT: 100,
    DATE_MIN_YEAR: 1900,
    DATE_MAX_YEAR: 9999
  },
  
  // エラーメッセージテンプレート
  ERROR_MESSAGES: {
    REQUIRED: '${field}: 必須項目です',
    INVALID_TYPE: '${field}: ${type}形式である必要があります',
    INVALID_OPTION: '${field}: 選択可能な値ではありません',
    TOO_LONG: '${field}: 文字数が上限を超えています',
    OUT_OF_RANGE: '${field}: 値が許可範囲外です'
  },
  
  // 正規表現パターン
  REGEX_PATTERNS: {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    URL: /^https?:\/\/[^\s]+$/,
    PHONE: /^[\d\s\-\(\)\+]+$/,
    DATABASE_ID: /^[a-f0-9]{32}$/,
    DATE_ISO: /^\d{4}-\d{2}-\d{2}$/
  }
};
```

## 5. エラーハンドリング

### 5.1 処理可能なエラー
- データ型不一致（TYPE_MISMATCH_ERROR）
- 必須項目欠損（REQUIRED_FIELD_ERROR）
- 形式エラー（FORMAT_ERROR）
- 範囲外エラー（OUT_OF_RANGE_ERROR）
- 選択肢不一致（INVALID_OPTION_ERROR）

### 5.2 エラー処理方針
- 検証エラーは詳細な情報と修正方法を提供
- バッチ処理では部分的失敗を許容
- ユーザーフレンドリーなエラーメッセージ

## 6. パフォーマンス考慮事項

### 6.1 最適化ポイント
- 正規表現のコンパイル最適化
- バッチ検証時のメモリ使用量
- 早期リターンによる無駄な処理の削減

### 6.2 制限事項
- 大量データ検証時のタイムアウト対策
- メモリ使用量の監視

## 7. 国際化対応

### 7.1 多言語エラーメッセージ
```javascript
const ERROR_MESSAGES_JA = {
  REQUIRED: '${field}は必須項目です',
  INVALID_EMAIL: '${field}は有効なメールアドレスを入力してください',
  INVALID_URL: '${field}は有効なURLを入力してください',
  INVALID_DATE: '${field}は有効な日付を入力してください'
};
```

## 8. 依存関係

### 8.1 依存モジュール
- Constants: 定数定義
- Logger: ログ出力

### 8.2 外部依存
- JavaScript標準ライブラリ（正規表現、Date等）

## 9. テスト観点

### 9.1 単体テスト項目
- 各データ型の正常値・異常値検証
- 境界値テスト
- 正規表現パターンの動作確認
- エラーメッセージの内容確認

### 9.2 統合テスト項目
- 実際のスプレッドシートデータでの検証
- Notionプロパティ設定との互換性確認
- 大量データの検証性能
