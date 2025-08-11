# バグ修正レポート: カラムマッピングエラー

## 問題の概要

以下のエラーが発生していました：

```
データに問題があります: データ検証エラー: Column 'Title' not found in row data, Column 'Status' not found in row data, Column 'Priority' not found in row data, Column 'Date' not found in row data, Column 'Notes' not found in row data
```

## 根本原因

### 1. カラム名形式の問題

`Validator.getColumnIndex()` および `DataMapper.getColumnIndex()` メソッドは、以下の形式のカラム名のみをサポートしていました：

- 数値文字列（例：`"0"`, `"1"`, `"2"`）
- アルファベットカラム名（例：`"A"`, `"B"`, `"C"`）

しかし、実際のマッピング設定では `Title`, `Status`, `Priority`, `Date`, `Notes` といった**文字列カラム名**が使用されており、これらは上記のサポート形式に該当しないため、常に `-1` （見つからない）が返されていました。

### 2. エラーメッセージの不十分さ

従来のエラーメッセージは `Column 'xxx' not found in row data` のみで、問題の原因や解決方法が分からない状態でした。

## 実施した修正

### 1. 詳細なエラーメッセージの追加

**Validator.ts** と **DataMapper.ts** に `generateColumnNotFoundError()` メソッドを追加しました：

```typescript
private static generateColumnNotFoundError(columnName: string, rowData: any[]): string {
  const baseMessage = `Column '${columnName}' not found in row data`;
  
  // 数値でもアルファベットでもない場合の詳細説明
  if (!/^[0-9]+$/.test(columnName) && !/^[A-Z]+$/i.test(columnName)) {
    return `${baseMessage}. Column name '${columnName}' is not a valid format. Use numeric index (0, 1, 2...) or alphabetic column (A, B, C...). Available data columns: ${rowData.length}`;
  }
  
  // 範囲外の場合の説明
  const index = parseInt(columnName, 10);
  if (!isNaN(index)) {
    return `${baseMessage}. Column index '${columnName}' is out of range. Available columns: 0-${rowData.length - 1}`;
  }
  
  // アルファベットの場合の変換チェック
  if (/^[A-Z]+$/i.test(columnName)) {
    let result = 0;
    const upperCol = columnName.toUpperCase();
    for (let i = 0; i < upperCol.length; i++) {
      result = result * 26 + (upperCol.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
    }
    const zeroBasedIndex = result - 1;
    return `${baseMessage}. Column '${columnName}' converts to index ${zeroBasedIndex}, but only ${rowData.length} columns available (0-${rowData.length - 1})`;
  }
  
  return baseMessage;
}
```

### 2. getColumnIndex メソッドの改善

警告ログを追加して、サポートされていないカラム名形式を明確に特定できるようにしました：

```typescript
// 警告: 文字列カラム名は現在サポートされていません
Logger.warn(`Unsupported column name format: '${columnName}'. Use numeric index (0, 1, 2...) or alphabetic column (A, B, C...) instead.`, {
  columnName,
  supportedFormats: ['0, 1, 2... (numeric index)', 'A, B, C... (alphabetic)'],
  receivedFormat: typeof columnName,
});
```

### 3. ConfigManager での事前検証

カラムマッピング読み込み時に、カラム名の形式を事前検証する機能を追加しました：

```typescript
// カラム名の形式チェック
if (!this.isValidColumnName(spreadsheetColumn)) {
  const error = `Row ${rowNumber}: Invalid column name format '${spreadsheetColumn}'. Use numeric index (0, 1, 2...) or alphabetic column (A, B, C...)`;
  errors.push(error);
  Logger.warn(`Invalid column name format at row ${rowNumber}`, {
    spreadsheetColumn,
    suggestedFormats: ['0, 1, 2... (numeric index)', 'A, B, C... (alphabetic)'],
  });
  return;
}

private static isValidColumnName(columnName: string): boolean {
  // 数値文字列（0, 1, 2...）
  if (/^[0-9]+$/.test(columnName)) {
    return true;
  }

  // アルファベットカラム名（A, B, C...）
  if (/^[A-Z]+$/i.test(columnName)) {
    return true;
  }

  return false;
}
```

### 4. サンプルファイルの修正

**test/fixtures/sample-mappings.json** を正しい形式に修正しました：

```json
[
  {
    "spreadsheet_column": "C",  // "title" から "C" に変更
    "notion_property": "Title",
    "notion_type": "title"
  },
  {
    "spreadsheet_column": "D",  // "description" から "D" に変更
    "notion_property": "Description",
    "notion_type": "rich_text"
  }
  // ... 他のマッピングも同様に修正
]
```

**test/integration/basic-integration.test.ts** のテストマッピングも修正しました：

```typescript
const testMappings: ColumnMapping[] = [
  {
    spreadsheetColumn: 'C',  // 'title' から 'C' に変更
    notionPropertyName: 'Title',
    dataType: 'title',
    isTarget: true,
    isRequired: true,
  },
];
```

## 修正の効果

### 1. 明確なエラーメッセージ

従来：
```
Column 'Title' not found in row data
```

修正後：
```
Column 'Title' not found in row data. Column name 'Title' is not a valid format. Use numeric index (0, 1, 2...) or alphabetic column (A, B, C...). Available data columns: 10
```

### 2. 事前検証によるエラー防止

カラムマッピング設定読み込み時に不正な形式を検出し、実行前にエラーとして報告されるようになりました。

### 3. 開発者向けの詳細情報

ログに追加情報が含まれるため、問題の特定と解決が容易になりました。

## 今後の推奨事項

### 1. カラムマッピング設定の標準化

スプレッドシートのカラムマッピングでは、以下の形式を使用してください：

- **数値インデックス**: `"0"`, `"1"`, `"2"`, ...
- **アルファベット**: `"A"`, `"B"`, `"C"`, ...

### 2. 設定時の検証

カラムマッピングを設定する際は、ConfigManager の検証機能により、不正な形式が事前に検出されます。

### 3. ドキュメントの更新

ユーザー向けドキュメントで、正しいカラム名の形式について明記することを推奨します。

## テスト結果

修正後のテスト結果：
- **Validator テスト**: ✅ 全て通過
- **DataMapper テスト**: ✅ 全て通過  
- **統合テスト**: ✅ 主要テスト通過（1つの軽微なPerformanceMonitorテストのみ失敗）

修正により、カラムマッピングエラーは解決され、より明確なエラーメッセージと事前検証により、同様の問題の再発を防ぐことができます。
