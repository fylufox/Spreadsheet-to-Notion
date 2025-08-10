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

import { ValidationResult, ColumnMapping } from '../types';
import { CONSTANTS } from '../utils/Constants';
import { Logger } from '../utils/Logger';

/**
 * データ検証処理を行うクラス
 * スプレッドシートデータの形式チェック、Notionプロパティ互換性検証、
 * 必須項目チェックなどを提供
 */
export class Validator {
  /**
   * 行データの検証を実行
   */
  public static validateRowData(
    rowData: any[],
    columnMappings: ColumnMapping[]
  ): ValidationResult {
    const timerId = Logger.startTimer('Validator.validateRowData');
    const errors: string[] = [];

    try {
      Logger.debug('Starting row data validation', {
        dataLength: rowData.length,
        mappingsCount: columnMappings.length,
      });

      // 基本的なデータ構造チェック
      if (!Array.isArray(rowData)) {
        errors.push('Row data must be an array');
        return { valid: false, errors };
      }

      if (rowData.length < CONSTANTS.COLUMNS.DATA_START) {
        errors.push(
          `Row data must have at least ${CONSTANTS.COLUMNS.DATA_START} columns`
        );
        return { valid: false, errors };
      }

      // 対象カラムのマッピングのみを処理
      const targetMappings = columnMappings.filter(mapping => mapping.isTarget);

      if (targetMappings.length === 0) {
        errors.push('No target column mappings found');
        return { valid: false, errors };
      }

      // 各カラムの検証
      for (const mapping of targetMappings) {
        const columnIndex = this.getColumnIndex(
          mapping.spreadsheetColumn,
          rowData
        );

        if (columnIndex === -1) {
          errors.push(
            `Column '${mapping.spreadsheetColumn}' not found in row data`
          );
          continue;
        }

        const value = rowData[columnIndex];
        const validationResult = this.validateCellValue(value, mapping);

        if (!validationResult.valid) {
          errors.push(...validationResult.errors);
        }
      }

      const isValid = errors.length === 0;

      Logger.debug('Row data validation completed', {
        valid: isValid,
        errorCount: errors.length,
      });

      Logger.endTimer(timerId, 'Validator.validateRowData');

      return { valid: isValid, errors };
    } catch (error) {
      Logger.endTimer(timerId, 'Validator.validateRowData (error)');
      Logger.logError(error as Error, 'Validator.validateRowData');
      errors.push(`Validation error: ${(error as Error).message}`);
      return { valid: false, errors };
    }
  }

  /**
   * セル値の検証
   */
  private static validateCellValue(
    value: any,
    mapping: ColumnMapping
  ): ValidationResult {
    const errors: string[] = [];
    const fieldName = `${mapping.spreadsheetColumn} (${mapping.notionPropertyName})`;

    // 必須チェック
    if (mapping.isRequired && this.isEmpty(value)) {
      errors.push(`Required field '${fieldName}' is empty`);
      return { valid: false, errors };
    }

    // 空値の場合は、必須でなければOK
    if (this.isEmpty(value)) {
      return { valid: true, errors: [] };
    }

    // データ型別の検証
    switch (mapping.dataType) {
      case CONSTANTS.DATA_TYPES.TITLE:
      case CONSTANTS.DATA_TYPES.RICH_TEXT:
        return this.validateText(value, fieldName);

      case CONSTANTS.DATA_TYPES.NUMBER:
        return this.validateNumber(value, fieldName);

      case CONSTANTS.DATA_TYPES.DATE:
        return this.validateDate(value, fieldName);

      case CONSTANTS.DATA_TYPES.SELECT:
      case CONSTANTS.DATA_TYPES.MULTI_SELECT:
        return this.validateSelect(value, fieldName);

      case CONSTANTS.DATA_TYPES.CHECKBOX:
        return this.validateCheckbox(value, fieldName);

      case CONSTANTS.DATA_TYPES.URL:
        return this.validateUrl(value, fieldName);

      case CONSTANTS.DATA_TYPES.EMAIL:
        return this.validateEmail(value, fieldName);

      case CONSTANTS.DATA_TYPES.PHONE_NUMBER:
        return this.validatePhoneNumber(value, fieldName);

      default:
        errors.push(
          `Unknown data type '${mapping.dataType}' for field '${fieldName}'`
        );
        return { valid: false, errors };
    }
  }

  /**
   * テキスト型の検証
   */
  private static validateText(value: any, fieldName: string): ValidationResult {
    const errors: string[] = [];

    if (typeof value !== 'string' && typeof value !== 'number') {
      errors.push(
        `Field '${fieldName}' must be text or number, got ${typeof value}`
      );
    }

    const stringValue = String(value);
    if (stringValue.length > 2000) {
      errors.push(
        `Field '${fieldName}' exceeds maximum length of 2000 characters`
      );
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * 数値型の検証
   */
  private static validateNumber(
    value: any,
    fieldName: string
  ): ValidationResult {
    const errors: string[] = [];

    // 数値または数値文字列であることを確認
    const numValue = Number(value);

    if (isNaN(numValue)) {
      errors.push(
        `Field '${fieldName}' must be a valid number, got '${value}'`
      );
    } else if (!isFinite(numValue)) {
      errors.push(
        `Field '${fieldName}' must be a finite number, got '${value}'`
      );
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * 日付型の検証
   */
  private static validateDate(value: any, fieldName: string): ValidationResult {
    const errors: string[] = [];

    let dateValue: Date;

    if (value instanceof Date) {
      dateValue = value;
    } else if (typeof value === 'string') {
      dateValue = new Date(value);
    } else if (typeof value === 'number') {
      // Excel日付シリアル値の可能性
      dateValue = new Date((value - 25569) * 86400 * 1000);
    } else {
      errors.push(
        `Field '${fieldName}' must be a valid date, got ${typeof value}`
      );
      return { valid: false, errors };
    }

    if (isNaN(dateValue.getTime())) {
      errors.push(
        `Field '${fieldName}' contains invalid date value '${value}'`
      );
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * セレクト型の検証
   */
  private static validateSelect(
    value: any,
    fieldName: string
  ): ValidationResult {
    const errors: string[] = [];

    if (typeof value !== 'string' && typeof value !== 'number') {
      errors.push(
        `Field '${fieldName}' must be text for select option, got ${typeof value}`
      );
    }

    const stringValue = String(value).trim();
    if (stringValue.length === 0) {
      errors.push(`Field '${fieldName}' select option cannot be empty`);
    }

    if (stringValue.length > 100) {
      errors.push(
        `Field '${fieldName}' select option exceeds maximum length of 100 characters`
      );
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * チェックボックス型の検証
   */
  private static validateCheckbox(
    value: any,
    fieldName: string
  ): ValidationResult {
    const errors: string[] = [];

    if (typeof value === 'boolean') {
      return { valid: true, errors: [] };
    }

    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase().trim();
      if (
        ['true', 'false', 'yes', 'no', '1', '0', 'on', 'off'].includes(
          lowerValue
        )
      ) {
        return { valid: true, errors: [] };
      }
    }

    if (typeof value === 'number') {
      if (value === 0 || value === 1) {
        return { valid: true, errors: [] };
      }
    }

    errors.push(`Field '${fieldName}' must be a boolean value, got '${value}'`);
    return { valid: errors.length === 0, errors };
  }

  /**
   * URL型の検証
   */
  private static validateUrl(value: any, fieldName: string): ValidationResult {
    const errors: string[] = [];

    if (typeof value !== 'string') {
      errors.push(
        `Field '${fieldName}' must be a valid URL string, got ${typeof value}`
      );
      return { valid: false, errors };
    }

    if (!CONSTANTS.PATTERNS.URL.test(value)) {
      errors.push(
        `Field '${fieldName}' must be a valid HTTP/HTTPS URL, got '${value}'`
      );
    }

    if (value.length > 2000) {
      errors.push(
        `Field '${fieldName}' URL exceeds maximum length of 2000 characters`
      );
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * メール型の検証
   */
  private static validateEmail(
    value: any,
    fieldName: string
  ): ValidationResult {
    const errors: string[] = [];

    if (typeof value !== 'string') {
      errors.push(
        `Field '${fieldName}' must be a valid email string, got ${typeof value}`
      );
      return { valid: false, errors };
    }

    if (!CONSTANTS.PATTERNS.EMAIL.test(value)) {
      errors.push(
        `Field '${fieldName}' must be a valid email address, got '${value}'`
      );
    }

    if (value.length > 320) {
      errors.push(
        `Field '${fieldName}' email exceeds maximum length of 320 characters`
      );
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * 電話番号型の検証
   */
  private static validatePhoneNumber(
    value: any,
    fieldName: string
  ): ValidationResult {
    const errors: string[] = [];

    if (typeof value !== 'string' && typeof value !== 'number') {
      errors.push(
        `Field '${fieldName}' must be a valid phone number, got ${typeof value}`
      );
      return { valid: false, errors };
    }

    const stringValue = String(value).trim();

    if (!CONSTANTS.PATTERNS.PHONE.test(stringValue)) {
      errors.push(
        `Field '${fieldName}' must be a valid phone number format, got '${value}'`
      );
    }

    if (stringValue.length > 50) {
      errors.push(
        `Field '${fieldName}' phone number exceeds maximum length of 50 characters`
      );
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * カラムマッピングの検証
   */
  public static validateMapping(mapping: ColumnMapping): ValidationResult {
    const errors: string[] = [];

    // 必須フィールドのチェック
    if (!mapping.spreadsheetColumn?.trim()) {
      errors.push('Spreadsheet column name is required');
    }

    if (!mapping.notionPropertyName?.trim()) {
      errors.push('Notion property name is required');
    }

    if (!mapping.dataType?.trim()) {
      errors.push('Data type is required');
    }

    // データ型の妥当性チェック
    if (
      mapping.dataType &&
      !Object.values(CONSTANTS.DATA_TYPES).includes(mapping.dataType as any)
    ) {
      errors.push(`Invalid data type '${mapping.dataType}'`);
    }

    // Notion プロパティ名の形式チェック
    if (mapping.notionPropertyName) {
      if (mapping.notionPropertyName.length > 100) {
        errors.push(
          'Notion property name exceeds maximum length of 100 characters'
        );
      }

      // 予約語チェック
      const reservedWords = [
        'id',
        'created_time',
        'last_edited_time',
        'created_by',
        'last_edited_by',
      ];
      if (reservedWords.includes(mapping.notionPropertyName.toLowerCase())) {
        errors.push(
          `'${mapping.notionPropertyName}' is a reserved property name`
        );
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * 複数のカラムマッピングの検証
   */
  public static validateMappings(mappings: ColumnMapping[]): ValidationResult {
    const errors: string[] = [];

    if (!Array.isArray(mappings) || mappings.length === 0) {
      errors.push('Column mappings are required');
      return { valid: false, errors };
    }

    // 各マッピングの個別検証
    mappings.forEach((mapping, index) => {
      const result = this.validateMapping(mapping);
      if (!result.valid) {
        errors.push(
          ...result.errors.map(error => `Mapping ${index + 1}: ${error}`)
        );
      }
    });

    // 重複チェック
    const spreadsheetColumns = mappings
      .map(m => m.spreadsheetColumn?.trim())
      .filter(Boolean);
    const notionProperties = mappings
      .map(m => m.notionPropertyName?.trim())
      .filter(Boolean);

    const duplicateSpreadsheetColumns = this.findDuplicates(spreadsheetColumns);
    const duplicateNotionProperties = this.findDuplicates(notionProperties);

    if (duplicateSpreadsheetColumns.length > 0) {
      errors.push(
        `Duplicate spreadsheet columns: ${duplicateSpreadsheetColumns.join(', ')}`
      );
    }

    if (duplicateNotionProperties.length > 0) {
      errors.push(
        `Duplicate Notion properties: ${duplicateNotionProperties.join(', ')}`
      );
    }

    // タイトル型の存在チェック
    const titleMappings = mappings.filter(
      m => m.dataType === CONSTANTS.DATA_TYPES.TITLE && m.isTarget
    );
    if (titleMappings.length === 0) {
      errors.push('At least one title property mapping is required');
    } else if (titleMappings.length > 1) {
      errors.push('Only one title property mapping is allowed');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * 値が空かどうかを判定
   */
  private static isEmpty(value: any): boolean {
    return (
      value === null ||
      value === undefined ||
      (typeof value === 'string' && value.trim() === '') ||
      (typeof value === 'number' && isNaN(value))
    );
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
   * 配列内の重複要素を見つける
   */
  private static findDuplicates(array: string[]): string[] {
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    for (const item of array) {
      if (seen.has(item)) {
        duplicates.add(item);
      } else {
        seen.add(item);
      }
    }

    return Array.from(duplicates);
  }

  /**
   * データ変換可能性のチェック
   */
  public static canConvertToNotionType(
    value: any,
    targetType: string
  ): boolean {
    if (this.isEmpty(value)) {
      return true; // 空値は常に変換可能
    }

    try {
      switch (targetType) {
        case CONSTANTS.DATA_TYPES.TITLE:
        case CONSTANTS.DATA_TYPES.RICH_TEXT:
          return true; // あらゆる値は文字列に変換可能

        case CONSTANTS.DATA_TYPES.NUMBER:
          return !isNaN(Number(value)) && isFinite(Number(value));

        case CONSTANTS.DATA_TYPES.DATE:
          return !isNaN(new Date(value).getTime());

        case CONSTANTS.DATA_TYPES.CHECKBOX:
          if (typeof value === 'boolean') return true;
          if (typeof value === 'number') return value === 0 || value === 1;
          if (typeof value === 'string') {
            const lower = value.toLowerCase().trim();
            return [
              'true',
              'false',
              'yes',
              'no',
              '1',
              '0',
              'on',
              'off',
            ].includes(lower);
          }
          return false;

        case CONSTANTS.DATA_TYPES.URL:
          return (
            typeof value === 'string' && CONSTANTS.PATTERNS.URL.test(value)
          );

        case CONSTANTS.DATA_TYPES.EMAIL:
          return (
            typeof value === 'string' && CONSTANTS.PATTERNS.EMAIL.test(value)
          );

        case CONSTANTS.DATA_TYPES.PHONE_NUMBER:
          return CONSTANTS.PATTERNS.PHONE.test(String(value));

        default:
          return false;
      }
    } catch (error) {
      Logger.warn('Type conversion check failed', { value, targetType, error });
      return false;
    }
  }
}
