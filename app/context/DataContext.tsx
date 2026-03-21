import React, { createContext, useContext, useState, ReactNode } from 'react';
import { MaterialPosition, parseFile, autoDetectMapping, INVOICE_ALIASES } from '../utils/fileUtils';

export interface YandexConfig {
  apiKey: string;
  folderId: string;
}
export function genId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export interface SpecRow extends MaterialPosition {
  id: string;
  originalRowsIds?: string[];
  children?: SpecRow[];
}

export interface InvoiceRow {
  id: string;
  documentName?: string;
  isUncertain?: boolean;
  article: string;
  name: string;
  supplier: string;
  quantity: string | number;
  unit: string;
  price: string | number;
  vatRate?: string;
  vatAmount?: string;
  total: string | number;
  discount?: string | number;
  priceAfterDiscount?: string | number;
  totalBeforeDiscount?: string | number;
}

export function emptyInvoiceRow(): InvoiceRow {
  return {
    id: genId(),
    article: '',
    name: '',
    supplier: '',
    quantity: '1',
    unit: 'шт',
    price: '0',
    vatRate: '20%',
    vatAmount: '0',
    total: '0',
    discount: '',
    priceAfterDiscount: '',
    totalBeforeDiscount: '',
    isUncertain: false,
  };
}

export function emptySpecRow(): SpecRow {
  return {
    id: genId(),
    code: '',
    brand: '',
    name: '',
    quantity: '1',
    unit: 'шт',
    supplier: '',
    mass: '0',
    note: ''
  };
}

export function emptyEstimateRow(): EstimateRow {
  return {
    id: genId(),
    type: 'material',
    name: '',
    unit: 'шт',
    quantity: '1',
    cost: '0',
    markup: '15',
    clientPrice: '0',
  };
}

export interface EstimateRow {
  id: string;
  type: string;
  name: string;
  unit: string;
  quantity: string;
  cost: string;
  markup: string;
  clientPrice: string;
}

interface DataContextType {
  projectName: string;
  setProjectName: (name: string) => void;
  specRows: SpecRow[];
  setSpecRows: React.Dispatch<React.SetStateAction<SpecRow[]>>;
  invoiceRows: InvoiceRow[];
  setInvoiceRows: React.Dispatch<React.SetStateAction<InvoiceRow[]>>;
  estimateRows: EstimateRow[];
  setEstimateRows: React.Dispatch<React.SetStateAction<EstimateRow[]>>;
  requestRows: SpecRow[];
  setRequestRows: React.Dispatch<React.SetStateAction<SpecRow[]>>;
  configKeys: Record<string, string>;
  setConfigKeys: (keys: Record<string, string>) => void;
  yandexConfig: YandexConfig;
  saveYandexConfig: (config: YandexConfig) => void;
  uploadStatuses: Record<string, { status: string; time: string }>;
  setUploadStatuses: React.Dispatch<React.SetStateAction<Record<string, { status: string; time: string }>>>;
  filesMap: Record<string, File>;
  setFilesMap: React.Dispatch<React.SetStateAction<Record<string, File>>>;
  handleFile: (file: File, forceAI?: boolean) => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [projectName, setProjectName] = useState('Новый проект #1');
  const [specRows, setSpecRows] = useState<SpecRow[]>([]);
  const [invoiceRows, setInvoiceRows] = useState<InvoiceRow[]>([]);
  const [estimateRows, setEstimateRows] = useState<EstimateRow[]>([]);
  const [requestRows, setRequestRows] = useState<SpecRow[]>([]);
  const [configKeys, setConfigKeys] = useState<Record<string, string>>({});
  const [yandexConfig, setYandexConfig] = useState<YandexConfig>(() => {
    const saved = localStorage.getItem('docok_yandex_config');
    return saved ? JSON.parse(saved) : { apiKey: '', folderId: '' };
  });
  const [uploadStatuses, setUploadStatuses] = useState<Record<string, { status: string; time: string }>>({});
  const [filesMap, setFilesMap] = useState<Record<string, File>>({});

  const saveYandexConfig = (config: YandexConfig) => {
    setYandexConfig(config);
    localStorage.setItem('docok_yandex_config', JSON.stringify(config));
  };

  const handleFile = async (file: File, forceAI: boolean = false) => {
    const now = new Date();
    const currentTime = `${now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} | ${now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })}`;
    setUploadStatuses(prev => ({ ...prev, [file.name]: { status: 'Старт...', time: currentTime } }));

    const isPdfOrImage = !!file.name.match(/\.(pdf|png|jpe?g)$/i);
    const useAi = forceAI || isPdfOrImage;

    if (!useAi) {
      setUploadStatuses(prev => ({ ...prev, [file.name]: { status: 'Локальный парсинг...', time: currentTime } }));
      try {
        const { headers, rows: parsedRawRows } = await parseFile(file);
        const detected = autoDetectMapping(headers, INVOICE_ALIASES);
        
        const mapping = Object.fromEntries(
          Object.entries(detected).map(([key, value]) => [key, value.index])
        );

        const newRowsToAppend: InvoiceRow[] = parsedRawRows.map((row) => {
          const r = emptyInvoiceRow();
          r.documentName = file.name;
          if (mapping.article !== undefined) r.article = row[mapping.article] || '';
          if (mapping.name !== undefined) r.name = row[mapping.name] || '';
          if (mapping.supplier !== undefined) r.supplier = row[mapping.supplier] || '';
          if (mapping.quantity !== undefined) r.quantity = row[mapping.quantity] || '';
          if (mapping.unit !== undefined) r.unit = row[mapping.unit] || '';
          if (mapping.price !== undefined) r.price = row[mapping.price] || '';
          if (mapping.vat !== undefined) r.vatRate = row[mapping.vat] || '';
          if (mapping.vatAmount !== undefined) r.vatAmount = row[mapping.vatAmount] || '';
          if (mapping.total !== undefined) r.total = row[mapping.total] || '';

          const qty = parseFloat(String(r.quantity).replace(/\s/g, '').replace(/,/g, '.')) || 0;
          const price = parseFloat(String(r.price).replace(/\s/g, '').replace(/,/g, '.')) || 0;
          const subtotal = qty * price;

          if (!r.total && subtotal > 0) {
            r.total = subtotal.toFixed(2);
          }
          return r;
        });

        setInvoiceRows(prev => {
          const filtered = prev.filter(r => r.documentName !== file.name);
          return [...filtered, ...newRowsToAppend];
        });
        
        setUploadStatuses(prev => ({ ...prev, [file.name]: { status: 'Готово (Локально)', time: currentTime } }));
        setFilesMap(prev => ({ ...prev, [file.name]: file }));
      } catch (e: any) {
        setUploadStatuses(prev => ({ ...prev, [file.name]: { status: 'Ошибка', time: currentTime } }));
      }
      return; 
    }

    if (useAi) {
      setUploadStatuses(prev => ({ ...prev, [file.name]: { status: 'Конвертация и Анализ ИИ...', time: currentTime } }));
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('http://localhost:8000/api/process-invoice', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          throw new Error(`Ошибка сервера ${res.status}`);
        }

        const data = await res.json();
        
        const strToNumOrBlank = (v: any) => {
           if (!v) return '';
           const parsed = parseFloat(String(v).replace(/,/g, '.').replace(/\s/g, ''));
           return isNaN(parsed) ? String(v) : String(parsed);
        };

        const aiRows: InvoiceRow[] = (data.items || []).map((item: any) => {
           const r = emptyInvoiceRow();
           r.documentName = data.document?.filename || data.document?.name || file.name;
           r.isUncertain = Boolean(item.isUncertain);
           r.article = item.article || '';
           r.name = item.name || '';
           r.supplier = data.document?.metadata?.vendor || '';
           r.quantity = strToNumOrBlank(item.quantity) || '1';
           r.unit = item.unit || 'шт';
           r.price = strToNumOrBlank(item.price) || '0';
           r.total = strToNumOrBlank(item.total) || '0';
           return r;
        });

        setInvoiceRows(prev => {
          const filtered = prev.filter((r) => r.documentName !== file.name);
          return [...filtered, ...aiRows];
        });
        
        setUploadStatuses(prev => ({ ...prev, [file.name]: { status: 'Готово (ИИ)', time: currentTime } }));
        setFilesMap(prev => ({ ...prev, [file.name]: file }));
      } catch (e: any) {
        setUploadStatuses(prev => ({ ...prev, [file.name]: { status: 'Ошибка', time: currentTime } }));
      }
    }
  };

  return (
    <DataContext.Provider
      value={{
        projectName,
        setProjectName,
        specRows,
        setSpecRows,
        invoiceRows,
        setInvoiceRows,
        estimateRows,
        setEstimateRows,
        requestRows,
        setRequestRows,
        configKeys,
        setConfigKeys,
        yandexConfig,
        saveYandexConfig,
        uploadStatuses,
        setUploadStatuses,
        filesMap,
        setFilesMap,
        handleFile,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
