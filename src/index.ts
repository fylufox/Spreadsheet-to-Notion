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

// エントリーポイント - Google Apps Script用
import { Logger } from './utils/Logger';
import { CONSTANTS } from './utils/Constants';

/**
 * スプレッドシート編集時のトリガー関数
 * この関数はGoogle Apps Scriptによって自動的に呼び出されます
 */
function onEdit(e: GoogleAppsScript.Events.SheetsOnEdit): void {
  try {
    Logger.info('onEdit triggered', {
      range: e.range.getA1Notation(),
      value: e.value,
      user: e.user?.getEmail(),
    });

    // TODO: TriggerManager実装後に置き換え
    // TriggerManager.onEdit(e);
  } catch (error) {
    Logger.error('onEdit failed', error);
    // TODO: ErrorManager実装後に置き換え
    // ErrorManager.handleError(error, 'onEdit');
  }
}

/**
 * システム初期化関数（手動実行用）
 */
function initializeSystem(): void {
  try {
    Logger.info('System initialization started');

    // システム情報をログ出力
    Logger.info('System constants loaded', {
      version: CONSTANTS.DEFAULTS.VERSION,
      sheets: CONSTANTS.SHEETS,
    });

    Logger.info('System initialization completed');
  } catch (error) {
    Logger.error('System initialization failed', error);
  }
}

/**
 * 開発・デバッグ用の動作確認関数
 */
function testBasicFunctions(): void {
  try {
    Logger.info('Running basic function tests');

    // Constants の動作確認
    Logger.debug('Testing constants', {
      sheetsCount: Object.keys(CONSTANTS.SHEETS).length,
      dataTypesCount: Object.keys(CONSTANTS.DATA_TYPES).length,
    });

    // Logger の各レベルをテスト
    Logger.debug('Debug test message');
    Logger.info('Info test message');
    Logger.warn('Warning test message');
    Logger.error('Error test message');

    // 機密情報マスキングのテスト
    Logger.info('Testing sensitive data masking', {
      apiToken: 'secret_abcdefghijklmnopqrstuvwxyz1234567890123',
      normalData: 'This is normal data',
    });

    Logger.info('Basic function tests completed');
  } catch (error) {
    Logger.error('Basic function tests failed', error);
  }
}

// Google Apps Script用の関数をグローバルスコープに公開
(global as any).onEdit = onEdit;
(global as any).initializeSystem = initializeSystem;
(global as any).testBasicFunctions = testBasicFunctions;
