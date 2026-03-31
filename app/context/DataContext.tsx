import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { toast } from 'sonner';
import { MaterialPosition, parseFile, autoDetectMapping, INVOICE_ALIASES, SPEC_ALIASES, mergeDuplicateMaterials, exportGeometryToXLSX } from '../utils/fileUtils';
import { parsePdfGeometry, PdfGeometry } from '../utils/pdfUtils';
import { Stage, FileStatus, UploadStatus } from '../types';

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

export function naturalSort(a: any, b: any): number {
  const as = String(a || '');
  const bs = String(b || '');
  const ax: (string | number)[] = [];
  const bx: (string | number)[] = [];

  as.replace(/(\d+)|(\D+)/g, (_, $1, $2) => {
    ax.push($1 ? parseInt($1, 10) : $2);
    return "";
  });
  bs.replace(/(\d+)|(\D+)/g, (_, $1, $2) => {
    bx.push($1 ? parseInt($1, 10) : $2);
    return "";
  });

  while (ax.length && bx.length) {
    const an = ax.shift()!;
    const bn = bx.shift()!;
    if (an !== bn) {
      if (typeof an === 'number' && typeof bn === 'number') {
        return an - bn;
      }
      return an > bn ? 1 : -1;
    }
  }
  return ax.length - bx.length;
}

export interface SpecRow extends MaterialPosition {
  id: string;
  fileId?: string;
  originalRowsIds?: string[];
  children?: SpecRow[];
  row_type?: 'WORK_TYPE' | 'LOCATION' | 'GROUP' | 'ITEM';
}

export const SPEC_COLUMNS = [
  { key: 'pos', label: '№', width: 60, align: 'center', sortable: false },
  { key: 'name', label: 'Наименование', width: 220 },
  { key: 'brand', label: 'Марка/Тип', width: 130 },
  { key: 'code', label: 'Код', width: 110 },
  { key: 'supplier', label: 'Поставщик', width: 140 },
  { key: 'unit', label: 'Ед.', width: 100, align: 'center' },
  { key: 'quantity', label: 'Кол-во', width: 100, type: 'number', align: 'right' },
  { key: 'mass', label: 'Масса 1 ед, кг', width: 120, type: 'number', align: 'right' },
  { key: 'note', label: 'Прим.', width: 180 },
];

export const SPEC_TARGET_FIELDS = [
  { key: 'pos', label: 'Позиция', required: true },
  { key: 'name', label: 'Наименование', required: true },
  { key: 'brand', label: 'Марка/Тип' },
  { key: 'code', label: 'Код продукции' },
  { key: 'supplier', label: 'Поставщик' },
  { key: 'unit', label: 'Единицы измерения' },
  { key: 'quantity', label: 'Количество' },
  { key: 'mass', label: 'Масса 1 ед, кг' },
  { key: 'note', label: 'Примечания' },
];

export interface InvoiceRow {
  id: string;
  fileId?: string;
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
  match_data?: {
    target_id: string | null;
    target_name: string | null;
    score: number;
    status: 'perfect' | 'warning' | 'none';
  };
  row_type?: 'WORK_TYPE' | 'LOCATION' | 'GROUP' | 'ITEM';
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
    pos: '',
    code: '',
    brand: '',
    name: '',
    quantity: '1',
    unit: 'шт',
    supplier: '',
    mass: '0',
    note: '',
    is_header: false,
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
  fileId?: string;
  workType: string;
  name: string;
  unit: string;
  quantity: string;
  costPrice: string;
  clientPrice: string;
  costSum: string;
  clientSum: string;
  supplier: string;
  row_type?: 'WORK_TYPE' | 'LOCATION' | 'GROUP' | 'ITEM';
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
  uploadStatuses: Record<string, UploadStatus>;
  setUploadStatuses: React.Dispatch<React.SetStateAction<Record<string, UploadStatus>>>;
  isResetConfirmOpen: boolean;
  setIsResetConfirmOpen: (isOpen: boolean) => void;
  resetProjectData: () => void;
  resetFileData: (fileName: string) => void;
  filesMap: Record<string, File>;
  setFilesMap: React.Dispatch<React.SetStateAction<Record<string, File>>>;
  handleFile: (files: FileList | File[], stage: string, forceAI?: boolean) => Promise<void>;
  reprocessAi: (fileName: string) => Promise<void>;
  removeFile: (fileName: string, nuclear?: boolean) => void;
  retryFile: (fileName: string, stage: Stage) => Promise<void>;
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
  handleRowChange: (stage: Stage, rowId: string, field: string, value: any) => void;
  currentStage: Stage;
  setCurrentStage: (stage: Stage) => void;
  getCurrentRows: () => any[];
  matchInvoiceToSpec: () => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [projectName, setProjectName] = useState('Новый проект #1');

  const [specRows, setSpecRows] = useState<SpecRow[]>(() => {
    try { const saved = localStorage.getItem('docok_specRows'); if (saved) return JSON.parse(saved); } catch (e) { }
    return [];
  });
  const [requestRows, setRequestRows] = useState<SpecRow[]>(() => {
    try { const saved = localStorage.getItem('docok_requestRows'); if (saved) return JSON.parse(saved); } catch (e) { }
    return [];
  });
  const [invoiceRows, setInvoiceRows] = useState<InvoiceRow[]>(() => {
    try { const saved = localStorage.getItem('docok_invoiceRows'); if (saved) return JSON.parse(saved); } catch (e) { }
    return [];
  });
  const [estimateRows, setEstimateRows] = useState<EstimateRow[]>(() => {
    try { const saved = localStorage.getItem('docok_estimateRows'); if (saved) return JSON.parse(saved); } catch (e) { }
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
  const [uploadStatuses, setUploadStatuses] = useState<Record<string, UploadStatus>>({});
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
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

  // Helper to sync status (and optionally other fields) with server
  const updateFileStatusOnServer = async (fileName: string, status: 'ok' | 'reset') => {
    try {
      await fetch(`http://localhost:8000/api/storage/files/${encodeURIComponent(fileName)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
    } catch (e) {
      console.error(`Failed to update status for ${fileName}:`, e);
    }
  };

  // Load files from storage on mount
  useEffect(() => {
    const fetchStorageFiles = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/storage/files');
        if (res.ok) {
          const files = await res.json();
          const restoredStatuses: Record<string, UploadStatus> = {};
          files.forEach((f: any) => {
            restoredStatuses[f.name] = {
              status: f.status === 'reset' ? 'reset' : 'Готово (Хранилище)',
              time: f.time,
              size: f.size,
              // Preserve cost and tokens from server
              cost: f.cost || 0,
              tokens: f.tokens || 0,
              estimated_cost: f.estimated_cost || 0,
              estimated_tokens: f.estimated_tokens || 0,
              model: f.model || '',
              method: f.method || '',
            };
          });
          setUploadStatuses(prev => ({ ...prev, ...restoredStatuses }));
        }
      } catch (e) {
        console.error('Failed to fetch storage files:', e);
      }
    };
    fetchStorageFiles();
  }, []);

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

  const parseMarkdownToRows = (md: string, stage: string, fileName: string) => {
    const lines = md.split('\n').filter(l => l.trim().length > 0);
    // Skip Markdown header (separator line is at index 1)
    const dataLines = lines.length >= 2 ? lines.slice(2) : [];

    if (stage === 'spec') {
      return dataLines.map(line => {
        const cols = line.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
        
        // Фильтр технической строки 1 | 2 | 3...
        if (cols[0] === '1' && cols[1] === '2' && (cols[2] === '3' || cols[3] === '4')) {
          return null;
        }

        return {
          id: genId(),
          fileId: fileName,
          pos: cols[0] || '',
          name: cols[1] || '',
          brand: cols[2] || '',
          code: cols[3] || '',
          supplier: cols[4] || '',
          unit: cols[5] || '',
          quantity: cols[6] || '',
          mass: cols[7] || '',
          note: cols[8] || '',
          is_header: !cols[6],
          originalRowsIds: [],
          children: []
        };
      }).filter(Boolean);
    } else {
      return dataLines.map(line => {
        const cols = line.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
        
        // Фильтр технической строки 1 | 2 | 3...
        if (cols[0] === '1' && cols[1] === '2' && (cols[2] === '3' || cols[3] === '4')) {
          return null;
        }

        const r = emptyInvoiceRow();
        r.fileId = fileName;
        r.documentName = fileName;
        // Basic mapping for Invoice from MD: 
        r.article = cols[0] || '';
        r.name = cols[1] || '';
        r.quantity = cols[2] || '1';
        r.unit = cols[3] || 'шт';
        r.price = cols[4] || '0';
        r.total = cols[5] || '0';
        return r;
      }).filter(Boolean);
    }
  };

  const handleFile = useCallback(async (files: FileList | File[], stage: string, forceAI: boolean = false) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    // Reset search filter so new rows are visible
    setSearchQuery('');

    const now = new Date();
    const currentTime = `${now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} | ${now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })}`;

    // Set all initial statuses to render instantly
    const initialStatuses: Record<string, any> = {};
    for (const f of fileArray) {
      initialStatuses[f.name] = { status: 'Ожидание...', time: currentTime, size: f.size };
    }
    setUploadStatuses((prev: any) => ({ ...prev, ...initialStatuses }));

    // Start async processing for all files concurrently
    fileArray.forEach(async (file) => {
      setUploadStatuses((prev: any) => ({ ...prev, [file.name]: { ...prev[file.name], status: 'Старт...' } }));

      let serverFilename = '';
      // Upload to physical storage
      try {
        const uploadData = new FormData();
        uploadData.append('file', file);
        const res = await fetch('http://localhost:8000/api/storage/upload', {
          method: 'POST',
          body: uploadData,
        });
        if (res.ok) {
          const resData = await res.json();
          serverFilename = resData.filename || '';
          if (resData.estimated_cost !== undefined || resData.estimated_tokens !== undefined) {
            setUploadStatuses((prev: any) => ({
              ...prev,
              [file.name]: {
                ...prev[file.name],
                ...(resData.estimated_cost !== undefined && { estimated_cost: resData.estimated_cost }),
                ...(resData.estimated_tokens !== undefined && { estimated_tokens: resData.estimated_tokens })
              }
            }));
          }

          // TK v1.6: Instant Markdown population
          if (resData.raw_markdown) {
            const instantRows = parseMarkdownToRows(resData.raw_markdown, stage, file.name);
            if (stage === 'spec') {
              setSpecRows(prev => [...prev, ...instantRows as SpecRow[]]);
            } else {
              setInvoiceRows(prev => [...prev, ...instantRows as InvoiceRow[]]);
            }
          }
        }
      } catch (e) {
        console.error('Failed to upload file to storage:', e);
      }

      const isPdfOrImage = !!file.name.match(/\.(pdf|png|jpe?g)$/i);
      const useAi = forceAI || isPdfOrImage;

      if (!useAi) {
        setUploadStatuses((prev: any) => ({
          ...prev,
          [file.name]: {
            ...prev[file.name],
            status: 'READY_MD',
            time: currentTime,
            method: 'MD_Instant'
          }
        }));
        // Sync status 'READY_MD' to server (was 'ok')
        updateFileStatusOnServer(file.name, 'READY_MD');
      } else if (useAi) {
        if (!yandexConfig.apiKey || !yandexConfig.catalogId) {
          setUploadStatuses((prev: any) => ({ ...prev, [file.name]: { ...prev[file.name], status: 'Ошибка', error: 'API Ключ или ID каталога не настроены', time: currentTime } }));
          return;
        }

        setUploadStatuses((prev: any) => ({ ...prev, [file.name]: { ...prev[file.name], status: 'Анализ ИИ...', time: currentTime } }));
        const formData = new FormData();
        formData.append('doc_type', stage); // СТРОГО ПЕРВЫМ!
        
        // Если файл уже на сервере в хранилище — используем его ID (disk_name)
        if (serverFilename) {
           formData.append('file_id', serverFilename);
        } else {
           formData.append('file', file);
        }

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

          const reader = res.body?.getReader();
          if (!reader) throw new Error('Поток недоступен');
          const decoder = new TextDecoder();
          let buffer = '';

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              let newlineIdx;
              while ((newlineIdx = buffer.indexOf('\n\n')) >= 0) {
                const packet = buffer.slice(0, newlineIdx).trim();
                buffer = buffer.slice(newlineIdx + 2);

                if (!packet.startsWith('data: ')) continue;

                const payloadStr = packet.slice(6);
                let payload;
                try {
                  payload = JSON.parse(payloadStr);
                } catch (e) {
                  console.error('Невалидный JSON пакет:', payloadStr);
                  continue;
                }

                if (payload.status === 'stage') {
                  setUploadStatuses((prev: any) => ({
                    ...prev,
                    [file.name]: { ...prev[file.name], current_step: payload.step || 'prep' }
                  }));
                } else if (payload.status === 'chunk') {
                  setUploadStatuses((prev: any) => ({
                    ...prev,
                    [file.name]: {
                      ...prev[file.name],
                      current_step: 'ai',
                      processed_count: payload.index,
                      total_chunks: payload.total
                    }
                  }));
                } else if (payload.status === 'error') {
                  throw new Error(payload.detail || 'Неизвестная ошибка ИИ');
                } else if (payload.status === 'final') {
                  const data = payload.data;
                  const tokens = data.usage?.total_tokens || 0;
                  const cost = data.cost || 0;

                  const strToNumOrBlank = (v: any) => {
                    if (v === undefined || v === null || v === '') return '';
                    const parsed = parseFloat(String(v).replace(/,/g, '.').replace(/\s/g, ''));
                    return isNaN(parsed) ? String(v) : String(parsed);
                  };

                  if (stage === 'spec') {
                    const aiRows: SpecRow[] = (data.items || []).map((item: any) => {
                      if (item.pos === 'ERROR') {
                        toast.error(`Ошибка в файле ${file.name}: ${item.name} (${item.note || 'Без описания'})`, { duration: 5000 });
                      }
                      return {
                        id: genId(),
                        fileId: file.name,
                        pos: item.pos || '',
                        name: item.name || '',
                        brand: item.brand || '',
                        code: item.code || item.article || '',
                        supplier: item.supplier || data.document?.metadata?.vendor || '',
                        unit: item.unit || 'шт',
                        quantity: item.is_header ? '' : (strToNumOrBlank(item.quantity) || '1'),
                        mass: item.is_header ? '' : (strToNumOrBlank(item.mass) || '0'),
                        note: item.note || (item.isUncertain ? 'Требует проверки' : ''),
                        is_header: item.row_type === 'LOCATION' || item.row_type === 'GROUP' || Boolean(item.is_header),
                        row_type: item.row_type || 'ITEM',
                        originalRowsIds: [],
                        children: []
                      };
                    });

                    setSpecRows((prev) => {
                      const filtered = prev.filter(r => r.fileId !== file.name);
                      return [...filtered, ...aiRows];
                    });
                    setBackupSpecRows((prev) => {
                      const filtered = prev.filter(r => r.fileId !== file.name);
                      return [...filtered, ...aiRows];
                    });
                    setIsMerged(false);
                  } else {
                    const aiRows: InvoiceRow[] = (data.items || []).map((item: any) => {
                      if (item.pos === 'ERROR') {
                        toast.error(`Ошибка в файле ${file.name}: ${item.name} (${item.note || 'Без описания'})`, { duration: 5000 });
                      }
                      const r = emptyInvoiceRow();
                      r.fileId = file.name;
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

                    setInvoiceRows((prev) => {
                      const filtered = prev.filter(r => r.fileId !== file.name);
                      return [...filtered, ...aiRows];
                    });
                  }

                  setUploadStatuses((prev: any) => ({
                    ...prev,
                    [file.name]: {
                      ...prev?.[file.name],
                      status: 'Готово (ИИ)',
                      time: currentTime,
                      current_step: 'final',
                      tokens,
                      cost,
                      model: data.model || '',
                      method: data.method || '',
                      chunks_report: data.chunks_report || []
                    }
                  }));
                  setFilesMap((prev: Record<string, File>) => ({ ...prev, [file.name]: file }));
                  // Sync status 'ok' to server
                  updateFileStatusOnServer(file.name, 'ok');
                }
              }
            }
          } finally {
            reader.cancel().catch(e => console.error('Не удалось закрыть поток:', e));
          }
        } catch (e: any) {
          console.error('AI Processing error:', e);
          setUploadStatuses((prev: any) => ({ ...prev, [file.name]: { ...prev[file.name], status: 'Ошибка', error: e.message, time: currentTime } }));
        }
      }
    }); // closes forEach

  }, [yandexConfig, updateFileStatusOnServer]);

  // Re-run AI processing on a file that already exists in filesMap
  const reprocessAi = useCallback(async (fileName: string) => {
    const file = filesMap[fileName];
    if (!file) return;
    await handleFile([file], currentStage, true);
  }, [filesMap, currentStage, handleFile]);

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

  const matchInvoiceToSpec = useCallback(async () => {
    if (invoiceRows.length === 0 || specRows.length === 0) return;
    try {
      const payload = {
        invoice_items: invoiceRows,
        spec_items: specRows
      };

      const res = await fetch('http://localhost:8000/api/match-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setInvoiceRows(data.invoice_items || []);
        toast.success('Сопоставление со спецификацией завершено');
      } else {
        throw new Error('Server returned an error');
      }
    } catch (e: any) {
      console.error('Match error:', e);
      toast.error('Ошибка при сопоставлении: ' + e.message);
    }
  }, [invoiceRows, specRows]);

  const resetData = useCallback((stage: Stage) => {
    switch (stage) {
      case 'spec': setSpecRows([]); break;
      case 'invoice': setInvoiceRows([]); break;
      case 'estimate': setEstimateRows([]); break;
      case 'request': setRequestRows([]); break;
    }
  }, []);

  const resetProjectData = useCallback(() => {
    setSpecRows([]);
    setInvoiceRows([]);
    setEstimateRows([]);
    setRequestRows([]);
    setCompletedStages([]);
    setSelectedIds([]);

    setUploadStatuses((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach(fileName => {
        if (!next[fileName].status.includes('Ошибка') && !next[fileName].status.includes('Старт')) {
          next[fileName] = { ...next[fileName], status: 'reset' };
          // Sync status 'reset' to server
          updateFileStatusOnServer(fileName, 'reset');
        }
      });
      return next;
    });

    setIsResetConfirmOpen(false);
    toast.success('Все данные таблиц сброшены. Файлы сохранены.');
  }, [updateFileStatusOnServer]);

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
    if (!config.key || !config.direction) {
      return result; // RETURN ORIGINAL FILE ORDER
    }

    return [...result].sort((a: any, b: any) => {
      let valA = a[config.key!];
      let valB = b[config.key!];

      if (config.key === 'pos') {
        return naturalSort(valA, valB) * (config.direction === 'asc' ? 1 : -1);
      }

      // Handle numbers
      const numA = parseFloat(String(valA).replace(/\s/g, '').replace(/,/g, '.'));
      const numB = parseFloat(String(valB).replace(/\s/g, '').replace(/,/g, '.'));

      if (!isNaN(Number(valA)) && !isNaN(Number(valB))) {
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

  // Helper: parse quantity to float
  const parseQtyNum = (val: unknown) => parseFloat(String(val).replace(/\s/g, '').replace(/,/g, '.')) || 0;

  const removeFile = useCallback((fileName: string, nuclear: boolean = false) => {
    // 1. Remove from uploadStatuses and filesMap
    setUploadStatuses(prev => {
      const next = { ...prev };
      delete next[fileName];
      return next;
    });
    setFilesMap(prev => {
      const next = { ...prev };
      delete next[fileName];
      return next;
    });

    // Delete from physical storage
    fetch(`http://localhost:8000/api/storage/files/${encodeURIComponent(fileName)}?nuclear=${nuclear}`, { method: 'DELETE' })
      .catch(e => console.error('Failed to delete file from storage:', e));

    // 2. Remove specRows (including cascade in merged groups)
    setSpecRows(prev => {
      const filtered: SpecRow[] = [];
      for (const row of prev) {
        if (row.children && row.children.length > 0) {
          // Merged group: filter children by fileId
          const keptChildren = row.children.filter((c: SpecRow) => c.fileId !== fileName);
          if (keptChildren.length === 0) {
            // All children removed — drop the parent too
            continue;
          }
          if (keptChildren.length === row.children.length) {
            // Nothing changed in this group
            filtered.push(row);
          } else {
            // Recalculate parent quantity as sum of remaining children
            const newQty = keptChildren.reduce((acc, c) => acc + parseQtyNum(c.quantity), 0);
            filtered.push({ ...row, children: keptChildren, quantity: String(newQty > 0 ? newQty : '') });
          }
        } else if (row.fileId !== fileName) {
          filtered.push(row);
        }
      }
      return filtered;
    });

    // 3. Remove requestRows
    setRequestRows(prev => prev.filter((r: SpecRow) => r.fileId !== fileName));

    // 4. Remove invoiceRows
    setInvoiceRows(prev => prev.filter((r: InvoiceRow) => r.fileId !== fileName));

    // 5. Remove estimateRows
    setEstimateRows(prev => prev.filter((r: EstimateRow) => r.fileId !== fileName));
  }, [setUploadStatuses, setFilesMap, setSpecRows, setRequestRows, setInvoiceRows, setEstimateRows]);

  const resetFileData = useCallback((fileName: string) => {
    // 1. Убираем сроки только из активной вкладки
    switch (currentStage) {
      case 'spec':
        setSpecRows(prev => prev.filter(r => r.fileId !== fileName));
        break;
      case 'invoice':
        setInvoiceRows(prev => prev.filter(r => r.fileId !== fileName));
        break;
      case 'estimate':
        setEstimateRows(prev => prev.filter(r => r.fileId !== fileName));
        break;
      case 'request':
        setRequestRows(prev => prev.filter(r => r.fileId !== fileName));
        break;
    }

    // 2. Выставляем статус сброса + пишем на бэк
    setUploadStatuses(prev => {
      const next = { ...prev };
      if (next[fileName]) {
        next[fileName] = { ...next[fileName], status: 'reset' };
      }
      return next;
    });

    updateFileStatusOnServer(fileName, 'reset');
    toast.success(`Данные файла ${fileName} сброшены для текущей вкладки.`);
  }, [currentStage, setSpecRows, setInvoiceRows, setEstimateRows, setRequestRows, setUploadStatuses, updateFileStatusOnServer]);

  const retryFile = useCallback(async (fileName: string, stage: Stage) => {
    const file = filesMap[fileName];
    if (!file) return;
    removeFile(fileName);
    await handleFile([file], stage, false);
    // handleFile will call updateFileStatusOnServer(fileName, 'ok') on success
  }, [filesMap, removeFile, handleFile]);

  const handleRowChange = useCallback((stage: Stage, rowId: string, field: string, value: any) => {
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
    let activeRows: { id: string, row_type?: string, is_header?: boolean, pos?: string }[] = [];
    if (currentStage === 'spec') activeRows = specRows as any;
    else if (currentStage === 'invoice') activeRows = invoiceRows;
    else if (currentStage === 'estimate') activeRows = estimateRows;
    else if (currentStage === 'request') activeRows = requestRows as any;

    let targetIds = [id];
    const idx = activeRows.findIndex(r => r.id === id);
    if (idx !== -1) {
      const row = activeRows[idx];
      const type = row.row_type || (row.is_header ? (row.pos === '§' ? 'LOCATION' : 'GROUP') : 'ITEM');
      if (type === 'WORK_TYPE' || type === 'LOCATION' || type === 'GROUP') {
        for (let i = idx + 1; i < activeRows.length; i++) {
          const nr = activeRows[i];
          const nType = nr.row_type || (nr.is_header ? (nr.pos === '§' ? 'LOCATION' : 'GROUP') : 'ITEM');
          if (type === 'WORK_TYPE' && nType === 'WORK_TYPE') break;
          if (type === 'LOCATION' && (nType === 'WORK_TYPE' || nType === 'LOCATION')) break;
          if (type === 'GROUP' && (nType === 'WORK_TYPE' || nType === 'LOCATION' || nType === 'GROUP')) break;
          targetIds.push(nr.id);
        }
      }
    }

    setSelectedIds(prev => {
      const isSelected = prev.includes(id);
      if (isSelected) {
        if (!isCellClick && prev.length === 1) return prev;
        return prev.filter(rowId => !targetIds.includes(rowId));
      } else {
        if (prev.length === 0 && !isCellClick) return prev;
        const next = [...prev];
        targetIds.forEach(tid => {
          if (!next.includes(tid)) next.push(tid);
        });
        return next;
      }
    });
  }, [currentStage, specRows, invoiceRows, estimateRows, requestRows]);

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
        isResetConfirmOpen,
        setIsResetConfirmOpen,
        resetProjectData,
        resetFileData,
        handleFile,
        removeFile,
        retryFile,
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
        },
        reprocessAi,
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
