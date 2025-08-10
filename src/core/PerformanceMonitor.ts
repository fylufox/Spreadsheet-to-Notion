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

import { Logger } from '../utils/Logger';

/**
 * パフォーマンス測定結果の型定義
 */
export interface PerformanceMetrics {
  /** 処理開始時刻 */
  startTime: Date;
  /** 処理終了時刻 */
  endTime: Date;
  /** 総処理時間（ミリ秒） */
  totalTime: number;
  /** 処理行数 */
  processedRows: number;
  /** 1行あたりの平均処理時間（ミリ秒） */
  averageTimePerRow: number;
  /** API呼び出し回数 */
  apiCallCount: number;
  /** 成功した処理数 */
  successCount: number;
  /** エラー発生数 */
  errorCount: number;
  /** 成功率（%） */
  successRate: number;
  /** メモリ使用量（概算） */
  memoryUsage?: number;
}

/**
 * システム統計情報の型定義
 */
export interface SystemStats {
  /** 総処理回数 */
  totalProcessed: number;
  /** 総成功回数 */
  totalSuccess: number;
  /** 総エラー回数 */
  totalErrors: number;
  /** 全体成功率 */
  overallSuccessRate: number;
  /** 平均処理時間 */
  averageProcessingTime: number;
  /** 最後の処理時刻 */
  lastProcessedAt: Date;
  /** エラー発生傾向 */
  errorTrends: { [errorType: string]: number };
}

/**
 * パフォーマンス監視・運用管理クラス
 * 実運用での性能測定と運用状況の監視を行う
 */
export class PerformanceMonitor {
  private currentMetrics: Partial<PerformanceMetrics> = {};

  constructor() {
    // Loggerは静的メソッドを使用
  }

  /**
   * パフォーマンス測定を開始
   * @param expectedRows 処理予定行数
   */
  startMeasurement(expectedRows: number): void {
    this.currentMetrics = {
      startTime: new Date(),
      processedRows: 0,
      apiCallCount: 0,
      successCount: 0,
      errorCount: 0,
    };

    Logger.info(
      `パフォーマンス測定開始: 予定処理行数 ${expectedRows}行`,
      'PerformanceMonitor'
    );
  }

  /**
   * API呼び出しをカウント
   */
  recordApiCall(): void {
    this.currentMetrics.apiCallCount =
      (this.currentMetrics.apiCallCount || 0) + 1;
  }

  /**
   * 成功処理をカウント
   */
  recordSuccess(): void {
    this.currentMetrics.successCount =
      (this.currentMetrics.successCount || 0) + 1;
    this.currentMetrics.processedRows =
      (this.currentMetrics.processedRows || 0) + 1;
  }

  /**
   * エラー発生をカウント
   * @param errorType エラーの種類
   */
  recordError(errorType: string): void {
    this.currentMetrics.errorCount = (this.currentMetrics.errorCount || 0) + 1;
    this.currentMetrics.processedRows =
      (this.currentMetrics.processedRows || 0) + 1;

    Logger.warn(`エラー発生をカウント: ${errorType}`, 'PerformanceMonitor');
  }

  /**
   * パフォーマンス測定を終了し、結果を取得
   * @returns 測定結果
   */
  endMeasurement(): PerformanceMetrics {
    const endTime = new Date();
    const startTime = this.currentMetrics.startTime || endTime;
    const totalTime = endTime.getTime() - startTime.getTime();

    const processedRows = this.currentMetrics.processedRows || 0;
    const successCount = this.currentMetrics.successCount || 0;
    const errorCount = this.currentMetrics.errorCount || 0;

    const metrics: PerformanceMetrics = {
      startTime,
      endTime,
      totalTime,
      processedRows,
      averageTimePerRow: processedRows > 0 ? totalTime / processedRows : 0,
      apiCallCount: this.currentMetrics.apiCallCount || 0,
      successCount,
      errorCount,
      successRate: processedRows > 0 ? (successCount / processedRows) * 100 : 0,
      memoryUsage: this.getMemoryUsage(),
    };

    Logger.info(
      `パフォーマンス測定完了: ${totalTime}ms, 処理行数: ${processedRows}, 成功率: ${metrics.successRate.toFixed(1)}%, 平均処理時間: ${metrics.averageTimePerRow.toFixed(1)}ms/row`,
      'PerformanceMonitor'
    );

    // 統計情報を記録
    this.recordStats(metrics);

    return metrics;
  }

  /**
   * リアルタイムパフォーマンス情報を取得
   * @returns 現在の処理状況
   */
  getCurrentStatus(): Partial<PerformanceMetrics> {
    if (!this.currentMetrics.startTime) {
      return {};
    }

    const currentTime = new Date();
    const elapsedTime =
      currentTime.getTime() - this.currentMetrics.startTime.getTime();
    const processedRows = this.currentMetrics.processedRows || 0;

    return {
      ...this.currentMetrics,
      totalTime: elapsedTime,
      averageTimePerRow: processedRows > 0 ? elapsedTime / processedRows : 0,
      successRate:
        processedRows > 0
          ? ((this.currentMetrics.successCount || 0) / processedRows) * 100
          : 0,
    };
  }

  /**
   * システム統計情報を取得
   * @returns 累積統計情報
   */
  getSystemStats(): SystemStats {
    try {
      const properties = PropertiesService.getScriptProperties();
      const statsJson = properties.getProperty('system_stats');

      if (statsJson) {
        const stats = JSON.parse(statsJson);
        return {
          ...stats,
          lastProcessedAt: new Date(stats.lastProcessedAt),
        };
      }
    } catch (error) {
      Logger.warn(
        `統計情報の取得に失敗: ${String(error)}`,
        'PerformanceMonitor'
      );
    }

    // デフォルト統計情報
    return {
      totalProcessed: 0,
      totalSuccess: 0,
      totalErrors: 0,
      overallSuccessRate: 0,
      averageProcessingTime: 0,
      lastProcessedAt: new Date(),
      errorTrends: {},
    };
  }

  /**
   * システムヘルスチェックを実行
   * @returns ヘルスチェック結果
   */
  healthCheck(): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
  } {
    const stats = this.getSystemStats();
    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    // 成功率チェック
    if (stats.overallSuccessRate < 95 && stats.totalProcessed > 10) {
      issues.push(`成功率が低下: ${stats.overallSuccessRate.toFixed(1)}%`);
      status = 'warning';
    }
    if (stats.overallSuccessRate < 90 && stats.totalProcessed > 10) {
      status = 'critical';
    }

    // 平均処理時間チェック
    if (stats.averageProcessingTime > 10000) {
      // 10秒超
      issues.push(
        `処理時間が長い: ${(stats.averageProcessingTime / 1000).toFixed(1)}秒/行`
      );
      if (status === 'healthy') status = 'warning';
    }

    // 最終処理時刻チェック（24時間以上前の場合）
    const hoursSinceLastProcess =
      (new Date().getTime() - stats.lastProcessedAt.getTime()) /
      (1000 * 60 * 60);
    if (hoursSinceLastProcess > 24) {
      issues.push(`最終処理から${Math.floor(hoursSinceLastProcess)}時間経過`);
      if (status === 'healthy') status = 'warning';
    }

    Logger.info(
      `ヘルスチェック完了: ${status}, 課題: ${issues.join(', ')}`,
      'PerformanceMonitor'
    );

    return { status, issues };
  }

  /**
   * パフォーマンスレポートを生成
   * @param period 期間（日数）
   * @returns レポート文字列
   */
  generatePerformanceReport(period = 7): string {
    const stats = this.getSystemStats();
    const health = this.healthCheck();

    const report = `
📊 システムパフォーマンスレポート (過去${period}日間)

🎯 基本統計:
• 総処理数: ${stats.totalProcessed.toLocaleString()}行
• 成功率: ${stats.overallSuccessRate.toFixed(1)}%
• 平均処理時間: ${(stats.averageProcessingTime / 1000).toFixed(2)}秒/行
• 最終処理: ${stats.lastProcessedAt.toLocaleString()}

🔍 ヘルス状況: ${health.status.toUpperCase()}
${health.issues.length > 0 ? '⚠️ 課題:\n' + health.issues.map(issue => `  • ${issue}`).join('\n') : '✅ 問題なし'}

📈 エラー傾向:
${Object.entries(stats.errorTrends)
  .map(([type, count]) => `• ${type}: ${count}回`)
  .join('\n')}

${this.generateRecommendations(stats)}
    `.trim();

    Logger.info('パフォーマンスレポート生成完了', 'PerformanceMonitor');
    return report;
  }

  /**
   * 推奨事項を生成
   * @param stats 統計情報
   * @returns 推奨事項
   */
  private generateRecommendations(stats: SystemStats): string {
    const recommendations: string[] = [];

    if (stats.overallSuccessRate < 95) {
      recommendations.push('• エラー原因の詳細分析を実施してください');
      recommendations.push(
        '• データ入力ガイドラインの見直しを検討してください'
      );
    }

    if (stats.averageProcessingTime > 5000) {
      recommendations.push('• 大量データは分割処理を検討してください');
      recommendations.push('• API呼び出し最適化の実装を検討してください');
    }

    if (Object.keys(stats.errorTrends).length > 0) {
      recommendations.push(
        '• 頻発エラーの自動修復機能の追加を検討してください'
      );
    }

    return recommendations.length > 0
      ? `\n💡 推奨事項:\n${recommendations.join('\n')}`
      : '\n✨ システムは最適な状態で動作しています';
  }

  /**
   * 統計情報を記録
   * @param metrics パフォーマンス測定結果
   */
  private recordStats(metrics: PerformanceMetrics): void {
    try {
      const currentStats = this.getSystemStats();

      const updatedStats: SystemStats = {
        totalProcessed: currentStats.totalProcessed + metrics.processedRows,
        totalSuccess: currentStats.totalSuccess + metrics.successCount,
        totalErrors: currentStats.totalErrors + metrics.errorCount,
        overallSuccessRate: 0, // 下で計算
        averageProcessingTime: 0, // 下で計算
        lastProcessedAt: metrics.endTime,
        errorTrends: { ...currentStats.errorTrends },
      };

      // 成功率を計算
      updatedStats.overallSuccessRate =
        updatedStats.totalProcessed > 0
          ? (updatedStats.totalSuccess / updatedStats.totalProcessed) * 100
          : 0;

      // 平均処理時間を更新（移動平均）
      const totalWeight = currentStats.totalProcessed + metrics.processedRows;
      updatedStats.averageProcessingTime =
        totalWeight > 0
          ? (currentStats.averageProcessingTime * currentStats.totalProcessed +
              metrics.averageTimePerRow * metrics.processedRows) /
            totalWeight
          : 0;

      // 統計情報を保存
      const properties = PropertiesService.getScriptProperties();
      properties.setProperty('system_stats', JSON.stringify(updatedStats));

      Logger.debug(
        `統計情報を更新: 総処理数=${updatedStats.totalProcessed}, 成功率=${updatedStats.overallSuccessRate.toFixed(1)}%`,
        'PerformanceMonitor'
      );
    } catch (error) {
      Logger.error(
        `統計情報の記録に失敗: ${String(error)}`,
        'PerformanceMonitor'
      );
    }
  }

  /**
   * メモリ使用量を取得（概算）
   * @returns メモリ使用量
   */
  private getMemoryUsage(): number {
    try {
      // Google Apps Scriptでは正確なメモリ使用量取得は困難
      // 処理データ量から概算
      return this.currentMetrics.processedRows
        ? this.currentMetrics.processedRows * 1024
        : 0;
    } catch {
      return 0;
    }
  }
}
