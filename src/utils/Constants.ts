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

/**
 * システム全体で使用する定数定義
 */
export const CONSTANTS = {
  // シート名
  SHEETS: {
    IMPORT_DATA: 'import_data',
    IMPORT_COLUMN: 'import_column',
    CONFIG: 'config',
    MAPPING: 'mapping',
  },

  // カラム位置
  COLUMNS: {
    CHECKBOX: 1, // A列: チェックボックス
    PRIMARY_KEY: 2, // B列: 主キー (Notion Page ID)
    DATA_START: 3, // C列: データ開始位置
  },

  // Notion API
  NOTION: {
    API_VERSION: '2022-06-28',
    BASE_URL: 'https://api.notion.com/v1',
    RATE_LIMIT_DELAY: 334, // 3リクエスト/秒制限対応 (1000ms / 3 = 333.33ms)
    MAX_RETRIES: 3,
    TIMEOUT: 10000, // 10秒
  },

  // エラーコード
  ERROR_CODES: {
    CONFIG_ERROR: 'CONFIG_001',
    MAPPING_ERROR: 'MAPPING_002',
    API_ERROR: 'API_003',
    VALIDATION_ERROR: 'VALIDATION_004',
    NETWORK_ERROR: 'NETWORK_005',
    PERMISSION_ERROR: 'PERMISSION_006',
  },

  // 設定項目
  CONFIG_KEYS: {
    DATABASE_ID: 'DATABASE_ID',
    PROJECT_NAME: 'PROJECT_NAME',
    VERSION: 'VERSION',
    LAST_UPDATE: 'LAST_UPDATE',
    NOTION_API_TOKEN: 'NOTION_API_TOKEN',
    BATCH_SIZE: 'sync_batch_size',
    AUTO_SYNC_ENABLED: 'auto_sync_enabled',
    RETRY_ATTEMPTS: 'retry_attempts',
  },

  // デフォルト設定
  DEFAULT_CONFIG: {
    BATCH_SIZE: 10,
    AUTO_SYNC_ENABLED: false,
    RETRY_ATTEMPTS: 3,
  },

  // GAS プロパティキー
  PROPERTY_KEYS: {
    NOTION_API_TOKEN: 'NOTION_API_TOKEN',
    ENCRYPTION_KEY: 'ENCRYPTION_KEY',
  },

  // デフォルト値
  DEFAULTS: {
    VERSION: '1.0.0',
    PROJECT_NAME: 'Notion Import Project',
    CACHE_DURATION: 5 * 60 * 1000, // 5分
    LOG_LEVEL: 'INFO',
  },

  // データ型マッピング
  DATA_TYPES: {
    TITLE: 'title',
    RICH_TEXT: 'rich_text',
    NUMBER: 'number',
    SELECT: 'select',
    MULTI_SELECT: 'multi_select',
    DATE: 'date',
    CHECKBOX: 'checkbox',
    URL: 'url',
    EMAIL: 'email',
    PHONE_NUMBER: 'phone_number',
  },

  // HTTP ステータスコード
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
  },

  // 正規表現パターン
  PATTERNS: {
    DATABASE_ID:
      /^[a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}$/i,
    PAGE_ID:
      /^[a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}$/i,
    // Notion APIトークンの形式: 新形式(ntn_)と旧形式(secret_)の両方に対応
    API_TOKEN: /^(secret_[a-zA-Z0-9]{43}|ntn_[a-zA-Z0-9]+)$/,
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    URL: /^https?:\/\/.+/,
    PHONE: /^[+]?[\d\s\-()]+$/,
  },

  // UI メッセージ
  MESSAGES: {
    SUCCESS: {
      IMPORT_COMPLETE: 'データの連携が完了しました',
      CONFIG_SAVED: '設定が保存されました',
      VALIDATION_PASSED: 'データ検証が完了しました',
    },
    ERROR: {
      CONFIG_MISSING: '設定情報が不足しています',
      INVALID_DATA: 'データ形式が正しくありません',
      API_CONNECTION_FAILED: 'Notion APIへの接続に失敗しました',
      PERMISSION_DENIED: 'アクセス権限がありません',
      NETWORK_ERROR: 'ネットワークエラーが発生しました',
    },
    WARNING: {
      RATE_LIMIT: 'APIレート制限のため処理を一時停止します',
      RETRY_ATTEMPT: '処理を再試行しています',
      CACHE_EXPIRED: 'キャッシュの有効期限が切れました',
    },
  },

  // ログ設定
  LOGGING: {
    MAX_LOG_ENTRIES: 1000,
    LOG_RETENTION_DAYS: 30,
    SENSITIVE_FIELDS: ['apiToken', 'token', 'password', 'key'],
  },
} as const;

/**
 * 環境別設定
 */
export const ENV_CONFIG = {
  DEVELOPMENT: {
    LOG_LEVEL: 'DEBUG',
    API_TIMEOUT: 30000,
    ENABLE_CACHE: false,
  },
  PRODUCTION: {
    LOG_LEVEL: 'INFO',
    API_TIMEOUT: 10000,
    ENABLE_CACHE: true,
  },
} as const;

/**
 * 型安全な定数アクセサー
 */
export type SheetNames = keyof typeof CONSTANTS.SHEETS;
export type DataTypes = keyof typeof CONSTANTS.DATA_TYPES;
export type ErrorCodes = keyof typeof CONSTANTS.ERROR_CODES;
export type ConfigKeys = keyof typeof CONSTANTS.CONFIG_KEYS;
