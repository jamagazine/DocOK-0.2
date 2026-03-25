export type Stage = 'spec' | 'request' | 'invoice' | 'estimate';

export type StageStatus = 'done' | 'partial' | 'not_started';

export interface StageInfo {
  id: Stage;
  label: string;
  status: StageStatus;
}

export type RightPanelTab = 'tools' | 'info' | 'calc';

export type FileStatus = 'ok' | 'loading' | 'error' | 'reset' | 'Старт...' | 'Локальный парсинг...' | 'Конвертация и Анализ ИИ...' | string;

export interface UploadStatus {
  status: FileStatus;
  time: string;
  size?: number;
  tokens?: number;
  cost?: number;
  estimated_cost?: number;
  model?: string;
  method?: string;
  error?: string;
  chunks?: { current: number; total: number };
}

export interface UploadedFile {
  id: string;
  name: string;
  status: 'ok' | 'loading' | 'error' | 'reset';
  method: 'Local' | 'AI';
  uploadTime: string;
}

export interface SpecRow {
  id: string;
  index: number;
  name: string;
  brand: string;
  code: string;
  supplier: string;
  quantity: number;
  unit: string;
  weight: number;
  notes: string;
}

export interface InvoiceRow {
  id: string;
  index: number;
  article: string;
  name: string;
  quantity: number;
  unit: string;
  vat: number;
  priceWithVat: number;
  discount: number;
  priceDiscounted: number;
  sumNoDiscount: number;
  sumWithVat: number;
}

export interface EstimateRow {
  id: string;
  index: number;
  type: string;
  name: string;
  quantity: number;
  unit: string;
  costPrice: number;
  markup: number;
  clientPrice: number;
}
