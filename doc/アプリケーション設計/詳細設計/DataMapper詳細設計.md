# DataMapper モジュール詳細設計

## 1. 役割・概要
**DataMapper** は、静的クラス設計によるデータ変換の中核モジュールです。スプレッドシートデータとNotion API形式間の双方向変換、厳密な型安全性、Validator連携によるデータ整合性確保を提供します。

### 設計方針
- **Static Class Pattern**: ステートレス変換処理・テスト容易性
- **Type Safety**: TypeScript厳密型定義による変換安全性
- **Validator Integration**: 事前検証による変換品質保証
- **Performance Optimization**: タイマー機能・エラー詳細化

## 2. クラス構造

### 2.1 クラス定義
```typescript
export class DataMapper {
  // 主要変換メソッド
  static mapRowToNotionPage(rowData: any[], mappings: ColumnMapping[]): NotionPageData;
  static mapNotionPageToRow(notionPage: NotionPageResponse, mappings: ColumnMapping[]): any[];
  
  // プロパティ変換
  private static convertToNotionProperty(value: any, dataType: string): NotionProperty | null;
  private static convertFromNotionProperty(property: NotionProperty, dataType: string): any;
  
  // ユーティリティ
  private static getColumnIndex(columnName: string): number;
  private static formatDateForNotion(value: any): string;
  private static isEmptyValue(value: any): boolean;
  private static validateRowNumber(rowNumber: number): void;
}

```

## 2. 主要メソッド

### 2.1 mapRowToNotionPage(rowData: any[], mappings: ColumnMapping[]): NotionPageData
**概要:** スプレッドシート行データをNotionページ形式に変換（Validator連携）
**引数:**
- `rowData` (any[]): スプレッドシートの行データ
- `mappings` (ColumnMapping[]): カラムマッピング情報
**戻り値:** NotionPageData
**特徴:** 事前検証、詳細エラー、パフォーマンス計測

```typescript
static mapRowToNotionPage(rowData: any[], mappings: ColumnMapping[]): NotionPageData {
  Logger.startTimer('DataMapper.mapRowToNotionPage');
  
  try {
    // 入力データの事前検証
    const validationResult = Validator.validateRowData(rowData, mappings);
    if (!validationResult.valid) {
      throw new MappingError(
        `Row ${rowNumber} validation failed: ${validationResult.errors.join(', ')}`
      );
    }

    const properties: Record<string, NotionProperty> = {};
    
    // 対象マッピングの処理
    mappings.forEach(mapping => {
      if (!mapping.isTarget) return;
      
      try {
        const columnIndex = this.getColumnIndex(mapping.spreadsheetColumn);
        const value = rowData[columnIndex];
        
        // 空値チェック
        if (this.isEmptyValue(value) && !mapping.isRequired) {
          return; // 空値は設定しない
        }
        
        // Notion形式に変換
        const notionProperty = this.convertToNotionProperty(value, mapping.dataType);
        if (notionProperty !== null) {
          properties[mapping.notionPropertyName] = notionProperty;
        }
      } catch (error) {
        throw new MappingError(
          `Failed to map column '${mapping.spreadsheetColumn}' to '${mapping.notionPropertyName}'`,
          error as Error,
          { mapping, value: rowData[this.getColumnIndex(mapping.spreadsheetColumn)] }
        );
      }
    });

    Logger.debug('Data mapping completed', {
      mappedProperties: Object.keys(properties).length,
      totalMappings: mappings.filter(m => m.isTarget).length
    });

    return { properties };
  } catch (error) {
    Logger.logError('DataMapper.mapRowToNotionPage', error);
    throw error;
  } finally {
    Logger.endTimer('DataMapper.mapRowToNotionPage');
  }
}
```

### 2.2 convertToNotionProperty(value: any, dataType: string): NotionProperty | null
**概要:** 型安全なNotionプロパティ変換
**特徴:** 厳密な型チェック、null安全、詳細エラー

```typescript
private static convertToNotionProperty(value: any, dataType: string): NotionProperty | null {
  // 空値処理
  if (this.isEmptyValue(value)) {
    return null;
  }
  
  try {
    switch (dataType) {
      case CONSTANTS.DATA_TYPES.TITLE:
        return {
          type: 'title',
          title: [{ text: { content: String(value) } }]
        };
        
      case CONSTANTS.DATA_TYPES.RICH_TEXT:
        return {
          type: 'rich_text',
          rich_text: [{ text: { content: String(value) } }]
        };
        
      case CONSTANTS.DATA_TYPES.NUMBER:
        const numValue = Number(value);
        if (isNaN(numValue)) {
          throw new Error(`Cannot convert '${value}' to number`);
        }
        return {
          type: 'number',
          number: numValue
        };
        
      case CONSTANTS.DATA_TYPES.SELECT:
        return {
          type: 'select',
          select: { name: String(value).trim() }
        };
        
      case CONSTANTS.DATA_TYPES.MULTI_SELECT:
        const items = String(value)
          .split(',')
          .map(item => item.trim())
          .filter(item => item.length > 0);
        return {
          type: 'multi_select',
          multi_select: items.map(item => ({ name: item }))
        };
        
      case CONSTANTS.DATA_TYPES.DATE:
        return {
          type: 'date',
          date: { start: this.formatDateForNotion(value) }
        };
        
      case CONSTANTS.DATA_TYPES.CHECKBOX:
        return {
          type: 'checkbox',
          checkbox: Boolean(value)
        };
        
      case CONSTANTS.DATA_TYPES.URL:
        const urlValue = String(value).trim();
        if (urlValue && !urlValue.match(/^https?:\/\//)) {
          throw new Error(`Invalid URL format: ${urlValue}`);
        }
        return {
          type: 'url',
          url: urlValue || null
        };
        
      case CONSTANTS.DATA_TYPES.EMAIL:
        const emailValue = String(value).trim();
        if (emailValue && !emailValue.includes('@')) {
          throw new Error(`Invalid email format: ${emailValue}`);
        }
        return {
          type: 'email',
          email: emailValue || null
        };
        
      case CONSTANTS.DATA_TYPES.PHONE_NUMBER:
        return {
          type: 'phone_number',
          phone_number: String(value).trim() || null
        };
        
      default:
        throw new Error(`Unsupported data type: ${dataType}`);
    }
  } catch (error) {
    throw new Error(`Type conversion failed for '${dataType}': ${error instanceof Error ? error.message : String(error)}`);
  }
}
```

### 2.3 mapNotionPageToRow(notionPage: NotionPageResponse, mappings: ColumnMapping[]): any[]
**概要:** Notionページからスプレッドシート行への逆変換
```typescript
static mapNotionPageToRow(notionPage: NotionPageResponse, mappings: ColumnMapping[]): any[] {
  Logger.startTimer('DataMapper.mapNotionPageToRow');
  
  try {
    const maxColumnIndex = Math.max(
      ...mappings.map(m => this.getColumnIndex(m.spreadsheetColumn))
    );
    const rowData = new Array(maxColumnIndex + 1).fill('');
    
    // 主キー設定
    rowData[CONSTANTS.COLUMNS.PRIMARY_KEY - 1] = notionPage.id;
    
    // マッピング処理
    mappings.forEach(mapping => {
      if (!mapping.isTarget) return;
      
      const property = notionPage.properties[mapping.notionPropertyName];
      if (property) {
        const columnIndex = this.getColumnIndex(mapping.spreadsheetColumn);
        rowData[columnIndex] = this.convertFromNotionProperty(property, mapping.dataType);
      }
    });
    
    return rowData;
  } finally {
    Logger.endTimer('DataMapper.mapNotionPageToRow');
  }
}
```

### 2.4 日付変換・ユーティリティメソッド

#### formatDateForNotion(value: any): string
```typescript
private static formatDateForNotion(value: any): string {
  let date: Date;
  
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'number') {
    // Excelシリアル値対応
    date = new Date((value - 25569) * 86400 * 1000);
  } else if (typeof value === 'string') {
    date = new Date(value);
  } else {
    throw new Error(`Cannot convert value to date: ${value}`);
  }
  
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date value: ${value}`);
  }
  
  // ISO 8601形式 (YYYY-MM-DD)
  return date.toISOString().split('T')[0];
}
```

#### getColumnIndex(columnName: string): number
```typescript
private static getColumnIndex(columnName: string): number {
  // A=0, B=1, C=2, ... の形式でインデックス計算
  if (!/^[A-Z]+$/.test(columnName)) {
    throw new Error(`Invalid column name format: ${columnName}`);
  }
  
  let index = 0;
  for (let i = 0; i < columnName.length; i++) {
    index = index * 26 + (columnName.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
  }
  return index - 1; // 0-based index
}
```

#### isEmptyValue(value: any): boolean
```typescript
private static isEmptyValue(value: any): boolean {
  return value === null || 
         value === undefined || 
         value === '' || 
         value === 'null' || 
         value === 'undefined';
}
```

#### convertFromNotionProperty(property: NotionProperty, dataType: string): any
```typescript
private static convertFromNotionProperty(property: NotionProperty, dataType: string): any {
  if (!property) return '';
  
  try {
    switch (dataType) {
      case CONSTANTS.DATA_TYPES.TITLE:
        return property.type === 'title' && property.title?.[0]?.text?.content || '';
        
      case CONSTANTS.DATA_TYPES.RICH_TEXT:
        return property.type === 'rich_text' && property.rich_text?.[0]?.text?.content || '';
        
      case CONSTANTS.DATA_TYPES.NUMBER:
        return property.type === 'number' ? property.number || 0 : '';
        
      case CONSTANTS.DATA_TYPES.SELECT:
        return property.type === 'select' && property.select?.name || '';
        
      case CONSTANTS.DATA_TYPES.MULTI_SELECT:
        return property.type === 'multi_select' 
          ? property.multi_select?.map(item => item.name).join(', ') || ''
          : '';
        
      case CONSTANTS.DATA_TYPES.DATE:
        return property.type === 'date' && property.date?.start || '';
        
      case CONSTANTS.DATA_TYPES.CHECKBOX:
        return property.type === 'checkbox' ? property.checkbox || false : false;
        
      case CONSTANTS.DATA_TYPES.URL:
        return property.type === 'url' && property.url || '';
        
      case CONSTANTS.DATA_TYPES.EMAIL:
        return property.type === 'email' && property.email || '';
        
      case CONSTANTS.DATA_TYPES.PHONE_NUMBER:
        return property.type === 'phone_number' && property.phone_number || '';
        
      default:
        Logger.logWarning('DataMapper.convertFromNotionProperty', `Unsupported data type: ${dataType}`);
        return '';
    }
  } catch (error) {
    Logger.logError('DataMapper.convertFromNotionProperty', error, { dataType, property });
    return '';
  }
}
```

## 3. 型定義

```typescript
interface ColumnMapping {
  spreadsheetColumn: string;      // A, B, C, ...
  notionPropertyName: string;     // Notionプロパティ名
  dataType: string;              // title, rich_text, number, etc.
  isTarget: boolean;             // 対象フラグ
  isRequired?: boolean;          // 必須フラグ
}

interface NotionPageData {
  properties: Record<string, NotionProperty>;
}

interface NotionProperty {
  type: string;
  // 各プロパティ型の詳細は省略
  [key: string]: any;
}

interface NotionPageResponse {
  id: string;
  created_time: string;
  last_edited_time: string;
  properties: Record<string, NotionProperty>;
}

interface MappingContext {
  mapping: ColumnMapping;
  value: any;
  rowIndex?: number;
}
```

## 4. エラーハンドリング

### 4.1 MappingError
```typescript
class MappingError extends Error {
  constructor(
    message: string,
    public cause?: Error,
    public context?: MappingContext
  ) {
    super(message);
    this.name = 'MappingError';
  }
}
```

### 4.2 エラーパターン
- **型変換エラー:** 無効な数値・日付・URL・メール形式
- **マッピング設定エラー:** 無効なカラム名・重複プロパティ名
- **検証エラー:** 必須フィールド未設定・サポート外データ型
- **データ整合性エラー:** 主キー不一致・データ型不整合

## 5. パフォーマンス特性

### 5.1 計算量
- mapRowToNotionPage: O(n) (nはマッピング数)
- mapNotionPageToRow: O(n) (nはマッピング数)
- 大量データ処理時のバッチ最適化対応

### 5.2 メモリ使用量
- 静的メソッドによる低メモリフットプリント
- 一時オブジェクト生成の最小化
- ガベージコレクション配慮

## 6. テスト戦略

### 6.1 単体テスト (DataMapper.test.ts)
- データ型変換テスト（全11種類）
- エラーハンドリングテスト
- 境界値・異常値テスト
- パフォーマンステスト

### 6.2 統合テスト
- スプレッドシート連携テスト
- Notion API連携テスト
- 双方向変換整合性テスト

## 7. 設計考慮事項

### 7.1 型安全性
- TypeScript strict mode対応
- null安全な実装
- 型ガードによる実行時検証

### 7.2 拡張性
- 新データ型の追加容易性
- カスタム変換ロジックの挿入ポイント
- 設定ベースのマッピング制御

### 7.3 保守性
- 関数分離による責務明確化
- 詳細なログ・エラー情報
- 包括的なユニットテスト

## 8. 関連モジュール

### 8.1 依存関係
- **Validator:** 入力データ検証
- **Logger:** 処理ログ・パフォーマンス計測
- **Constants:** データ型定数・カラム定義
- **types/index.ts:** 型定義

### 8.2 使用箇所
- **TriggerManager:** データ同期処理
- **NotionApiClient:** API送信データ作成
- **統合テスト:** データ整合性検証
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
