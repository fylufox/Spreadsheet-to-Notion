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
import { Validator } from './Validator';
import { DataMapper } from './DataMapper';
import { NotionApiClient } from './NotionApiClient';
import { PerformanceMonitor } from './PerformanceMonitor';
import {
  EditEvent,
  ImportContext,
  ImportResult,
  ProcessingStatus,
  ErrorType,
  SpreadsheetToNotionError,
} from '../types';

/**
 * TriggerManager
 * スプレッドシートのトリガーイベントを処理し、メインの制御フローを管理
 */
export class TriggerManager {
  private static instance: TriggerManager;
  private notionApiClient: NotionApiClient;
  private performanceMonitor: PerformanceMonitor;
  private processingStatus: ProcessingStatus;

  private constructor() {
    this.notionApiClient = new NotionApiClient();
    this.performanceMonitor = new PerformanceMonitor();
    this.processingStatus = {
      isProcessing: false,
      lastProcessTime: 0,
      errorHistory: [],
    };
  }

  /**
   * シングルトンインスタンスを取得
   */
  static getInstance(): TriggerManager {
    if (!TriggerManager.instance) {
      TriggerManager.instance = new TriggerManager();
    }
    return TriggerManager.instance;
  }

  /**
   * スプレッドシート編集時のトリガー関数
   */
  async onEdit(e: EditEvent): Promise<void> {
    try {
      Logger.info('Edit event triggered', {
        row: e.range.getRow(),
        column: e.range.getColumn(),
        value: e.value,
        oldValue: e.oldValue,
      });

      // 重複実行防止
      if (this.processingStatus.isProcessing) {
        Logger.warn('Processing already in progress, skipping');
        return;
      }

      // チェックボックス列の編集かチェック
      Logger.debug('Checking if edit is in checkbox column', {
        editColumn: e.range.getColumn(),
        checkboxColumn: CONSTANTS.COLUMNS.CHECKBOX,
        isCheckboxColumn: this.isCheckboxColumn(e.range),
      });

      if (!this.isCheckboxColumn(e.range)) {
        Logger.debug('Edit is not in checkbox column, skipping');
        return;
      }

      // チェックONの場合のみ処理（true, 'TRUE', 1, '1'を許可）
      Logger.debug('Checking checkbox value', {
        value: e.value,
        type: typeof e.value,
        isChecked: this.isCheckboxChecked(e.value),
      });

      if (!this.isCheckboxChecked(e.value)) {
        Logger.debug('Checkbox is not checked, skipping');
        return;
      }

      Logger.info('Checkbox validation passed, proceeding with import', {
        rowNumber: e.range.getRow(),
      });

      // セキュリティチェック
      this.validateAccess(e);

      // メイン処理実行
      await this.processImport(e.range.getRow());
    } catch (error) {
      this.handleError(error, {
        context: 'onEdit',
        rowNumber: e.range.getRow(),
      });
    }
  }

  /**
   * 指定行のデータインポート処理
   */
  async processImport(rowNumber: number): Promise<ImportResult> {
    const context: ImportContext = {
      rowNumber,
      timestamp: new Date(),
      userId: this.getCurrentUserId(),
    };

    this.processingStatus.isProcessing = true;
    this.processingStatus.lastProcessTime = Date.now();

    // パフォーマンス測定開始
    this.performanceMonitor.startMeasurement(1);

    try {
      Logger.info('Starting import process', { rowNumber });

      // 設定取得
      Logger.debug('Loading configuration...');
      const config = await ConfigManager.getConfig();
      Logger.debug('Configuration loaded successfully', {
        databaseId: config.databaseId
          ? config.databaseId.substring(0, 8) + '...'
          : 'Not set',
        projectName: config.projectName,
      });

      Logger.debug('Loading column mappings...');
      const mappings = ConfigManager.getColumnMappings();
      Logger.debug('Column mappings loaded', {
        totalMappings: mappings.length,
        targetMappings: mappings.filter(m => m.isTarget).length,
      });

      // データ取得
      Logger.debug('Retrieving row data...', { rowNumber });
      const rowData = this.getRowData(rowNumber);
      Logger.debug('Row data retrieved', {
        rowData:
          rowData
            .map((value, index) => `[${index}]${value}`)
            .join(', ')
            .substring(0, 200) + '...',
      });

      // データ検証
      const validationResult = Validator.validateRowData(rowData, mappings);
      if (!validationResult.valid) {
        this.performanceMonitor.recordError('VALIDATION_ERROR');
        throw new SpreadsheetToNotionError(
          `データ検証エラー: ${validationResult.errors.join(', ')}`,
          ErrorType.VALIDATION_ERROR
        );
      }

      // データ変換
      const notionData = DataMapper.mapRowToNotionPage(rowData, mappings);
      Logger.debug('Data mapped to Notion format', { notionData });

      // 既存ページの確認（主キー列の値）
      const primaryKeyColumnIndex = this.getPrimaryKeyColumnIndex();
      const existingPageId =
        primaryKeyColumnIndex >= 0 ? rowData[primaryKeyColumnIndex] : null;

      let result;

      if (
        existingPageId &&
        typeof existingPageId === 'string' &&
        existingPageId.trim()
      ) {
        // 既存ページの更新
        Logger.info('Updating existing Notion page', {
          pageId: existingPageId,
        });
        this.performanceMonitor.recordApiCall();
        result = await this.notionApiClient.updatePage(
          existingPageId.trim(),
          notionData
        );
      } else {
        // 新規ページの作成
        Logger.info('Creating new Notion page', {
          databaseId: config.databaseId,
        });
        this.performanceMonitor.recordApiCall();
        result = await this.notionApiClient.createPage(
          config.databaseId,
          notionData
        );

        // 主キーを記録
        if (primaryKeyColumnIndex >= 0) {
          this.recordPrimaryKey(rowNumber, result.id);
        }
      }

      // 成功記録
      this.performanceMonitor.recordSuccess();

      // 成功通知
      this.showSuccessMessage('データの連携が完了しました');
      Logger.info('Import process completed successfully', {
        rowNumber,
        pageId: result.id,
      });

      // パフォーマンス測定終了
      const metrics = this.performanceMonitor.endMeasurement();
      Logger.info(
        `処理完了 - 処理時間: ${metrics.totalTime}ms, 成功率: ${metrics.successRate}%`
      );

      return { success: true, result, performanceMetrics: metrics };
    } catch (error) {
      this.performanceMonitor.recordError(
        error instanceof SpreadsheetToNotionError ? error.type : 'UNKNOWN_ERROR'
      );

      Logger.error('Import process failed', { error, context });
      this.handleError(error, { context: 'processImport', ...context });

      // パフォーマンス測定終了
      const metrics = this.performanceMonitor.endMeasurement();

      return {
        success: false,
        error: error as Error,
        performanceMetrics: metrics,
      };
    } finally {
      this.processingStatus.isProcessing = false;
    }
  }

  /**
   * 編集された範囲がチェックボックス列かどうかをチェック
   */
  private isCheckboxColumn(range: GoogleAppsScript.Spreadsheet.Range): boolean {
    return range.getColumn() === CONSTANTS.COLUMNS.CHECKBOX;
  }

  /**
   * チェックボックスがチェックされているかどうかを判定
   */
  private isCheckboxChecked(value: any): boolean {
    if (value === true || value === 'TRUE' || value === 1 || value === '1') {
      return true;
    }
    return false;
  }

  /**
   * アクセス権限の確認
   */
  private validateAccess(e: EditEvent): void {
    try {
      // スプレッドシートの編集権限があることは既に確認済み
      // 追加のセキュリティチェックが必要な場合はここで実装
      Logger.debug('Access validation passed', { user: e.user.getEmail() });
    } catch (error) {
      throw new SpreadsheetToNotionError(
        'アクセス権限の確認に失敗しました',
        ErrorType.PERMISSION_ERROR,
        error as Error
      );
    }
  }

  /**
   * 指定行からデータを取得
   */
  private getRowData(rowNumber: number): any[] {
    try {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
        CONSTANTS.SHEETS.IMPORT_DATA
      );

      if (!sheet) {
        throw new Error(
          `シート "${CONSTANTS.SHEETS.IMPORT_DATA}" が見つかりません`
        );
      }

      const lastColumn = sheet.getLastColumn();
      const range = sheet.getRange(rowNumber, 1, 1, lastColumn);

      return range.getValues()[0];
    } catch (error) {
      throw new SpreadsheetToNotionError(
        `行データの取得に失敗しました（行: ${rowNumber}）`,
        ErrorType.CONFIG_ERROR,
        error as Error
      );
    }
  }

  /**
   * 主キー列のインデックスを取得
   */
  private getPrimaryKeyColumnIndex(): number {
    return CONSTANTS.COLUMNS.PRIMARY_KEY - 1; // 1-based to 0-based
  }

  /**
   * 作成されたNotionページIDを主キー列に記録
   */
  private recordPrimaryKey(rowNumber: number, pageId: string): void {
    try {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
        CONSTANTS.SHEETS.IMPORT_DATA
      );

      if (!sheet) {
        throw new Error(
          `シート "${CONSTANTS.SHEETS.IMPORT_DATA}" が見つかりません`
        );
      }

      sheet.getRange(rowNumber, CONSTANTS.COLUMNS.PRIMARY_KEY).setValue(pageId);

      Logger.info('Primary key recorded', { rowNumber, pageId });
    } catch (error) {
      Logger.error('Failed to record primary key', {
        error,
        rowNumber,
        pageId,
      });
      // 主キー記録の失敗は処理全体を止めない
    }
  }

  /**
   * 成功メッセージをユーザーに表示
   */
  private showSuccessMessage(message: string): void {
    try {
      SpreadsheetApp.getUi().alert(
        '成功',
        message,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch (error) {
      Logger.warn('Failed to show success message', { error, message });
      // UI表示の失敗は処理全体に影響しない
    }
  }

  /**
   * エラーメッセージをユーザーに表示
   */
  private showErrorMessage(message: string): void {
    try {
      SpreadsheetApp.getUi().alert(
        'エラー',
        message,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch (error) {
      Logger.error('Failed to show error message', { error, message });
    }
  }

  /**
   * 現在のユーザーIDを取得
   */
  private getCurrentUserId(): string {
    try {
      return Session.getActiveUser().getEmail();
    } catch (error) {
      Logger.warn('Failed to get current user ID', { error });
      return 'unknown';
    }
  }

  /**
   * エラーハンドリング
   */
  private handleError(error: any, context?: any): void {
    // エラー履歴に記録
    this.processingStatus.errorHistory.push({
      timestamp: new Date(),
      error: error instanceof Error ? error.message : String(error),
      context,
    });

    // エラー履歴の制限（最新100件まで）
    if (this.processingStatus.errorHistory.length > 100) {
      this.processingStatus.errorHistory.shift();
    }

    // ログ記録
    Logger.error('TriggerManager error occurred', { error, context });

    // ユーザーへの通知
    let userMessage = 'データの連携中にエラーが発生しました。';

    if (error instanceof SpreadsheetToNotionError) {
      switch (error.type) {
        case ErrorType.CONFIG_ERROR:
          userMessage = '設定に問題があります。管理者にお問い合わせください。';
          break;
        case ErrorType.VALIDATION_ERROR:
          userMessage = `データに問題があります: ${error.message}`;
          break;
        case ErrorType.API_ERROR:
          userMessage =
            'Notion APIとの通信でエラーが発生しました。しばらく待ってから再試行してください。';
          break;
        case ErrorType.PERMISSION_ERROR:
          userMessage =
            'アクセス権限がありません。管理者にお問い合わせください。';
          break;
        default:
          userMessage = `エラー: ${error.message}`;
      }
    }

    this.showErrorMessage(userMessage);
  }

  /**
   * 処理状況を取得
   */
  getProcessingStatus(): ProcessingStatus {
    return { ...this.processingStatus };
  }

  /**
   * エラー履歴をクリア
   */
  clearErrorHistory(): void {
    this.processingStatus.errorHistory = [];
    Logger.info('Error history cleared');
  }

  /**
   * システム統計情報を取得
   */
  getSystemStats() {
    return this.performanceMonitor.getSystemStats();
  }

  /**
   * システムヘルスチェックを実行
   */
  healthCheck() {
    return this.performanceMonitor.healthCheck();
  }

  /**
   * パフォーマンスレポートを生成
   * @param period 期間（日数）
   */
  generatePerformanceReport(period?: number): string {
    return this.performanceMonitor.generatePerformanceReport(period);
  }

  /**
   * リアルタイムパフォーマンス情報を取得
   */
  getCurrentPerformanceStatus() {
    return this.performanceMonitor.getCurrentStatus();
  }

  /**
   * 接続テストを実行
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.notionApiClient.testConnection();
      return result;
    } catch (error) {
      Logger.error('Connection test failed', { error });
      return {
        success: false,
        message: `接続テストに失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

/**
 * グローバル関数（Google Apps Scriptのトリガー用）
 */

/**
 * スプレッドシート編集トリガー関数
 */
declare global {
  function onEdit(e: any): void;
  function processImportManually(rowNumber: number): void;
  function testConnectionManually(): void;
  function getSystemHealthReport(): void;
  function clearSystemErrorHistory(): void;
  function showPerformanceReport(): void;
}

globalThis.onEdit = function (e: any): void {
  const triggerManager = TriggerManager.getInstance();
  triggerManager.onEdit(e as EditEvent).catch(error => {
    Logger.error('Unhandled error in onEdit trigger', { error });
  });
};

(globalThis as any).processImportManually = (rowNumber: number) => {
  void TriggerManager.getInstance().processImport(rowNumber);
};

(globalThis as any).testConnectionManually = () => {
  void TriggerManager.getInstance()
    .testConnection()
    .then(result => {
      SpreadsheetApp.getUi().alert(result.message);
    })
    .catch(error => {
      Logger.error('Test connection failed', { error });
      SpreadsheetApp.getUi().alert('接続テストに失敗しました');
    });
};

(globalThis as any).getSystemHealthReport = () => {
  const triggerManager = TriggerManager.getInstance();
  const health = triggerManager.healthCheck();
  const stats = triggerManager.getSystemStats();

  const message = `🔍 システムヘルス状況: ${health.status.toUpperCase()}
📊 総処理数: ${stats.totalProcessed}行
✅ 成功率: ${stats.overallSuccessRate.toFixed(1)}%
⏱️ 平均処理時間: ${(stats.averageProcessingTime / 1000).toFixed(2)}秒/行
🕒 最終処理: ${stats.lastProcessedAt.toLocaleString()}

${health.issues.length > 0 ? '⚠️ 課題:\n' + health.issues.map(issue => `• ${issue}`).join('\n') : '✅ システムは正常に動作しています'}`;

  SpreadsheetApp.getUi().alert(
    'システムヘルス状況',
    message,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
};

(globalThis as any).clearSystemErrorHistory = () => {
  TriggerManager.getInstance().clearErrorHistory();
  SpreadsheetApp.getUi().alert('エラー履歴をクリアしました');
};

(globalThis as any).showPerformanceReport = () => {
  const report = TriggerManager.getInstance().generatePerformanceReport(7);

  // レポートが長い場合は、ダイアログで表示
  const ui = SpreadsheetApp.getUi();
  const htmlContent = `<div style="font-family: monospace; white-space: pre-wrap; padding: 10px;">${report.replace(/\n/g, '<br>')}</div>`;
  const htmlOutput = HtmlService.createHtmlOutput(htmlContent)
    .setWidth(600)
    .setHeight(400);

  ui.showModalDialog(htmlOutput, 'パフォーマンスレポート (過去7日間)');
};
