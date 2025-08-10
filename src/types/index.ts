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
 * システム設定情報
 */
export interface SystemConfig {
  databaseId: string;
  projectName: string;
  version: string;
  apiToken: string;
}

/**
 * カラムマッピング設定
 */
export interface ColumnMapping {
  spreadsheetColumn: string;
  notionPropertyName: string;
  dataType: string;
  isTarget: boolean;
  isRequired: boolean;
}

/**
 * Notionページデータ
 */
export interface NotionPageData {
  properties: Record<string, NotionProperty>;
}

/**
 * Notionプロパティの型定義
 */
export type NotionProperty =
  | { type: 'title'; title: Array<{ text: { content: string } }> }
  | { type: 'rich_text'; rich_text: Array<{ text: { content: string } }> }
  | { type: 'number'; number: number | null }
  | { type: 'select'; select: { name: string } | null }
  | { type: 'multi_select'; multi_select: Array<{ name: string }> }
  | { type: 'date'; date: { start: string; end?: string } | null }
  | { type: 'checkbox'; checkbox: boolean }
  | { type: 'url'; url: string | null }
  | { type: 'email'; email: string | null }
  | { type: 'phone_number'; phone_number: string | null };

/**
 * データ検証結果
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * エラーハンドリング結果
 */
export interface ErrorHandlingResult {
  handled: boolean;
  errorType?: string;
  canRetry?: boolean;
  retryDelay?: number;
}

/**
 * インポート結果
 */
export interface ImportResult {
  success: boolean;
  result?: NotionPageResponse;
  error?: Error;
}

/**
 * インポート処理のコンテキスト
 */
export interface ImportContext {
  rowNumber: number;
  timestamp: Date;
  userId?: string;
}

/**
 * Notion API レスポンス (ページ作成/更新)
 */
export interface NotionPageResponse {
  id: string;
  created_time: string;
  last_edited_time: string;
  properties: Record<string, NotionProperty>;
}

/**
 * ログレベル
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * エラータイプ
 */
export enum ErrorType {
  CONFIG_ERROR = 'CONFIG_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  API_ERROR = 'API_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
}

/**
 * カスタムエラークラス
 */
export class SpreadsheetToNotionError extends Error {
  constructor(
    message: string,
    public readonly type: ErrorType,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'SpreadsheetToNotionError';
  }
}

/**
 * 設定エラー
 */
export class ConfigError extends SpreadsheetToNotionError {
  constructor(message: string, originalError?: Error) {
    super(message, ErrorType.CONFIG_ERROR, originalError);
    this.name = 'ConfigError';
  }
}

/**
 * データ検証エラー
 */
export class ValidationError extends SpreadsheetToNotionError {
  constructor(message: string, originalError?: Error) {
    super(message, ErrorType.VALIDATION_ERROR, originalError);
    this.name = 'ValidationError';
  }
}

/**
 * API通信エラー
 */
export class ApiError extends SpreadsheetToNotionError {
  constructor(message: string, originalError?: Error) {
    super(message, ErrorType.API_ERROR, originalError);
    this.name = 'ApiError';
  }
}
