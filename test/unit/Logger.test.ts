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

import { Logger } from '../../src/utils/Logger';
import { LogLevel } from '../../src/types';

// Google Apps Script API のモック
const mockPropertiesService = {
  getScriptProperties: jest.fn(() => ({
    getProperty: jest.fn(),
    setProperty: jest.fn(),
  })),
};

// グローバルオブジェクトにモックを設定
(global as any).PropertiesService = mockPropertiesService;

// Console のモック
const mockConsole = {
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// console をモック
Object.assign(console, mockConsole);

describe('Logger', () => {
  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();
    Logger.clearHistory();
    
    // インスタンスをリセット
    (Logger as any).instance = undefined;
    
    // デフォルトのプロパティサービスの動作を設定
    mockPropertiesService.getScriptProperties().getProperty.mockReturnValue(null);
  });

  describe('ログレベル管理', () => {
    test('デフォルトログレベルはINFOである', () => {
      const logger = Logger.getInstance();
      expect(logger.getLogLevel()).toBe(LogLevel.INFO);
    });

    test('ログレベルを変更できる', () => {
      const logger = Logger.getInstance();
      logger.setLogLevel(LogLevel.DEBUG);
      expect(logger.getLogLevel()).toBe(LogLevel.DEBUG);
    });

    test('環境からログレベルを取得する', () => {
      // プロパティサービスからDEBUGを返すようにモック設定
      const debugPropertyMock = {
        getProperty: jest.fn(() => 'DEBUG'),
        setProperty: jest.fn()
      };
      mockPropertiesService.getScriptProperties.mockReturnValue(debugPropertyMock);
      
      // 新しいインスタンス作成のため、既存インスタンスをリセット
      (Logger as any).instance = undefined;
      
      const logger = Logger.getInstance();
      expect(logger.getLogLevel()).toBe(LogLevel.DEBUG);
      
      // テスト後のクリーンアップ
      (Logger as any).instance = undefined;
    });
  });

  describe('ログ出力', () => {
    beforeEach(() => {
      // 全ログレベルが出力されるようDEBUGレベルに設定
      Logger.getInstance().setLogLevel(LogLevel.DEBUG);
    });
    test('DEBUGログが正しく出力される', () => {
      Logger.getInstance().setLogLevel(LogLevel.DEBUG);
      Logger.debug('Debug message', { data: 'test' }, 'TestContext');
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG]')
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('Debug message')
      );
    });

    test('INFOログが正しく出力される', () => {
      Logger.info('Info message', { data: 'test' });
      
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]')
      );
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('Info message')
      );
    });

    test('WARNログが正しく出力される', () => {
      Logger.warn('Warning message');
      
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('[WARN]')
      );
    });

    test('ERRORログが正しく出力される', () => {
      Logger.error('Error message');
      
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]')
      );
    });
  });

  describe('ログレベル制御', () => {
    test('INFOレベル設定時にDEBUGログは出力されない', () => {
      Logger.getInstance().setLogLevel(LogLevel.INFO);
      Logger.debug('Debug message');
      
      expect(mockConsole.log).not.toHaveBeenCalled();
    });

    test('ERRORレベル設定時にINFO以下のログは出力されない', () => {
      Logger.getInstance().setLogLevel(LogLevel.ERROR);
      Logger.info('Info message');
      Logger.warn('Warning message');
      
      expect(mockConsole.info).not.toHaveBeenCalled();
      expect(mockConsole.warn).not.toHaveBeenCalled();
    });

    test('ERRORレベル設定時にERRORログは出力される', () => {
      Logger.getInstance().setLogLevel(LogLevel.ERROR);
      Logger.error('Error message');
      
      expect(mockConsole.error).toHaveBeenCalled();
    });
  });

  describe('機密情報のマスキング', () => {
    test('APIトークンがマスキングされる', () => {
      const sensitiveData = {
        apiToken: 'secret_abcdefghijklmnopqrstuvwxyz1234567890123',
        normalData: 'normal value',
      };

      Logger.info('Test message', sensitiveData);

      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('secret_a***')
      );
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('normal value')
      );
    });

    test('ネストしたオブジェクト内の機密情報もマスキングされる', () => {
      const nestedData = {
        config: {
          token: 'secret_token_123456',
          password: 'mypassword',
        },
        publicData: 'public',
      };

      Logger.info('Nested test', nestedData);

      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('secret_t***')
      );
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('mypasswo***')
      );
    });

    test('配列内の機密情報もマスキングされる', () => {
      const arrayData = [
        { key: 'sensitive_key_123' },
        { normalField: 'normal' },
      ];

      Logger.info('Array test', arrayData);

      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('sensitiv***')
      );
    });
  });

  describe('ログ履歴管理', () => {
    test('ログ履歴に正しく記録される', () => {
      Logger.info('Test message 1');
      Logger.warn('Test message 2');

      const history = Logger.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].message).toBe('Test message 1');
      expect(history[1].message).toBe('Test message 2');
    });

    test('特定のレベルのログ履歴を取得できる', () => {
      Logger.info('Info message');
      Logger.warn('Warning message');
      Logger.error('Error message');

      const errorHistory = Logger.getHistory(LogLevel.ERROR);
      expect(errorHistory).toHaveLength(1);
      expect(errorHistory[0].message).toBe('Error message');
    });

    test('ログ履歴をクリアできる', () => {
      Logger.info('Test message');
      expect(Logger.getHistory()).toHaveLength(1);

      Logger.clearHistory();
      expect(Logger.getHistory()).toHaveLength(0);
    });
  });

  describe('エラーログ', () => {
    test('エラーオブジェクトの詳細情報が記録される', () => {
      const testError = new Error('Test error');
      testError.stack = 'Test stack trace';

      Logger.logError(testError, 'TestContext');

      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('Exception occurred')
      );
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('Test error')
      );
    });
  });

  describe('パフォーマンス測定', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('タイマーの開始と終了が正しく動作する', () => {
      const timerId = Logger.startTimer('test-operation');
      
      // 100ms 経過をシミュレート
      jest.advanceTimersByTime(100);
      
      Logger.endTimer(timerId, 'test-operation');

      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('Timer ended: test-operation')
      );
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('100ms')
      );
    });
  });

  describe('異常系', () => {
    test('プロパティサービスアクセスエラーでもログは動作する', () => {
      // テスト用の独立したモックを作成
      const errorMockPropertiesService = {
        getScriptProperties: jest.fn(() => {
          throw new Error('PropertiesService error');
        })
      };

      // 一時的にモックを置き換え
      const originalPropertiesService = (global as any).PropertiesService;
      (global as any).PropertiesService = errorMockPropertiesService;

      try {
        // 新しいインスタンス作成のため、既存インスタンスをリセット
        (Logger as any).instance = undefined;

        expect(() => {
          Logger.getInstance();
          Logger.info('Test message');
        }).not.toThrow();

      } finally {
        // モックを元に戻す
        (global as any).PropertiesService = originalPropertiesService;
        (Logger as any).instance = undefined;
      }
    });

    test('サニタイズ処理で循環参照エラーが発生しても動作する', () => {
      const circularData: any = { name: 'test' };
      circularData.self = circularData;

      expect(() => {
        Logger.info('Circular test', circularData);
      }).not.toThrow();

      expect(mockConsole.info).toHaveBeenCalled();
    });
  });
});
