# 実運用検証用テストデータ

## テストシナリオ1: 基本動作確認用データ (5行)

### Import_Data シート
| Import | Title | Status | Priority | Date | Notes |
|--------|-------|--------|----------|------|-------|
| ☐ | 基本テスト1 | 未着手 | 高 | 2025-08-15 | 基本的なデータ入力テスト |
| ☐ | 基本テスト2 | 進行中 | 中 | 2025-08-16 | 進行中ステータステスト |
| ☐ | 基本テスト3 | 完了 | 低 | 2025-08-17 | 完了ステータステスト |
| ☐ | 特殊文字テスト | 未着手 | 高 | 2025-08-18 | "特殊文字 & <> '" を含むテスト |
| ☐ | 長いタイトルのテスト項目です非常に長いタイトルでも正常に処理されることを確認 | 進行中 | 中 | 2025-08-19 | 長いタイトルのテスト |

### Import_Column シート  
| SpreadsheetColumn | NotionProperty | PropertyType |
|------------------|----------------|--------------|
| Title | Name | title |
| Status | Status | select |
| Priority | Priority | select |
| Date | Due Date | date |
| Notes | Notes | rich_text |

### Config シート
| Setting | Value |
|---------|-------|
| NotionDatabaseId | [実際のNotion Database IDを入力] |
| ImportSheetName | Import_Data |
| MappingSheetName | Import_Column |
| StatusColumn | Import |
| ProcessedStatus | ✅ |
| ErrorStatus | ❌ |

## テストシナリオ2: 大量データテスト用 (100行)

### 自動生成用スクリプト
```javascript
function generateTestData() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const startRow = 2; // ヘッダー行の次から
  const numRows = 100;
  
  const statuses = ['未着手', '進行中', '完了', '保留'];
  const priorities = ['高', '中', '低'];
  
  for (let i = 0; i < numRows; i++) {
    const row = startRow + i;
    const status = statuses[i % statuses.length];
    const priority = priorities[i % priorities.length];
    const date = new Date(2025, 7, 10 + (i % 30)); // 8月10日から30日循環
    
    sheet.getRange(row, 1).setValue(false); // Import チェックボックス
    sheet.getRange(row, 2).setValue(`テストタスク${i + 1}`); // Title
    sheet.getRange(row, 3).setValue(status); // Status
    sheet.getRange(row, 4).setValue(priority); // Priority
    sheet.getRange(row, 5).setValue(date); // Date
    sheet.getRange(row, 6).setValue(`テスト項目${i + 1}の詳細説明`); // Notes
  }
  
  Logger.log(`${numRows}行のテストデータを生成しました`);
}
```

## テストシナリオ3: エラーハンドリングテスト用

### エラーケース1: 必須項目不備
| Import | Title | Status | Priority | Date | Notes |
|--------|-------|--------|----------|------|-------|
| ☐ | | 未着手 | 高 | 2025-08-15 | タイトル空白テスト |
| ☐ | 無効ステータステスト | 無効 | 高 | 2025-08-15 | 無効なステータス値 |
| ☐ | 日付形式エラー | 未着手 | 高 | 無効な日付 | 無効な日付形式 |

### エラーケース2: データ型不整合
| Import | Title | Status | Priority | Date | Notes |
|--------|-------|--------|----------|------|-------|
| ☐ | 123456 | 未着手 | 高 | 2025-08-15 | 数値タイトルテスト |
| ☐ | 特殊文字<>&'"テスト | 未着手 | 高 | 2025-08-15 | HTML特殊文字テスト |
| ☐ | 絵文字テスト🎯📊💻 | 未着手 | 高 | 2025-08-15 | 絵文字処理テスト |

## パフォーマンステスト計測用

### 処理時間測定用関数
```javascript
function measureProcessingTime() {
  const startTime = new Date();
  
  // 10行同時処理テスト
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Import_Data');
  const range = sheet.getRange(2, 1, 10, 1); // A2:A11のチェックボックス
  
  // チェックを付ける
  for (let i = 1; i <= 10; i++) {
    range.getCell(i, 1).setValue(true);
    Utilities.sleep(1000); // 1秒間隔で処理
    
    const currentTime = new Date();
    const elapsedTime = currentTime.getTime() - startTime.getTime();
    Logger.log(`${i}行目処理完了: ${elapsedTime}ms経過`);
  }
  
  const endTime = new Date();
  const totalTime = endTime.getTime() - startTime.getTime();
  Logger.log(`総処理時間: ${totalTime}ms (${totalTime/1000}秒)`);
  
  return {
    totalTime: totalTime,
    averagePerRow: totalTime / 10,
    startTime: startTime,
    endTime: endTime
  };
}
```

## 品質確認チェックリスト

### 基本機能確認
- [ ] チェックボックストリガーの動作
- [ ] データ検証の正確性
- [ ] Notion API通信の成功
- [ ] エラーメッセージの適切性
- [ ] 処理状況の表示

### パフォーマンス確認
- [ ] 1行あたりの処理時間 < 5秒
- [ ] 10行同時処理 < 60秒
- [ ] 100行処理 < 300秒（5分）
- [ ] メモリ使用量の安定性
- [ ] API レート制限の遵守

### エラーハンドリング確認
- [ ] 必須項目不備時の適切なエラー
- [ ] 無効データ形式時の処理
- [ ] API通信エラー時の回復
- [ ] 実行時間制限時の処理
- [ ] ユーザーへの分かりやすい通知

### セキュリティ確認
- [ ] APIトークンの適切な管理
- [ ] ログでの機密情報マスキング
- [ ] 不正アクセスの防止
- [ ] データ検証によるインジェクション対策

---

**このテストデータとチェックリストにより、実運用環境での包括的な品質確認が可能です。**
