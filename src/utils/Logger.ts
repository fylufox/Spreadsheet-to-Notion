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

import { LogLevel } from '../types';
import { CONSTANTS } from './Constants';

/**
 * ログエントリの構造
 */
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
  context?: string;
}

/**
 * ログ管理クラス
 * デバッグ情報の出力、機密情報のマスキング、ログレベル制御を行う
 */
export class Logger {
  private static instance: Logger;
  private currentLogLevel: LogLevel = LogLevel.INFO;
  private logHistory: LogEntry[] = [];

  private constructor() {
    this.setLogLevel(this.getEnvironmentLogLevel());
  }

  /**
   * Loggerのシングルトンインスタンスを取得
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * 環境に応じたログレベルを取得
   */
  private getEnvironmentLogLevel(): LogLevel {
    // GAS環境では環境変数が使えないため、プロパティサービスから取得
    try {
      const logLevel = PropertiesService.getScriptProperties().getProperty(
        'LOG_LEVEL'
      );
      if (logLevel && Object.values(LogLevel).includes(logLevel as LogLevel)) {
        return logLevel as LogLevel;
      }
    } catch (error) {
      // プロパティサービスアクセスエラーは無視
    }
    return LogLevel.INFO;
  }

  /**
   * ログレベルを設定
   */
  public setLogLevel(level: LogLevel): void {
    this.currentLogLevel = level;
  }

  /**
   * 現在のログレベルを取得
   */
  public getLogLevel(): LogLevel {
    return this.currentLogLevel;
  }

  /**
   * DEBUGレベルのログを出力
   */
  public static debug(message: string, data?: unknown, context?: string): void {
    Logger.getInstance().log(LogLevel.DEBUG, message, data, context);
  }

  /**
   * INFOレベルのログを出力
   */
  public static info(message: string, data?: unknown, context?: string): void {
    Logger.getInstance().log(LogLevel.INFO, message, data, context);
  }

  /**
   * WARNレベルのログを出力
   */
  public static warn(message: string, data?: unknown, context?: string): void {
    Logger.getInstance().log(LogLevel.WARN, message, data, context);
  }

  /**
   * ERRORレベルのログを出力
   */
  public static error(message: string, data?: unknown, context?: string): void {
    Logger.getInstance().log(LogLevel.ERROR, message, data, context);
  }

  /**
   * ログエントリを作成・出力
   */
  private log(
    level: LogLevel,
    message: string,
    data?: unknown,
    context?: string
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const sanitizedData = this.sanitizeLogData(data);
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data: sanitizedData,
      context,
    };

    // コンソールに出力
    this.outputToConsole(logEntry);

    // 履歴に保存
    this.addToHistory(logEntry);
  }

  /**
   * ログレベルに応じた出力判定
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentIndex = levels.indexOf(this.currentLogLevel);
    const targetIndex = levels.indexOf(level);
    return targetIndex >= currentIndex;
  }

  /**
   * 機密情報をマスキング
   */
  private sanitizeLogData(data: unknown): unknown {
    if (!data) return data;

    try {
      // プリミティブ型はそのまま返す
      if (typeof data !== 'object') {
        return data;
      }

      // 配列の場合は各要素を再帰的に処理
      if (Array.isArray(data)) {
        return data.map((item) => this.sanitizeLogData(item));
      }

      // オブジェクトの場合は機密フィールドをマスク
      const sanitized = JSON.parse(JSON.stringify(data));
      this.maskSensitiveFields(sanitized);
      return sanitized;
    } catch (error) {
      // サニタイズに失敗した場合は安全な文字列を返す
      return '[Sanitization Failed]';
    }
  }

  /**
   * オブジェクト内の機密フィールドをマスク
   */
  private maskSensitiveFields(obj: Record<string, unknown>): void {
    for (const key in obj) {
      if (this.isSensitiveField(key)) {
        const value = obj[key];
        if (typeof value === 'string' && value.length > 8) {
          obj[key] = value.substring(0, 8) + '***';
        } else {
          obj[key] = '***';
        }
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.maskSensitiveFields(obj[key] as Record<string, unknown>);
      }
    }
  }

  /**
   * 機密フィールドかどうかを判定
   */
  private isSensitiveField(fieldName: string): boolean {
    const lowerFieldName = fieldName.toLowerCase();
    return CONSTANTS.LOGGING.SENSITIVE_FIELDS.some((sensitiveField) =>
      lowerFieldName.includes(sensitiveField.toLowerCase())
    );
  }

  /**
   * コンソールにログを出力
   */
  private outputToConsole(entry: LogEntry): void {
    const logMessage = this.formatLogMessage(entry);

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.log(logMessage);
        break;
      case LogLevel.INFO:
        console.info(logMessage);
        break;
      case LogLevel.WARN:
        console.warn(logMessage);
        break;
      case LogLevel.ERROR:
        console.error(logMessage);
        break;
    }
  }

  /**
   * ログメッセージをフォーマット
   */
  private formatLogMessage(entry: LogEntry): string {
    let message = `[${entry.timestamp}] [${entry.level}]`;

    if (entry.context) {
      message += ` [${entry.context}]`;
    }

    message += ` ${entry.message}`;

    if (entry.data) {
      try {
        message += ` ${JSON.stringify(entry.data, null, 2)}`;
      } catch (error) {
        message += ` [Data formatting failed]`;
      }
    }

    return message;
  }

  /**
   * ログ履歴に追加
   */
  private addToHistory(entry: LogEntry): void {
    this.logHistory.push(entry);

    // 履歴サイズの制限
    if (this.logHistory.length > CONSTANTS.LOGGING.MAX_LOG_ENTRIES) {
      this.logHistory = this.logHistory.slice(-CONSTANTS.LOGGING.MAX_LOG_ENTRIES);
    }
  }

  /**
   * ログ履歴を取得
   */
  public static getHistory(level?: LogLevel): LogEntry[] {
    const history = Logger.getInstance().logHistory;
    if (level) {
      return history.filter((entry) => entry.level === level);
    }
    return [...history];
  }

  /**
   * ログ履歴をクリア
   */
  public static clearHistory(): void {
    Logger.getInstance().logHistory = [];
  }

  /**
   * エラーオブジェクトの詳細情報をログ出力
   */
  public static logError(error: Error, context?: string): void {
    const errorInfo = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };

    Logger.error('Exception occurred', errorInfo, context);
  }

  /**
   * パフォーマンス測定用のタイマー開始
   */
  public static startTimer(label: string): string {
    const timerId = `${label}_${Date.now()}`;
    Logger.debug(`Timer started: ${label}`, { timerId });
    return timerId;
  }

  /**
   * パフォーマンス測定用のタイマー終了
   */
  public static endTimer(timerId: string, label: string): void {
    const startTime = parseInt(timerId.split('_')[1]);
    const duration = Date.now() - startTime;
    Logger.info(`Timer ended: ${label}`, { duration: `${duration}ms` });
  }
}
