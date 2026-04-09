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
  id?: string; // Server-side secured name
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
  type?: Stage;
  supplierData?: SupplierData;
  verifiedFields?: Record<string, boolean>;
}

export interface FileItem extends UploadStatus {
  id?: string;
  name?: string;
}

export interface FieldWithConfidence<T> {
  value: T;
  confidence: number;
  isVerified: boolean;
  note?: string;
}

export interface SupplierData {
  document_type?: FieldWithConfidence<string | null>;
  contact_person?: FieldWithConfidence<string | null>;
  organization_name: FieldWithConfidence<string | null>;
  inn: FieldWithConfidence<string | null>;
  kpp: FieldWithConfidence<string | null>;
  legal_address: FieldWithConfidence<string | null>;
  postal_address: FieldWithConfidence<string | null>;
  bank_name?: FieldWithConfidence<string | null>;
  bank_bik?: FieldWithConfidence<string | null>;
  bank_account?: FieldWithConfidence<string | null>;
  corr_account?: FieldWithConfidence<string | null>;
  phone?: FieldWithConfidence<string | null>;
  [key: string]: any;
}

export interface MaterialPosition {
  pos: string;
  name: string;
  brand: string;
  code: string;
  supplier: string;
  unit: string;
  quantity: string;
  mass: string;
  note: string;
  is_header?: boolean;
}

export interface SpecRow extends MaterialPosition {
  id: string;
  fileId?: string;
  originalRowsIds?: string[];
  children?: SpecRow[];
  row_type?: 'WORK_TYPE' | 'LOCATION' | 'GROUP' | 'ITEM';
  level?: number;
  parentId?: string | null;
  // Field-mapping aliases (mass/weight and note/notes)
  mass: string;
  weight?: string;
  note: string;
  notes?: string;
}

export interface InvoiceItem {
  pos: string;
  name: string;
  article: string;
  supplier: string;
  quantity: number;
  unit: string;
  price_unit: number;
  discount: string;
  price_final: number;
  total: number;
  vat_rate: string;
  is_valid: boolean; // Для индикации математических ошибок
}

export interface InvoiceRow extends InvoiceItem {
  id: string;
  fileId?: string;
  documentName?: string;
  isUncertain?: boolean;
  level?: number;
  parentId?: string | null;
  match_data?: {
    target_id: string | null;
    target_name: string | null;
    score: number;
    status?: 'perfect' | 'warning' | 'none';
  };
  row_type?: 'WORK_TYPE' | 'LOCATION' | 'GROUP' | 'ITEM';
  is_header?: boolean;
  // Legacy support if needed
  price?: string | number;
}

export interface EstimateRow {
  id: string;
  fileId?: string;
  workType: string;
  name: string;
  unit?: string;
  quantity: string | number;
  costPrice: string | number;
  clientPrice: string | number;
  costSum: string | number;
  clientSum: string | number;
  supplier: string;
  row_type?: 'WORK_TYPE' | 'LOCATION' | 'GROUP' | 'ITEM';
  is_header?: boolean;
  level?: number;
  parentId?: string | null;
}
