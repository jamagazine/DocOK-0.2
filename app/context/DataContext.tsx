import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { toast } from 'sonner';
import { MaterialPosition, parseFile, autoDetectMapping, INVOICE_ALIASES, SPEC_ALIASES, mergeDuplicateMaterials, exportGeometryToXLSX } from '../utils/fileUtils';
import { parsePdfGeometry, PdfGeometry } from '../utils/pdfUtils';
import { Stage } from '../types';

export interface YandexConfig {
  apiKey: string;
  catalogId: string;
}
export interface SortConfig {
  key: string | null;
  direction: 'asc' | 'desc' | null;
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

export const SPEC_COLUMNS = [
  { key: 'name', label: 'Наименование', width: 220 },
  { key: 'brand', label: 'Марка', width: 130 },
  { key: 'code', label: 'Код', width: 110 },
  { key: 'supplier', label: 'Поставщик', width: 140 },
  { key: 'unit', label: 'Ед.', width: 80, align: 'center' },
  { key: 'quantity', label: 'Кол-во', width: 100, type: 'number', align: 'right' },
  { key: 'mass', label: 'Масса', width: 100, type: 'number', align: 'right' },
  { key: 'note', label: 'Прим.', width: 180 },
];

export const SPEC_TARGET_FIELDS = [
  { key: 'name', label: 'Наименование', required: true },
  { key: 'brand', label: 'Марка' },
  { key: 'code', label: 'Код' },
  { key: 'supplier', label: 'Поставщик' },
  { key: 'unit', label: 'Единицы измерения' },
  { key: 'quantity', label: 'Количество' },
  { key: 'mass', label: 'Масса' },
  { key: 'note', label: 'Примечания' },
];

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
    workType: '',
    name: '',
    unit: 'шт',
    quantity: '1',
    costPrice: '',
    clientPrice: '',
    costSum: '',
    clientSum: '',
    supplier: '',
  };
}

export interface EstimateRow {
  id: string;
  workType: string;
  name: string;
  unit: string;
  quantity: string;
  costPrice: string;
  clientPrice: string;
  costSum: string;
  clientSum: string;
  supplier: string;
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
  handleFile: (files: FileList | File[], stage: string, forceAI?: boolean) => Promise<void>;
  pdfGeometry: PdfGeometry | null;
  isMerged: boolean;
  toggleMerge: () => void;
  handleUnmerge: (parentId: string, childId: string) => void;
  generateEstimate: () => void;
  estimateTotal: { cost: string; client: string };
  resetData: (stage: Stage) => void;
  groupRows: (stage: Stage, field: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sortConfig: SortConfig;
  handleSort: (key: string) => void;
  completedStages: string[];
  completeStage: (stageId: string) => void;
  isDragging: boolean;
  setIsDragging: (val: boolean) => void;
  selectedIds: string[];
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  toggleRowSelection: (id: string, isCellClick: boolean) => void;
  toggleSelectAllPage: (ids: string[]) => void;
  selectAllRows: () => void;
  deleteSelectedRows: () => void;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  rowsPerPage: number;
  setRowsPerPage: (rows: number) => void;
  isOnlySelectedView: boolean;
  setIsOnlySelectedView: (val: boolean) => void;
  handleRowChange: (stage: Stage, rowId: string, field: string, value: string) => void;
  currentStage: Stage;
  setCurrentStage: (stage: Stage) => void;
  getCurrentRows: () => any[];
}

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [projectName, setProjectName] = useState('Новый проект #1');
  
  const [specRows, setSpecRows] = useState<SpecRow[]>(() => {
    try { const saved = localStorage.getItem('docok_specRows'); if (saved) return JSON.parse(saved); } catch (e) {}
    return [];
  });
  const [requestRows, setRequestRows] = useState<SpecRow[]>(() => {
    try { const saved = localStorage.getItem('docok_requestRows'); if (saved) return JSON.parse(saved); } catch (e) {}
    return [];
  });
  const [invoiceRows, setInvoiceRows] = useState<InvoiceRow[]>(() => {
    try { const saved = localStorage.getItem('docok_invoiceRows'); if (saved) return JSON.parse(saved); } catch (e) {}
    return [];
  });
  const [estimateRows, setEstimateRows] = useState<EstimateRow[]>(() => {
    try { const saved = localStorage.getItem('docok_estimateRows'); if (saved) return JSON.parse(saved); } catch (e) {}
    return [];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: null });

  const [completedStages, setCompletedStages] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('docok_completed_stages');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  useEffect(() => { localStorage.setItem('docok_specRows', JSON.stringify(specRows)); }, [specRows]);
  useEffect(() => { localStorage.setItem('docok_requestRows', JSON.stringify(requestRows)); }, [requestRows]);
  useEffect(() => { localStorage.setItem('docok_invoiceRows', JSON.stringify(invoiceRows)); }, [invoiceRows]);
  useEffect(() => { localStorage.setItem('docok_estimateRows', JSON.stringify(estimateRows)); }, [estimateRows]);
  useEffect(() => { localStorage.setItem('docok_completed_stages', JSON.stringify(completedStages)); }, [completedStages]);

  const [configKeys, setConfigKeys] = useState<Record<string, string>>({});
  const [yandexConfig, setYandexConfig] = useState<YandexConfig>(() => {
    const saved = localStorage.getItem('docok_yandex_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        apiKey: parsed.apiKey || '',
        catalogId: parsed.catalogId || parsed.folderId || ''
      };
    }
    return { apiKey: '', catalogId: '' };
  });
  const [uploadStatuses, setUploadStatuses] = useState<Record<string, { status: string; time: string }>>({});
  const [filesMap, setFilesMap] = useState<Record<string, File>>({});
  const [pdfGeometry, setPdfGeometry] = useState<PdfGeometry | null>(null);
  const [isMerged, setIsMerged] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [backupSpecRows, setBackupSpecRows] = useState<SpecRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [isOnlySelectedView, setIsOnlySelectedView] = useState(false);
  
  const [currentStage, setCurrentStage] = useState<Stage>('spec');

  // Reset pagination and selection on stage change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds([]);
    setIsOnlySelectedView(false);
  }, [currentStage]);

  const saveYandexConfig = useCallback((config: YandexConfig) => {
    setYandexConfig(config);
    localStorage.setItem('docok_yandex_config', JSON.stringify(config));
  }, []);

  const handleFile = useCallback(async (files: FileList | File[], stage: string, forceAI: boolean = false) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    // Рефакторинг: сбор данных для пакетного обновления
    const allNewSpecRows: SpecRow[] = [];
    const allNewInvoiceRows: InvoiceRow[] = [];

    for (const file of fileArray) {
      const now = new Date();
    const currentTime = `${now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} | ${now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })}`;
    setUploadStatuses((prev: Record<string, any>) => ({ ...prev, [file.name]: { status: 'Старт...', time: currentTime } }));

    const isPdfOrImage = !!file.name.match(/\.(pdf|png|jpe?g)$/i);
    const useAi = forceAI || isPdfOrImage;

    const toastId = toast.loading(`Обработка файла ${file.name}...`);

    if (!useAi) {
      setUploadStatuses((prev: Record<string, any>) => ({ ...prev, [file.name]: { status: 'Локальный парсинг...', time: currentTime } }));
      try {
        const { headers, rows: parsedRawRows, gridX } = await parseFile(file);
        
        // Дополнительно парсим геометрию для "Цифрового двойника" если это этап спецификации
        if (stage === 'spec' && file.name.toLowerCase().endsWith('.pdf')) {
          const geometry = await parsePdfGeometry(file);
          setPdfGeometry(geometry);
        }

        const aliases = stage === 'spec' ? SPEC_ALIASES : INVOICE_ALIASES;
        const detected = autoDetectMapping(headers, aliases);
        
        const mapping = Object.fromEntries(
          Object.entries(detected).map(([key, value]) => [key, value.index])
        );

        if (stage === 'spec') {
            const newRows: SpecRow[] = parsedRawRows.map((row) => ({
              id: genId(),
              name: mapping.name !== undefined ? (row[mapping.name] || '') : '',
              brand: mapping.brand !== undefined ? (row[mapping.brand] || '') : '',
              code: mapping.code !== undefined ? (row[mapping.code] || '') : '',
              supplier: mapping.supplier !== undefined ? (row[mapping.supplier] || '') : '',
              unit: mapping.unit !== undefined ? (row[mapping.unit] || '') : '',
              quantity: mapping.quantity !== undefined ? (row[mapping.quantity] || '') : '',
              mass: mapping.mass !== undefined ? (row[mapping.mass] || '') : '',
              note: mapping.note !== undefined ? (row[mapping.note] || '') : '',
              originalRowsIds: [],
              children: [],
            }));

            allNewSpecRows.push(...newRows);
            setIsMerged(false);
            // backupSpecRows will be updated after the loop
        } else {
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

            allNewInvoiceRows.push(...newRowsToAppend);
          }
          
          setUploadStatuses((prev: any) => ({ ...prev, [file.name]: { status: 'Готово (Локально)', time: currentTime } }));
          setFilesMap((prev: Record<string, File>) => ({ ...prev, [file.name]: file }));
        toast.success(`Файл ${file.name} успешно прочитан локально`, { id: toastId });
      } catch (e: any) {
        setUploadStatuses((prev: any) => ({ ...prev, [file.name]: { status: 'Ошибка', time: currentTime } }));
        toast.error(`Ошибка чтения: ${e.message}`, { id: toastId });
      }
    } else if (useAi) {
      if (!yandexConfig.apiKey || !yandexConfig.catalogId) {
        toast.error('API Ключ или ID каталога не настроены. Проверьте настройки в левой панели.', { id: toastId });
        setUploadStatuses((prev: any) => ({ ...prev, [file.name]: { status: 'Ошибка настроек', time: currentTime } }));
        return;
      }

      setUploadStatuses((prev: any) => ({ ...prev, [file.name]: { status: 'Конвертация и Анализ ИИ...', time: currentTime } }));
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('http://localhost:8000/api/process-invoice', {
          method: 'POST',
          body: formData,
          headers: {
            'x-api-key': yandexConfig.apiKey,
            'x-folder-id': yandexConfig.catalogId
          }
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.detail || `Ошибка сервера ${res.status}`);
        }

        const data = await res.json();
        
        const strToNumOrBlank = (v: any) => {
           if (v === undefined || v === null || v === '') return '';
           const parsed = parseFloat(String(v).replace(/,/g, '.').replace(/\s/g, ''));
           return isNaN(parsed) ? String(v) : String(parsed);
        };

        if (stage === 'spec') {
          const aiRows: SpecRow[] = (data.items || []).map((item: any) => ({
            id: genId(),
            name: item.name || '',
            brand: '', // GPT doesn't specifically extract brand usually, or it's in name
            code: item.article || '',
            supplier: data.document?.metadata?.vendor || '',
            unit: item.unit || 'шт',
            quantity: strToNumOrBlank(item.quantity) || '1',
            mass: '0',
            note: item.isUncertain ? 'Требует проверки' : '',
            originalRowsIds: [],
            children: []
          }));

            allNewSpecRows.push(...aiRows);
            setIsMerged(false);
            // backupSpecRows will be updated after the loop
        } else {
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

            allNewInvoiceRows.push(...aiRows);
          }
          
          setUploadStatuses((prev: any) => ({ ...prev, [file.name]: { status: 'Готово (ИИ)', time: currentTime } }));
          setFilesMap((prev: Record<string, File>) => ({ ...prev, [file.name]: file }));
        toast.success(`Файл ${file.name} успешно обработан ИИ`, { id: toastId });
      } catch (e: any) {
        console.error('AI Processing error:', e);
        setUploadStatuses((prev: any) => ({ ...prev, [file.name]: { status: 'Ошибка', time: currentTime } }));
        toast.error(`Ошибка обработки: ${e.message}`, { id: toastId });
      }
    }
    } // closes for loop

    // Финальное пакетное обновление стейта
    if (allNewSpecRows.length > 0) {
      setSpecRows((prev: SpecRow[]) => [...prev, ...allNewSpecRows]);
      setBackupSpecRows((prev: SpecRow[]) => [...prev, ...allNewSpecRows]);
    }
    if (allNewInvoiceRows.length > 0) {
      setInvoiceRows((prev: InvoiceRow[]) => [...prev, ...allNewInvoiceRows]);
    }
  }, [yandexConfig]);

  const toggleMerge = useCallback(() => {
    setIsMerged((prev: boolean) => {
      if (prev) {
        if (backupSpecRows.length > 0) {
          setSpecRows(backupSpecRows);
        }
        return false;
      } else {
        setBackupSpecRows(specRows);
        const merged = mergeDuplicateMaterials(specRows).map(item => ({
          ...item,
          id: (item as any).id || genId()
        })) as unknown as SpecRow[];
        setSpecRows(merged);
        return true;
      }
    });
  }, [specRows, backupSpecRows]);

  const handleUnmerge = useCallback((parentId: string, childId: string) => {
    setSpecRows((prev: SpecRow[]) => {
      const newRows = [...prev];
      const parentIndex = newRows.findIndex(r => r.id === parentId);
      if (parentIndex === -1) return prev;
      
      const parentRow = { ...newRows[parentIndex] };
      if (!parentRow.children || parentRow.children.length === 0) return prev;
      
      const childIndex = parentRow.children.findIndex((c: SpecRow) => c.id === childId);
      if (childIndex === -1) return prev;
      
      const extractedChild = parentRow.children[childIndex];
      
      parentRow.children = parentRow.children.filter((c: SpecRow) => c.id !== childId);
      parentRow.originalRowsIds = parentRow.originalRowsIds?.filter(id => id !== childId);
      
      const parseQty = (val: unknown) => parseFloat(String(val).replace(/\s/g, '').replace(/,/g, '.')) || 0;
      const pQty = parseQty(parentRow.quantity);
      const cQty = parseQty(extractedChild.quantity);
      const newQty = Math.max(0, pQty - cQty);
      parentRow.quantity = newQty === 0 ? '' : String(newQty);
      
      newRows[parentIndex] = parentRow;
      
      const unmergedSpecRow: SpecRow = {
         ...extractedChild,
         originalRowsIds: [extractedChild.id],
         children: [{ ...extractedChild } as SpecRow]
      };
      
      newRows.splice(parentIndex + 1, 0, unmergedSpecRow);
      return newRows;
    });
  }, []);

  const generateEstimate = useCallback(() => {
    const newEstimate = specRows.map((spec: SpecRow) => {
      // Ищем совпадения в счетах по названию или артикулу/коду
      const matches = invoiceRows.filter((inv: InvoiceRow) => {
        const invName = (inv.name || '').toLowerCase();
        const specName = (spec.name || '').toLowerCase();
        const invArt = (inv.article || '').toLowerCase();
        const specCode = (spec.code || '').toLowerCase();
        
        return (specName && invName && invName.includes(specName)) || 
               (specCode && invArt && invArt === specCode);
      });

      let bestPrice = '';
      let bestSupplier = '';

      if (matches.length > 0) {
        const sorted = matches
          .map((m: InvoiceRow) => ({
            p: parseFloat(String(m.price).replace(/\s/g, '').replace(/,/g, '.')) || 0,
            s: m.supplier
          }))
          .filter((m: any) => m.p > 0)
          .sort((a: any, b: any) => a.p - b.p);
        
        if (sorted.length > 0) {
          bestPrice = String(sorted[0].p);
          bestSupplier = sorted[0].s;
        }
      }

      const q = parseFloat(String(spec.quantity).replace(/\s/g, '').replace(/,/g, '.')) || 0;
      const cp = parseFloat(bestPrice) || 0;
      // По умолчанию наценка 20% для цены заказчика, если есть цена закупки
      const clp = cp > 0 ? cp * 1.2 : 0;
      
      const cs = q * cp;
      const cls = q * clp;

      return {
        id: genId(),
        workType: 'Оборудование и материалы', // Значение по умолчанию
        name: spec.name,
        unit: spec.unit,
        quantity: spec.quantity,
        costPrice: bestPrice,
        clientPrice: clp > 0 ? clp.toFixed(2) : '',
        costSum: cs > 0 ? cs.toFixed(2) : '',
        clientSum: cls > 0 ? cls.toFixed(2) : '',
        supplier: bestSupplier
      };
    });
    setEstimateRows(newEstimate);
  }, [specRows, invoiceRows]);
  
  const resetData = useCallback((stage: Stage) => {
    switch(stage) {
      case 'spec': setSpecRows([]); break;
      case 'invoice': setInvoiceRows([]); break;
      case 'estimate': setEstimateRows([]); break;
      case 'request': setRequestRows([]); break;
    }
  }, []);

  const handleSort = useCallback((key: string) => {
    setSortConfig((prev: SortConfig) => {
      if (prev.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        if (prev.direction === 'desc') return { key: null, direction: null };
      }
      return { key, direction: 'asc' };
    });
  }, []);

  const applySortAndFilter = <T extends { id: string }>(rows: T[], config: SortConfig, query: string, searchFields: string[], selectedIds: string[], isOnlySelected: boolean): T[] => {
    let result = rows;
    
    // Filter by "Only Selected"
    if (isOnlySelected) {
      result = result.filter(r => selectedIds.includes(r.id));
    }

    // Search Filter
    if (query) {
      const lowQuery = query.toLowerCase();
      result = result.filter((r: any) => 
        searchFields.some(field => String(r[field] || '').toLowerCase().includes(lowQuery))
      );
    }

    // Sort
    if (!config.key || !config.direction) return result;
    
    return [...result].sort((a: any, b: any) => {
      let valA = a[config.key!];
      let valB = b[config.key!];

      // Handle numbers
      const numA = parseFloat(String(valA).replace(/\s/g, '').replace(/,/g, '.'));
      const numB = parseFloat(String(valB).replace(/\s/g, '').replace(/,/g, '.'));
      
      if (!isNaN(numA) && !isNaN(numB)) {
        return config.direction === 'asc' ? numA - numB : numB - numA;
      }

      // Handle strings
      const strA = String(valA || '').toLowerCase();
      const strB = String(valB || '').toLowerCase();
      
      if (config.direction === 'asc') {
        return strA.localeCompare(strB, 'ru');
      } else {
        return strB.localeCompare(strA, 'ru');
      }
    });
  };

  const sortedSpecRows = React.useMemo(() => 
    applySortAndFilter(specRows, sortConfig, searchQuery, ['name', 'code', 'supplier'], selectedIds, isOnlySelectedView), 
    [specRows, sortConfig, searchQuery, selectedIds, isOnlySelectedView]
  );
  const sortedRequestRows = React.useMemo(() => 
    applySortAndFilter(requestRows, sortConfig, searchQuery, ['name', 'code', 'supplier'], selectedIds, isOnlySelectedView), 
    [requestRows, sortConfig, searchQuery, selectedIds, isOnlySelectedView]
  );
  const sortedInvoiceRows = React.useMemo(() => 
    applySortAndFilter(invoiceRows, sortConfig, searchQuery, ['name', 'article', 'supplier'], selectedIds, isOnlySelectedView), 
    [invoiceRows, sortConfig, searchQuery, selectedIds, isOnlySelectedView]
  );
  const sortedEstimateRows = React.useMemo(() => 
    applySortAndFilter(estimateRows, sortConfig, searchQuery, ['name', 'workType', 'supplier'], selectedIds, isOnlySelectedView), 
    [estimateRows, sortConfig, searchQuery, selectedIds, isOnlySelectedView]
  );

  const groupRows = useCallback((stage: Stage, field: string) => {
    // Базовая заглушка: просто логируем, так как сложная группировка требует UI-состояния
    console.log(`Grouping ${stage} by ${field}`);
  }, []);

  const estimateTotal = React.useMemo(() => {
    const cost = estimateRows.reduce((acc: number, row: EstimateRow) => acc + (parseFloat(String(row.costSum).replace(/\s/g, '').replace(/,/g, '.')) || 0), 0);
    const client = estimateRows.reduce((acc: number, row: EstimateRow) => acc + (parseFloat(String(row.clientSum).replace(/\s/g, '').replace(/,/g, '.')) || 0), 0);
    return {
      cost: cost.toLocaleString('ru-RU'),
      client: client.toLocaleString('ru-RU')
    };
  }, [estimateRows]);

  const completeStage = useCallback((stageId: string) => {
    setCompletedStages((prev: string[]) => {
      if (!prev.includes(stageId)) {
        return [...prev, stageId];
      }
      return prev;
    });
  }, []);

  const handleRowChange = useCallback((stage: Stage, rowId: string, field: string, value: string) => {
    if (stage === 'spec') {
      setSpecRows(prev => prev.map(row => {
        if (row.id !== rowId) return row;
        return { ...row, [field]: value };
      }));
    } else if (stage === 'invoice') {
      setInvoiceRows(prev => prev.map(row => {
        if (row.id !== rowId) return row;
        const updatedRow = { ...row, [field]: value } as InvoiceRow;
        
        // Recalculate totals
        const qty = parseFloat(String(field === 'quantity' ? value : updatedRow.quantity).replace(/\s/g, '').replace(/,/g, '.')) || 0;
        const price = parseFloat(String(field === 'price' ? value : updatedRow.price).replace(/\s/g, '').replace(/,/g, '.')) || 0;
        const discountStr = String(field === 'discount' ? value : updatedRow.discount || '');
        const isPercent = discountStr.includes('%');
        let dVal = parseFloat(discountStr) || 0;

        let pad = price;
        if (dVal > 0) {
          pad = isPercent ? price * (1 - dVal / 100) : Math.max(0, price - dVal);
        }

        updatedRow.priceAfterDiscount = pad.toFixed(2);
        updatedRow.totalBeforeDiscount = (qty * price).toFixed(2);
        updatedRow.total = (qty * pad).toFixed(2);

        return updatedRow;
      }));
    } else if (stage === 'estimate') {
      setEstimateRows(prev => prev.map(row => {
        if (row.id !== rowId) return row;
        const updatedRow = { ...row, [field]: value };

        if (field === 'price' || field === 'quantity' || field === 'clientPrice') {
          const q = parseFloat(String(updatedRow.quantity).replace(/\s/g, '').replace(/,/g, '.')) || 0;
          const p = parseFloat(String(field === 'costPrice' ? value : updatedRow.costPrice).replace(/\s/g, '').replace(/,/g, '.')) || 0;
          const cp = parseFloat(String(field === 'clientPrice' ? value : updatedRow.clientPrice).replace(/\s/g, '').replace(/,/g, '.')) || 0;
          
          updatedRow.costSum = (q * p).toFixed(2);
          updatedRow.clientSum = (q * cp).toFixed(2);
        }
        return updatedRow;
      }));
    }
  }, []);

  const toggleRowSelection = useCallback((id: string, isCellClick: boolean) => {
    setSelectedIds(prev => {
      const isSelected = prev.includes(id);
      if (isSelected) {
        if (!isCellClick && prev.length === 1) return prev;
        return prev.filter(rowId => rowId !== id);
      } else {
        if (prev.length === 0 && !isCellClick) return prev;
        return [...prev, id];
      }
    });
  }, []);

  const toggleSelectAllPage = useCallback((pageIds: string[]) => {
    if (pageIds.length === 0) return;
    const allSelected = pageIds.every(id => selectedIds.includes(id));
    
    setSelectedIds(prev => {
      if (allSelected) {
        return prev.filter(id => !pageIds.includes(id));
      } else {
        const next = [...prev];
        pageIds.forEach(id => {
          if (!next.includes(id)) {
            next.push(id);
          }
        });
        return next;
      }
    });
  }, [selectedIds]);

  const selectAllRows = useCallback(() => {
    let rows: { id: string }[] = [];
    switch (currentStage) {
      case 'spec': rows = specRows; break;
      case 'request': rows = requestRows; break;
      case 'invoice': rows = invoiceRows; break;
      case 'estimate': rows = estimateRows; break;
    }
    const allIds = rows.map(r => r.id);
    setSelectedIds(prev => {
      const next = [...prev];
      allIds.forEach(id => {
        if (!next.includes(id)) next.push(id);
      });
      return next;
    });
  }, [currentStage, specRows, requestRows, invoiceRows, estimateRows]);

  const deleteSelectedRows = useCallback(() => {
    if (selectedIds.length === 0) return;
    const idsToDelete = new Set(selectedIds);
    switch (currentStage) {
      case 'spec':
        setSpecRows(prev => prev.filter(r => !idsToDelete.has(r.id)));
        break;
      case 'request':
        setRequestRows(prev => prev.filter(r => !idsToDelete.has(r.id)));
        break;
      case 'invoice':
        setInvoiceRows(prev => prev.filter(r => !idsToDelete.has(r.id)));
        break;
      case 'estimate':
        setEstimateRows(prev => prev.filter(r => !idsToDelete.has(r.id)));
        break;
    }
    setSelectedIds([]);
    setIsOnlySelectedView(false);
  }, [selectedIds, currentStage]);

  return (
    <DataContext.Provider
      value={{
        projectName,
        setProjectName,
        specRows: sortedSpecRows,
        setSpecRows,
        invoiceRows: sortedInvoiceRows,
        setInvoiceRows,
        estimateRows: sortedEstimateRows,
        setEstimateRows,
        requestRows: sortedRequestRows,
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
        pdfGeometry,
        isMerged,
        toggleMerge,
        handleUnmerge,
        generateEstimate,
        estimateTotal,
        resetData,
        sortConfig,
        handleSort,
        groupRows,
        searchQuery,
        setSearchQuery,
        completedStages,
        completeStage,
        isDragging,
        setIsDragging,
        selectedIds,
        setSelectedIds,
        toggleRowSelection,
        toggleSelectAllPage,
        selectAllRows,
        deleteSelectedRows,
        currentPage,
        setCurrentPage,
        rowsPerPage,
        setRowsPerPage,
        isOnlySelectedView,
        setIsOnlySelectedView,
        handleRowChange,
        currentStage,
        setCurrentStage,
        getCurrentRows: () => {
          switch (currentStage) {
            case 'spec': return sortedSpecRows;
            case 'request': return sortedRequestRows;
            case 'invoice': return sortedInvoiceRows;
            case 'estimate': return sortedEstimateRows;
            default: return [];
          }
        }
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx || ctx === null) throw new Error('useData must be used within DataProvider');
  return ctx;
}
