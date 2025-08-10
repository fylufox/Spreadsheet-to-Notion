# DataMapper モジュール詳細設計

## 1. 役割
スプレッドシートのデータをNotion API形式に変換する。データ型の変換、プロパティのマッピング、フォーマット調整を行う。

## 2. 関数

### 2.1 mapToNotionFormat(rowData, mappings)
**概要:** スプレッドシートデータをNotion形式に変換
**引数:**
- `rowData` (Array): スプレッドシートの行データ
- `mappings` (Array<ColumnMapping>): カラムマッピング情報
**戻り値:** `NotionPageData`

```javascript
function mapToNotionFormat(rowData, mappings) {
  const properties = {};
  
  mappings.forEach((mapping, index) => {
    if (!mapping.isTarget) return;
    
    const value = rowData[index + CONSTANTS.COLUMNS.DATA_START - 1];
    const notionProperty = convertToNotionProperty(value, mapping.dataType);
    
    properties[mapping.notionPropertyName] = notionProperty;
  });
  
  return { properties };
}
```

### 2.2 convertToNotionProperty(value, dataType)
**概要:** 値をNotionプロパティ形式に変換
**引数:**
- `value` (any): 変換対象の値
- `dataType` (string): Notionプロパティタイプ
**戻り値:** `NotionProperty`

```javascript
function convertToNotionProperty(value, dataType) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  switch (dataType) {
    case 'title':
      return { title: [{ text: { content: String(value) } }] };
      
    case 'rich_text':
      return { rich_text: [{ text: { content: String(value) } }] };
      
    case 'number':
      return { number: parseFloat(value) || 0 };
      
    case 'select':
      return { select: { name: String(value) } };
      
    case 'multi_select':
      const values = String(value).split(',').map(v => v.trim());
      return { multi_select: values.map(v => ({ name: v })) };
      
    case 'date':
      return { date: { start: formatDateForNotion(value) } };
      
    case 'checkbox':
      return { checkbox: Boolean(value) };
      
    case 'url':
      return { url: String(value) };
      
    case 'email':
      return { email: String(value) };
      
    case 'phone_number':
      return { phone_number: String(value) };
      
    default:
      throw new Error(`Unsupported data type: ${dataType}`);
  }
}
```

### 2.3 formatDateForNotion(value)
**概要:** 日付値をNotion API形式に変換
**引数:**
- `value` (any): 日付値（Date, 文字列, 数値）
**戻り値:** `string` (ISO 8601形式)

```javascript
function formatDateForNotion(value) {
  let date;
  
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'number') {
    // Excelのシリアル値から変換
    date = new Date((value - 25569) * 86400 * 1000);
  } else if (typeof value === 'string') {
    date = new Date(value);
  } else {
    throw new Error(`Cannot convert value to date: ${value}`);
  }
  
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date value: ${value}`);
  }
  
  // ISO 8601形式で返却（YYYY-MM-DD）
  return date.toISOString().split('T')[0];
}
```

### 2.4 mapFromNotionFormat(notionPage, mappings)
**概要:** Notionページデータをスプレッドシート形式に逆変換
**引数:**
- `notionPage` (NotionPage): Notionページデータ
- `mappings` (Array<ColumnMapping>): カラムマッピング情報
**戻り値:** `Array<any>` (スプレッドシート行データ)

```javascript
function mapFromNotionFormat(notionPage, mappings) {
  const rowData = new Array(mappings.length + CONSTANTS.COLUMNS.DATA_START - 1);
  
  // 主キー設定
  rowData[CONSTANTS.COLUMNS.PRIMARY_KEY - 1] = notionPage.id;
  
  mappings.forEach((mapping, index) => {
    if (!mapping.isTarget) return;
    
    const notionProperty = notionPage.properties[mapping.notionPropertyName];
    const value = convertFromNotionProperty(notionProperty, mapping.dataType);
    
    rowData[index + CONSTANTS.COLUMNS.DATA_START - 1] = value;
  });
  
  return rowData;
}
```

### 2.5 convertFromNotionProperty(notionProperty, dataType)
**概要:** Notionプロパティをスプレッドシート値に変換
**引数:**
- `notionProperty` (NotionProperty): Notionプロパティデータ
- `dataType` (string): プロパティタイプ
**戻り値:** `any`

```javascript
function convertFromNotionProperty(notionProperty, dataType) {
  if (!notionProperty) return '';
  
  switch (dataType) {
    case 'title':
      return notionProperty.title?.[0]?.text?.content || '';
      
    case 'rich_text':
      return notionProperty.rich_text?.[0]?.text?.content || '';
      
    case 'number':
      return notionProperty.number || 0;
      
    case 'select':
      return notionProperty.select?.name || '';
      
    case 'multi_select':
      return notionProperty.multi_select?.map(item => item.name).join(', ') || '';
      
    case 'date':
      return notionProperty.date?.start || '';
      
    case 'checkbox':
      return notionProperty.checkbox || false;
      
    case 'url':
      return notionProperty.url || '';
      
    case 'email':
      return notionProperty.email || '';
      
    case 'phone_number':
      return notionProperty.phone_number || '';
      
    default:
      return '';
  }
}
```

### 2.6 validateMapping(mappings)
**概要:** カラムマッピング設定の検証
**引数:**
- `mappings` (Array<ColumnMapping>): 検証対象マッピング
**戻り値:** `ValidationResult`

```javascript
function validateMapping(mappings) {
  const errors = [];
  const usedNotionProperties = new Set();
  let hasTitleProperty = false;
  
  mappings.forEach((mapping, index) => {
    if (!mapping.isTarget) return;
    
    // 必須項目チェック
    if (!mapping.notionPropertyName) {
      errors.push(`行${index + 2}: Notionプロパティ名が指定されていません`);
      return;
    }
    
    if (!mapping.dataType) {
      errors.push(`行${index + 2}: データ型が指定されていません`);
      return;
    }
    
    // 重複チェック
    if (usedNotionProperties.has(mapping.notionPropertyName)) {
      errors.push(`行${index + 2}: Notionプロパティ名 '${mapping.notionPropertyName}' が重複しています`);
    }
    usedNotionProperties.add(mapping.notionPropertyName);
    
    // Titleプロパティチェック
    if (mapping.dataType === 'title') {
      if (hasTitleProperty) {
        errors.push(`行${index + 2}: Titleプロパティは1つのみ設定可能です`);
      }
      hasTitleProperty = true;
    }
    
    // サポート対象データ型チェック
    const supportedTypes = [
      'title', 'rich_text', 'number', 'select', 'multi_select',
      'date', 'checkbox', 'url', 'email', 'phone_number'
    ];
    
    if (!supportedTypes.includes(mapping.dataType)) {
      errors.push(`行${index + 2}: サポートされていないデータ型です: ${mapping.dataType}`);
    }
  });
  
  // Titleプロパティの存在チェック
  if (!hasTitleProperty) {
    errors.push('Titleプロパティが設定されていません。少なくとも1つのTitleプロパティが必要です。');
  }
  
  if (errors.length > 0) {
    throw new ValidationError('カラムマッピング検証エラー', errors);
  }
  
  return { valid: true, errors: [] };
}
```

### 2.7 getDataTypeInfo(dataType)
**概要:** データ型の詳細情報を取得
**引数:**
- `dataType` (string): データ型
**戻り値:** `DataTypeInfo`

```javascript
function getDataTypeInfo(dataType) {
  const dataTypeMap = {
    'title': {
      name: 'タイトル',
      description: 'ページのタイトル（必須、1つのみ）',
      example: 'ページタイトル',
      validation: 'テキスト形式'
    },
    'rich_text': {
      name: 'リッチテキスト',
      description: '複数行のテキスト',
      example: '詳細な説明文',
      validation: 'テキスト形式'
    },
    'number': {
      name: '数値',
      description: '数値データ',
      example: '123.45',
      validation: '数値形式'
    },
    'select': {
      name: 'セレクト',
      description: '単一選択',
      example: 'オプション1',
      validation: 'テキスト形式（選択肢と一致）'
    },
    'multi_select': {
      name: 'マルチセレクト',
      description: '複数選択',
      example: 'オプション1, オプション2',
      validation: 'カンマ区切りテキスト'
    },
    'date': {
      name: '日付',
      description: '日付データ',
      example: '2025-08-10',
      validation: '日付形式（YYYY-MM-DD）'
    },
    'checkbox': {
      name: 'チェックボックス',
      description: 'true/false',
      example: 'TRUE',
      validation: 'ブール値'
    },
    'url': {
      name: 'URL',
      description: 'ウェブサイトのURL',
      example: 'https://example.com',
      validation: 'URL形式'
    },
    'email': {
      name: 'メール',
      description: 'メールアドレス',
      example: 'user@example.com',
      validation: 'メール形式'
    },
    'phone_number': {
      name: '電話番号',
      description: '電話番号',
      example: '090-1234-5678',
      validation: 'テキスト形式'
    }
  };
  
  return dataTypeMap[dataType] || {
    name: 'Unknown',
    description: 'サポートされていないデータ型',
    example: '',
    validation: ''
  };
}
```

## 3. データ構造

```typescript
interface NotionPageData {
  properties: Record<string, NotionProperty>;
}

interface NotionProperty {
  title?: Array<{ text: { content: string } }>;
  rich_text?: Array<{ text: { content: string } }>;
  number?: number;
  select?: { name: string };
  multi_select?: Array<{ name: string }>;
  date?: { start: string; end?: string };
  checkbox?: boolean;
  url?: string;
  email?: string;
  phone_number?: string;
}

interface NotionPage {
  id: string;
  created_time: string;
  last_edited_time: string;
  properties: Record<string, NotionProperty>;
}

interface DataTypeInfo {
  name: string;
  description: string;
  example: string;
  validation: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
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
const DATA_MAPPER = {
  // サポートされているデータ型
  SUPPORTED_DATA_TYPES: [
    'title', 'rich_text', 'number', 'select', 'multi_select',
    'date', 'checkbox', 'url', 'email', 'phone_number'
  ],
  
  // 日付フォーマット設定
  DATE_FORMATS: {
    INPUT: ['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY'],
    OUTPUT: 'YYYY-MM-DD'
  },
  
  // マルチセレクトの区切り文字
  MULTI_SELECT_DELIMITER: ',',
  
  // 空値として扱う値
  EMPTY_VALUES: [null, undefined, '', 'null', 'undefined']
};
```

## 5. エラーハンドリング

### 5.1 処理可能なエラー
- データ型変換エラー（TYPE_CONVERSION_ERROR）
- 日付フォーマットエラー（DATE_FORMAT_ERROR）
- マッピング設定エラー（MAPPING_CONFIG_ERROR）
- 必須プロパティ欠損（REQUIRED_PROPERTY_MISSING）

### 5.2 エラー処理方針
- 変換エラーは詳細な情報をユーザーに提供
- 部分的な失敗でも可能な限り処理を継続
- 致命的エラーは即座に処理を停止

## 6. パフォーマンス考慮事項

### 6.1 最適化ポイント
- 大量データ処理時のメモリ使用量
- 文字列変換処理の効率化
- 日付変換のキャッシュ

### 6.2 制限事項
- 1回の処理で扱えるデータ量: 1000件程度
- サポートするファイルサイズ: スプレッドシートの制限に依存

## 7. 依存関係

### 7.1 依存モジュール
- Constants: 定数定義
- Logger: ログ出力

### 7.2 外部依存
- Google Apps Script Date API
- JavaScript標準ライブラリ

## 8. テスト観点

### 8.1 単体テスト項目
- 各データ型の正常変換
- 異常値の処理
- 空値の処理
- 日付フォーマット変換

### 8.2 統合テスト項目
- 実際のNotionデータベースとの互換性
- 大量データの変換性能
