import React, { createContext, useContext, useState, ReactNode } from 'react';
import { MaterialPosition } from '../utils/fileUtils';

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
  quantity: string;
  unit: string;
  price: string;
  vat: string;
  vatAmount: string;
  total: string;
  discount?: string;
  priceAfterDiscount?: string;
  totalBeforeDiscount?: string;
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
  configKeys: Record<string, string>;
  setConfigKeys: (keys: Record<string, string>) => void;
  yandexConfig: YandexConfig;
  saveYandexConfig: (config: YandexConfig) => void;
}

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [projectName, setProjectName] = useState('Новый проект #1');
  const [specRows, setSpecRows] = useState<SpecRow[]>([]);
  const [invoiceRows, setInvoiceRows] = useState<InvoiceRow[]>([]);
  const [estimateRows, setEstimateRows] = useState<EstimateRow[]>([]);
  const [configKeys, setConfigKeys] = useState<Record<string, string>>({});
  const [yandexConfig, setYandexConfig] = useState<YandexConfig>(() => {
    const saved = localStorage.getItem('docok_yandex_config');
    return saved ? JSON.parse(saved) : { apiKey: '', folderId: '' };
  });

  const saveYandexConfig = (config: YandexConfig) => {
    setYandexConfig(config);
    localStorage.setItem('docok_yandex_config', JSON.stringify(config));
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
        configKeys,
        setConfigKeys,
        yandexConfig,
        saveYandexConfig,
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
