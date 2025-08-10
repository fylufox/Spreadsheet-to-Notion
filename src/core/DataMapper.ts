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

import { ColumnMapping, NotionPageData, MappingError } from '../types';
import { CONSTANTS } from '../utils/Constants';
import { Logger } from '../utils/Logger';
import { Validator } from './Validator';

/**
 * スプレッドシートデータをNotionページデータに変換するクラス
 * カラムマッピングに基づいてデータ型を適切に変換し、
 * Notion APIに送信可能な形式に整形する
 */
export class DataMapper {

  /**
   * スプレッドシートの行データをNotionページデータに変換
   */
  public static mapRowToNotionPage(
    rowData: any[],
    columnMappings: ColumnMapping[],
    rowIndex: number = 0
  ): NotionPageData {
    const timerId = Logger.startTimer('DataMapper.mapRowToNotionPage');
    
    try {
      Logger.debug('Starting row data mapping', {
        rowIndex,
        dataLength: rowData.length,
        mappingsCount: columnMappings.length
      });

      // データ検証
      const validationResult = Validator.validateRowData(rowData, columnMappings);
      if (!validationResult.valid) {
        throw new MappingError(
          `Row ${rowIndex + 1} validation failed: ${validationResult.errors.join(', ')}`,
          undefined,
          { rowIndex, errors: validationResult.errors }
        );
      }

      // 対象となるマッピングのみを処理
      const targetMappings = columnMappings.filter(mapping => mapping.isTarget);
      
      if (targetMappings.length === 0) {
        throw new MappingError('No target column mappings found', undefined, { rowIndex });
      }

      // Notionページデータの初期化
      const pageData: NotionPageData = {
        properties: {},
        children: []
      };

      // 各カラムをマッピング
      for (const mapping of targetMappings) {
        const columnIndex = this.getColumnIndex(mapping.spreadsheetColumn, rowData);
        
        if (columnIndex === -1) {
          Logger.warn(`Column '${mapping.spreadsheetColumn}' not found in row data`, { rowIndex });
          continue;
        }

        const cellValue = rowData[columnIndex];
        
        // 空値のスキップ（必須でない場合）
        if (!mapping.isRequired && this.isEmpty(cellValue)) {
          Logger.debug(`Skipping empty non-required field: ${mapping.notionPropertyName}`);
          continue;
        }

        try {
          const notionProperty = this.convertToNotionProperty(cellValue, mapping);
          pageData.properties[mapping.notionPropertyName] = notionProperty;
          
          Logger.debug(`Mapped field: ${mapping.spreadsheetColumn} -> ${mapping.notionPropertyName}`, {
            dataType: mapping.dataType,
            originalValue: this.sanitizeForLog(cellValue),
            mappedValue: this.sanitizeForLog(notionProperty)
          });
          
        } catch (error) {
          Logger.warn(`Failed to map field '${mapping.notionPropertyName}'`, {
            error: (error as Error).message,
            value: this.sanitizeForLog(cellValue),
            mapping
          });
          
          // 必須フィールドの場合はエラーとする
          if (mapping.isRequired) {
            throw new MappingError(
              `Required field '${mapping.notionPropertyName}' mapping failed: ${(error as Error).message}`,
              error as Error,
              { rowIndex, fieldName: mapping.notionPropertyName }
            );
          }
        }
      }

      // タイトルプロパティの存在確認
      const hasTitle = Object.values(pageData.properties).some(
        (prop: any) => prop.type === 'title'
      );
      
      if (!hasTitle) {
        throw new MappingError(
          'No title property found in mapped data',
          undefined,
          { rowIndex, properties: Object.keys(pageData.properties) }
        );
      }

      Logger.debug('Row data mapping completed', {
        rowIndex,
        propertiesCount: Object.keys(pageData.properties).length
      });

      Logger.endTimer(timerId, 'DataMapper.mapRowToNotionPage');
      return pageData;

    } catch (error) {
      Logger.endTimer(timerId, 'DataMapper.mapRowToNotionPage (error)');
      
      if (error instanceof MappingError) {
        Logger.logError(error, 'DataMapper.mapRowToNotionPage');
        throw error;
      }
      
      const errorInstance = error instanceof Error ? error : new Error(String(error));
      Logger.logError(errorInstance, 'DataMapper.mapRowToNotionPage');
      throw new MappingError(
        `Unexpected error mapping row ${rowIndex + 1}: ${errorInstance.message}`,
        errorInstance,
        { rowIndex }
      );
    }
  }

  /**
   * 複数の行データを一括変換
   */
  public static mapRowsToNotionPages(
    rowsData: any[][],
    columnMappings: ColumnMapping[],
    startRowIndex: number = 0
  ): NotionPageData[] {
    const timerId = Logger.startTimer('DataMapper.mapRowsToNotionPages');
    const results: NotionPageData[] = [];
    const errors: { rowIndex: number; error: Error }[] = [];

    try {
      Logger.info(`Starting batch mapping of ${rowsData.length} rows`, {
        startRowIndex,
        mappingsCount: columnMappings.length
      });

      for (let i = 0; i < rowsData.length; i++) {
        const globalRowIndex = startRowIndex + i;
        
        try {
          const pageData = this.mapRowToNotionPage(
            rowsData[i],
            columnMappings,
            globalRowIndex
          );
          results.push(pageData);
          
        } catch (error) {
          errors.push({ 
            rowIndex: globalRowIndex, 
            error: error as Error 
          });
          
          Logger.warn(`Failed to map row ${globalRowIndex + 1}`, {
            error: (error as Error).message
          });
        }
      }

      Logger.info(`Batch mapping completed`, {
        totalRows: rowsData.length,
        successCount: results.length,
        errorCount: errors.length
      });

      // エラーがある場合は詳細をログ出力
      if (errors.length > 0) {
        Logger.warn('Mapping errors occurred', {
          errorSummary: errors.map(e => ({
            row: e.rowIndex + 1,
            message: e.error.message
          }))
        });
      }

      Logger.endTimer(timerId, 'DataMapper.mapRowsToNotionPages');
      return results;

    } catch (error) {
      Logger.endTimer(timerId, 'DataMapper.mapRowsToNotionPages (error)');
      const errorInstance = error instanceof Error ? error : new Error(String(error));
      Logger.logError(errorInstance, 'DataMapper.mapRowsToNotionPages');
      throw new MappingError(
        `Batch mapping failed: ${errorInstance.message}`,
        errorInstance,
        { startRowIndex, rowCount: rowsData.length, partialResults: results.length }
      );
    }
  }

  /**
   * セル値をNotionプロパティ形式に変換
   */
  private static convertToNotionProperty(value: any, mapping: ColumnMapping): any {
    if (this.isEmpty(value)) {
      return this.createEmptyNotionProperty(mapping.dataType);
    }

    switch (mapping.dataType) {
      case CONSTANTS.DATA_TYPES.TITLE:
        return this.convertToTitle(value);

      case CONSTANTS.DATA_TYPES.RICH_TEXT:
        return this.convertToRichText(value);

      case CONSTANTS.DATA_TYPES.NUMBER:
        return this.convertToNumber(value);

      case CONSTANTS.DATA_TYPES.DATE:
        return this.convertToDate(value);

      case CONSTANTS.DATA_TYPES.CHECKBOX:
        return this.convertToCheckbox(value);

      case CONSTANTS.DATA_TYPES.SELECT:
        return this.convertToSelect(value);

      case CONSTANTS.DATA_TYPES.MULTI_SELECT:
        return this.convertToMultiSelect(value);

      case CONSTANTS.DATA_TYPES.URL:
        return this.convertToUrl(value);

      case CONSTANTS.DATA_TYPES.EMAIL:
        return this.convertToEmail(value);

      case CONSTANTS.DATA_TYPES.PHONE_NUMBER:
        return this.convertToPhoneNumber(value);

      default:
        throw new Error(`Unsupported data type: ${mapping.dataType}`);
    }
  }

  /**
   * タイトル型に変換
   */
  private static convertToTitle(value: any): any {
    const textValue = String(value).trim();
    return {
      type: 'title',
      title: [
        {
          type: 'text',
          text: {
            content: textValue.substring(0, 2000) // Notion制限に合わせて切り詰め
          }
        }
      ]
    };
  }

  /**
   * リッチテキスト型に変換
   */
  private static convertToRichText(value: any): any {
    const textValue = String(value).trim();
    return {
      type: 'rich_text',
      rich_text: [
        {
          type: 'text',
          text: {
            content: textValue.substring(0, 2000)
          }
        }
      ]
    };
  }

  /**
   * 数値型に変換
   */
  private static convertToNumber(value: any): any {
    const numValue = Number(value);
    
    if (isNaN(numValue) || !isFinite(numValue)) {
      throw new Error(`Invalid number value: ${value}`);
    }
    
    return {
      type: 'number',
      number: numValue
    };
  }

  /**
   * 日付型に変換
   */
  private static convertToDate(value: any): any {
    let dateValue: Date;

    if (value instanceof Date) {
      dateValue = value;
    } else if (typeof value === 'string') {
      dateValue = new Date(value);
    } else if (typeof value === 'number') {
      // Excel日付シリアル値の変換
      dateValue = new Date((value - 25569) * 86400 * 1000);
    } else {
      throw new Error(`Invalid date value: ${value}`);
    }

    if (isNaN(dateValue.getTime())) {
      throw new Error(`Invalid date value: ${value}`);
    }

    return {
      type: 'date',
      date: {
        start: dateValue.toISOString().split('T')[0] // YYYY-MM-DD形式
      }
    };
  }

  /**
   * チェックボックス型に変換
   */
  private static convertToCheckbox(value: any): any {
    let boolValue: boolean;

    if (typeof value === 'boolean') {
      boolValue = value;
    } else if (typeof value === 'number') {
      boolValue = value !== 0;
    } else if (typeof value === 'string') {
      const lowerValue = value.toLowerCase().trim();
      switch (lowerValue) {
        case 'true':
        case 'yes':
        case '1':
        case 'on':
          boolValue = true;
          break;
        case 'false':
        case 'no':
        case '0':
        case 'off':
          boolValue = false;
          break;
        default:
          throw new Error(`Invalid checkbox value: ${value}`);
      }
    } else {
      throw new Error(`Invalid checkbox value: ${value}`);
    }

    return {
      type: 'checkbox',
      checkbox: boolValue
    };
  }

  /**
   * セレクト型に変換
   */
  private static convertToSelect(value: any): any {
    const selectValue = String(value).trim();
    
    if (selectValue.length === 0) {
      throw new Error('Select option cannot be empty');
    }
    
    if (selectValue.length > 100) {
      throw new Error('Select option exceeds maximum length');
    }

    return {
      type: 'select',
      select: {
        name: selectValue
      }
    };
  }

  /**
   * マルチセレクト型に変換
   */
  private static convertToMultiSelect(value: any): any {
    const stringValue = String(value).trim();
    
    if (stringValue.length === 0) {
      return {
        type: 'multi_select',
        multi_select: []
      };
    }

    // カンマ区切りで分割
    const options = stringValue
      .split(',')
      .map(option => option.trim())
      .filter(option => option.length > 0)
      .slice(0, 100) // Notionの制限
      .map(option => ({
        name: option.substring(0, 100) // 各オプションの長さ制限
      }));

    return {
      type: 'multi_select',
      multi_select: options
    };
  }

  /**
   * URL型に変換
   */
  private static convertToUrl(value: any): any {
    const urlValue = String(value).trim();
    
    if (!CONSTANTS.PATTERNS.URL.test(urlValue)) {
      throw new Error(`Invalid URL format: ${value}`);
    }

    return {
      type: 'url',
      url: urlValue.substring(0, 2000)
    };
  }

  /**
   * メール型に変換
   */
  private static convertToEmail(value: any): any {
    const emailValue = String(value).trim();
    
    if (!CONSTANTS.PATTERNS.EMAIL.test(emailValue)) {
      throw new Error(`Invalid email format: ${value}`);
    }

    return {
      type: 'email',
      email: emailValue.substring(0, 320)
    };
  }

  /**
   * 電話番号型に変換
   */
  private static convertToPhoneNumber(value: any): any {
    const phoneValue = String(value).trim();
    
    if (!CONSTANTS.PATTERNS.PHONE.test(phoneValue)) {
      throw new Error(`Invalid phone number format: ${value}`);
    }

    return {
      type: 'phone_number',
      phone_number: phoneValue.substring(0, 50)
    };
  }

  /**
   * 空のNotionプロパティを作成
   */
  private static createEmptyNotionProperty(dataType: string): any {
    switch (dataType) {
      case CONSTANTS.DATA_TYPES.TITLE:
        return { type: 'title', title: [] };
      case CONSTANTS.DATA_TYPES.RICH_TEXT:
        return { type: 'rich_text', rich_text: [] };
      case CONSTANTS.DATA_TYPES.NUMBER:
        return { type: 'number', number: null };
      case CONSTANTS.DATA_TYPES.DATE:
        return { type: 'date', date: null };
      case CONSTANTS.DATA_TYPES.CHECKBOX:
        return { type: 'checkbox', checkbox: false };
      case CONSTANTS.DATA_TYPES.SELECT:
        return { type: 'select', select: null };
      case CONSTANTS.DATA_TYPES.MULTI_SELECT:
        return { type: 'multi_select', multi_select: [] };
      case CONSTANTS.DATA_TYPES.URL:
        return { type: 'url', url: null };
      case CONSTANTS.DATA_TYPES.EMAIL:
        return { type: 'email', email: null };
      case CONSTANTS.DATA_TYPES.PHONE_NUMBER:
        return { type: 'phone_number', phone_number: null };
      default:
        return { type: 'rich_text', rich_text: [] };
    }
  }

  /**
   * カラム名からインデックスを取得
   */
  private static getColumnIndex(columnName: string, rowData: any[]): number {
    // 数値文字列の場合はそのままインデックスとして使用
    const index = parseInt(columnName, 10);
    if (!isNaN(index) && index >= 0 && index < rowData.length) {
      return index;
    }
    
    // アルファベットカラム名（A, B, C...）を数値に変換
    if (/^[A-Z]+$/i.test(columnName)) {
      let result = 0;
      const upperCol = columnName.toUpperCase();
      for (let i = 0; i < upperCol.length; i++) {
        result = result * 26 + (upperCol.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
      }
      const zeroBasedIndex = result - 1;
      if (zeroBasedIndex >= 0 && zeroBasedIndex < rowData.length) {
        return zeroBasedIndex;
      }
    }
    
    return -1;
  }

  /**
   * 値が空かどうかを判定
   */
  private static isEmpty(value: any): boolean {
    return value === null || 
           value === undefined || 
           (typeof value === 'string' && value.trim() === '') ||
           (typeof value === 'number' && isNaN(value));
  }

  /**
   * ログ用にデータをサニタイズ
   */
  private static sanitizeForLog(value: any): any {
    if (typeof value === 'string' && value.length > 100) {
      return value.substring(0, 100) + '...';
    }
    return value;
  }

  /**
   * マッピング統計情報を取得
   */
  public static getMappingStats(
    columnMappings: ColumnMapping[]
  ): {
    totalMappings: number;
    targetMappings: number;
    requiredMappings: number;
    dataTypeBreakdown: Record<string, number>;
  } {
    const targetMappings = columnMappings.filter(m => m.isTarget);
    const requiredMappings = targetMappings.filter(m => m.isRequired);
    
    const dataTypeBreakdown: Record<string, number> = {};
    targetMappings.forEach(mapping => {
      dataTypeBreakdown[mapping.dataType] = (dataTypeBreakdown[mapping.dataType] || 0) + 1;
    });

    return {
      totalMappings: columnMappings.length,
      targetMappings: targetMappings.length,
      requiredMappings: requiredMappings.length,
      dataTypeBreakdown
    };
  }

  /**
   * データ変換の互換性チェック
   */
  public static checkDataCompatibility(
    rowData: any[],
    columnMappings: ColumnMapping[]
  ): {
    compatible: boolean;
    issues: string[];
    warnings: string[];
  } {
    const issues: string[] = [];
    const warnings: string[] = [];
    
    const targetMappings = columnMappings.filter(m => m.isTarget);
    
    for (const mapping of targetMappings) {
      const columnIndex = this.getColumnIndex(mapping.spreadsheetColumn, rowData);
      
      if (columnIndex === -1) {
        issues.push(`Column '${mapping.spreadsheetColumn}' not found`);
        continue;
      }
      
      const value = rowData[columnIndex];
      
      if (this.isEmpty(value)) {
        if (mapping.isRequired) {
          issues.push(`Required field '${mapping.notionPropertyName}' is empty`);
        }
        continue;
      }
      
      if (!Validator.canConvertToNotionType(value, mapping.dataType)) {
        issues.push(`Value '${value}' cannot be converted to ${mapping.dataType}`);
      }
    }
    
    return {
      compatible: issues.length === 0,
      issues,
      warnings
    };
  }
}
