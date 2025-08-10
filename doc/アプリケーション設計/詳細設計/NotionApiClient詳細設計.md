# NotionApiClient モジュール詳細設計

## 1. 役割
Notion APIとの通信を担当する。ページの作成・更新、データベース情報の取得、レート制限対応、エラーハンドリングを行う。

## 2. 関数

### 2.1 createPage(databaseId, pageData)
**概要:** Notionデータベースに新しいページを作成
**引数:**
- `databaseId` (string): 対象データベースID
- `pageData` (NotionPageData): ページデータ
**戻り値:** `Promise<NotionPageResponse>`

```javascript
async function createPage(databaseId, pageData) {
  await this.rateLimiter.waitForRateLimit();
  
  const response = await this.makeRequest('/pages', {
    method: 'POST',
    payload: JSON.stringify({
      parent: { database_id: databaseId },
      properties: pageData.properties
    })
  });
  
  Logger.info('Page created successfully', { pageId: response.id });
  return response;
}
```

### 2.2 updatePage(pageId, pageData)
**概要:** 既存のNotionページを更新
**引数:**
- `pageId` (string): 更新対象ページID
- `pageData` (NotionPageData): 更新データ
**戻り値:** `Promise<NotionPageResponse>`

```javascript
async function updatePage(pageId, pageData) {
  await this.rateLimiter.waitForRateLimit();
  
  const response = await this.makeRequest(`/pages/${pageId}`, {
    method: 'PATCH',
    payload: JSON.stringify({
      properties: pageData.properties
    })
  });
  
  Logger.info('Page updated successfully', { pageId });
  return response;
}
```

### 2.3 getDatabaseInfo(databaseId)
**概要:** データベースのプロパティ情報を取得
**引数:**
- `databaseId` (string): データベースID
**戻り値:** `Promise<DatabaseInfo>`

```javascript
async function getDatabaseInfo(databaseId) {
  await this.rateLimiter.waitForRateLimit();
  
  const response = await this.makeRequest(`/databases/${databaseId}`);
  
  return {
    id: response.id,
    title: response.title?.[0]?.plain_text || 'Untitled',
    properties: Object.entries(response.properties).map(([name, prop]) => ({
      name,
      type: prop.type,
      id: prop.id,
      config: extractPropertyConfig(prop)
    }))
  };
}
```

### 2.4 getPage(pageId)
**概要:** 指定されたページの詳細情報を取得
**引数:**
- `pageId` (string): ページID
**戻り値:** `Promise<NotionPageResponse>`

```javascript
async function getPage(pageId) {
  await this.rateLimiter.waitForRateLimit();
  
  const response = await this.makeRequest(`/pages/${pageId}`);
  
  Logger.info('Page retrieved successfully', { pageId });
  return response;
}
```

### 2.5 makeRequest(endpoint, options)
**概要:** Notion APIへのHTTPリクエストを実行
**引数:**
- `endpoint` (string): APIエンドポイント
- `options` (RequestOptions): リクエストオプション
**戻り値:** `Promise<any>`

```javascript
async function makeRequest(endpoint, options = {}) {
  const url = `${CONSTANTS.NOTION.BASE_URL}${endpoint}`;
  
  const defaultOptions = {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${ConfigManager.getApiToken()}`,
      'Notion-Version': CONSTANTS.NOTION.API_VERSION,
      'Content-Type': 'application/json'
    },
    muteHttpExceptions: true
  };
  
  const requestOptions = { ...defaultOptions, ...options };
  
  try {
    Logger.info('Making API request', { 
      method: requestOptions.method, 
      endpoint: endpoint 
    });
    
    const response = UrlFetchApp.fetch(url, requestOptions);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    if (responseCode >= 400) {
      throw new ApiError(
        `API request failed: ${responseCode}`,
        responseCode,
        responseText
      );
    }
    
    return JSON.parse(responseText);
    
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError('Network or parsing error', 0, error.message);
  }
}
```

### 2.6 extractPropertyConfig(property)
**概要:** プロパティ設定情報を抽出
**引数:**
- `property` (any): Notionプロパティオブジェクト
**戻り値:** `PropertyConfig`

```javascript
function extractPropertyConfig(property) {
  const config = {
    type: property.type,
    required: false
  };
  
  switch (property.type) {
    case 'select':
      config.options = property.select?.options?.map(opt => ({
        name: opt.name,
        color: opt.color
      })) || [];
      break;
      
    case 'multi_select':
      config.options = property.multi_select?.options?.map(opt => ({
        name: opt.name,
        color: opt.color
      })) || [];
      break;
      
    case 'date':
      config.format = property.date?.format || null;
      break;
      
    case 'number':
      config.format = property.number?.format || 'number';
      break;
      
    case 'formula':
      config.expression = property.formula?.expression || '';
      break;
  }
  
  return config;
}
```

### 2.7 testConnection()
**概要:** API接続テストを実行
**引数:** なし
**戻り値:** `Promise<ConnectionTestResult>`

```javascript
async function testConnection() {
  try {
    const config = await ConfigManager.getConfig();
    
    // データベース情報取得でテスト
    const dbInfo = await getDatabaseInfo(config.databaseId);
    
    return {
      success: true,
      databaseTitle: dbInfo.title,
      propertyCount: dbInfo.properties.length,
      message: '接続テストが成功しました'
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '接続テストが失敗しました'
    };
  }
}
```

### 2.8 queryDatabase(databaseId, filter, sorts)
**概要:** データベースのクエリ実行
**引数:**
- `databaseId` (string): データベースID
- `filter` (object, optional): フィルター条件
- `sorts` (array, optional): ソート条件
**戻り値:** `Promise<QueryResult>`

```javascript
async function queryDatabase(databaseId, filter = null, sorts = null) {
  await this.rateLimiter.waitForRateLimit();
  
  const payload = {
    page_size: 100
  };
  
  if (filter) payload.filter = filter;
  if (sorts) payload.sorts = sorts;
  
  const response = await this.makeRequest(`/databases/${databaseId}/query`, {
    method: 'POST',
    payload: JSON.stringify(payload)
  });
  
  return {
    results: response.results,
    hasMore: response.has_more,
    nextCursor: response.next_cursor
  };
}
```

## 3. レート制限管理

### 3.1 RateLimiter クラス
```javascript
class RateLimiter {
  constructor() {
    this.lastRequestTime = 0;
    this.minInterval = CONSTANTS.NOTION.RATE_LIMIT_DELAY; // 334ms
    this.requestQueue = [];
  }
  
  async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastRequest;
      Logger.debug('Rate limit wait', { waitTime });
      await this.sleep(waitTime);
    }
    
    this.lastRequestTime = Date.now();
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  reset() {
    this.lastRequestTime = 0;
    this.requestQueue = [];
  }
}
```

## 4. データ構造

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
  options?: Array<{ name: string; color: string }>;
  format?: string;
  expression?: string;
}

interface ConnectionTestResult {
  success: boolean;
  databaseTitle?: string;
  propertyCount?: number;
  error?: string;
  message: string;
}

interface QueryResult {
  results: NotionPageResponse[];
  hasMore: boolean;
  nextCursor?: string;
}

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  payload?: string;
  muteHttpExceptions?: boolean;
}

class ApiError extends Error {
  constructor(
    message: string, 
    public statusCode: number, 
    public responseBody: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
```

## 5. プロパティ/変数

```javascript
const NOTION_API_CLIENT = {
  // レート制限管理
  rateLimiter: new RateLimiter(),
  
  // リトライ設定
  MAX_RETRIES: 3,
  RETRY_DELAYS: [1000, 2000, 4000], // 指数バックオフ
  
  // タイムアウト設定
  REQUEST_TIMEOUT: 30000, // 30秒
  
  // サポートAPIバージョン
  SUPPORTED_API_VERSIONS: ['2022-06-28', '2022-02-22'],
  
  // HTTPステータスコード
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    RATE_LIMITED: 429,
    INTERNAL_ERROR: 500
  }
};
```

## 6. エラーハンドリング

### 6.1 処理可能なエラー
- 認証エラー（401 Unauthorized）
- 権限エラー（403 Forbidden）
- リソース不存在（404 Not Found）
- レート制限（429 Too Many Requests）
- サーバーエラー（500 Internal Server Error）

### 6.2 リトライ機能
```javascript
async function makeRequestWithRetry(endpoint, options = {}, retryCount = 0) {
  try {
    return await this.makeRequest(endpoint, options);
  } catch (error) {
    if (retryCount >= this.MAX_RETRIES) {
      throw error;
    }
    
    if (this.shouldRetry(error)) {
      const delay = this.RETRY_DELAYS[retryCount] || 4000;
      Logger.info('Retrying request', { 
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

function shouldRetry(error) {
  if (error instanceof ApiError) {
    // 429 (Rate Limited) または 5xx (Server Error) の場合はリトライ
    return error.statusCode === 429 || error.statusCode >= 500;
  }
  
  // ネットワークエラーの場合もリトライ
  return error.message?.includes('network') || 
         error.message?.includes('timeout');
}
```

## 7. セキュリティ考慮事項

### 7.1 認証情報管理
- APIトークンはリクエストヘッダーで送信
- ログ出力時はトークンをマスク
- 不正なトークンの検出と適切なエラー処理

### 7.2 データ保護
- HTTPS通信の強制
- レスポンスデータの適切な処理
- 機密情報のログ出力防止

## 8. 依存関係

### 8.1 依存モジュール
- ConfigManager: API認証情報の取得
- Logger: ログ出力
- Constants: 定数定義

### 8.2 外部依存
- UrlFetchApp: HTTP通信
- JSON: データ変換
- setTimeout: 遅延処理

## 9. テスト観点

### 9.1 単体テスト項目
- 正常なAPI呼び出し
- 各種エラーステータスの処理
- レート制限の動作
- リトライ機能

### 9.2 統合テスト項目
- 実際のNotion APIとの通信
- 大量データの処理性能
- 長時間実行時の安定性
