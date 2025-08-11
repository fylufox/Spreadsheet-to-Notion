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
import { TriggerManager } from './core/TriggerManager';
import { ConfigManager } from './core/ConfigManager';

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

/**
 * TriggerManagerの動作をテストする関数（デバッグ用）
 */
function testTriggerManager(): void {
  try {
    Logger.info('Testing TriggerManager functionality');

    const triggerManager = TriggerManager.getInstance();

    // 処理ステータスを確認
    const status = triggerManager.getProcessingStatus();
    Logger.info('Current processing status', status);

    // システム統計を確認
    const stats = triggerManager.getSystemStats();
    Logger.info('System statistics', stats);

    // ヘルスチェックを実行
    const health = triggerManager.healthCheck();
    Logger.info('Health check results', health);

    Logger.info('TriggerManager test completed');
  } catch (error) {
    Logger.error('TriggerManager test failed', error);
  }
}

/**
 * 設定情報をテストする関数（デバッグ用）
 */
function testConfiguration(): void {
  try {
    Logger.info('Testing configuration');

    // 設定のヘルスチェック
    ConfigManager.healthCheck()
      .then((result: { healthy: boolean; issues: string[] }) => {
        Logger.info('Configuration health check result', result);

        if (result.healthy) {
          // 設定取得テスト
          ConfigManager.getConfig()
            .then((config: any) => {
              Logger.info('Configuration loaded successfully', {
                projectName: config.projectName,
                version: config.version,
                hasValidToken: !!config.apiToken,
                databaseId: config.databaseId
                  ? config.databaseId.substring(0, 8) + '...'
                  : 'Not set',
              });
            })
            .catch((error: any) => {
              Logger.error('Failed to load configuration', error);
            });

          // カラムマッピングテスト
          try {
            const mappings = ConfigManager.getColumnMappings();
            Logger.info('Column mappings loaded', {
              totalMappings: mappings.length,
              targetMappings: mappings.filter((m: any) => m.isTarget).length,
            });
          } catch (error) {
            Logger.error('Failed to load column mappings', error);
          }
        } else {
          Logger.error('Configuration health check failed', result.issues);
        }
      })
      .catch((error: any) => {
        Logger.error('Configuration health check failed', error);
      });
  } catch (error) {
    Logger.error('Configuration test failed', error);
  }
}

/**
 * 手動でonEdit処理をテストする関数
 */
function testOnEditManually(rowNumber?: number): void {
  try {
    Logger.info('Manual onEdit test started', { rowNumber });

    const testRowNumber = rowNumber || 2; // デフォルトは2行目

    // テスト用のEditEventオブジェクトを作成
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const range = sheet.getRange(testRowNumber, CONSTANTS.COLUMNS.CHECKBOX);

    const mockEditEvent = {
      range: range,
      value: true, // チェックボックスON
      oldValue: false,
      source: SpreadsheetApp.getActiveSpreadsheet(),
      user: Session.getActiveUser(),
    };

    Logger.info('Created mock edit event', {
      range: range.getA1Notation(),
      value: mockEditEvent.value,
    });

    // TriggerManagerで処理
    const triggerManager = TriggerManager.getInstance();
    triggerManager
      .onEdit(mockEditEvent)
      .then(() => {
        Logger.info('Manual onEdit test completed successfully');
      })
      .catch(error => {
        Logger.error('Manual onEdit test failed', error);
      });
  } catch (error) {
    Logger.error('Manual onEdit test setup failed', error);
  }
}

/**
 * 詳細な診断を実行する関数
 */
function runDiagnostics(): void {
  try {
    Logger.info('=== スプレッドシート to Notion 診断開始 ===');

    // 1. スプレッドシート構造の確認
    Logger.info('1. スプレッドシート構造の確認');
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = spreadsheet.getSheets();

    Logger.info('利用可能なシート:', {
      sheetNames: sheets.map(sheet => sheet.getName()),
      totalSheets: sheets.length,
    });

    // 必要なシートの確認
    const requiredSheets = [
      CONSTANTS.SHEETS.IMPORT_DATA,
      CONSTANTS.SHEETS.IMPORT_COLUMN,
      CONSTANTS.SHEETS.CONFIG,
    ];
    const missingSheets: string[] = [];

    requiredSheets.forEach(sheetName => {
      const sheet = spreadsheet.getSheetByName(sheetName);
      if (!sheet) {
        missingSheets.push(sheetName);
      } else {
        Logger.info(`シート "${sheetName}" が見つかりました`, {
          lastRow: sheet.getLastRow(),
          lastColumn: sheet.getLastColumn(),
        });
      }
    });

    if (missingSheets.length > 0) {
      Logger.error('必要なシートが見つかりません:', missingSheets);
      return;
    }

    // 2. 設定の確認
    Logger.info('2. 設定の確認');
    testConfiguration();

    // 3. チェックボックス列の確認
    Logger.info('3. チェックボックス列の確認');
    const importDataSheet = spreadsheet.getSheetByName(
      CONSTANTS.SHEETS.IMPORT_DATA
    );
    if (importDataSheet) {
      const checkboxColumn = CONSTANTS.COLUMNS.CHECKBOX;
      const lastRow = importDataSheet.getLastRow();

      if (lastRow > 1) {
        // 2行目のチェックボックス値を確認
        const checkboxValue = importDataSheet
          .getRange(2, checkboxColumn)
          .getValue();
        Logger.info('2行目のチェックボックス値:', {
          value: checkboxValue,
          type: typeof checkboxValue,
          column: checkboxColumn,
        });
      }
    }

    // 4. TriggerManagerのテスト
    Logger.info('4. TriggerManagerのテスト');
    testTriggerManager();

    Logger.info('=== 診断完了 ===');
  } catch (error) {
    Logger.error('診断中にエラーが発生しました:', error);
  }
}

/**
 * Notion APIトークンを設定する関数（手動実行用）
 * @param token Notion APIトークン（secret_またはntn_で始まる文字列）
 */
function setNotionApiToken(token?: string): void {
  try {
    if (!token) {
      Logger.error('APIトークンが指定されていません');
      Logger.info(
        '使用方法: setNotionApiToken("ntn_your_token_here") または setNotionApiToken("secret_your_token_here")'
      );
      return;
    }

    const success = ConfigManager.setApiToken(token);
    if (success) {
      Logger.info('Notion APIトークンが正常に設定されました');

      // 設定後の確認
      try {
        const retrievedToken = ConfigManager.getApiToken();
        Logger.info('設定確認完了', {
          tokenSet: true,
          tokenLength: retrievedToken.length,
          startsCorrectly: retrievedToken.startsWith('secret_'),
        });
      } catch (error) {
        Logger.error('設定後の確認に失敗しました', error);
      }
    } else {
      Logger.error('Notion APIトークンの設定に失敗しました');
    }
  } catch (error) {
    Logger.error('setNotionApiToken実行中にエラーが発生しました', error);
  }
}

/**
 * プロパティサービスの詳細な診断を行う関数
 */
function diagnoseProperties(): void {
  try {
    Logger.info('=== GASプロパティ診断開始 ===');

    // ConfigManagerのデバッグ機能を使用
    ConfigManager.debugProperties();

    // 手動でプロパティ確認
    const properties = PropertiesService.getScriptProperties().getProperties();
    Logger.info('全プロパティの詳細:', {
      totalCount: Object.keys(properties).length,
      keys: Object.keys(properties),
      hasNotionToken: CONSTANTS.CONFIG_KEYS.NOTION_API_TOKEN in properties,
    });

    // トークン取得テスト
    try {
      const token = ConfigManager.getApiToken();
      Logger.info('APIトークン取得成功', {
        tokenLength: token.length,
        format: token.substring(0, 7) + '...',
      });
    } catch (error) {
      Logger.error('APIトークン取得失敗', error);
    }

    Logger.info('=== プロパティ診断完了 ===');
  } catch (error) {
    Logger.error('プロパティ診断中にエラーが発生しました', error);
  }
}

/**
 * カラムマッピングシートの詳細診断を行う関数
 */
function diagnoseColumnMappingSheet(): void {
  try {
    Logger.info('=== カラムマッピングシート診断開始 ===');

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = CONSTANTS.SHEETS.IMPORT_COLUMN;
    const sheet = spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      Logger.error(`シート "${sheetName}" が見つかりません`);
      return;
    }

    Logger.info('シート基本情報', {
      name: sheet.getName(),
      lastRow: sheet.getLastRow(),
      lastColumn: sheet.getLastColumn(),
      maxRows: sheet.getMaxRows(),
      maxColumns: sheet.getMaxColumns(),
    });

    // データ範囲を取得
    const dataRange = sheet.getDataRange();
    const data = dataRange.getValues();

    Logger.info('データ範囲情報', {
      numRows: dataRange.getNumRows(),
      numColumns: dataRange.getNumColumns(),
      range: dataRange.getA1Notation(),
    });

    // 各行の詳細を確認
    data.forEach((row, index) => {
      const rowNumber = index + 1;
      Logger.info(`行 ${rowNumber} の詳細`, {
        columnCount: row.length,
        rowData: row.map(cell => String(cell).substring(0, 50)), // 50文字まで表示
        isEmpty: row.every(cell => !cell || String(cell).trim() === ''),
      });
    });

    // 期待される構造の説明
    Logger.info('期待されるシート構造', {
      requiredColumns: [
        'A: スプレッドシート列名',
        'B: Notionプロパティ名',
        'C: データ型',
        'D: 対象フラグ (yes/no)',
        'E: 必須フラグ (yes/no)',
      ],
      minimumColumns: 5,
      headerRowRequired: true,
    });

    Logger.info('=== カラムマッピングシート診断完了 ===');
  } catch (error) {
    Logger.error('カラムマッピングシート診断中にエラーが発生しました', error);
  }
}

/**
 * インストール可能なトリガーを設定する関数（手動実行用）
 * 外部API権限問題を解決するためのトリガー設定
 */
function setupTriggers(): void {
  TriggerManager.setupInstallableTriggers();
}

/**
 * すべてのトリガーをクリアする関数（管理者用）
 */
function clearTriggers(): void {
  TriggerManager.clearAllTriggers();
  SpreadsheetApp.getUi().alert('すべてのトリガーをクリアしました');
}

/**
 * 現在のトリガー状況を表示する関数（管理者用）
 */
function showTriggerStatus(): void {
  const status = TriggerManager.getTriggerStatus();

  let message = `現在のトリガー数: ${status.count}\n\n`;

  if (status.triggers.length > 0) {
    message += 'トリガー詳細:\n';
    status.triggers.forEach((trigger: any, index: number) => {
      message += `${index + 1}. 関数: ${trigger.handlerFunction}\n`;
      message += `   イベント: ${trigger.eventType}\n`;
      message += `   ソース: ${trigger.triggerSource}\n\n`;
    });
  } else {
    message += 'トリガーが設定されていません。\n';
    message += '「setupTriggers」関数を実行してトリガーを設定してください。';
  }

  SpreadsheetApp.getUi().alert(
    'トリガー状況',
    message,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * グローバル関数の定義（Google Apps Script用）
 * スプレッドシートから直接実行可能な関数
 */

// デバッグ用グローバル関数を定義
(globalThis as any).runDiagnostics = runDiagnostics;
(globalThis as any).testConfiguration = testConfiguration;
(globalThis as any).testTriggerManager = testTriggerManager;
(globalThis as any).testOnEditManually = testOnEditManually;
(globalThis as any).initializeSystem = initializeSystem;
(globalThis as any).testBasicFunctions = testBasicFunctions;
(globalThis as any).setNotionApiToken = setNotionApiToken;
(globalThis as any).diagnoseProperties = diagnoseProperties;
(globalThis as any).diagnoseColumnMappingSheet = diagnoseColumnMappingSheet;

// トリガー管理用グローバル関数を定義
(globalThis as any).setupTriggers = setupTriggers;
(globalThis as any).clearTriggers = clearTriggers;
(globalThis as any).showTriggerStatus = showTriggerStatus;
