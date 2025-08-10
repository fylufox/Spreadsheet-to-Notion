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
import {
  EditEvent,
  ImportContext,
  ImportResult,
  ProcessingStatus,
  SystemConfig,
  ColumnMapping,
  ErrorType,
  SpreadsheetToNotionError
} from '../types';

/**
 * TriggerManager
 * スプレッドシートのトリガーイベントを処理し、メインの制御フローを管理
 */
export class TriggerManager {
  private static instance: TriggerManager;
  private notionApiClient: NotionApiClient;
  private processingStatus: ProcessingStatus;

  private constructor() {
    this.notionApiClient = new NotionApiClient();
    this.processingStatus = {
      isProcessing: false,
      lastProcessTime: 0,
      errorHistory: []
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
        oldValue: e.oldValue
      });

      // 重複実行防止
      if (this.processingStatus.isProcessing) {
        Logger.warn('Processing already in progress, skipping');
        return;
      }

      // チェックボックス列の編集かチェック
      if (!this.isCheckboxColumn(e.range)) {
        Logger.debug('Edit is not in checkbox column, skipping');
        return;
      }

      // チェックONの場合のみ処理（true, 'TRUE', 1, '1'を許可）
      if (!this.isCheckboxChecked(e.value)) {
        Logger.debug('Checkbox is not checked, skipping');
        return;
      }

      // セキュリティチェック
      this.validateAccess(e);

      // メイン処理実行
      await this.processImport(e.range.getRow());

    } catch (error) {
      this.handleError(error, { 
        context: 'onEdit', 
        rowNumber: e.range.getRow() 
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
      userId: this.getCurrentUserId()
    };

    this.processingStatus.isProcessing = true;
    this.processingStatus.lastProcessTime = Date.now();

    try {
      Logger.info('Starting import process', { rowNumber });

      // 設定取得
      const config = await ConfigManager.getConfig();
      const mappings = ConfigManager.getColumnMappings();

      // データ取得
      const rowData = this.getRowData(rowNumber);
      Logger.debug('Row data retrieved', { rowData });

      // データ検証
      const validationResult = Validator.validateRowData(rowData, mappings);
      if (!validationResult.valid) {
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
      const existingPageId = primaryKeyColumnIndex >= 0 ? rowData[primaryKeyColumnIndex] : null;

      let result;
      
      if (existingPageId && typeof existingPageId === 'string' && existingPageId.trim()) {
        // 既存ページの更新
        Logger.info('Updating existing Notion page', { pageId: existingPageId });
        result = await this.notionApiClient.updatePage(existingPageId.trim(), notionData);
      } else {
        // 新規ページの作成
        Logger.info('Creating new Notion page', { databaseId: config.databaseId });
        result = await this.notionApiClient.createPage(config.databaseId, notionData);
        
        // 主キーを記録
        if (primaryKeyColumnIndex >= 0) {
          this.recordPrimaryKey(rowNumber, result.id);
        }
      }

      // 成功通知
      this.showSuccessMessage('データの連携が完了しました');
      Logger.info('Import process completed successfully', { 
        rowNumber, 
        pageId: result.id 
      });

      return { success: true, result };

    } catch (error) {
      Logger.error('Import process failed', { error, context });
      this.handleError(error, { context: 'processImport', ...context });
      return { success: false, error: error as Error };
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
      const sheet = SpreadsheetApp.getActiveSpreadsheet()
        .getSheetByName(CONSTANTS.SHEETS.IMPORT_DATA);
      
      if (!sheet) {
        throw new Error(`シート "${CONSTANTS.SHEETS.IMPORT_DATA}" が見つかりません`);
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
      const sheet = SpreadsheetApp.getActiveSpreadsheet()
        .getSheetByName(CONSTANTS.SHEETS.IMPORT_DATA);
      
      if (!sheet) {
        throw new Error(`シート "${CONSTANTS.SHEETS.IMPORT_DATA}" が見つかりません`);
      }

      sheet.getRange(rowNumber, CONSTANTS.COLUMNS.PRIMARY_KEY)
        .setValue(pageId);
      
      Logger.info('Primary key recorded', { rowNumber, pageId });
    } catch (error) {
      Logger.error('Failed to record primary key', { error, rowNumber, pageId });
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
      context
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
          userMessage = 'Notion APIとの通信でエラーが発生しました。しばらく待ってから再試行してください。';
          break;
        case ErrorType.PERMISSION_ERROR:
          userMessage = 'アクセス権限がありません。管理者にお問い合わせください。';
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
        message: `接続テストに失敗しました: ${error instanceof Error ? error.message : String(error)}`
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
}

globalThis.onEdit = function(e: any): void {
  const triggerManager = TriggerManager.getInstance();
  triggerManager.onEdit(e as EditEvent).catch(error => {
    Logger.error('Unhandled error in onEdit trigger', { error });
  });
};
