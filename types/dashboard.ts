export interface Item {
  projectName?: string;
  sheetName: string;
  rowNumber: number;
  buswayNo: string;
  lot: string;
  description: string;
  stockCode: string;
  remarks?: string;
  spreadsheetId?: string;
  spreadsheetName?: string;
  quantity?: number;
  isQuantityAggregate?: boolean;
  aggregateRowNumbers?: number[];
}

export interface ItemView extends Item {
  key: string;
  projectNorm: string;
  lotNorm: string;
  buswayTrim: string;
  descTrim: string;
  stockCodeNorm: string;
}

export interface ApiListOK {
  ok: true;
  startSheet?: string;
  status?: string;
  items: Item[];
  total: number;
  projects?: Array<{
    projectName: string;
    items: Item[];
    total: number;
  }>;
}

export interface ApiError {
  ok: false;
  error: string;
}

export type ApiListResponse = ApiListOK | ApiError;
export type ApiOk = { ok: true } | ApiError;

export interface AppConfigOk {
  ok: true;
  latestVersion?: string;
  latestVersionCode?: number;
  minSupportedVersionCode?: number;
  forceUpdate?: boolean;
  apkUrl?: string;
  changelog?: string;
  serverTime?: string;
}
export type AppConfigResponse = AppConfigOk | ApiError;

export interface SectionRow extends Array<ItemView> {}

export interface SectionType {
  title: string;
  data: SectionRow[];
}

export interface UpdateRemarksPayload {
  spreadsheetId?: string;
  sheetName: string;
  rowNumber: number;
  remarks: "Completed" | "To run";
}

export interface UpdateBatchRemarksPayload {
  spreadsheetId?: string;
  sheetName: string;
  rowNumbers: number[];
  remarks: "Completed" | "To run";
}

export type PendingStatus = "done" | "undone";

export interface BatchUpdateItem {
  key: string;
  spreadsheetId: string;
  sheetName: string;
  buswayPrefix: string;
  sequenceNumber: number;
  rowNumber?: number;
  status: PendingStatus;
  clientTimestamp: number;
}

export interface DashboardStats {
  totalItems: number;
  completedItems: number;
  completionPercent: number;
  lotStats: Record<string, { done: number; total: number }>;
}
