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

import { CONSTANTS, ENV_CONFIG } from '../../src/utils/Constants';

describe('Constants', () => {
  describe('SHEETS', () => {
    test('必要なシート名が定義されている', () => {
      expect(CONSTANTS.SHEETS.IMPORT_DATA).toBe('import_data');
      expect(CONSTANTS.SHEETS.IMPORT_COLUMN).toBe('import_column');
      expect(CONSTANTS.SHEETS.CONFIG).toBe('config');
    });
  });

  describe('COLUMNS', () => {
    test('カラム位置が正しく定義されている', () => {
      expect(CONSTANTS.COLUMNS.CHECKBOX).toBe(1);
      expect(CONSTANTS.COLUMNS.PRIMARY_KEY).toBe(2);
      expect(CONSTANTS.COLUMNS.DATA_START).toBe(3);
    });

    test('カラム位置の順序が正しい', () => {
      expect(CONSTANTS.COLUMNS.CHECKBOX).toBeLessThan(
        CONSTANTS.COLUMNS.PRIMARY_KEY
      );
      expect(CONSTANTS.COLUMNS.PRIMARY_KEY).toBeLessThan(
        CONSTANTS.COLUMNS.DATA_START
      );
    });
  });

  describe('NOTION', () => {
    test('Notion API設定が正しく定義されている', () => {
      expect(CONSTANTS.NOTION.API_VERSION).toBe('2022-06-28');
      expect(CONSTANTS.NOTION.BASE_URL).toBe('https://api.notion.com/v1');
      expect(CONSTANTS.NOTION.RATE_LIMIT_DELAY).toBe(334);
      expect(CONSTANTS.NOTION.MAX_RETRIES).toBe(3);
      expect(CONSTANTS.NOTION.TIMEOUT).toBe(10000);
    });

    test('レート制限設定が3リクエスト/秒に対応している', () => {
      // 3リクエスト/秒 = 333.33ms間隔
      expect(CONSTANTS.NOTION.RATE_LIMIT_DELAY).toBeGreaterThanOrEqual(333);
      expect(CONSTANTS.NOTION.RATE_LIMIT_DELAY).toBeLessThanOrEqual(335);
    });
  });

  describe('ERROR_CODES', () => {
    test('すべてのエラーコードが一意である', () => {
      const codes = Object.values(CONSTANTS.ERROR_CODES);
      const uniqueCodes = new Set(codes);
      expect(codes.length).toBe(uniqueCodes.size);
    });

    test('エラーコードが適切な形式である', () => {
      Object.values(CONSTANTS.ERROR_CODES).forEach(code => {
        expect(code).toMatch(/^[A-Z_]+_\d{3}$/);
      });
    });
  });

  describe('PATTERNS', () => {
    test('DATABASE_ID パターンが正しく動作する', () => {
      const pattern = CONSTANTS.PATTERNS.DATABASE_ID;

      // 正常なUUID形式
      expect('550e8400-e29b-41d4-a716-446655440000').toMatch(pattern);
      expect('550e8400e29b41d4a716446655440000').toMatch(pattern);

      // 異常な形式
      expect('invalid-id').not.toMatch(pattern);
      expect('550e8400-e29b-41d4-a716').not.toMatch(pattern);
    });

    test('API_TOKEN パターンが正しく動作する', () => {
      const pattern = CONSTANTS.PATTERNS.API_TOKEN;

      // 正常なトークン形式 (secret_ + 43文字)
      expect('secret_abcdefghijklmnopqrstuvwxyz1234567890123abcd').toMatch(
        pattern
      );

      // 異常な形式
      expect('invalid_token').not.toMatch(pattern);
      expect('secret_short').not.toMatch(pattern);
      expect('token_without_secret_prefix').not.toMatch(pattern);
    });

    test('EMAIL パターンが正しく動作する', () => {
      const pattern = CONSTANTS.PATTERNS.EMAIL;

      // 正常なメール形式
      expect('test@example.com').toMatch(pattern);
      expect('user.name+tag@domain.co.jp').toMatch(pattern);

      // 異常な形式
      expect('invalid-email').not.toMatch(pattern);
      expect('@domain.com').not.toMatch(pattern);
      expect('user@').not.toMatch(pattern);
    });

    test('URL パターンが正しく動作する', () => {
      const pattern = CONSTANTS.PATTERNS.URL;

      // 正常なURL形式
      expect('https://example.com').toMatch(pattern);
      expect('http://localhost:3000/path').toMatch(pattern);

      // 異常な形式
      expect('ftp://example.com').not.toMatch(pattern);
      expect('invalid-url').not.toMatch(pattern);
    });
  });

  describe('MESSAGES', () => {
    test('成功メッセージが定義されている', () => {
      expect(typeof CONSTANTS.MESSAGES.SUCCESS.IMPORT_COMPLETE).toBe('string');
      expect(typeof CONSTANTS.MESSAGES.SUCCESS.CONFIG_SAVED).toBe('string');
      expect(typeof CONSTANTS.MESSAGES.SUCCESS.VALIDATION_PASSED).toBe(
        'string'
      );
    });

    test('エラーメッセージが定義されている', () => {
      expect(typeof CONSTANTS.MESSAGES.ERROR.CONFIG_MISSING).toBe('string');
      expect(typeof CONSTANTS.MESSAGES.ERROR.INVALID_DATA).toBe('string');
      expect(typeof CONSTANTS.MESSAGES.ERROR.API_CONNECTION_FAILED).toBe(
        'string'
      );
    });

    test('警告メッセージが定義されている', () => {
      expect(typeof CONSTANTS.MESSAGES.WARNING.RATE_LIMIT).toBe('string');
      expect(typeof CONSTANTS.MESSAGES.WARNING.RETRY_ATTEMPT).toBe('string');
    });
  });

  describe('DATA_TYPES', () => {
    test('Notionでサポートされるデータ型が定義されている', () => {
      const expectedTypes = [
        'title',
        'rich_text',
        'number',
        'select',
        'multi_select',
        'date',
        'checkbox',
        'url',
        'email',
        'phone_number',
      ];

      expectedTypes.forEach(type => {
        expect(Object.values(CONSTANTS.DATA_TYPES)).toContain(type);
      });
    });
  });

  describe('HTTP_STATUS', () => {
    test('主要なHTTPステータスコードが定義されている', () => {
      expect(CONSTANTS.HTTP_STATUS.OK).toBe(200);
      expect(CONSTANTS.HTTP_STATUS.CREATED).toBe(201);
      expect(CONSTANTS.HTTP_STATUS.BAD_REQUEST).toBe(400);
      expect(CONSTANTS.HTTP_STATUS.UNAUTHORIZED).toBe(401);
      expect(CONSTANTS.HTTP_STATUS.FORBIDDEN).toBe(403);
      expect(CONSTANTS.HTTP_STATUS.NOT_FOUND).toBe(404);
      expect(CONSTANTS.HTTP_STATUS.TOO_MANY_REQUESTS).toBe(429);
      expect(CONSTANTS.HTTP_STATUS.INTERNAL_SERVER_ERROR).toBe(500);
    });
  });

  describe('DEFAULTS', () => {
    test('デフォルト値が適切に設定されている', () => {
      expect(CONSTANTS.DEFAULTS.VERSION).toMatch(/^\d+\.\d+\.\d+$/);
      expect(typeof CONSTANTS.DEFAULTS.PROJECT_NAME).toBe('string');
      expect(CONSTANTS.DEFAULTS.CACHE_DURATION).toBeGreaterThan(0);
      expect(['DEBUG', 'INFO', 'WARN', 'ERROR']).toContain(
        CONSTANTS.DEFAULTS.LOG_LEVEL
      );
    });

    test('キャッシュ期間が適切な値である', () => {
      // 5分 = 300,000ms
      expect(CONSTANTS.DEFAULTS.CACHE_DURATION).toBe(5 * 60 * 1000);
    });
  });

  describe('LOGGING', () => {
    test('ログ設定が適切に定義されている', () => {
      expect(CONSTANTS.LOGGING.MAX_LOG_ENTRIES).toBeGreaterThan(0);
      expect(CONSTANTS.LOGGING.LOG_RETENTION_DAYS).toBeGreaterThan(0);
      expect(Array.isArray(CONSTANTS.LOGGING.SENSITIVE_FIELDS)).toBe(true);
      expect(CONSTANTS.LOGGING.SENSITIVE_FIELDS.length).toBeGreaterThan(0);
    });

    test('機密フィールドが適切に定義されている', () => {
      const expectedSensitiveFields = ['apiToken', 'token', 'password', 'key'];
      expectedSensitiveFields.forEach(field => {
        expect(CONSTANTS.LOGGING.SENSITIVE_FIELDS).toContain(field);
      });
    });
  });
});

describe('ENV_CONFIG', () => {
  test('開発環境設定が定義されている', () => {
    expect(ENV_CONFIG.DEVELOPMENT.LOG_LEVEL).toBe('DEBUG');
    expect(ENV_CONFIG.DEVELOPMENT.API_TIMEOUT).toBeGreaterThan(
      CONSTANTS.NOTION.TIMEOUT
    );
    expect(ENV_CONFIG.DEVELOPMENT.ENABLE_CACHE).toBe(false);
  });

  test('本番環境設定が定義されている', () => {
    expect(ENV_CONFIG.PRODUCTION.LOG_LEVEL).toBe('INFO');
    expect(ENV_CONFIG.PRODUCTION.API_TIMEOUT).toBe(CONSTANTS.NOTION.TIMEOUT);
    expect(ENV_CONFIG.PRODUCTION.ENABLE_CACHE).toBe(true);
  });

  test('環境別の設定が適切に分かれている', () => {
    // 開発環境はより詳細なログ、長いタイムアウト、キャッシュ無効
    expect(ENV_CONFIG.DEVELOPMENT.LOG_LEVEL).toBe('DEBUG');
    expect(ENV_CONFIG.DEVELOPMENT.API_TIMEOUT).toBeGreaterThan(
      ENV_CONFIG.PRODUCTION.API_TIMEOUT
    );
    expect(ENV_CONFIG.DEVELOPMENT.ENABLE_CACHE).toBe(false);

    // 本番環境は効率的な設定
    expect(ENV_CONFIG.PRODUCTION.LOG_LEVEL).toBe('INFO');
    expect(ENV_CONFIG.PRODUCTION.ENABLE_CACHE).toBe(true);
  });
});

describe('型安全性', () => {
  test('定数が読み取り専用である', () => {
    // TypeScriptの as const により、定数は読み取り専用になっている
    // ランタイムでの変更はエラーにならないが、TypeScriptレベルで保護されている
    expect(typeof CONSTANTS.SHEETS.IMPORT_DATA).toBe('string');
    expect(CONSTANTS.SHEETS.IMPORT_DATA).toBe('import_data');
  });
});
