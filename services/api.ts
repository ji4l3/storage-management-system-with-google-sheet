import { API_CONFIG } from "@/constants/dashboard";
import type {
    AppConfigResponse,
    ApiListResponse,
    ApiOk,
    UpdateBatchRemarksPayload,
    UpdateRemarksPayload,
} from "@/types/dashboard";
import { withRetry } from "@/utils/retry";
import Constants from "expo-constants";

// API 密钥配置
const API_KEY =
  process.env.EXPO_PUBLIC_API_KEY ||
  Constants.expoConfig?.extra?.apiKey ||
  "";

class DashboardAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "DashboardAPIError";
  }
}

/**
 * 构建带有 API 密钥的 URL
 */
function buildApiUrl(
  action: string,
  additionalParams?: Record<string, string>,
): string {
  const params = new URLSearchParams({
    action,
    apiKey: API_KEY,
    // 向后兼容：同时保留 token 参数
    token: API_CONFIG.token,
    ...additionalParams,
  });

  return `${API_CONFIG.baseUrl}?${params.toString()}`;
}

async function fetchJson(url: string, options?: RequestInit): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      redirect: "follow", // ✅ 跟随 302 重定向
    });

    clearTimeout(timeoutId);

    const text = await response.text();

    console.log(`API ${response.status}:`, text.slice(0, 200));

    if (!response.ok) {
      throw new DashboardAPIError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status,
      );
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new DashboardAPIError(
        `Invalid JSON response. Status: ${response.status}. Content: ${text.slice(0, 120)}`,
      );
    }
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof DashboardAPIError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new DashboardAPIError("Request timeout");
    }

    // 检查是否是 API 密钥错误
    if (error instanceof Error && error.message.includes("401")) {
      throw new DashboardAPIError("API 密钥无效，请联系开发者", 401);
    }

    throw new DashboardAPIError(
      `Network error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export class DashboardAPI {
  static async fetchAppConfig(): Promise<AppConfigResponse> {
    const url = buildApiUrl("appConfig");
    return withRetry(() => fetchJson(url), 1, 1000);
  }

  static async fetchItems(): Promise<ApiListResponse> {
    const url = buildApiUrl("list");

    console.log("🌐 Fetching from:", API_CONFIG.baseUrl);
    console.log("🔑 Using API key:", API_KEY.substring(0, 8) + "***");

    return withRetry(() => fetchJson(url), API_CONFIG.retryAttempts, 1000);
  }

  static async updateRemarks(payload: UpdateRemarksPayload): Promise<ApiOk> {
    const url = buildApiUrl("setRemarks");

    const requestBody: any = {
      sheetName: payload.sheetName,
      row: payload.rowNumber,
      remarks: payload.remarks,
    };

    // Include spreadsheetId if provided
    if (payload.spreadsheetId) {
      requestBody.spreadsheetId = payload.spreadsheetId;
    }

    console.log("📤 Updating remarks:", requestBody);
    console.log("🔑 Using API key:", API_KEY.substring(0, 8) + "***");

    return withRetry(
      () =>
        fetchJson(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        }),
      // Fewer retries for write operations
      Math.min(2, API_CONFIG.retryAttempts),
      1500,
    );
  }

  static async updateBatchRemarks(
    payload: UpdateBatchRemarksPayload,
  ): Promise<ApiOk> {
    const url = buildApiUrl("setRemarksBatchRows");

    const requestBody: any = {
      sheetName: payload.sheetName,
      rowNumbers: payload.rowNumbers,
      remarks: payload.remarks,
    };

    if (payload.spreadsheetId) {
      requestBody.spreadsheetId = payload.spreadsheetId;
    }

    return withRetry(
      () =>
        fetchJson(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        }),
      Math.min(2, API_CONFIG.retryAttempts),
      1500,
    );
  }
}

export { DashboardAPIError };
