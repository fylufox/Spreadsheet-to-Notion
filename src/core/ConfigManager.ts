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

import { SystemConfig, ColumnMapping, ConfigError } from '../types';
import { CONSTANTS } from '../utils/Constants';
import { Logger } from '../utils/Logger';

/**
 * システム設定情報の取得・管理を行うクラス
 * スプレッドシートの設定シートとGASプロパティサービスから設定を読み込み、
 * 統合された設定オブジェクトを提供する
 */
export class ConfigManager {
  private static cachedConfig: SystemConfig | null = null;
  private static cacheExpiry = 0;

  /**
   * システム設定情報を取得
   * キャッシュ機能付きで効率的に設定を提供
   */
  public static async getConfig(): Promise<SystemConfig> {
    const timerId = Logger.startTimer('ConfigManager.getConfig');

    try {
      // キャッシュが有効な場合は返す
      if (this.isCacheValid()) {
        Logger.debug('Using cached config');
        Logger.endTimer(timerId, 'ConfigManager.getConfig (cached)');
        return this.cachedConfig!;
      }

      Logger.info('Loading fresh configuration');

      // 設定シートから基本情報を取得
      const configSheet = this.getConfigSheet();
      const databaseId = this.getConfigValue(
        configSheet,
        CONSTANTS.CONFIG_KEYS.DATABASE_ID
      );
      const projectName = this.getConfigValue(
        configSheet,
        CONSTANTS.CONFIG_KEYS.PROJECT_NAME
      );
      const version = this.getConfigValue(
        configSheet,
        CONSTANTS.CONFIG_KEYS.VERSION
      );

      // GASプロパティからAPIトークンを取得
      const apiToken = this.getApiToken();

      // 設定オブジェクトを構築
      const config: SystemConfig = {
        databaseId: databaseId || '',
        projectName: projectName || CONSTANTS.DEFAULTS.PROJECT_NAME,
        version: version || CONSTANTS.DEFAULTS.VERSION,
        apiToken,
      };

      // 設定の検証
      this.validateConfig(config);

      // キャッシュに保存
      this.updateCache(config);

      Logger.info('Configuration loaded successfully', {
        projectName: config.projectName,
        version: config.version,
        hasValidToken: !!config.apiToken,
      });

      Logger.endTimer(timerId, 'ConfigManager.getConfig');
      return config;
    } catch (error) {
      Logger.endTimer(timerId, 'ConfigManager.getConfig (error)');
      Logger.logError(error as Error, 'ConfigManager.getConfig');
      throw new ConfigError('Failed to load configuration', error as Error);
    }
  }

  /**
   * Notion APIトークンを安全に取得
   */
  public static getApiToken(): string {
    try {
      const token = PropertiesService.getScriptProperties().getProperty(
        CONSTANTS.CONFIG_KEYS.NOTION_API_TOKEN
      );

      if (!token) {
        // プロパティの詳細情報をログ出力
        const allProperties =
          PropertiesService.getScriptProperties().getProperties();
        Logger.error('API token not found in properties', {
          availableKeys: Object.keys(allProperties),
          searchingForKey: CONSTANTS.CONFIG_KEYS.NOTION_API_TOKEN,
          propertiesCount: Object.keys(allProperties).length,
        });
        throw new ConfigError('Notion API token not configured');
      }

      if (!CONSTANTS.PATTERNS.API_TOKEN.test(token)) {
        Logger.error('Invalid API token format', {
          tokenLength: token.length,
          startsWithSecret: token.startsWith('secret_'),
          startsWithNtn: token.startsWith('ntn_'),
          actualPattern: token.substring(0, 10) + '...',
          expectedFormats: 'secret_xxx... or ntn_xxx...',
        });
        throw new ConfigError(
          'Invalid API token format. Expected format: secret_xxx... or ntn_xxx...'
        );
      }

      Logger.debug('API token retrieved successfully');
      return token;
    } catch (error) {
      Logger.error('Failed to retrieve API token', error);
      throw new ConfigError(
        'Authentication configuration error',
        error as Error
      );
    }
  }

  /**
   * カラムマッピング設定を取得
   */
  public static getColumnMappings(): ColumnMapping[] {
    try {
      Logger.debug('Loading column mappings');

      const mappingSheet = this.getSheet(CONSTANTS.SHEETS.IMPORT_COLUMN);
      const data = mappingSheet.getDataRange().getValues();

      if (data.length <= 1) {
        throw new ConfigError(
          'Column mapping sheet is empty or contains only headers'
        );
      }

      // ヘッダー行をスキップして処理
      const mappings: ColumnMapping[] = data.slice(1).map((row, index) => {
        if (row.length < 5) {
          throw new ConfigError(
            `Invalid column mapping at row ${index + 2}: insufficient columns`
          );
        }

        return {
          spreadsheetColumn: String(row[0] || ''),
          notionPropertyName: String(row[1] || ''),
          dataType: String(row[2] || ''),
          isTarget: String(row[3]).toLowerCase() === 'yes',
          isRequired: String(row[4]).toLowerCase() === 'yes',
        };
      });

      // 有効なマッピングのみフィルタ
      const validMappings = mappings.filter(
        mapping =>
          mapping.spreadsheetColumn &&
          mapping.notionPropertyName &&
          mapping.dataType
      );

      if (validMappings.length === 0) {
        throw new ConfigError('No valid column mappings found');
      }

      Logger.info('Column mappings loaded', {
        totalMappings: validMappings.length,
        targetMappings: validMappings.filter(m => m.isTarget).length,
      });

      return validMappings;
    } catch (error) {
      Logger.logError(error as Error, 'ConfigManager.getColumnMappings');
      throw new ConfigError('Failed to load column mappings', error as Error);
    }
  }

  /**
   * Notion APIトークンを設定
   */
  public static setApiToken(token: string): boolean {
    try {
      if (!token || !CONSTANTS.PATTERNS.API_TOKEN.test(token)) {
        Logger.error('Invalid API token format provided', {
          hasToken: !!token,
          tokenLength: token?.length || 0,
          startsWithSecret: token?.startsWith('secret_') || false,
          startsWithNtn: token?.startsWith('ntn_') || false,
          expectedFormats: 'secret_xxx... or ntn_xxx...',
        });
        throw new ConfigError(
          'Invalid API token format. Expected format: secret_xxx... or ntn_xxx...'
        );
      }

      PropertiesService.getScriptProperties().setProperty(
        CONSTANTS.CONFIG_KEYS.NOTION_API_TOKEN,
        token
      );

      Logger.info('API token updated successfully');

      // キャッシュをクリア
      this.clearCache();

      return true;
    } catch (error) {
      Logger.error('Failed to set API token', error);
      return false;
    }
  }

  /**
   * デバッグ用：プロパティサービスの内容を確認
   */
  public static debugProperties(): void {
    try {
      const properties =
        PropertiesService.getScriptProperties().getProperties();
      Logger.info('Current GAS Properties', {
        keys: Object.keys(properties),
        hasNotionToken: CONSTANTS.CONFIG_KEYS.NOTION_API_TOKEN in properties,
        totalCount: Object.keys(properties).length,
      });
    } catch (error) {
      Logger.error('Failed to read properties', error);
    }
  }

  /**
   * 設定値を更新
   */
  public static updateConfigValue(key: string, value: string): boolean {
    try {
      const sheet = this.getConfigSheet();
      const data = sheet.getDataRange().getValues();

      let rowIndex = -1;
      for (let i = 0; i < data.length; i++) {
        if (data[i][0] === key) {
          rowIndex = i + 1; // 1-indexed
          break;
        }
      }

      if (rowIndex === -1) {
        // 新規追加
        const lastRow = sheet.getLastRow();
        sheet.getRange(lastRow + 1, 1, 1, 2).setValues([[key, value]]);
        Logger.info('Config value added', { key, value });
      } else {
        // 既存更新
        sheet.getRange(rowIndex, 2).setValue(value);
        Logger.info('Config value updated', { key, value });
      }

      // キャッシュをクリア
      this.clearCache();

      return true;
    } catch (error) {
      Logger.error('Failed to update config value', { key, value, error });
      return false;
    }
  }

  /**
   * 設定シートを取得
   */
  private static getConfigSheet(): GoogleAppsScript.Spreadsheet.Sheet {
    return this.getSheet(CONSTANTS.SHEETS.CONFIG);
  }

  /**
   * 指定名のシートを取得
   */
  private static getSheet(
    sheetName: string
  ): GoogleAppsScript.Spreadsheet.Sheet {
    const sheet =
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

    if (!sheet) {
      throw new ConfigError(`Required sheet '${sheetName}' not found`);
    }

    return sheet;
  }

  /**
   * 設定シートから特定の設定値を取得
   */
  private static getConfigValue(
    sheet: GoogleAppsScript.Spreadsheet.Sheet,
    key: string
  ): string | null {
    try {
      const data = sheet.getDataRange().getValues();

      for (const row of data) {
        if (row[0] === key) {
          return String(row[1] || '');
        }
      }

      Logger.warn(`Config key not found: ${key}`);
      return null;
    } catch (error) {
      Logger.warn(`Failed to get config value for key: ${key}`, error);
      return null;
    }
  }

  /**
   * 設定情報の検証
   */
  private static validateConfig(config: SystemConfig): void {
    const errors: string[] = [];

    // 必須フィールドの確認
    if (!config.apiToken) {
      errors.push('API token is required');
    }

    if (!config.databaseId) {
      errors.push('Database ID is required');
    }

    // データベースIDの形式チェック
    if (
      config.databaseId &&
      !CONSTANTS.PATTERNS.DATABASE_ID.test(config.databaseId)
    ) {
      errors.push('Invalid database ID format');
    }

    // APIトークンの形式チェック
    if (
      config.apiToken &&
      !CONSTANTS.PATTERNS.API_TOKEN.test(config.apiToken)
    ) {
      errors.push(
        'Invalid API token format (expected: secret_xxx... or ntn_xxx...)'
      );
    }

    if (errors.length > 0) {
      throw new ConfigError(
        `Configuration validation failed: ${errors.join(', ')}`
      );
    }

    Logger.debug('Configuration validation passed');
  }

  /**
   * キャッシュが有効かどうかを確認
   */
  private static isCacheValid(): boolean {
    return this.cachedConfig !== null && Date.now() < this.cacheExpiry;
  }

  /**
   * キャッシュを更新
   */
  private static updateCache(config: SystemConfig): void {
    this.cachedConfig = { ...config };
    this.cacheExpiry = Date.now() + CONSTANTS.DEFAULTS.CACHE_DURATION;
    Logger.debug('Configuration cached', {
      cacheExpiry: new Date(this.cacheExpiry).toISOString(),
    });
  }

  /**
   * キャッシュをクリア
   */
  public static clearCache(): void {
    this.cachedConfig = null;
    this.cacheExpiry = 0;
    Logger.debug('Configuration cache cleared');
  }

  /**
   * 設定の正常性をチェック
   */
  public static async healthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      // 基本設定の取得を試行
      await this.getConfig();
    } catch (error) {
      issues.push(`Config loading failed: ${(error as Error).message}`);
    }

    try {
      // カラムマッピングの取得を試行
      this.getColumnMappings();
    } catch (error) {
      issues.push(`Column mappings failed: ${(error as Error).message}`);
    }

    try {
      // 必要なシートの存在確認
      const requiredSheets = [
        CONSTANTS.SHEETS.IMPORT_DATA,
        CONSTANTS.SHEETS.IMPORT_COLUMN,
        CONSTANTS.SHEETS.CONFIG,
      ];

      for (const sheetName of requiredSheets) {
        this.getSheet(sheetName);
      }
    } catch (error) {
      issues.push(`Sheet structure check failed: ${(error as Error).message}`);
    }

    const healthy = issues.length === 0;

    Logger.info('Configuration health check completed', {
      healthy,
      issueCount: issues.length,
      issues,
    });

    return { healthy, issues };
  }
}
