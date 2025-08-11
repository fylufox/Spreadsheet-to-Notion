# NotionApiClient モジュール詳細設計

## 1. 概要

### 1.1 役割
Notion APIとの通信を担当する静的クラス。ページの作成・更新、データベース情報の取得、レート制限対応、接続テスト、包括的なエラーハンドリングを行う。

### 1.2 設計パターン
- **静的クラス設計:** インスタンス化不要、グローバル状態管理
- **レート制限管理:** 3リクエスト/秒の制限対応
- **自動リトライ機能:** 指数バックオフによる堅牢性確保
- **接続テスト機能:** 設定検証とトラブルシューティング支援

## 2. 主要メソッド

### 2.1 createPage(databaseId: string, pageData: NotionPageData): Promise<NotionPageResponse>
**概要:** Notionデータベースに新しいページを作成（レート制限・リトライ対応）
```typescript
static async createPage(databaseId: string, pageData: NotionPageData): Promise<NotionPageResponse> {
  Logger.startTimer('NotionApiClient.createPage');
  
  try {
    await this.rateLimiter.waitForRateLimit();
    
    const response = await this.makeRequestWithRetry('/pages', {
      method: 'POST',
      payload: JSON.stringify({
        parent: { database_id: databaseId },
        properties: pageData.properties
      })
    });
    
    Logger.info('Page created successfully', { 
      pageId: response.id,
      databaseId 
    });
    
    return response;
  } catch (error) {
    Logger.logError('NotionApiClient.createPage', error, { databaseId });
    throw new NotionApiError(
      `Failed to create page in database ${databaseId}`,
      error as Error
    );
  } finally {
    Logger.endTimer('NotionApiClient.createPage');
  }
}
```

### 2.2 updatePage(pageId: string, pageData: NotionPageData): Promise<NotionPageResponse>
**概要:** 既存のNotionページを更新
```typescript
static async updatePage(pageId: string, pageData: NotionPageData): Promise<NotionPageResponse> {
  Logger.startTimer('NotionApiClient.updatePage');
  
  try {
    await this.rateLimiter.waitForRateLimit();
    
    const response = await this.makeRequestWithRetry(`/pages/${pageId}`, {
      method: 'PATCH',
      payload: JSON.stringify({
        properties: pageData.properties
      })
    });
    
    Logger.info('Page updated successfully', { pageId });
    return response;
  } catch (error) {
    Logger.logError('NotionApiClient.updatePage', error, { pageId });
    throw new NotionApiError(
      `Failed to update page ${pageId}`,
      error as Error
    );
  } finally {
    Logger.endTimer('NotionApiClient.updatePage');
  }
}
```

### 2.3 getDatabaseInfo(databaseId: string): Promise<DatabaseInfo>
**概要:** データベースのプロパティ情報を取得（キャッシュ対応）
```typescript
static async getDatabaseInfo(databaseId: string): Promise<DatabaseInfo> {
  Logger.startTimer('NotionApiClient.getDatabaseInfo');
  
  try {
    // キャッシュチェック
    const cached = this.databaseInfoCache.get(databaseId);
    if (cached && (Date.now() - cached.timestamp) < CONSTANTS.CACHE.DATABASE_INFO_TTL) {
      Logger.debug('Database info cache hit', { databaseId });
      return cached.data;
    }
    
    await this.rateLimiter.waitForRateLimit();
    
    const response = await this.makeRequestWithRetry(`/databases/${databaseId}`);
    
    const dbInfo: DatabaseInfo = {
      id: response.id,
      title: response.title?.[0]?.plain_text || 'Untitled',
      properties: Object.entries(response.properties).map(([name, prop]: [string, any]) => ({
        name,
        type: prop.type,
        id: prop.id,
        config: this.extractPropertyConfig(prop)
      }))
    };
    
    // キャッシュに保存
    this.databaseInfoCache.set(databaseId, {
      data: dbInfo,
      timestamp: Date.now()
    });
    
    Logger.info('Database info retrieved', { 
      databaseId, 
      title: dbInfo.title,
      propertyCount: dbInfo.properties.length 
    });
    
    return dbInfo;
  } catch (error) {
    Logger.logError('NotionApiClient.getDatabaseInfo', error, { databaseId });
    throw new NotionApiError(
      `Failed to get database info for ${databaseId}`,
      error as Error
    );
  } finally {
    Logger.endTimer('NotionApiClient.getDatabaseInfo');
  }
}
```

### 2.4 testConnection(): Promise<ConnectionTestResult>
**概要:** API接続テストを実行（設定検証・トラブルシューティング）
```typescript
static async testConnection(): Promise<ConnectionTestResult> {
  Logger.startTimer('NotionApiClient.testConnection');
  
  try {
    const config = await ConfigManager.getConfig();
    
    // APIトークンの基本検証
    if (!config.apiToken || config.apiToken.length < 10) {
      return {
        success: false,
        error: 'Invalid API token format',
        message: 'APIトークンが無効です'
      };
    }
    
    // データベースID検証
    if (!config.databaseId || !config.databaseId.match(/^[a-f0-9-]{36}$/)) {
      return {
        success: false,
        error: 'Invalid database ID format',
        message: 'データベースIDが無効です'
      };
    }
    
    // 実際の接続テスト
    const dbInfo = await this.getDatabaseInfo(config.databaseId);
    
    return {
      success: true,
      databaseTitle: dbInfo.title,
      propertyCount: dbInfo.properties.length,
      message: '接続テストが成功しました'
    };
    
  } catch (error) {
    Logger.logError('NotionApiClient.testConnection', error);
    
    let errorMessage = '接続テストが失敗しました';
    if (error instanceof NotionApiError) {
      if (error.statusCode === 401) {
        errorMessage = 'APIトークンが無効です';
      } else if (error.statusCode === 404) {
        errorMessage = 'データベースが見つかりません';
      } else if (error.statusCode === 403) {
        errorMessage = 'データベースへのアクセス権限がありません';
      }
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      message: errorMessage
    };
  } finally {
    Logger.endTimer('NotionApiClient.testConnection');
  }
}
```

### 2.5 makeRequestWithRetry(): Promise<any>
**概要:** リトライ機能付きHTTPリクエスト実行
```typescript
private static async makeRequestWithRetry(
  endpoint: string,
  options: RequestOptions = {},
  retryCount: number = 0
): Promise<any> {
  try {
    return await this.makeRequest(endpoint, options);
  } catch (error) {
    if (retryCount >= CONSTANTS.NOTION.MAX_RETRIES) {
      throw error;
    }
    
    if (this.shouldRetry(error)) {
      const delay = CONSTANTS.NOTION.RETRY_DELAYS[retryCount] || 4000;
      Logger.info('Retrying API request', { 
        endpoint, 
        retryCount: retryCount + 1, 
        delay 
      });
      
      await this.sleep(delay);
      return this.makeRequestWithRetry(endpoint, options, retryCount + 1);
    }
    
    throw error;
  }
}

private static shouldRetry(error: any): boolean {
  if (error instanceof NotionApiError) {
    // 429 (Rate Limited) または 5xx (Server Error) の場合はリトライ
    return error.statusCode === 429 || error.statusCode >= 500;
  }
  
  // ネットワークエラーの場合もリトライ
  return error.message?.includes('network') || 
         error.message?.includes('timeout') ||
         error.message?.includes('DNS');
}
```

### 2.6 レート制限管理・ユーティリティメソッド

#### RateLimiter管理
```typescript
private static rateLimiter = {
  lastRequestTime: 0,
  minInterval: CONSTANTS.NOTION.RATE_LIMIT_DELAY, // 334ms (3 req/s)
  
  async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastRequest;
      Logger.debug('Rate limit wait', { waitTime });
      await NotionApiClient.sleep(waitTime);
    }
    
    this.lastRequestTime = Date.now();
  },
  
  reset(): void {
    this.lastRequestTime = 0;
  }
};
```

#### extractPropertyConfig(property: any): PropertyConfig
```typescript
private static extractPropertyConfig(property: any): PropertyConfig {
  const config: PropertyConfig = {
    type: property.type,
    required: false
  };
  
  try {
    switch (property.type) {
      case CONSTANTS.DATA_TYPES.SELECT:
        config.options = property.select?.options?.map((opt: any) => ({
          name: opt.name,
          color: opt.color,
          id: opt.id
        })) || [];
        break;
        
      case CONSTANTS.DATA_TYPES.MULTI_SELECT:
        config.options = property.multi_select?.options?.map((opt: any) => ({
          name: opt.name,
          color: opt.color,
          id: opt.id
        })) || [];
        break;
        
      case CONSTANTS.DATA_TYPES.DATE:
        config.format = property.date?.format || null;
        break;
        
      case CONSTANTS.DATA_TYPES.NUMBER:
        config.format = property.number?.format || 'number';
        break;
        
      case 'formula':
        config.expression = property.formula?.expression || '';
        config.return_type = property.formula?.return_type || 'string';
        break;
        
      case 'relation':
        config.database_id = property.relation?.database_id;
        config.synced_property_name = property.relation?.synced_property_name;
        break;
        
      case 'rollup':
        config.relation_property_name = property.rollup?.relation_property_name;
        config.relation_property_id = property.rollup?.relation_property_id;
        config.rollup_property_name = property.rollup?.rollup_property_name;
        config.rollup_property_id = property.rollup?.rollup_property_id;
        config.function = property.rollup?.function;
        break;
    }
  } catch (error) {
    Logger.logWarning('NotionApiClient.extractPropertyConfig', 
      `Failed to extract config for property type: ${property.type}`, error);
  }
  
  return config;
}
```

#### sleep(ms: number): Promise<void>
```typescript
private static sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

## 3. 型定義

```typescript
interface NotionPageResponse {
  id: string;
  created_time: string;
  last_edited_time: string;
  created_by: { id: string };
  last_edited_by: { id: string };
  cover: any;
  icon: any;
  parent: { database_id: string };
  archived: boolean;
  properties: Record<string, any>;
  url: string;
}

interface DatabaseInfo {
  id: string;
  title: string;
  properties: Array<{
    name: string;
    type: string;
    id: string;
    config: PropertyConfig;
  }>;
}

interface PropertyConfig {
  type: string;
  required: boolean;
  options?: Array<{ name: string; color: string; id: string }>;
  format?: string;
  expression?: string;
  return_type?: string;
  database_id?: string;
  synced_property_name?: string;
  relation_property_name?: string;
  relation_property_id?: string;
  rollup_property_name?: string;
  rollup_property_id?: string;
  function?: string;
}

interface ConnectionTestResult {
  success: boolean;
  databaseTitle?: string;
  propertyCount?: number;
  error?: string;
  message: string;
}

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  payload?: string;
  muteHttpExceptions?: boolean;
}

class NotionApiError extends Error {
  constructor(
    message: string,
    public cause?: Error,
    public statusCode?: number,
    public responseBody?: string
  ) {
    super(message);
    this.name = 'NotionApiError';
  }
}
```

## 4. エラーハンドリング

### 4.1 NotionApiError
```typescript
class NotionApiError extends Error {
  constructor(
    message: string,
    public cause?: Error,
    public statusCode?: number,
    public responseBody?: string
  ) {
    super(message);
    this.name = 'NotionApiError';
  }
}
```

### 4.2 HTTPステータスコード対応
- **200 OK:** 正常レスポンス
- **201 Created:** ページ作成成功
- **400 Bad Request:** リクエスト形式エラー
- **401 Unauthorized:** 認証エラー（APIトークン無効）
- **403 Forbidden:** 権限エラー（データベースアクセス不可）
- **404 Not Found:** リソース不存在（データベース・ページ）
- **429 Too Many Requests:** レート制限（自動リトライ）
- **500 Internal Server Error:** サーバーエラー（自動リトライ）

### 4.3 リトライ戦略
- **対象エラー:** 429, 5xx, ネットワークエラー
- **リトライ回数:** 最大3回
- **待機時間:** 指数バックオフ (1s, 2s, 4s)

## 5. パフォーマンス特性

### 5.1 レート制限対応
- **制限:** 3リクエスト/秒
- **実装:** 334ms間隔での自動制御
- **効果:** API制限エラーの回避

### 5.2 キャッシュ戦略
- **DatabaseInfo:** 5分間キャッシュ
- **メモリ効率:** Map構造による軽量キャッシュ
- **一貫性:** TTL管理による適切な更新

## 6. テスト戦略

### 6.1 単体テスト (NotionApiClient.test.ts)
- API通信テスト（モック使用）
- エラーハンドリングテスト
- レート制限テスト
- キャッシュ機能テスト

### 6.2 統合テスト
- 実Notion API接続テスト
- 大量データ処理テスト
- 長時間実行安定性テスト

## 7. セキュリティ考慮事項

### 7.1 認証情報管理
- APIトークンの安全な取得・使用
- ログ出力時のトークンマスク
- 不正認証の適切な検出・処理

### 7.2 通信セキュリティ
- HTTPS通信の強制
- 機密情報のログ出力防止
- レスポンスデータの適切な処理

## 8. 関連モジュール

### 8.1 依存関係
- **ConfigManager:** API認証情報・設定取得
- **Logger:** 処理ログ・パフォーマンス計測
- **Constants:** API定数・エンドポイント定義
- **types/index.ts:** 型定義

### 8.2 使用箇所
- **TriggerManager:** Notion API操作の実行
- **統合テスト:** API通信テスト
