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

import { NotionApiClient } from '../../src/core/NotionApiClient';
import { ConfigManager } from '../../src/core/ConfigManager';
import { Logger } from '../../src/utils/Logger';
import { CONSTANTS } from '../../src/utils/Constants';
import { ApiError } from '../../src/types';

// Google Apps Script APIのモック
const mockUrlFetchApp = {
  fetch: jest.fn(),
};

// グローバルにモックを設定
(global as any).UrlFetchApp = mockUrlFetchApp;

// ConfigManagerとLoggerのモック
jest.mock('../../src/core/ConfigManager');
jest.mock('../../src/utils/Logger');

const mockConfigManager = ConfigManager as jest.Mocked<typeof ConfigManager>;
const mockLogger = Logger as jest.Mocked<typeof Logger>;

describe('NotionApiClient', () => {
  let client: NotionApiClient;
  let mockResponse: any;

  beforeEach(() => {
    client = new NotionApiClient();

    // モックのリセット
    jest.clearAllMocks();
    client.resetRateLimit();

    // デフォルトのモック設定
    mockConfigManager.getApiToken.mockReturnValue('test-api-token');
    mockConfigManager.getConfig.mockResolvedValue({
      databaseId: 'test-database-id',
      projectName: 'test-project',
      version: '1.0.0',
      apiToken: 'test-api-token',
    });

    // HTTPレスポンスのモック
    mockResponse = {
      getResponseCode: jest.fn().mockReturnValue(200),
      getContentText: jest.fn(),
    };
    mockUrlFetchApp.fetch.mockReturnValue(mockResponse);

    // Loggerのモック
    mockLogger.info = jest.fn();
    mockLogger.debug = jest.fn();
    mockLogger.error = jest.fn();
  });

  describe('createPage', () => {
    it('should create a page successfully', async () => {
      const pageData = {
        properties: {
          Name: {
            title: [{ text: { content: 'Test Page' } }],
          },
        },
      };

      const expectedResponse = {
        id: 'page-123',
        created_time: '2025-01-01T00:00:00.000Z',
        properties: pageData.properties,
      };

      mockResponse.getContentText.mockReturnValue(
        JSON.stringify(expectedResponse)
      );

      const result = await client.createPage('db-123', pageData);

      expect(result).toEqual(expectedResponse);
      expect(mockUrlFetchApp.fetch).toHaveBeenCalledWith(
        `${CONSTANTS.NOTION.BASE_URL}/pages`,
        expect.objectContaining({
          method: 'post',
          headers: {
            'Authorization': 'Bearer test-api-token',
            'Notion-Version': CONSTANTS.NOTION.API_VERSION,
            'Content-Type': 'application/json',
          },
          payload: JSON.stringify({
            parent: { database_id: 'db-123' },
            properties: pageData.properties,
          }),
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Page created successfully',
        { pageId: 'page-123' }
      );
    });

    it('should handle API errors when creating a page', async () => {
      mockResponse.getResponseCode.mockReturnValue(400);
      mockResponse.getContentText.mockReturnValue(
        '{"message":"Invalid request"}'
      );

      const pageData = {
        properties: {
          Name: {
            title: [{ text: { content: 'Test Page' } }],
          },
        },
      };

      await expect(client.createPage('db-123', pageData)).rejects.toThrow(
        ApiError
      );
    });
  });

  describe('updatePage', () => {
    it('should update a page successfully', async () => {
      const pageData = {
        properties: {
          Name: {
            title: [{ text: { content: 'Updated Page' } }],
          },
        },
      };

      const expectedResponse = {
        id: 'page-123',
        last_edited_time: '2025-01-01T00:00:00.000Z',
        properties: pageData.properties,
      };

      mockResponse.getContentText.mockReturnValue(
        JSON.stringify(expectedResponse)
      );

      const result = await client.updatePage('page-123', pageData);

      expect(result).toEqual(expectedResponse);
      expect(mockUrlFetchApp.fetch).toHaveBeenCalledWith(
        `${CONSTANTS.NOTION.BASE_URL}/pages/page-123`,
        expect.objectContaining({
          method: 'patch',
          payload: JSON.stringify({
            properties: pageData.properties,
          }),
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Page updated successfully',
        { pageId: 'page-123' }
      );
    });
  });

  describe('getDatabaseInfo', () => {
    it('should get database info successfully', async () => {
      const databaseResponse = {
        id: 'db-123',
        title: [{ plain_text: 'Test Database' }],
        properties: {
          Name: {
            id: 'prop-1',
            type: 'title',
          },
          Status: {
            id: 'prop-2',
            type: 'select',
            select: {
              options: [
                { name: 'Todo', color: 'red' },
                { name: 'Done', color: 'green' },
              ],
            },
          },
        },
      };

      mockResponse.getContentText.mockReturnValue(
        JSON.stringify(databaseResponse)
      );

      const result = await client.getDatabaseInfo('db-123');

      expect(result).toEqual({
        id: 'db-123',
        title: 'Test Database',
        properties: [
          {
            name: 'Name',
            type: 'title',
            id: 'prop-1',
            config: { type: 'title', required: false },
          },
          {
            name: 'Status',
            type: 'select',
            id: 'prop-2',
            config: {
              type: 'select',
              required: false,
              options: [
                { name: 'Todo', color: 'red' },
                { name: 'Done', color: 'green' },
              ],
            },
          },
        ],
      });
    });

    it('should handle untitled database', async () => {
      const databaseResponse = {
        id: 'db-123',
        title: [],
        properties: {},
      };

      mockResponse.getContentText.mockReturnValue(
        JSON.stringify(databaseResponse)
      );

      const result = await client.getDatabaseInfo('db-123');

      expect(result.title).toBe('Untitled');
    });
  });

  describe('getPage', () => {
    it('should get page successfully', async () => {
      const pageResponse = {
        id: 'page-123',
        properties: {
          Name: {
            title: [{ text: { content: 'Test Page' } }],
          },
        },
      };

      mockResponse.getContentText.mockReturnValue(JSON.stringify(pageResponse));

      const result = await client.getPage('page-123');

      expect(result).toEqual(pageResponse);
      expect(mockUrlFetchApp.fetch).toHaveBeenCalledWith(
        `${CONSTANTS.NOTION.BASE_URL}/pages/page-123`,
        expect.objectContaining({
          method: 'get',
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Page retrieved successfully',
        { pageId: 'page-123' }
      );
    });
  });

  describe('queryDatabase', () => {
    it('should query database successfully', async () => {
      const queryResponse = {
        results: [
          { id: 'page-1', properties: {} },
          { id: 'page-2', properties: {} },
        ],
        has_more: false,
        next_cursor: null,
      };

      mockResponse.getContentText.mockReturnValue(
        JSON.stringify(queryResponse)
      );

      const result = await client.queryDatabase('db-123');

      expect(result).toEqual({
        results: queryResponse.results,
        hasMore: false,
        nextCursor: null,
      });
    });

    it('should query database with filter and sorts', async () => {
      const filter = { property: 'Status', select: { equals: 'Todo' } };
      const sorts = [{ property: 'Name', direction: 'ascending' }];

      const queryResponse = {
        results: [],
        has_more: false,
        next_cursor: null,
      };

      mockResponse.getContentText.mockReturnValue(
        JSON.stringify(queryResponse)
      );

      await client.queryDatabase('db-123', filter, sorts);

      expect(mockUrlFetchApp.fetch).toHaveBeenCalledWith(
        `${CONSTANTS.NOTION.BASE_URL}/databases/db-123/query`,
        expect.objectContaining({
          method: 'post',
          payload: JSON.stringify({
            page_size: 100,
            filter: filter,
            sorts: sorts,
          }),
        })
      );
    });
  });

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      const databaseResponse = {
        id: 'db-123',
        title: [{ plain_text: 'Test Database' }],
        properties: {
          Name: { id: 'prop-1', type: 'title' },
          Status: { id: 'prop-2', type: 'select' },
        },
      };

      mockResponse.getContentText.mockReturnValue(
        JSON.stringify(databaseResponse)
      );

      const result = await client.testConnection();

      expect(result).toEqual({
        success: true,
        databaseTitle: 'Test Database',
        propertyCount: 2,
        message: '接続テストが成功しました',
      });
    });

    it('should handle connection test failure', async () => {
      mockResponse.getResponseCode.mockReturnValue(401);
      mockResponse.getContentText.mockReturnValue('{"message":"Unauthorized"}');

      const result = await client.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toBe('接続テストが失敗しました');
      expect(result.error).toBeDefined();
    });
  });

  describe('Rate limiting', () => {
    it('should respect rate limits', async () => {
      // レート制限の遅延をモックで短縮
      const originalDelay = CONSTANTS.NOTION.RATE_LIMIT_DELAY;
      (CONSTANTS.NOTION as any).RATE_LIMIT_DELAY = 10; // 10msに短縮

      const startTime = Date.now();

      mockResponse.getContentText.mockReturnValue('{"id": "test"}');

      // 複数のリクエストを連続実行
      await client.getPage('page-1');
      await client.getPage('page-2');

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // レート制限により最小限の遅延が発生することを確認
      expect(elapsed).toBeGreaterThanOrEqual(10);

      // 元の設定を復元
      (CONSTANTS.NOTION as any).RATE_LIMIT_DELAY = originalDelay;
    });
  });

  describe('Retry mechanism', () => {
    it('should retry on rate limit error (429)', async () => {
      mockResponse.getResponseCode
        .mockReturnValueOnce(429)
        .mockReturnValueOnce(200);

      mockResponse.getContentText
        .mockReturnValueOnce('{"message":"Rate limited"}')
        .mockReturnValueOnce('{"id": "success"}');

      const result = await client.getPage('page-123');

      expect(result).toEqual({ id: 'success' });
      expect(mockUrlFetchApp.fetch).toHaveBeenCalledTimes(2);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Retrying request',
        expect.objectContaining({
          endpoint: '/pages/page-123',
          retryCount: 1,
        })
      );
    });

    it('should retry on server error (500)', async () => {
      mockResponse.getResponseCode
        .mockReturnValueOnce(500)
        .mockReturnValueOnce(200);

      mockResponse.getContentText
        .mockReturnValueOnce('{"message":"Internal server error"}')
        .mockReturnValueOnce('{"id": "success"}');

      const result = await client.getPage('page-123');

      expect(result).toEqual({ id: 'success' });
      expect(mockUrlFetchApp.fetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on client error (400)', async () => {
      mockResponse.getResponseCode.mockReturnValue(400);
      mockResponse.getContentText.mockReturnValue('{"message":"Bad request"}');

      await expect(client.getPage('page-123')).rejects.toThrow(ApiError);
      expect(mockUrlFetchApp.fetch).toHaveBeenCalledTimes(1);
    });

    it('should stop retrying after max attempts', async () => {
      mockResponse.getResponseCode.mockReturnValue(429);
      mockResponse.getContentText.mockReturnValue('{"message":"Rate limited"}');

      await expect(client.getPage('page-123')).rejects.toThrow(ApiError);
      expect(mockUrlFetchApp.fetch).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    }, 15000); // 15秒のタイムアウト
  });

  describe('Error handling', () => {
    it('should handle network errors', async () => {
      mockUrlFetchApp.fetch.mockImplementation(() => {
        throw new Error('Network error');
      });

      await expect(client.getPage('page-123')).rejects.toThrow(ApiError);
    });

    it('should handle JSON parsing errors', async () => {
      mockResponse.getContentText.mockReturnValue('invalid json');

      await expect(client.getPage('page-123')).rejects.toThrow(ApiError);
    });
  });

  describe('Property config extraction', () => {
    it('should extract select property config', async () => {
      const databaseResponse = {
        id: 'db-123',
        title: [{ plain_text: 'Test Database' }],
        properties: {
          Status: {
            id: 'prop-1',
            type: 'select',
            select: {
              options: [
                { name: 'Todo', color: 'red' },
                { name: 'In Progress', color: 'yellow' },
                { name: 'Done', color: 'green' },
              ],
            },
          },
        },
      };

      mockResponse.getContentText.mockReturnValue(
        JSON.stringify(databaseResponse)
      );

      const result = await client.getDatabaseInfo('db-123');

      expect(result.properties[0].config).toEqual({
        type: 'select',
        required: false,
        options: [
          { name: 'Todo', color: 'red' },
          { name: 'In Progress', color: 'yellow' },
          { name: 'Done', color: 'green' },
        ],
      });
    });

    it('should extract multi_select property config', async () => {
      const databaseResponse = {
        id: 'db-123',
        title: [{ plain_text: 'Test Database' }],
        properties: {
          Tags: {
            id: 'prop-1',
            type: 'multi_select',
            multi_select: {
              options: [
                { name: 'urgent', color: 'red' },
                { name: 'low-priority', color: 'gray' },
              ],
            },
          },
        },
      };

      mockResponse.getContentText.mockReturnValue(
        JSON.stringify(databaseResponse)
      );

      const result = await client.getDatabaseInfo('db-123');

      expect(result.properties[0].config).toEqual({
        type: 'multi_select',
        required: false,
        options: [
          { name: 'urgent', color: 'red' },
          { name: 'low-priority', color: 'gray' },
        ],
      });
    });

    it('should extract number property config', async () => {
      const databaseResponse = {
        id: 'db-123',
        title: [{ plain_text: 'Test Database' }],
        properties: {
          Price: {
            id: 'prop-1',
            type: 'number',
            number: {
              format: 'yen',
            },
          },
        },
      };

      mockResponse.getContentText.mockReturnValue(
        JSON.stringify(databaseResponse)
      );

      const result = await client.getDatabaseInfo('db-123');

      expect(result.properties[0].config).toEqual({
        type: 'number',
        required: false,
        format: 'yen',
      });
    });
  });
});
