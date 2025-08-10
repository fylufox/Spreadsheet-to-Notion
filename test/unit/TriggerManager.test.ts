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

import { TriggerManager } from '../../src/core/TriggerManager';
import { ConfigManager } from '../../src/core/ConfigManager';
import { Validator } from '../../src/core/Validator';
import { DataMapper } from '../../src/core/DataMapper';
import { NotionApiClient } from '../../src/core/NotionApiClient';
import { Logger } from '../../src/utils/Logger';
import { CONSTANTS } from '../../src/utils/Constants';
import { EditEvent, ImportResult } from '../../src/types';

// 依存モジュールのモック
jest.mock('../../src/core/ConfigManager');
jest.mock('../../src/core/Validator');
jest.mock('../../src/core/DataMapper');
jest.mock('../../src/core/NotionApiClient');
jest.mock('../../src/utils/Logger');

const mockConfigManager = ConfigManager as jest.Mocked<typeof ConfigManager>;
const mockValidator = Validator as jest.Mocked<typeof Validator>;
const mockDataMapper = DataMapper as jest.Mocked<typeof DataMapper>;
const mockNotionApiClient = NotionApiClient as jest.Mocked<typeof NotionApiClient>;
const mockLogger = Logger as jest.Mocked<typeof Logger>;

// Google Apps Script APIのグローバルモック
const mockSpreadsheetApp = {
  getActiveSpreadsheet: jest.fn(),
  getUi: jest.fn(() => mockUi)
};

const mockSession = {
  getActiveUser: jest.fn()
};

const mockUi = {
  alert: jest.fn(),
  ButtonSet: {
    OK: 'OK'
  }
};

// グローバルスコープにモックを設定
(global as any).SpreadsheetApp = mockSpreadsheetApp;
(global as any).Session = mockSession;

describe('TriggerManager', () => {
  let triggerManager: TriggerManager;
  let mockSheet: any;
  let mockRange: any;
  let mockSpreadsheet: any;

  beforeEach(() => {
    // モックのリセット
    jest.clearAllMocks();

    // スプレッドシートのモック設定
    mockSheet = {
      getLastColumn: jest.fn().mockReturnValue(10),
      getRange: jest.fn(),
      getValues: jest.fn()
    };

    mockRange = {
      getRow: jest.fn().mockReturnValue(2),
      getColumn: jest.fn().mockReturnValue(CONSTANTS.COLUMNS.CHECKBOX),
      getValues: jest.fn().mockReturnValue([['Test Title', '', 'In Progress', '']]), // 主キー列(B列)を空にする
      setValue: jest.fn()
    };

    mockSpreadsheet = {
      getSheetByName: jest.fn().mockReturnValue(mockSheet),
      getUi: jest.fn().mockReturnValue(mockUi)
    };

    mockSheet.getRange.mockReturnValue(mockRange);
    mockSpreadsheetApp.getActiveSpreadsheet.mockReturnValue(mockSpreadsheet);

    mockSession.getActiveUser.mockReturnValue({
      getEmail: jest.fn().mockReturnValue('test@example.com'),
      getUserLoginId: jest.fn().mockReturnValue('test-user-id')
    });

    // ConfigManagerのモック
    mockConfigManager.getConfig.mockResolvedValue({
      databaseId: 'test-database-id',
      projectName: 'test-project',
      version: '1.0.0',
      apiToken: 'test-api-token'
    });

    mockConfigManager.getColumnMappings.mockReturnValue([
      {
        spreadsheetColumn: 'A',
        notionPropertyName: 'Title',
        dataType: 'title',
        isRequired: true,
        isTarget: true
      },
      {
        spreadsheetColumn: 'B',
        notionPropertyName: 'Status',
        dataType: 'select',
        isRequired: false,
        isTarget: true
      }
    ]);

    // Validatorのモック
    mockValidator.validateRowData.mockReturnValue({
      valid: true,
      errors: []
    });

    // DataMapperのモック
    mockDataMapper.mapRowToNotionPage.mockReturnValue({
      properties: {
        'Title': {
          title: [{ text: { content: 'Test Title' } }]
        }
      }
    });

    // Loggerのモック
    mockLogger.info = jest.fn();
    mockLogger.debug = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.startTimer = jest.fn().mockReturnValue('timer-id');
    mockLogger.endTimer = jest.fn();

    // TriggerManagerのインスタンスを取得してエラー履歴をクリア
    triggerManager = TriggerManager.getInstance();
    triggerManager.clearErrorHistory();

    // NotionApiClientのインスタンスメソッドをモック
    const mockNotionClient = {
      createPage: jest.fn().mockResolvedValue({
        id: 'test-page-id',
        created_time: '2025-01-01T00:00:00.000Z',
        properties: {}
      }),
      updatePage: jest.fn().mockResolvedValue({
        id: 'existing-page-id',
        last_edited_time: '2025-01-01T00:00:00.000Z',
        properties: {}
      }),
      testConnection: jest.fn().mockResolvedValue({
        success: true,
        message: '接続テストが成功しました'
      })
    };

    // TriggerManager内のNotionApiClientインスタンスを置き換え
    (triggerManager as any).notionApiClient = mockNotionClient;
  });

  describe('onEdit', () => {
    it('should process checkbox check event successfully', async () => {
      const mockEvent: EditEvent = {
        range: mockRange,
        value: true,
        oldValue: false,
        source: mockSpreadsheet as any,
        user: mockSession.getActiveUser() as any
      };

      await triggerManager.onEdit(mockEvent);

      expect(mockLogger.info).toHaveBeenCalledWith('Edit event triggered', expect.any(Object));
      expect(mockConfigManager.getConfig).toHaveBeenCalled();
      expect(mockConfigManager.getColumnMappings).toHaveBeenCalled();
      expect(mockValidator.validateRowData).toHaveBeenCalled();
      expect(mockDataMapper.mapRowToNotionPage).toHaveBeenCalled();
    });

    it('should skip processing if not checkbox column', async () => {
      mockRange.getColumn.mockReturnValue(3); // Not checkbox column (column 3 instead of 1)

      const mockEvent: EditEvent = {
        range: mockRange,
        value: true,
        oldValue: false,
        source: mockSpreadsheet as any,
        user: mockSession.getActiveUser() as any
      };

      await triggerManager.onEdit(mockEvent);

      expect(mockLogger.debug).toHaveBeenCalledWith('Edit is not in checkbox column, skipping');
      expect(mockConfigManager.getConfig).not.toHaveBeenCalled();
    });

    it('should skip processing if checkbox is not checked', async () => {
      const mockEvent: EditEvent = {
        range: mockRange,
        value: false, // Checkbox not checked
        oldValue: false,
        source: mockSpreadsheet as any,
        user: mockSession.getActiveUser() as any
      };

      await triggerManager.onEdit(mockEvent);

      expect(mockLogger.debug).toHaveBeenCalledWith('Checkbox is not checked, skipping');
      expect(mockConfigManager.getConfig).not.toHaveBeenCalled();
    });

    it('should handle various checkbox checked values', async () => {
      const testValues = [true, 'TRUE', 1, '1'];

      for (const value of testValues) {
        jest.clearAllMocks();
        
        const mockEvent: EditEvent = {
          range: mockRange,
          value: value,
          oldValue: false,
          source: mockSpreadsheet as any,
          user: mockSession.getActiveUser() as any
        };

        await triggerManager.onEdit(mockEvent);

        expect(mockConfigManager.getConfig).toHaveBeenCalled();
      }
    });

    it('should prevent duplicate processing', async () => {
      const mockEvent: EditEvent = {
        range: mockRange,
        value: true,
        oldValue: false,
        source: mockSpreadsheet as any,
        user: mockSession.getActiveUser() as any
      };

      // 最初の処理を開始（processImportが非同期で実行される前に2回目を実行）
      const promise1 = triggerManager.onEdit(mockEvent);
      const promise2 = triggerManager.onEdit(mockEvent);

      await Promise.all([promise1, promise2]);

      expect(mockLogger.warn).toHaveBeenCalledWith('Processing already in progress, skipping');
    });
  });

  describe('processImport', () => {
    it('should create new Notion page successfully', async () => {
      const rowNumber = 2;

      const result = await triggerManager.processImport(rowNumber);

      expect(result.success).toBe(true);
      expect(result.result?.id).toBe('test-page-id');
      expect(mockSheet.getRange).toHaveBeenCalledWith(rowNumber, CONSTANTS.COLUMNS.PRIMARY_KEY);
      expect(mockRange.setValue).toHaveBeenCalledWith('test-page-id');
    });

    it('should update existing Notion page', async () => {
      const rowNumber = 2;
      const existingPageId = 'existing-page-id';
      
      // 主キー列(B列=インデックス1)に既存のページIDがある場合のデータを設定
      mockRange.getValues.mockReturnValue([['Test Title', existingPageId, 'In Progress', '']]);

      const result = await triggerManager.processImport(rowNumber);

      expect(result.success).toBe(true);
      expect(result.result?.id).toBe('existing-page-id');
      expect((triggerManager as any).notionApiClient.updatePage).toHaveBeenCalledWith(
        existingPageId,
        expect.any(Object)
      );
    });

    it('should handle validation errors', async () => {
      const rowNumber = 2;

      mockValidator.validateRowData.mockReturnValue({
        valid: false,
        errors: ['Title is required', 'Invalid data format']
      });

      const result = await triggerManager.processImport(rowNumber);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('データ検証エラー');
    });

    it('should handle API errors', async () => {
      const rowNumber = 2;

      // モックのAPIクライアントでエラーを発生させる
      (triggerManager as any).notionApiClient.createPage = jest.fn().mockRejectedValue(
        new Error('API connection failed')
      );

      const result = await triggerManager.processImport(rowNumber);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('API connection failed');
    });

    it('should handle missing sheet error', async () => {
      const rowNumber = 2;

      mockSpreadsheet.getSheetByName.mockReturnValue(null);

      const result = await triggerManager.processImport(rowNumber);

      expect(result.success).toBe(false);
      // getRowDataがシートがないことを検出した場合のエラーメッセージを確認
      expect(result.error?.message).toMatch(/行データの取得に失敗しました|シート.*が見つかりません/);
    });
  });

  describe('helper methods', () => {
    it('should get row data correctly', async () => {
      const rowNumber = 2;

      await triggerManager.processImport(rowNumber);

      expect(mockSheet.getRange).toHaveBeenCalledWith(rowNumber, 1, 1, 10);
      expect(mockRange.getValues).toHaveBeenCalled();
    });

    it('should record primary key correctly', async () => {
      const rowNumber = 2;

      // 2つ目のモックRangeを作成（主キー記録用）
      const mockPrimaryKeyRange = {
        setValue: jest.fn()
      };

      // getRange呼び出しに応じて異なるモックを返す
      mockSheet.getRange.mockImplementation((row: number, col: number, numRows?: number, numCols?: number) => {
        if (numRows && numCols) {
          // 行データ取得用
          return mockRange;
        } else if (col === CONSTANTS.COLUMNS.PRIMARY_KEY) {
          // 主キー記録用
          return mockPrimaryKeyRange;
        }
        return mockRange;
      });

      await triggerManager.processImport(rowNumber);

      // 主キー記録の呼び出しを確認
      expect(mockSheet.getRange).toHaveBeenCalledWith(rowNumber, CONSTANTS.COLUMNS.PRIMARY_KEY);
      expect(mockPrimaryKeyRange.setValue).toHaveBeenCalledWith('test-page-id');
    });

    it('should show success message', async () => {
      const rowNumber = 2;

      await triggerManager.processImport(rowNumber);

      // Success message is displayed through SpreadsheetApp.getUi().alert()
      expect(mockSpreadsheetApp.getUi).toHaveBeenCalled();
      expect(mockUi.alert).toHaveBeenCalledWith(
        '成功',
        'データの連携が完了しました',
        'OK'
      );
    });
  });

  describe('error handling', () => {
    it('should handle and log errors properly', async () => {
      const rowNumber = 2;
      const testError = new Error('Test error');

      mockConfigManager.getConfig.mockRejectedValue(testError);

      const result = await triggerManager.processImport(rowNumber);

      expect(result.success).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Import process failed',
        expect.objectContaining({ error: testError })
      );
    });

    it('should maintain error history', async () => {
      const rowNumber = 2;

      mockConfigManager.getConfig.mockRejectedValue(new Error('Config error'));

      await triggerManager.processImport(rowNumber);

      const status = triggerManager.getProcessingStatus();
      expect(status.errorHistory.length).toBeGreaterThan(0);
      expect(status.errorHistory[status.errorHistory.length - 1].error).toContain('Config error');
    });

    it('should clear error history', () => {
      triggerManager.clearErrorHistory();

      const status = triggerManager.getProcessingStatus();
      expect(status.errorHistory).toHaveLength(0);
    });
  });

  describe('connection test', () => {
    it('should test connection successfully', async () => {
      const result = await triggerManager.testConnection();

      expect(result.success).toBe(true);
      expect(result.message).toBe('接続テストが成功しました');
    });

    it('should handle connection test failure', async () => {
      // モックのAPIクライアントでエラーを発生させる
      (triggerManager as any).notionApiClient.testConnection = jest.fn().mockRejectedValue(
        new Error('Connection failed')
      );

      const result = await triggerManager.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('接続テストに失敗しました');
    });
  });

  describe('processing status', () => {
    it('should track processing status correctly', async () => {
      const statusBefore = triggerManager.getProcessingStatus();
      expect(statusBefore.isProcessing).toBe(false);

      const promise = triggerManager.processImport(2);
      
      // 処理中の状態は外部からは確認できないが、完了後に確認
      const result = await promise;
      
      const statusAfter = triggerManager.getProcessingStatus();
      expect(statusAfter.isProcessing).toBe(false);
      expect(statusAfter.lastProcessTime).toBeGreaterThan(0);
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const instance1 = TriggerManager.getInstance();
      const instance2 = TriggerManager.getInstance();

      expect(instance1).toBe(instance2);
    });
  });
});
