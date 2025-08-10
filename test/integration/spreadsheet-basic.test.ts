/**
 * Spreadsheet Basic Integration Tests
 * 
 * スプレッドシート連携の基本的な統合テストのみを実行します。
 * 
 * @license Apache-2.0
 */

import { ConfigManager } from '../../src/core/ConfigManager';
import { TriggerManager } from '../../src/core/TriggerManager';
import sampleConfig from '../fixtures/sample-config.json';
import sampleMappings from '../fixtures/sample-mappings.json';

// Google Apps Script APIのモック
const mockSpreadsheetApp = {
  getActiveSpreadsheet: jest.fn(),
  getUi: jest.fn()
};

const mockPropertiesService = {
  getScriptProperties: jest.fn()
};

// グローバルAPIをモック
(global as any).SpreadsheetApp = mockSpreadsheetApp;
(global as any).PropertiesService = mockPropertiesService;

describe('Spreadsheet Basic Integration Tests', () => {
  let mockProperties: any;
  let mockSpreadsheet: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // ConfigManagerのキャッシュを毎回クリア
    (ConfigManager as any)._cache = null;

    // PropertiesServiceのモック設定（最初に設定）
    mockProperties = {
      getProperty: jest.fn().mockImplementation((key: string) => {
        if (key === 'NOTION_API_TOKEN') {
          return sampleConfig.apiToken;
        }
        return null;
      })
    };

    mockPropertiesService.getScriptProperties.mockReturnValue(mockProperties);

    // ConfigManagerで使用するスプレッドシートのモック設定
    mockSpreadsheet = {
      getSheetByName: jest.fn().mockImplementation((name: string) => {
        if (name === 'config') {
          return {
            getDataRange: jest.fn().mockReturnValue({
              getValues: jest.fn().mockReturnValue([
                ['DATABASE_ID', sampleConfig.notionDatabaseId],
                ['PROJECT_NAME', 'Test Project'],
                ['VERSION', '1.0.0']
              ])
            }),
            getName: jest.fn().mockReturnValue('config')
          };
        }
        if (name === 'import_column') {
          return {
            getDataRange: jest.fn().mockReturnValue({
              getValues: jest.fn().mockReturnValue([
                ['spreadsheetColumn', 'notionPropertyName', 'dataType', 'isTarget', 'isRequired'], // ヘッダー行
                ...sampleMappings.map(mapping => [
                  mapping.spreadsheet_column,
                  mapping.notion_property,
                  mapping.notion_type,
                  'true',
                  mapping.notion_property === 'Title' ? 'true' : 'false'
                ])
              ])
            }),
            getName: jest.fn().mockReturnValue('import_column')
          };
        }
        return null;
      })
    };

    mockSpreadsheetApp.getActiveSpreadsheet.mockReturnValue(mockSpreadsheet);
  });

  afterEach(() => {
    // シングルトンインスタンスをリセット
    (TriggerManager as any)._instance = null;
  });

  describe('Configuration Loading', () => {
    it('should load configuration from spreadsheet', async () => {
      const config = await ConfigManager.getConfig();

      expect(config).toBeDefined();
      expect(config.apiToken).toBe(sampleConfig.apiToken);
      expect(config.databaseId).toBe(sampleConfig.notionDatabaseId);
      expect(config.projectName).toBe('Test Project');
      expect(config.version).toBe('1.0.0');
    });

    it('should load column mappings from spreadsheet', async () => {
      const mappings = await ConfigManager.getColumnMappings();

      expect(mappings).toBeDefined();
      expect(Array.isArray(mappings)).toBe(true);
      expect(mappings.length).toBeGreaterThan(0);
    });
  });

  describe('TriggerManager Integration', () => {
    it('should initialize TriggerManager with spreadsheet context', () => {
      const triggerManager = TriggerManager.getInstance();

      expect(triggerManager).toBeDefined();
      expect(triggerManager).toBeInstanceOf(TriggerManager);
    });

    it('should provide test connection functionality', async () => {
      const triggerManager = TriggerManager.getInstance();

      // testConnectionメソッドが存在することを確認
      expect(typeof triggerManager.testConnection).toBe('function');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing configuration sheet', async () => {
      // ConfigManagerのキャッシュをクリア（重要）
      ConfigManager.clearCache();
      
      // PropertiesServiceからAPIトークンも削除してエラーを確実に発生させる
      mockProperties.getProperty.mockReturnValue(null);
      
      // configシートがない場合のモック
      mockSpreadsheet.getSheetByName.mockImplementation((name: string) => {
        if (name === 'config') {
          return null; // configシートが存在しない
        }
        if (name === 'import_column') {
          return {
            getDataRange: jest.fn().mockReturnValue({
              getValues: jest.fn().mockReturnValue([
                ['spreadsheetColumn', 'notionPropertyName', 'dataType', 'isTarget', 'isRequired'], // ヘッダー行
                ...sampleMappings.map(mapping => [
                  mapping.spreadsheet_column,
                  mapping.notion_property,
                  mapping.notion_type,
                  'true',
                  mapping.notion_property === 'Title' ? 'true' : 'false'
                ])
              ])
            }),
            getName: jest.fn().mockReturnValue('import_column')
          };
        }
        return null;
      });

      await expect(ConfigManager.getConfig()).rejects.toThrow();
    });

    it('should handle missing mapping sheet', async () => {
      // ConfigManagerのキャッシュをクリア（重要）
      ConfigManager.clearCache();
      
      // import_columnシートがない場合のモック
      mockSpreadsheet.getSheetByName.mockImplementation((name: string) => {
        if (name === 'config') {
          return {
            getDataRange: jest.fn().mockReturnValue({
              getValues: jest.fn().mockReturnValue([
                ['DATABASE_ID', sampleConfig.notionDatabaseId],
                ['PROJECT_NAME', 'Test Project'],
                ['VERSION', '1.0.0']
              ])
            }),
            getName: jest.fn().mockReturnValue('config')
          };
        }
        if (name === 'import_column') {
          return null;
        }
        return null;
      });

      // エラーがスローされることを期待
      try {
        await ConfigManager.getColumnMappings();
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Failed to load column mappings');
      }
    });
  });
});
