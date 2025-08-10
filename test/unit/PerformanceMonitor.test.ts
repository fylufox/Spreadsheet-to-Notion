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
 * Copyright 2025 Nakatani Naoya
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { PerformanceMonitor } from '../../src/core/PerformanceMonitor';
import { Logger } from '../../src/utils/Logger';

// Loggerのモック
jest.mock('../../src/utils/Logger');

// Google Apps Script APIのモック
const mockProperties = {
  getProperty: jest.fn(),
  setProperty: jest.fn(),
};

const mockPropertiesService = {
  getScriptProperties: jest.fn(() => mockProperties),
};

// PropertiesServiceをグローバルオブジェクトに設定
(global as any).PropertiesService = mockPropertiesService;

describe('PerformanceMonitor', () => {
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor();
    jest.clearAllMocks();

    // デフォルトの統計データをセット
    mockProperties.getProperty.mockReturnValue(
      JSON.stringify({
        totalProcessed: 100,
        totalSuccess: 95,
        totalErrors: 5,
        overallSuccessRate: 95,
        averageProcessingTime: 3000,
        lastProcessedAt: new Date().toISOString(),
        errorTrends: { VALIDATION_ERROR: 3, API_ERROR: 2 },
      })
    );
  });

  describe('基本的なパフォーマンス測定', () => {
    test('測定開始と終了が正常に動作する', () => {
      // 測定開始
      performanceMonitor.startMeasurement(10);

      // Logger.infoが呼ばれることを確認
      expect(Logger.info).toHaveBeenCalledWith(
        'パフォーマンス測定開始: 予定処理行数 10行',
        'PerformanceMonitor'
      );

      // 成功とエラーを記録
      performanceMonitor.recordSuccess();
      performanceMonitor.recordSuccess();
      performanceMonitor.recordError('VALIDATION_ERROR');
      performanceMonitor.recordApiCall();
      performanceMonitor.recordApiCall();

      // 測定終了
      const metrics = performanceMonitor.endMeasurement();

      // 結果の検証
      expect(metrics.processedRows).toBe(3);
      expect(metrics.successCount).toBe(2);
      expect(metrics.errorCount).toBe(1);
      expect(metrics.successRate).toBeCloseTo(66.67, 1);
      expect(metrics.apiCallCount).toBe(2);
      expect(metrics.totalTime).toBeGreaterThan(0);
      expect(metrics.averageTimePerRow).toBeGreaterThan(0);
    });

    test('処理なしでの測定終了', () => {
      performanceMonitor.startMeasurement(0);
      const metrics = performanceMonitor.endMeasurement();

      expect(metrics.processedRows).toBe(0);
      expect(metrics.successCount).toBe(0);
      expect(metrics.errorCount).toBe(0);
      expect(metrics.successRate).toBe(0);
      expect(metrics.averageTimePerRow).toBe(0);
    });

    test('測定開始前の現在状況取得', () => {
      const status = performanceMonitor.getCurrentStatus();
      expect(status).toEqual({});
    });

    test('測定中の現在状況取得', async () => {
      performanceMonitor.startMeasurement(5);

      // 時間経過を確保するために少し待機
      await new Promise(resolve => setTimeout(resolve, 10));

      performanceMonitor.recordSuccess();

      const status = performanceMonitor.getCurrentStatus();

      expect(status.processedRows).toBe(1);
      expect(status.successCount).toBe(1);
      expect(status.totalTime).toBeGreaterThan(0);
      expect(status.averageTimePerRow).toBeGreaterThan(0);
    });
  });

  describe('システム統計機能', () => {
    test('統計情報の正常取得', () => {
      const stats = performanceMonitor.getSystemStats();

      expect(stats.totalProcessed).toBe(100);
      expect(stats.totalSuccess).toBe(95);
      expect(stats.totalErrors).toBe(5);
      expect(stats.overallSuccessRate).toBe(95);
      expect(stats.averageProcessingTime).toBe(3000);
      expect(stats.errorTrends).toEqual({ VALIDATION_ERROR: 3, API_ERROR: 2 });
    });

    test('統計情報がない場合のデフォルト値', () => {
      mockProperties.getProperty.mockReturnValue(null);

      const stats = performanceMonitor.getSystemStats();

      expect(stats.totalProcessed).toBe(0);
      expect(stats.totalSuccess).toBe(0);
      expect(stats.totalErrors).toBe(0);
      expect(stats.overallSuccessRate).toBe(0);
      expect(stats.averageProcessingTime).toBe(0);
      expect(stats.errorTrends).toEqual({});
    });

    test('不正な統計データの場合のフォールバック', () => {
      mockProperties.getProperty.mockReturnValue('invalid json');

      const stats = performanceMonitor.getSystemStats();

      expect(stats.totalProcessed).toBe(0);
      expect(Logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('統計情報の取得に失敗'),
        'PerformanceMonitor'
      );
    });
  });

  describe('ヘルスチェック機能', () => {
    test('正常状態のヘルスチェック', () => {
      mockProperties.getProperty.mockReturnValue(
        JSON.stringify({
          totalProcessed: 100,
          totalSuccess: 98,
          totalErrors: 2,
          overallSuccessRate: 98,
          averageProcessingTime: 2000,
          lastProcessedAt: new Date().toISOString(),
          errorTrends: {},
        })
      );

      const health = performanceMonitor.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.issues).toHaveLength(0);
    });

    test('警告状態のヘルスチェック（成功率低下）', () => {
      mockProperties.getProperty.mockReturnValue(
        JSON.stringify({
          totalProcessed: 100,
          totalSuccess: 92,
          totalErrors: 8,
          overallSuccessRate: 92,
          averageProcessingTime: 2000,
          lastProcessedAt: new Date().toISOString(),
          errorTrends: {},
        })
      );

      const health = performanceMonitor.healthCheck();

      expect(health.status).toBe('warning');
      expect(health.issues).toContain('成功率が低下: 92.0%');
    });

    test('危険状態のヘルスチェック（成功率大幅低下）', () => {
      mockProperties.getProperty.mockReturnValue(
        JSON.stringify({
          totalProcessed: 100,
          totalSuccess: 85,
          totalErrors: 15,
          overallSuccessRate: 85,
          averageProcessingTime: 2000,
          lastProcessedAt: new Date().toISOString(),
          errorTrends: {},
        })
      );

      const health = performanceMonitor.healthCheck();

      expect(health.status).toBe('critical');
      expect(health.issues).toContain('成功率が低下: 85.0%');
    });

    test('処理時間超過のヘルスチェック', () => {
      mockProperties.getProperty.mockReturnValue(
        JSON.stringify({
          totalProcessed: 100,
          totalSuccess: 98,
          totalErrors: 2,
          overallSuccessRate: 98,
          averageProcessingTime: 15000, // 15秒
          lastProcessedAt: new Date().toISOString(),
          errorTrends: {},
        })
      );

      const health = performanceMonitor.healthCheck();

      expect(health.status).toBe('warning');
      expect(health.issues).toContain('処理時間が長い: 15.0秒/行');
    });

    test('長期間未処理のヘルスチェック', () => {
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 25); // 25時間前

      mockProperties.getProperty.mockReturnValue(
        JSON.stringify({
          totalProcessed: 100,
          totalSuccess: 98,
          totalErrors: 2,
          overallSuccessRate: 98,
          averageProcessingTime: 2000,
          lastProcessedAt: oldDate.toISOString(),
          errorTrends: {},
        })
      );

      const health = performanceMonitor.healthCheck();

      expect(health.status).toBe('warning');
      expect(health.issues).toContainEqual(
        expect.stringContaining('最終処理から25時間経過')
      );
    });
  });

  describe('パフォーマンスレポート生成', () => {
    test('正常なレポート生成', () => {
      const report = performanceMonitor.generatePerformanceReport(7);

      expect(report).toContain('システムパフォーマンスレポート');
      expect(report).toContain('総処理数: 100');
      expect(report).toContain('成功率: 95.0%');
      expect(report).toContain('平均処理時間: 3.00秒/行');
      expect(report).toContain('VALIDATION_ERROR: 3回');
      expect(report).toContain('API_ERROR: 2回');

      expect(Logger.info).toHaveBeenCalledWith(
        'パフォーマンスレポート生成完了',
        'PerformanceMonitor'
      );
    });

    test('最適化推奨事項のレポート', () => {
      mockProperties.getProperty.mockReturnValue(
        JSON.stringify({
          totalProcessed: 100,
          totalSuccess: 90, // 成功率低下
          totalErrors: 10,
          overallSuccessRate: 90,
          averageProcessingTime: 8000, // 処理時間長い
          lastProcessedAt: new Date().toISOString(),
          errorTrends: { VALIDATION_ERROR: 8, API_ERROR: 2 },
        })
      );

      const report = performanceMonitor.generatePerformanceReport();

      expect(report).toContain('推奨事項');
      expect(report).toContain('エラー原因の詳細分析を実施してください');
      expect(report).toContain('大量データは分割処理を検討してください');
      expect(report).toContain(
        '頻発エラーの自動修復機能の追加を検討してください'
      );
    });
  });

  describe('統計データ記録', () => {
    test('統計情報の正常な更新', () => {
      performanceMonitor.startMeasurement(5);
      performanceMonitor.recordSuccess();
      performanceMonitor.recordSuccess();
      performanceMonitor.recordError('API_ERROR');

      performanceMonitor.endMeasurement();

      // setPropertyが正しい統計情報で呼ばれることを確認
      expect(mockProperties.setProperty).toHaveBeenCalledWith(
        'system_stats',
        expect.stringContaining('totalProcessed')
      );

      // 引数をパースして確認
      const savedData = JSON.parse(mockProperties.setProperty.mock.calls[0][1]);
      expect(savedData.totalProcessed).toBe(103); // 100 + 3
      expect(savedData.totalSuccess).toBe(97); // 95 + 2
      expect(savedData.totalErrors).toBe(6); // 5 + 1
    });

    test('統計保存エラーハンドリング', () => {
      mockProperties.setProperty.mockImplementation(() => {
        throw new Error('保存失敗');
      });

      performanceMonitor.startMeasurement(1);
      performanceMonitor.recordSuccess();
      performanceMonitor.endMeasurement();

      expect(Logger.error).toHaveBeenCalledWith(
        expect.stringContaining('統計情報の記録に失敗'),
        'PerformanceMonitor'
      );
    });
  });

  describe('エラーハンドリング', () => {
    test('API呼び出し記録', () => {
      performanceMonitor.startMeasurement(1);
      performanceMonitor.recordApiCall();
      performanceMonitor.recordApiCall();

      const status = performanceMonitor.getCurrentStatus();
      expect(status.apiCallCount).toBe(2);
    });

    test('エラー記録とログ出力', () => {
      performanceMonitor.startMeasurement(1);
      performanceMonitor.recordError('VALIDATION_ERROR');

      expect(Logger.warn).toHaveBeenCalledWith(
        'エラー発生をカウント: VALIDATION_ERROR',
        'PerformanceMonitor'
      );
    });
  });
});
