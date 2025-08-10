/**
 * Copyright 2025 Nakatani Naoya
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Validator } from '../../src/core/Validator';
import { ColumnMapping, ValidationResult } from '../../src/types';
import { CONSTANTS } from '../../src/utils/Constants';

// Logger のモック
jest.mock('../../src/utils/Logger', () => ({
  Logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    logError: jest.fn(),
    startTimer: jest.fn(() => 'timer-1'),
    endTimer: jest.fn()
  }
}));

describe('Validator', () => {
  
  describe('validateRowData', () => {
    const validColumnMappings: ColumnMapping[] = [
      {
        spreadsheetColumn: '0',
        notionPropertyName: 'Title',
        dataType: CONSTANTS.DATA_TYPES.TITLE,
        isRequired: true,
        isTarget: true
      },
      {
        spreadsheetColumn: '1',
        notionPropertyName: 'Description',
        dataType: CONSTANTS.DATA_TYPES.RICH_TEXT,
        isRequired: false,
        isTarget: true
      },
      {
        spreadsheetColumn: '2',
        notionPropertyName: 'Count',
        dataType: CONSTANTS.DATA_TYPES.NUMBER,
        isRequired: false,
        isTarget: true
      }
    ];

    test('正常なデータを検証できる', () => {
      const rowData = ['Test Title', 'Test Description', 100];
      const result = Validator.validateRowData(rowData, validColumnMappings);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('配列以外のデータでエラーになる', () => {
      const rowData = 'not an array' as any;
      const result = Validator.validateRowData(rowData, validColumnMappings);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Row data must be an array');
    });

    test('データが短すぎる場合エラーになる', () => {
      const rowData = ['Title'];
      const result = Validator.validateRowData(rowData, validColumnMappings);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(`Row data must have at least ${CONSTANTS.COLUMNS.DATA_START} columns`);
    });

    test('対象マッピングがない場合エラーになる', () => {
      const noTargetMappings = validColumnMappings.map(m => ({ ...m, isTarget: false }));
      const rowData = ['Test Title', 'Test Description', 100];
      const result = Validator.validateRowData(rowData, noTargetMappings);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('No target column mappings found');
    });

    test('必須フィールドが空の場合エラーになる', () => {
      const rowData = ['', 'Test Description', 100];
      const result = Validator.validateRowData(rowData, validColumnMappings);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Required field '0 (Title)' is empty");
    });

    test('数値型の不正な値でエラーになる', () => {
      const mappingsWithNumber: ColumnMapping[] = [
        {
          spreadsheetColumn: '0',
          notionPropertyName: 'Number',
          dataType: CONSTANTS.DATA_TYPES.NUMBER,
          isRequired: false,
          isTarget: true
        }
      ];
      
      const rowData = ['invalid number', '', ''];
      const result = Validator.validateRowData(rowData, mappingsWithNumber);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Field '0 (Number)' must be a valid number, got 'invalid number'");
    });
  });

  describe('validateMapping', () => {
    test('正常なマッピングを検証できる', () => {
      const mapping: ColumnMapping = {
        spreadsheetColumn: 'A',
        notionPropertyName: 'Title',
        dataType: CONSTANTS.DATA_TYPES.TITLE,
        isRequired: true,
        isTarget: true
      };
      
      const result = Validator.validateMapping(mapping);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('スプレッドシートカラム名が空の場合エラーになる', () => {
      const mapping: ColumnMapping = {
        spreadsheetColumn: '',
        notionPropertyName: 'Title',
        dataType: CONSTANTS.DATA_TYPES.TITLE,
        isRequired: true,
        isTarget: true
      };
      
      const result = Validator.validateMapping(mapping);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Spreadsheet column name is required');
    });

    test('Notionプロパティ名が空の場合エラーになる', () => {
      const mapping: ColumnMapping = {
        spreadsheetColumn: 'A',
        notionPropertyName: '',
        dataType: CONSTANTS.DATA_TYPES.TITLE,
        isRequired: true,
        isTarget: true
      };
      
      const result = Validator.validateMapping(mapping);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Notion property name is required');
    });

    test('データ型が空の場合エラーになる', () => {
      const mapping: ColumnMapping = {
        spreadsheetColumn: 'A',
        notionPropertyName: 'Title',
        dataType: '',
        isRequired: true,
        isTarget: true
      };
      
      const result = Validator.validateMapping(mapping);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Data type is required');
    });

    test('無効なデータ型の場合エラーになる', () => {
      const mapping: ColumnMapping = {
        spreadsheetColumn: 'A',
        notionPropertyName: 'Title',
        dataType: 'invalid_type',
        isRequired: true,
        isTarget: true
      };
      
      const result = Validator.validateMapping(mapping);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Invalid data type 'invalid_type'");
    });

    test('予約語のNotionプロパティ名でエラーになる', () => {
      const mapping: ColumnMapping = {
        spreadsheetColumn: 'A',
        notionPropertyName: 'id',
        dataType: CONSTANTS.DATA_TYPES.TITLE,
        isRequired: true,
        isTarget: true
      };
      
      const result = Validator.validateMapping(mapping);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("'id' is a reserved property name");
    });

    test('長すぎるNotionプロパティ名でエラーになる', () => {
      const mapping: ColumnMapping = {
        spreadsheetColumn: 'A',
        notionPropertyName: 'a'.repeat(101),
        dataType: CONSTANTS.DATA_TYPES.TITLE,
        isRequired: true,
        isTarget: true
      };
      
      const result = Validator.validateMapping(mapping);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Notion property name exceeds maximum length of 100 characters');
    });
  });

  describe('validateMappings', () => {
    const validMappings: ColumnMapping[] = [
      {
        spreadsheetColumn: 'A',
        notionPropertyName: 'Title',
        dataType: CONSTANTS.DATA_TYPES.TITLE,
        isRequired: true,
        isTarget: true
      },
      {
        spreadsheetColumn: 'B',
        notionPropertyName: 'Description',
        dataType: CONSTANTS.DATA_TYPES.RICH_TEXT,
        isRequired: false,
        isTarget: true
      }
    ];

    test('正常なマッピング配列を検証できる', () => {
      const result = Validator.validateMappings(validMappings);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('空の配列でエラーになる', () => {
      const result = Validator.validateMappings([]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Column mappings are required');
    });

    test('配列以外でエラーになる', () => {
      const result = Validator.validateMappings('not array' as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Column mappings are required');
    });

    test('重複するスプレッドシートカラムでエラーになる', () => {
      const duplicateMappings = [
        ...validMappings,
        {
          spreadsheetColumn: 'A',
          notionPropertyName: 'Another',
          dataType: CONSTANTS.DATA_TYPES.RICH_TEXT,
          isRequired: false,
          isTarget: true
        }
      ];
      
      const result = Validator.validateMappings(duplicateMappings);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Duplicate spreadsheet columns: A');
    });

    test('重複するNotionプロパティでエラーになる', () => {
      const duplicateMappings = [
        ...validMappings,
        {
          spreadsheetColumn: 'C',
          notionPropertyName: 'Title',
          dataType: CONSTANTS.DATA_TYPES.RICH_TEXT,
          isRequired: false,
          isTarget: true
        }
      ];
      
      const result = Validator.validateMappings(duplicateMappings);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Duplicate Notion properties: Title');
    });

    test('タイトル型マッピングがない場合エラーになる', () => {
      const noTitleMappings = validMappings.map(m => ({
        ...m,
        dataType: CONSTANTS.DATA_TYPES.RICH_TEXT
      }));
      
      const result = Validator.validateMappings(noTitleMappings);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least one title property mapping is required');
    });

    test('複数のタイトル型マッピングでエラーになる', () => {
      const multipleTitleMappings = [
        ...validMappings,
        {
          spreadsheetColumn: 'C',
          notionPropertyName: 'AnotherTitle',
          dataType: CONSTANTS.DATA_TYPES.TITLE,
          isRequired: false,
          isTarget: true
        }
      ];
      
      const result = Validator.validateMappings(multipleTitleMappings);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Only one title property mapping is allowed');
    });
  });

  describe('データ型別の検証', () => {
    test('テキスト型の検証', () => {
      const mapping: ColumnMapping = {
        spreadsheetColumn: '0',
        notionPropertyName: 'Text',
        dataType: CONSTANTS.DATA_TYPES.RICH_TEXT,
        isRequired: false,
        isTarget: true
      };

      // 正常な値
      let result = Validator.validateRowData(['Valid text', '', ''], [mapping]);
      expect(result.valid).toBe(true);

      // 数値も許可
      result = Validator.validateRowData([123, '', ''], [mapping]);
      expect(result.valid).toBe(true);

      // 長すぎるテキスト
      result = Validator.validateRowData(['a'.repeat(2001), '', ''], [mapping]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Field '0 (Text)' exceeds maximum length of 2000 characters");
    });

    test('数値型の検証', () => {
      const mapping: ColumnMapping = {
        spreadsheetColumn: '0',
        notionPropertyName: 'Number',
        dataType: CONSTANTS.DATA_TYPES.NUMBER,
        isRequired: false,
        isTarget: true
      };

      // 正常な数値
      let result = Validator.validateRowData([123, '', ''], [mapping]);
      expect(result.valid).toBe(true);

      // 数値文字列
      result = Validator.validateRowData(['123.45', '', ''], [mapping]);
      expect(result.valid).toBe(true);

      // 無効な数値
      result = Validator.validateRowData(['not a number', '', ''], [mapping]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Field '0 (Number)' must be a valid number, got 'not a number'");

      // 無限大
      result = Validator.validateRowData([Infinity, '', ''], [mapping]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Field '0 (Number)' must be a finite number, got 'Infinity'");
    });

    test('日付型の検証', () => {
      const mapping: ColumnMapping = {
        spreadsheetColumn: '0',
        notionPropertyName: 'Date',
        dataType: CONSTANTS.DATA_TYPES.DATE,
        isRequired: false,
        isTarget: true
      };

      // 正常なDate
      let result = Validator.validateRowData([new Date(), '', ''], [mapping]);
      expect(result.valid).toBe(true);

      // 日付文字列
      result = Validator.validateRowData(['2023-01-01', '', ''], [mapping]);
      expect(result.valid).toBe(true);

      // Excelシリアル値
      result = Validator.validateRowData([44927, '', ''], [mapping]); // 2023-01-01相当
      expect(result.valid).toBe(true);

      // 無効な日付
      result = Validator.validateRowData(['invalid date', '', ''], [mapping]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Field '0 (Date)' contains invalid date value 'invalid date'");
    });

    test('チェックボックス型の検証', () => {
      const mapping: ColumnMapping = {
        spreadsheetColumn: '0',
        notionPropertyName: 'Checkbox',
        dataType: CONSTANTS.DATA_TYPES.CHECKBOX,
        isRequired: false,
        isTarget: true
      };

      // ブール値
      let result = Validator.validateRowData([true, '', ''], [mapping]);
      expect(result.valid).toBe(true);

      // 数値
      result = Validator.validateRowData([1, '', ''], [mapping]);
      expect(result.valid).toBe(true);

      result = Validator.validateRowData([0, '', ''], [mapping]);
      expect(result.valid).toBe(true);

      // 文字列
      result = Validator.validateRowData(['true', '', ''], [mapping]);
      expect(result.valid).toBe(true);

      result = Validator.validateRowData(['yes', '', ''], [mapping]);
      expect(result.valid).toBe(true);

      // 無効な値
      result = Validator.validateRowData(['invalid', '', ''], [mapping]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Field '0 (Checkbox)' must be a boolean value, got 'invalid'");
    });

    test('URL型の検証', () => {
      const mapping: ColumnMapping = {
        spreadsheetColumn: '0',
        notionPropertyName: 'URL',
        dataType: CONSTANTS.DATA_TYPES.URL,
        isRequired: false,
        isTarget: true
      };

      // 正常なURL
      let result = Validator.validateRowData(['https://example.com', '', ''], [mapping]);
      expect(result.valid).toBe(true);

      // 無効なURL
      result = Validator.validateRowData(['not a url', '', ''], [mapping]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Field '0 (URL)' must be a valid HTTP/HTTPS URL, got 'not a url'");

      // 非文字列
      result = Validator.validateRowData([123, '', ''], [mapping]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Field '0 (URL)' must be a valid URL string, got number");
    });

    test('メール型の検証', () => {
      const mapping: ColumnMapping = {
        spreadsheetColumn: '0',
        notionPropertyName: 'Email',
        dataType: CONSTANTS.DATA_TYPES.EMAIL,
        isRequired: false,
        isTarget: true
      };

      // 正常なメール
      let result = Validator.validateRowData(['test@example.com', '', ''], [mapping]);
      expect(result.valid).toBe(true);

      // 無効なメール
      result = Validator.validateRowData(['invalid email', '', ''], [mapping]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Field '0 (Email)' must be a valid email address, got 'invalid email'");

      // 非文字列
      result = Validator.validateRowData([123, '', ''], [mapping]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Field '0 (Email)' must be a valid email string, got number");
    });

    test('電話番号型の検証', () => {
      const mapping: ColumnMapping = {
        spreadsheetColumn: '0',
        notionPropertyName: 'Phone',
        dataType: CONSTANTS.DATA_TYPES.PHONE_NUMBER,
        isRequired: false,
        isTarget: true
      };

      // 正常な電話番号
      let result = Validator.validateRowData(['090-1234-5678', '', ''], [mapping]);
      expect(result.valid).toBe(true);

      // 数値でも可
      result = Validator.validateRowData([9012345678, '', ''], [mapping]);
      expect(result.valid).toBe(true);

      // 無効な電話番号
      result = Validator.validateRowData(['invalid phone', '', ''], [mapping]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Field '0 (Phone)' must be a valid phone number format, got 'invalid phone'");
    });

    test('セレクト型の検証', () => {
      const mapping: ColumnMapping = {
        spreadsheetColumn: '0',
        notionPropertyName: 'Select',
        dataType: CONSTANTS.DATA_TYPES.SELECT,
        isRequired: true, // 必須にする
        isTarget: true
      };

      // 正常な選択肢
      let result = Validator.validateRowData(['Option1', '', ''], [mapping]);
      expect(result.valid).toBe(true);

      // 空の選択肢
      result = Validator.validateRowData(['', '', ''], [mapping]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Required field '0 (Select)' is empty");

      // 長すぎる選択肢
      result = Validator.validateRowData(['a'.repeat(101), '', ''], [mapping]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Field '0 (Select)' select option exceeds maximum length of 100 characters");
    });
  });

  describe('canConvertToNotionType', () => {
    test('空値は常に変換可能', () => {
      expect(Validator.canConvertToNotionType(null, CONSTANTS.DATA_TYPES.TITLE)).toBe(true);
      expect(Validator.canConvertToNotionType(undefined, CONSTANTS.DATA_TYPES.NUMBER)).toBe(true);
      expect(Validator.canConvertToNotionType('', CONSTANTS.DATA_TYPES.DATE)).toBe(true);
    });

    test('テキスト型への変換', () => {
      expect(Validator.canConvertToNotionType('text', CONSTANTS.DATA_TYPES.TITLE)).toBe(true);
      expect(Validator.canConvertToNotionType(123, CONSTANTS.DATA_TYPES.RICH_TEXT)).toBe(true);
      expect(Validator.canConvertToNotionType(true, CONSTANTS.DATA_TYPES.TITLE)).toBe(true);
    });

    test('数値型への変換', () => {
      expect(Validator.canConvertToNotionType('123', CONSTANTS.DATA_TYPES.NUMBER)).toBe(true);
      expect(Validator.canConvertToNotionType(123, CONSTANTS.DATA_TYPES.NUMBER)).toBe(true);
      expect(Validator.canConvertToNotionType('abc', CONSTANTS.DATA_TYPES.NUMBER)).toBe(false);
      expect(Validator.canConvertToNotionType(Infinity, CONSTANTS.DATA_TYPES.NUMBER)).toBe(false);
    });

    test('日付型への変換', () => {
      expect(Validator.canConvertToNotionType('2023-01-01', CONSTANTS.DATA_TYPES.DATE)).toBe(true);
      expect(Validator.canConvertToNotionType(new Date(), CONSTANTS.DATA_TYPES.DATE)).toBe(true);
      expect(Validator.canConvertToNotionType('invalid date', CONSTANTS.DATA_TYPES.DATE)).toBe(false);
    });

    test('チェックボックス型への変換', () => {
      expect(Validator.canConvertToNotionType(true, CONSTANTS.DATA_TYPES.CHECKBOX)).toBe(true);
      expect(Validator.canConvertToNotionType(1, CONSTANTS.DATA_TYPES.CHECKBOX)).toBe(true);
      expect(Validator.canConvertToNotionType('yes', CONSTANTS.DATA_TYPES.CHECKBOX)).toBe(true);
      expect(Validator.canConvertToNotionType('invalid', CONSTANTS.DATA_TYPES.CHECKBOX)).toBe(false);
    });

    test('URL型への変換', () => {
      expect(Validator.canConvertToNotionType('https://example.com', CONSTANTS.DATA_TYPES.URL)).toBe(true);
      expect(Validator.canConvertToNotionType('invalid url', CONSTANTS.DATA_TYPES.URL)).toBe(false);
    });

    test('メール型への変換', () => {
      expect(Validator.canConvertToNotionType('test@example.com', CONSTANTS.DATA_TYPES.EMAIL)).toBe(true);
      expect(Validator.canConvertToNotionType('invalid email', CONSTANTS.DATA_TYPES.EMAIL)).toBe(false);
    });

    test('電話番号型への変換', () => {
      expect(Validator.canConvertToNotionType('090-1234-5678', CONSTANTS.DATA_TYPES.PHONE_NUMBER)).toBe(true);
      expect(Validator.canConvertToNotionType('invalid phone', CONSTANTS.DATA_TYPES.PHONE_NUMBER)).toBe(false);
    });

    test('不明なデータ型', () => {
      expect(Validator.canConvertToNotionType('value', 'unknown_type')).toBe(false);
    });
  });

  describe('エラーハンドリング', () => {
    test('validateRowDataでの例外処理', () => {
      // 無効なマッピングデータで例外が発生する状況を作る
      const invalidMappings = null as any;
      const rowData = ['test', '', ''];
      
      const result = Validator.validateRowData(rowData, invalidMappings);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toMatch(/Validation error:/);
    });
  });
});
