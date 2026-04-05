export type Stage = 'spec' | 'invoice' | 'estimate';

export type StageStatus = 'done' | 'partial' | 'not_started';

export interface StageInfo {
  id: Stage;
  label: string;
  status: StageStatus;
}

export type RightPanelTab = 'tools' | 'info' | 'calc';

export type FileStatus = 'ok' | 'loading' | 'error' | 'reset' | 'READY_MD' | 'Готово (ИИ)' | 'Готово (Хранилище)' | 'Старт...' | 'Локальный парсинг...' | 'Конвертация и Анализ ИИ...' | string;

export interface UploadStatus {
  status: FileStatus;
  time: string;
  size?: number;
  tokens?: number;
  cost?: number;
  estimated_cost?: number;
  estimated_tokens?: number;
  model?: string;
  method?: string;
  error?: string;
  chunks?: { current: number; total: number };
  chunks_report?: { id: number; ok: boolean }[];
  processed_count?: number;
  total_chunks?: number;
  current_step?: 'prep' | 'ai' | 'final';
  summary_md?: string;
  summary_fields?: {
    cipher?: string;
    destination?: string;
    notes?: string;
    total_positions?: number;
    suppliers?: string;
    [key: string]: any;
  };
  pages_count?: number;
  is_scan?: boolean;
  pdf_type?: string;
  supplierData?: SupplierData;
  verifiedFields?: Record<string, boolean>;
}

export interface FileItem extends UploadStatus {
  id?: string;
  name?: string;
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
  row_type?: 'WORK_TYPE' | 'LOCATION' | 'GROUP' | 'ITEM';
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
  row_type?: 'WORK_TYPE' | 'LOCATION' | 'GROUP' | 'ITEM';
  is_header?: boolean;
  isUncertain?: boolean;
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
  row_type?: 'WORK_TYPE' | 'LOCATION' | 'GROUP' | 'ITEM';
  is_header?: boolean;
}

export interface FieldWithConfidence<T> {
  value: T;
  confidence: number; // от 0.0 до 1.0 (например, 0.98 = 98% уверенности)
  isVerified: boolean; // Флаг, подтвердил ли человек это поле
}

export interface SupplierData {
  organization_name: FieldWithConfidence<string | null>;
  inn: FieldWithConfidence<string | null>;
  kpp: FieldWithConfidence<string | null>;
  legal_address: FieldWithConfidence<string | null>;
  postal_address: FieldWithConfidence<string | null>;
}
