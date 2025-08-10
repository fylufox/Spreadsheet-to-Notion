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

import { DataMapper } from '../../src/core/DataMapper';
import { ColumnMapping, MappingError } from '../../src/types';
import { CONSTANTS } from '../../src/utils/Constants';

// Logger のモック
jest.mock('../../src/utils/Logger', () => ({
  Logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    logError: jest.fn(),
    startTimer: jest.fn(() => 'timer-1'),
    endTimer: jest.fn()
  }
}));

// Validator のモック
jest.mock('../../src/core/Validator', () => ({
  Validator: {
    validateRowData: jest.fn(() => ({ valid: true, errors: [] })),
    canConvertToNotionType: jest.fn(() => true)
  }
}));

describe('DataMapper', () => {
  
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

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Validatorのモックをデフォルトで成功にする
    const { Validator } = require('../../src/core/Validator');
    Validator.validateRowData.mockReturnValue({ valid: true, errors: [] });
    Validator.canConvertToNotionType.mockReturnValue(true);
  });

  describe('mapRowToNotionPage', () => {
    test('正常なデータを変換できる', () => {
      const rowData = ['Test Title', 'Test Description', 100];
      const result = DataMapper.mapRowToNotionPage(rowData, validColumnMappings);
      
      expect(result.properties).toHaveProperty('Title');
      expect(result.properties).toHaveProperty('Description');
      expect(result.properties).toHaveProperty('Count');
      
      expect(result.properties.Title.type).toBe('title');
      expect(result.properties.Title.title[0].text.content).toBe('Test Title');
      
      expect(result.properties.Description.type).toBe('rich_text');
      expect(result.properties.Description.rich_text[0].text.content).toBe('Test Description');
      
      expect(result.properties.Count.type).toBe('number');
      expect(result.properties.Count.number).toBe(100);
    });

    test('空のオプションフィールドはスキップされる', () => {
      const rowData = ['Test Title', '', ''];
      const result = DataMapper.mapRowToNotionPage(rowData, validColumnMappings);
      
      expect(result.properties).toHaveProperty('Title');
      expect(result.properties).not.toHaveProperty('Description');
      expect(result.properties).not.toHaveProperty('Count');
    });

    test('検証エラーがある場合は例外が発生', () => {
      const { Validator } = require('../../src/core/Validator');
      Validator.validateRowData.mockReturnValue({
        valid: false,
        errors: ['Validation error']
      });
      
      const rowData = ['Test Title'];
      
      expect(() => {
        DataMapper.mapRowToNotionPage(rowData, validColumnMappings);
      }).toThrow(MappingError);
    });

    test('対象マッピングがない場合は例外が発生', () => {
      const noTargetMappings = validColumnMappings.map(m => ({ ...m, isTarget: false }));
      const rowData = ['Test Title', 'Description', 100];
      
      expect(() => {
        DataMapper.mapRowToNotionPage(rowData, noTargetMappings);
      }).toThrow(MappingError);
    });

    test('タイトルプロパティがない場合は例外が発生', () => {
      const noTitleMappings = validColumnMappings.map(m => 
        m.dataType === 'title' ? { ...m, dataType: 'rich_text' } : m
      );
      const rowData = ['Test Title', 'Description', 100];
      
      expect(() => {
        DataMapper.mapRowToNotionPage(rowData, noTitleMappings);
      }).toThrow(MappingError);
    });
  });

  describe('mapRowsToNotionPages', () => {
    test('複数行のデータを変換できる', () => {
      const rowsData = [
        ['Title 1', 'Desc 1', 10],
        ['Title 2', 'Desc 2', 20],
        ['Title 3', 'Desc 3', 30]
      ];
      
      const results = DataMapper.mapRowsToNotionPages(rowsData, validColumnMappings);
      
      expect(results).toHaveLength(3);
      expect(results[0].properties.Title.title[0].text.content).toBe('Title 1');
      expect(results[1].properties.Title.title[0].text.content).toBe('Title 2');
      expect(results[2].properties.Title.title[0].text.content).toBe('Title 3');
    });

    test('一部の行にエラーがある場合は成功した行のみ返す', () => {
      const { Validator } = require('../../src/core/Validator');
      
      // 2行目でエラーが発生するように設定
      Validator.validateRowData
        .mockReturnValueOnce({ valid: true, errors: [] })
        .mockReturnValueOnce({ valid: false, errors: ['Error'] })
        .mockReturnValueOnce({ valid: true, errors: [] });
      
      const rowsData = [
        ['Title 1', 'Desc 1', 10],
        ['Title 2', 'Desc 2', 20],
        ['Title 3', 'Desc 3', 30]
      ];
      
      const results = DataMapper.mapRowsToNotionPages(rowsData, validColumnMappings);
      
      expect(results).toHaveLength(2);
      expect(results[0].properties.Title.title[0].text.content).toBe('Title 1');
      expect(results[1].properties.Title.title[0].text.content).toBe('Title 3');
    });
  });

  describe('データ型変換', () => {
    test('タイトル型の変換', () => {
      const mapping: ColumnMapping = {
        spreadsheetColumn: '0',
        notionPropertyName: 'Title',
        dataType: CONSTANTS.DATA_TYPES.TITLE,
        isRequired: true,
        isTarget: true
      };
      
      const rowData = ['Test Title', '', ''];
      const result = DataMapper.mapRowToNotionPage(rowData, [mapping]);
      
      expect(result.properties.Title.type).toBe('title');
      expect(result.properties.Title.title[0].text.content).toBe('Test Title');
    });

    test('リッチテキスト型の変換', () => {
      const titleMapping: ColumnMapping = {
        spreadsheetColumn: '0',
        notionPropertyName: 'Title',
        dataType: CONSTANTS.DATA_TYPES.TITLE,
        isRequired: true,
        isTarget: true
      };
      
      const mapping: ColumnMapping = {
        spreadsheetColumn: '1',
        notionPropertyName: 'RichText',
        dataType: CONSTANTS.DATA_TYPES.RICH_TEXT,
        isRequired: false,
        isTarget: true
      };
      
      const rowData = ['Title', 'Rich text content', ''];
      const result = DataMapper.mapRowToNotionPage(rowData, [titleMapping, mapping]);
      
      expect(result.properties.RichText.type).toBe('rich_text');
      expect(result.properties.RichText.rich_text[0].text.content).toBe('Rich text content');
    });

    test('数値型の変換', () => {
      const titleMapping: ColumnMapping = {
        spreadsheetColumn: '0',
        notionPropertyName: 'Title',
        dataType: CONSTANTS.DATA_TYPES.TITLE,
        isRequired: true,
        isTarget: true
      };
      
      const numberMapping: ColumnMapping = {
        spreadsheetColumn: '1',
        notionPropertyName: 'Number',
        dataType: CONSTANTS.DATA_TYPES.NUMBER,
        isRequired: false,
        isTarget: true
      };
      
      const rowData = ['Title', 123.45, ''];
      const result = DataMapper.mapRowToNotionPage(rowData, [titleMapping, numberMapping]);
      
      expect(result.properties.Number.type).toBe('number');
      expect(result.properties.Number.number).toBe(123.45);
    });

    test('日付型の変換', () => {
      const titleMapping: ColumnMapping = {
        spreadsheetColumn: '0',
        notionPropertyName: 'Title',
        dataType: CONSTANTS.DATA_TYPES.TITLE,
        isRequired: true,
        isTarget: true
      };
      
      const dateMapping: ColumnMapping = {
        spreadsheetColumn: '1',
        notionPropertyName: 'Date',
        dataType: CONSTANTS.DATA_TYPES.DATE,
        isRequired: false,
        isTarget: true
      };
      
      const testDate = new Date('2023-01-01');
      const rowData = ['Title', testDate, ''];
      const result = DataMapper.mapRowToNotionPage(rowData, [titleMapping, dateMapping]);
      
      expect(result.properties.Date.type).toBe('date');
      expect(result.properties.Date.date.start).toBe('2023-01-01');
    });

    test('日付文字列の変換', () => {
      const titleMapping: ColumnMapping = {
        spreadsheetColumn: '0',
        notionPropertyName: 'Title',
        dataType: CONSTANTS.DATA_TYPES.TITLE,
        isRequired: true,
        isTarget: true
      };
      
      const dateMapping: ColumnMapping = {
        spreadsheetColumn: '1',
        notionPropertyName: 'Date',
        dataType: CONSTANTS.DATA_TYPES.DATE,
        isRequired: false,
        isTarget: true
      };
      
      const rowData = ['Title', '2023-01-01', ''];
      const result = DataMapper.mapRowToNotionPage(rowData, [titleMapping, dateMapping]);
      
      expect(result.properties.Date.type).toBe('date');
      expect(result.properties.Date.date.start).toBe('2023-01-01');
    });

    test('チェックボックス型の変換 - ブール値', () => {
      const titleMapping: ColumnMapping = {
        spreadsheetColumn: '0',
        notionPropertyName: 'Title',
        dataType: CONSTANTS.DATA_TYPES.TITLE,
        isRequired: true,
        isTarget: true
      };
      
      const checkboxMapping: ColumnMapping = {
        spreadsheetColumn: '1',
        notionPropertyName: 'Checkbox',
        dataType: CONSTANTS.DATA_TYPES.CHECKBOX,
        isRequired: false,
        isTarget: true
      };
      
      const rowData = ['Title', true, ''];
      const result = DataMapper.mapRowToNotionPage(rowData, [titleMapping, checkboxMapping]);
      
      expect(result.properties.Checkbox.type).toBe('checkbox');
      expect(result.properties.Checkbox.checkbox).toBe(true);
    });

    test('チェックボックス型の変換 - 文字列', () => {
      const titleMapping: ColumnMapping = {
        spreadsheetColumn: '0',
        notionPropertyName: 'Title',
        dataType: CONSTANTS.DATA_TYPES.TITLE,
        isRequired: true,
        isTarget: true
      };
      
      const checkboxMapping: ColumnMapping = {
        spreadsheetColumn: '1',
        notionPropertyName: 'Checkbox',
        dataType: CONSTANTS.DATA_TYPES.CHECKBOX,
        isRequired: false,
        isTarget: true
      };
      
      const rowData = ['Title', 'yes', ''];
      const result = DataMapper.mapRowToNotionPage(rowData, [titleMapping, checkboxMapping]);
      
      expect(result.properties.Checkbox.type).toBe('checkbox');
      expect(result.properties.Checkbox.checkbox).toBe(true);
    });

    test('セレクト型の変換', () => {
      const titleMapping: ColumnMapping = {
        spreadsheetColumn: '0',
        notionPropertyName: 'Title',
        dataType: CONSTANTS.DATA_TYPES.TITLE,
        isRequired: true,
        isTarget: true
      };
      
      const selectMapping: ColumnMapping = {
        spreadsheetColumn: '1',
        notionPropertyName: 'Select',
        dataType: CONSTANTS.DATA_TYPES.SELECT,
        isRequired: false,
        isTarget: true
      };
      
      const rowData = ['Title', 'Option A', ''];
      const result = DataMapper.mapRowToNotionPage(rowData, [titleMapping, selectMapping]);
      
      expect(result.properties.Select.type).toBe('select');
      expect(result.properties.Select.select.name).toBe('Option A');
    });

    test('マルチセレクト型の変換', () => {
      const titleMapping: ColumnMapping = {
        spreadsheetColumn: '0',
        notionPropertyName: 'Title',
        dataType: CONSTANTS.DATA_TYPES.TITLE,
        isRequired: true,
        isTarget: true
      };
      
      const multiSelectMapping: ColumnMapping = {
        spreadsheetColumn: '1',
        notionPropertyName: 'MultiSelect',
        dataType: CONSTANTS.DATA_TYPES.MULTI_SELECT,
        isRequired: false,
        isTarget: true
      };
      
      const rowData = ['Title', 'Option A, Option B, Option C', ''];
      const result = DataMapper.mapRowToNotionPage(rowData, [titleMapping, multiSelectMapping]);
      
      expect(result.properties.MultiSelect.type).toBe('multi_select');
      expect(result.properties.MultiSelect.multi_select).toHaveLength(3);
      expect(result.properties.MultiSelect.multi_select[0].name).toBe('Option A');
      expect(result.properties.MultiSelect.multi_select[1].name).toBe('Option B');
      expect(result.properties.MultiSelect.multi_select[2].name).toBe('Option C');
    });

    test('URL型の変換', () => {
      const titleMapping: ColumnMapping = {
        spreadsheetColumn: '0',
        notionPropertyName: 'Title',
        dataType: CONSTANTS.DATA_TYPES.TITLE,
        isRequired: true,
        isTarget: true
      };
      
      const urlMapping: ColumnMapping = {
        spreadsheetColumn: '1',
        notionPropertyName: 'URL',
        dataType: CONSTANTS.DATA_TYPES.URL,
        isRequired: false,
        isTarget: true
      };
      
      const rowData = ['Title', 'https://example.com', ''];
      const result = DataMapper.mapRowToNotionPage(rowData, [titleMapping, urlMapping]);
      
      expect(result.properties.URL.type).toBe('url');
      expect(result.properties.URL.url).toBe('https://example.com');
    });

    test('メール型の変換', () => {
      const titleMapping: ColumnMapping = {
        spreadsheetColumn: '0',
        notionPropertyName: 'Title',
        dataType: CONSTANTS.DATA_TYPES.TITLE,
        isRequired: true,
        isTarget: true
      };
      
      const emailMapping: ColumnMapping = {
        spreadsheetColumn: '1',
        notionPropertyName: 'Email',
        dataType: CONSTANTS.DATA_TYPES.EMAIL,
        isRequired: false,
        isTarget: true
      };
      
      const rowData = ['Title', 'test@example.com', ''];
      const result = DataMapper.mapRowToNotionPage(rowData, [titleMapping, emailMapping]);
      
      expect(result.properties.Email.type).toBe('email');
      expect(result.properties.Email.email).toBe('test@example.com');
    });

    test('電話番号型の変換', () => {
      const titleMapping: ColumnMapping = {
        spreadsheetColumn: '0',
        notionPropertyName: 'Title',
        dataType: CONSTANTS.DATA_TYPES.TITLE,
        isRequired: true,
        isTarget: true
      };
      
      const phoneMapping: ColumnMapping = {
        spreadsheetColumn: '1',
        notionPropertyName: 'Phone',
        dataType: CONSTANTS.DATA_TYPES.PHONE_NUMBER,
        isRequired: false,
        isTarget: true
      };
      
      const rowData = ['Title', '090-1234-5678', ''];
      const result = DataMapper.mapRowToNotionPage(rowData, [titleMapping, phoneMapping]);
      
      expect(result.properties.Phone.type).toBe('phone_number');
      expect(result.properties.Phone.phone_number).toBe('090-1234-5678');
    });
  });

  describe('エラーハンドリング', () => {
    test('無効な数値でエラーが発生', () => {
      const titleMapping: ColumnMapping = {
        spreadsheetColumn: '0',
        notionPropertyName: 'Title',
        dataType: CONSTANTS.DATA_TYPES.TITLE,
        isRequired: true,
        isTarget: true
      };
      
      const numberMapping: ColumnMapping = {
        spreadsheetColumn: '1',
        notionPropertyName: 'Number',
        dataType: CONSTANTS.DATA_TYPES.NUMBER,
        isRequired: true,
        isTarget: true
      };
      
      const rowData = ['Title', 'invalid number', ''];
      
      expect(() => {
        DataMapper.mapRowToNotionPage(rowData, [titleMapping, numberMapping]);
      }).toThrow(MappingError);
    });

    test('無効な日付でエラーが発生', () => {
      const titleMapping: ColumnMapping = {
        spreadsheetColumn: '0',
        notionPropertyName: 'Title',
        dataType: CONSTANTS.DATA_TYPES.TITLE,
        isRequired: true,
        isTarget: true
      };
      
      const dateMapping: ColumnMapping = {
        spreadsheetColumn: '1',
        notionPropertyName: 'Date',
        dataType: CONSTANTS.DATA_TYPES.DATE,
        isRequired: true,
        isTarget: true
      };
      
      const rowData = ['Title', 'invalid date', ''];
      
      expect(() => {
        DataMapper.mapRowToNotionPage(rowData, [titleMapping, dateMapping]);
      }).toThrow(MappingError);
    });

    test('無効なURLでエラーが発生', () => {
      const titleMapping: ColumnMapping = {
        spreadsheetColumn: '0',
        notionPropertyName: 'Title',
        dataType: CONSTANTS.DATA_TYPES.TITLE,
        isRequired: true,
        isTarget: true
      };
      
      const urlMapping: ColumnMapping = {
        spreadsheetColumn: '1',
        notionPropertyName: 'URL',
        dataType: CONSTANTS.DATA_TYPES.URL,
        isRequired: true,
        isTarget: true
      };
      
      const rowData = ['Title', 'invalid url', ''];
      
      expect(() => {
        DataMapper.mapRowToNotionPage(rowData, [titleMapping, urlMapping]);
      }).toThrow(MappingError);
    });
  });

  describe('ユーティリティメソッド', () => {
    test('getMappingStats', () => {
      const stats = DataMapper.getMappingStats(validColumnMappings);
      
      expect(stats.totalMappings).toBe(3);
      expect(stats.targetMappings).toBe(3);
      expect(stats.requiredMappings).toBe(1);
      expect(stats.dataTypeBreakdown.title).toBe(1);
      expect(stats.dataTypeBreakdown.rich_text).toBe(1);
      expect(stats.dataTypeBreakdown.number).toBe(1);
    });

    test('checkDataCompatibility - 互換性あり', () => {
      const rowData = ['Test Title', 'Description', 123];
      const compatibility = DataMapper.checkDataCompatibility(rowData, validColumnMappings);
      
      expect(compatibility.compatible).toBe(true);
      expect(compatibility.issues).toEqual([]);
    });

    test('checkDataCompatibility - 互換性なし', () => {
      const { Validator } = require('../../src/core/Validator');
      Validator.canConvertToNotionType.mockReturnValue(false);
      
      const rowData = ['Test Title', 'Description', 'invalid number'];
      const compatibility = DataMapper.checkDataCompatibility(rowData, validColumnMappings);
      
      expect(compatibility.compatible).toBe(false);
      expect(compatibility.issues.length).toBeGreaterThan(0);
    });
  });

  describe('長いテキストの処理', () => {
    test('タイトルが2000文字を超える場合は切り詰められる', () => {
      const longTitle = 'a'.repeat(2500);
      const mapping: ColumnMapping = {
        spreadsheetColumn: '0',
        notionPropertyName: 'Title',
        dataType: CONSTANTS.DATA_TYPES.TITLE,
        isRequired: true,
        isTarget: true
      };
      
      const rowData = [longTitle, '', ''];
      const result = DataMapper.mapRowToNotionPage(rowData, [mapping]);
      
      expect(result.properties.Title.title[0].text.content).toHaveLength(2000);
    });

    test('URLが2000文字を超える場合は切り詰められる', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2500);
      const titleMapping: ColumnMapping = {
        spreadsheetColumn: '0',
        notionPropertyName: 'Title',
        dataType: CONSTANTS.DATA_TYPES.TITLE,
        isRequired: true,
        isTarget: true
      };
      
      const urlMapping: ColumnMapping = {
        spreadsheetColumn: '1',
        notionPropertyName: 'URL',
        dataType: CONSTANTS.DATA_TYPES.URL,
        isRequired: false,
        isTarget: true
      };
      
      const rowData = ['Title', longUrl, ''];
      const result = DataMapper.mapRowToNotionPage(rowData, [titleMapping, urlMapping]);
      
      expect(result.properties.URL.url.length).toBeLessThanOrEqual(2000);
    });
  });
});
