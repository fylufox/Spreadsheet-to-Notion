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

import { CONSTANTS } from '../utils/Constants';
import { Logger } from '../utils/Logger';
import { ConfigManager } from './ConfigManager';
import {
  NotionPageData,
  NotionPageResponse,
  DatabaseInfo,
  PropertyConfig,
  ConnectionTestResult,
  QueryResult,
  RequestOptions,
  ApiError,
} from '../types';

/**
 * レート制限管理クラス
 */
class RateLimiter {
  private lastRequestTime = 0;
  private readonly minInterval: number;
  private requestQueue: Array<() => void> = [];

  constructor() {
    this.minInterval = CONSTANTS.NOTION.RATE_LIMIT_DELAY;
  }

  /**
   * レート制限に従って待機
   */
  async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastRequest;
      Logger.debug('Rate limit wait', { waitTime });
      await this.sleep(waitTime);
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * 指定時間待機
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * レート制限をリセット
   */
  reset(): void {
    this.lastRequestTime = 0;
    this.requestQueue = [];
  }
}

/**
 * Notion API クライアント
 * Notion APIとの通信、レート制限対応、エラーハンドリングを担当
 */
export class NotionApiClient {
  private rateLimiter: RateLimiter;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAYS = [1000, 2000, 4000]; // 指数バックオフ
  private readonly REQUEST_TIMEOUT = 30000; // 30秒

  constructor() {
    this.rateLimiter = new RateLimiter();
  }

  /**
   * Notionデータベースに新しいページを作成
   */
  async createPage(
    databaseId: string,
    pageData: NotionPageData
  ): Promise<NotionPageResponse> {
    await this.rateLimiter.waitForRateLimit();

    const response = await this.makeRequestWithRetry('/pages', {
      method: 'post',
      payload: JSON.stringify({
        parent: { database_id: databaseId },
        properties: pageData.properties,
      }),
    });

    Logger.info('Page created successfully', { pageId: response.id });
    return response;
  }

  /**
   * 既存のNotionページを更新
   */
  async updatePage(
    pageId: string,
    pageData: NotionPageData
  ): Promise<NotionPageResponse> {
    await this.rateLimiter.waitForRateLimit();

    const response = await this.makeRequestWithRetry(`/pages/${pageId}`, {
      method: 'patch',
      payload: JSON.stringify({
        properties: pageData.properties,
      }),
    });

    Logger.info('Page updated successfully', { pageId });
    return response;
  }

  /**
   * データベースのプロパティ情報を取得
   */
  async getDatabaseInfo(databaseId: string): Promise<DatabaseInfo> {
    await this.rateLimiter.waitForRateLimit();

    const response = await this.makeRequestWithRetry(
      `/databases/${databaseId}`
    );

    return {
      id: response.id,
      title: response.title?.[0]?.plain_text || 'Untitled',
      properties: Object.entries(response.properties).map(
        ([name, prop]: [string, any]) => ({
          name,
          type: prop.type,
          id: prop.id,
          config: this.extractPropertyConfig(prop),
        })
      ),
    };
  }

  /**
   * 指定されたページの詳細情報を取得
   */
  async getPage(pageId: string): Promise<NotionPageResponse> {
    await this.rateLimiter.waitForRateLimit();

    const response = await this.makeRequestWithRetry(`/pages/${pageId}`);

    Logger.info('Page retrieved successfully', { pageId });
    return response;
  }

  /**
   * データベースのクエリ実行
   */
  async queryDatabase(
    databaseId: string,
    filter: any = null,
    sorts: any[] | null = null
  ): Promise<QueryResult> {
    await this.rateLimiter.waitForRateLimit();

    const payload: any = {
      page_size: 100,
    };

    if (filter) payload.filter = filter;
    if (sorts) payload.sorts = sorts;

    const response = await this.makeRequestWithRetry(
      `/databases/${databaseId}/query`,
      {
        method: 'post',
        payload: JSON.stringify(payload),
      }
    );

    return {
      results: response.results,
      hasMore: response.has_more,
      nextCursor: response.next_cursor,
    };
  }

  /**
   * API接続テストを実行
   */
  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const config = await ConfigManager.getConfig();

      // データベース情報取得でテスト
      const dbInfo = await this.getDatabaseInfo(config.databaseId);

      return {
        success: true,
        databaseTitle: dbInfo.title,
        propertyCount: dbInfo.properties.length,
        message: '接続テストが成功しました',
      };
    } catch (error) {
      Logger.error('Connection test failed', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: '接続テストが失敗しました',
      };
    }
  }

  /**
   * Notion APIへのHTTPリクエストを実行（リトライ機能付き）
   */
  private async makeRequestWithRetry(
    endpoint: string,
    options: RequestOptions = {},
    retryCount = 0
  ): Promise<any> {
    try {
      return await this.makeRequest(endpoint, options);
    } catch (error) {
      if (retryCount >= this.MAX_RETRIES) {
        throw error;
      }

      if (this.shouldRetry(error)) {
        const delay = this.RETRY_DELAYS[retryCount] || 4000;
        Logger.info('Retrying request', {
          endpoint,
          retryCount: retryCount + 1,
          delay,
        });

        await this.sleep(delay);
        return this.makeRequestWithRetry(endpoint, options, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * Notion APIへのHTTPリクエストを実行
   */
  private async makeRequest(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<any> {
    const url = `${CONSTANTS.NOTION.BASE_URL}${endpoint}`;

    const defaultOptions: RequestOptions = {
      method: 'get',
      headers: {
        'Authorization': `Bearer ${ConfigManager.getApiToken()}`,
        'Notion-Version': CONSTANTS.NOTION.API_VERSION,
        'Content-Type': 'application/json',
      },
      muteHttpExceptions: true,
    };

    const requestOptions = { ...defaultOptions, ...options };

    try {
      Logger.info('Making API request', {
        method: requestOptions.method,
        endpoint: endpoint,
      });

      const response = UrlFetchApp.fetch(
        url,
        requestOptions as GoogleAppsScript.URL_Fetch.URLFetchRequestOptions
      );
      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();

      if (responseCode >= 400) {
        throw new ApiError(
          `API request failed: ${responseCode}`,
          responseCode,
          responseText
        );
      }

      return JSON.parse(responseText);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(
        'Network or parsing error',
        0,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * プロパティ設定情報を抽出
   */
  private extractPropertyConfig(property: any): PropertyConfig {
    const config: PropertyConfig = {
      type: property.type,
      required: false,
    };

    switch (property.type) {
      case 'select':
        config.options =
          property.select?.options?.map((opt: any) => ({
            name: opt.name,
            color: opt.color,
          })) || [];
        break;

      case 'multi_select':
        config.options =
          property.multi_select?.options?.map((opt: any) => ({
            name: opt.name,
            color: opt.color,
          })) || [];
        break;

      case 'date':
        config.format = property.date?.format || null;
        break;

      case 'number':
        config.format = property.number?.format || 'number';
        break;

      case 'formula':
        config.expression = property.formula?.expression || '';
        break;
    }

    return config;
  }

  /**
   * エラーがリトライ可能かどうかを判定
   */
  private shouldRetry(error: unknown): boolean {
    if (error instanceof ApiError) {
      // 429 (Rate Limited) または 5xx (Server Error) の場合はリトライ
      return error.statusCode === 429 || error.statusCode >= 500;
    }

    // ネットワークエラーの場合もリトライ
    if (error instanceof Error) {
      return (
        error.message?.includes('network') || error.message?.includes('timeout')
      );
    }

    return false;
  }

  /**
   * 指定時間待機
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * レート制限をリセット（テスト用）
   */
  resetRateLimit(): void {
    this.rateLimiter.reset();
  }
}
