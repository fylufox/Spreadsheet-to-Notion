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

import { ConfigManager } from '../../src/core/ConfigManager';
import { CONSTANTS } from '../../src/utils/Constants';

// モックシート作成のヘルパー関数
const createMockSheet = (values: any[][] = []) => ({
  getDataRange: jest.fn(() => ({
    getValues: jest.fn(() => values),
  })),
  getLastRow: jest.fn(() => values.length),
  getRange: jest.fn(() => ({
    setValue: jest.fn(),
    setValues: jest.fn(),
  })),
});

// SpreadsheetApp モック
const mockSpreadsheet = {
  getSheetByName: jest.fn(),
};

const mockSpreadsheetApp = {
  getActiveSpreadsheet: jest.fn(() => mockSpreadsheet),
};

// PropertiesService モック
const mockPropertiesService = {
  getScriptProperties: jest.fn(() => ({
    getProperty: jest.fn((key: string) => {
      if (key === CONSTANTS.CONFIG_KEYS.NOTION_API_TOKEN) {
        return 'secret_1234567890123456789012345678901234567890123';
      }
      return null;
    }),
    setProperty: jest.fn(),
  })),
};

// グローバルにモックを設定
(global as any).SpreadsheetApp = mockSpreadsheetApp;
(global as any).PropertiesService = mockPropertiesService;

// Loggerのモック
jest.mock('../../src/utils/Logger', () => ({
  Logger: {
    startTimer: jest.fn(() => 'timer-123'),
    endTimer: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    logError: jest.fn(),
  },
}));

describe('ConfigManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ConfigManager.clearCache();

    // デフォルトのconfigシートモック
    const defaultConfigSheet = createMockSheet([
      ['key', 'value', 'description'],
      [
        'DATABASE_ID',
        '550e8400-e29b-41d4-a716-446655440000',
        'Target database ID',
      ],
      ['PROJECT_NAME', 'Test Project', 'Project name'],
      ['VERSION', '1.0.0', 'System version'],
    ]);

    // デフォルトのマッピングシートモック
    const defaultMappingSheet = createMockSheet([
      [
        'spreadsheet_column',
        'notion_property_name',
        'data_type',
        'is_required',
        'is_target',
      ],
      ['A', 'Title', 'title', 'true', 'true'],
      ['B', 'Description', 'rich_text', 'false', 'true'],
      ['C', 'Priority', 'select', 'false', 'true'],
    ]);

    mockSpreadsheet.getSheetByName.mockImplementation((name: string) => {
      if (name === CONSTANTS.SHEETS.CONFIG) {
        return defaultConfigSheet;
      } else if (name === CONSTANTS.SHEETS.IMPORT_COLUMN) {
        return defaultMappingSheet;
      }
      return null;
    });
  });

  test('getApiToken works correctly', () => {
    const token = ConfigManager.getApiToken();
    expect(token).toBe('secret_1234567890123456789012345678901234567890123');
  });

  test('getConfig returns valid configuration', async () => {
    const config = await ConfigManager.getConfig();
    expect(config.databaseId).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(config.projectName).toBe('Test Project');
    expect(config.version).toBe('1.0.0');
  });

  test('getColumnMappings returns valid mappings', () => {
    const mappings = ConfigManager.getColumnMappings();
    expect(mappings).toHaveLength(3);
    expect(mappings[0].spreadsheetColumn).toBe('A');
    expect(mappings[0].notionPropertyName).toBe('Title');
  });
});
