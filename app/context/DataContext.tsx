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
  weight?: string;
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
  viewMode: 'original' | 'supplier' | 'merged';
  setViewMode: (mode: 'original' | 'supplier' | 'merged') => void;
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

  // Pipeline output
  displayRows: any[];
  totalProcessedCount: number;
  isPaginationActive: boolean;

  // Stage 6 additions
  activeHeaderIds: string[];
  setActiveHeaderIds: React.Dispatch<React.SetStateAction<string[]>>;
  getNavigatorTree: () => any[];
  keepSelectedRows: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [projectName, setProjectName] = useState(() => {
    try {
      const saved = localStorage.getItem('docok_projectName');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return 'Проект Торговый Центр "Галактика"';
  });

  useEffect(() => {
    localStorage.setItem('docok_projectName', JSON.stringify(projectName));
  }, [projectName]);

  const [specRows, setSpecRows] = useState<SpecRow[]>(() => {
    try {
      const saved = localStorage.getItem('docok_specRows');
      if (saved) {
        const rows = JSON.parse(saved);
        // Migrate cached rows: fix is_header/row_type inconsistencies
        return rows.map((r: any) => {
          // 1) Non-ITEM row_type must have is_header=true
          if (r.row_type && r.row_type !== 'ITEM' && !r.is_header) {
            return { ...r, is_header: true };
          }
          // 2) is_header=true but row_type missing or ITEM → force GROUP
          if (r.is_header && (!r.row_type || r.row_type === 'ITEM')) {
            return { ...r, row_type: 'GROUP' };
          }
          return r;
        });
      }
    } catch (e) {}
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

  const [searchQuery, setSearchQueryRaw] = useState('');
  const setSearchQuery = useCallback((q: string) => {
    setSearchQueryRaw(q);
    setCurrentPage(1);
  }, []);


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
  const [isDragging, setIsDragging] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [isOnlySelectedView, setIsOnlySelectedView] = useState(false);
  const [frozenSelectedIds, setFrozenSelectedIds] = useState<string[]>([]);

  // Простой переключатель фильтра «Выбранные»
  const toggleOnlySelectedView = useCallback((nextVal: boolean) => {
    setIsOnlySelectedView(nextVal);
    setCurrentPage(1); // Лечит баг с исчезновением таблицы
  }, []);



  const [currentStage, setCurrentStageRaw] = useState<Stage>('spec');
  const setCurrentStage = useCallback((stage: Stage) => {
    setCurrentStageRaw(stage);
    setSelectedIds([]); // Сбрасываем выборку при смене вкладок
    setIsOnlySelectedView(false); // Отключаем фильтр фокуса
  }, []);

  const [viewMode, setViewModeRaw] = useState<'original' | 'supplier' | 'merged'>('original');
  const setViewMode = useCallback((mode: 'original' | 'supplier' | 'merged') => {
    setViewModeRaw(mode);
    setCurrentPage(1); // Лечит прыжок пагинации
    setSelectedIds([]); // Сбрасываем выборку для чистоты ID
    setIsOnlySelectedView(false); // Отключаем фильтр фокуса
  }, []);




  // History & Navigator states
  const [history, setHistory] = useState<{ past: { stage: Stage, rows: any[] }[], future: { stage: Stage, rows: any[] }[] }>({ past: [], future: [] });
  const [activeHeaderIds, setActiveHeaderIds] = useState<string[]>([]);

  const pushHistory = useCallback((stage: Stage, rowsToSave: any[]) => {
    setHistory(prev => {
      const past = [...prev.past, { stage, rows: [...rowsToSave] }];
      if (past.length > 50) past.shift();
      return { past, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    setHistory(prev => {
      if (prev.past.length === 0) return prev;
      const newPast = [...prev.past];
      const snap = newPast.pop()!;
      let currentRows: any[] = [];
      if (snap.stage === 'spec') { currentRows = specRows; setSpecRows(snap.rows); }
      else if (snap.stage === 'request') { currentRows = requestRows; setRequestRows(snap.rows); }
      else if (snap.stage === 'invoice') { currentRows = invoiceRows; setInvoiceRows(snap.rows); }
      else if (snap.stage === 'estimate') { currentRows = estimateRows; setEstimateRows(snap.rows); }
      const newFuture = [{ stage: snap.stage, rows: [...currentRows] }, ...prev.future];
      return { past: newPast, future: newFuture };
    });
  }, [specRows, requestRows, invoiceRows, estimateRows]);

  const redo = useCallback(() => {
    setHistory(prev => {
      if (prev.future.length === 0) return prev;
      const newFuture = [...prev.future];
      const snap = newFuture.shift()!;
      let currentRows: any[] = [];
      if (snap.stage === 'spec') { currentRows = specRows; setSpecRows(snap.rows); }
      else if (snap.stage === 'request') { currentRows = requestRows; setRequestRows(snap.rows); }
      else if (snap.stage === 'invoice') { currentRows = invoiceRows; setInvoiceRows(snap.rows); }
      else if (snap.stage === 'estimate') { currentRows = estimateRows; setEstimateRows(snap.rows); }
      const newPast = [...prev.past, { stage: snap.stage, rows: [...currentRows] }];
      return { past: newPast, future: newFuture };
    });
  }, [specRows, requestRows, invoiceRows, estimateRows]);

  const handleUnmerge = useCallback((parentId: string, childId: string) => {
    // Current logic: unmerging in non-destructive view mode could mean 'ignoring' this sub-item?
    // For now, it's a stub or we just don't offer it in merged view if it complicates things.
    console.log(`Unmerge ${childId} from ${parentId}`);
  }, []);

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

        const name = cols[1] || '';
        const pos = cols[0] || '';
        const unit = cols[5] || '';
        const quantity = cols[6] || '';
        
        // Initial detection of row type
        const is_header = !quantity;
        let row_type = is_header ? 'GROUP' : 'ITEM'; // Default: no-quantity = GROUP

        if (is_header) {
          if (!pos && name === name.toUpperCase() && name.length > 3) {
            row_type = 'WORK_TYPE';
          } else if (pos === '§') {
            row_type = 'LOCATION';
          }
          // Everything else with is_header stays GROUP (the default)
        }

        return {
          id: genId(),
          fileId: fileName,
          pos,
          name,
          brand: cols[2] || '',
          code: cols[3] || '',
          supplier: cols[4] || '',
          unit,
          quantity,
          mass: cols[7] || '',
          note: cols[8] || '',
          row_type,
          is_header,
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
                        is_header: item.row_type === 'WORK_TYPE' || item.row_type === 'LOCATION' || item.row_type === 'GROUP' || Boolean(item.is_header),
                        row_type: item.row_type || 'ITEM',
                        originalRowsIds: [],
                        children: []
                      };
                    });

                      setSpecRows((prev) => {
                        const filtered = prev.filter(r => r.fileId !== file.name);
                        return [...filtered, ...aiRows];
                      });
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
    setActiveHeaderIds([]);
  }, []);

  const resetProjectData = useCallback(() => {
    setSpecRows([]);
    setInvoiceRows([]);
    setEstimateRows([]);
    setRequestRows([]);
    setCompletedStages([]);
    setSelectedIds([]);
    setActiveHeaderIds([]);

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

  const applySortAndFilter = <T extends { id: string }>(rows: T[], config: SortConfig, query: string, searchFields: string[]): T[] => {
    let result = rows;

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

      // Smart Sorting: Empty values always at the bottom
      const isEmptyA = valA === undefined || valA === null || valA === '';
      const isEmptyB = valB === undefined || valB === null || valB === '';
      if (isEmptyA && !isEmptyB) return 1;
      if (!isEmptyA && isEmptyB) return -1;
      if (isEmptyA && isEmptyB) return 0;

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
    applySortAndFilter(specRows, sortConfig, searchQuery, ['name', 'code', 'supplier']),
    [specRows, sortConfig, searchQuery]
  );
  const sortedRequestRows = React.useMemo(() =>
    applySortAndFilter(requestRows, sortConfig, searchQuery, ['name', 'code', 'supplier']),
    [requestRows, sortConfig, searchQuery]
  );
  const sortedInvoiceRows = React.useMemo(() =>
    applySortAndFilter(invoiceRows, sortConfig, searchQuery, ['name', 'article', 'supplier']),
    [invoiceRows, sortConfig, searchQuery]
  );
  const sortedEstimateRows = React.useMemo(() =>
    applySortAndFilter(estimateRows, sortConfig, searchQuery, ['name', 'workType', 'supplier']),
    [estimateRows, sortConfig, searchQuery]
  );


  const groupRows = useCallback((stage: Stage, field: string) => {
    // Базовая заглушка: просто логируем, так как сложная группировка требует UI-состояния
    console.log(`Grouping ${stage} by ${field}`);
  }, []);

  const generateStableId = (prefix: string, seed: string) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        const char = seed.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return `${prefix}_${Math.abs(hash)}`;
  };

  const getMergedRows = useCallback((items: SpecRow[]) => {
    const onlyItems = items.filter(r => !r.is_header && r.row_type !== 'WORK_TYPE' && r.row_type !== 'LOCATION' && r.row_type !== 'GROUP');
    const map = new Map<string, SpecRow[]>();

    // 1. Сначала просто группируем все строки по отпечатку
    onlyItems.forEach(item => {
      const fingerprint = `${item.name}|${item.brand}|${item.code}`.toLowerCase().trim();
      if (!map.has(fingerprint)) map.set(fingerprint, []);
      map.get(fingerprint)!.push(item);
    });

    const finalRows: SpecRow[] = [];

    // 2. Затем формируем временный список для сортировки
    const rawResult: SpecRow[] = [];
    for (const [fingerprint, group] of map.entries()) {
      // Детерминированный ID: на основе данных, без хеширования
      const namePart = String(group[0].name || '').trim();
      const brandPart = String(group[0].brand || '').trim();
      const codePart = String(group[0].code || '').trim();
      const stableId = `merged_${namePart}_${brandPart}_${codePart}`.trim();


      if (group.length === 1) {
        rawResult.push({ ...group[0], id: stableId });
      } else {
        const base = { ...group[0] };
        base.id = stableId;
        base.children = [];
        
        let sumQ = 0;
        let sumW = 0;
        const notes = new Set<string>();

        group.forEach(item => {
          const q = parseFloat(String(item.quantity).replace(/\s/g, '').replace(/,/g, '.')) || 0;
          sumQ += q;
          const itemWeight = item.weight || item.mass || 0;
          const w = parseFloat(String(itemWeight).replace(/\s/g, '').replace(/,/g, '.')) || 0;
          sumW += w;
          if (item.note) {
            item.note.split(';').forEach(n => {
              const trimmed = n.trim();
              if (trimmed) notes.add(trimmed);
            });
          }
          base.children!.push({ ...item });
        });

        base.quantity = sumQ.toString();
        if (Number(base.quantity) % 1 !== 0) {
          base.quantity = Number(base.quantity).toFixed(2);
        }
        if (sumW > 0) base.mass = sumW.toFixed(2);
        base.note = Array.from(notes).join('; ');
        
        // Очистка имени от возможных старых счетчиков
        base.name = base.name.replace(/\s*\(\d+\s*шт\.\)\s*$/, '').replace(/\s*\[\d+\]\s*$/, '').trim();
        
        rawResult.push(base);
      }
    }

    // 3. Сортировка по алфавиту (A-Z, А-Я)
    rawResult.sort((a, b) => a.name.localeCompare(b.name, 'ru'));

    // 4. Присвоение иерархических номеров (N и N.M)
    rawResult.forEach((row, idx) => {
      const mainNum = idx + 1;
      row.pos = mainNum.toString();

      if (row.children && row.children.length > 1) {
        row.children.forEach((child, cIdx) => {
          child.pos = `${mainNum}.${cIdx + 1}`;
        });
      }
      finalRows.push(row);
    });

    return finalRows;
  }, []);

  const getSupplierRows = useCallback((items: SpecRow[]) => {
    const onlyItems = items.filter(r => !r.is_header);
    const map = new Map<string, { id: string; name: string; is_header: boolean; row_type: string; quantity: string; children: any[]; names: string[] }>();

    onlyItems.forEach(item => {
      const rawSupplier = (item.supplier || '').trim();
      const sKey = rawSupplier.toLowerCase() || 'без поставщика';
      
      if (map.has(sKey)) {
        const existing = map.get(sKey)!;
        const q1 = parseFloat(String(existing.quantity).replace(/\s/g, '').replace(/,/g, '.')) || 0;
        const q2 = parseFloat(String(item.quantity).replace(/\s/g, '').replace(/,/g, '.')) || 0;
        existing.quantity = String(q1 + q2);
        existing.children.push(item);
        if (rawSupplier) existing.names.push(rawSupplier);
      } else {
        // Use 'supplier_header_[name]' pattern for stable, predictable supplier header IDs
        const safeId = `supplier_header_${sKey}`;
        map.set(sKey, { 
          id: safeId, 
          name: rawSupplier || 'БЕЗ ПОСТАВЩИКА', 
          is_header: true, 
          row_type: 'LOCATION', // Elevated to LOCATION for full-width rendering
          quantity: item.quantity,
          children: [item],
          names: rawSupplier ? [rawSupplier] : []
        });
      }
    });

    const result = Array.from(map.values()).map(group => {
      // Pick the "nicest" name (e.g. one starting with uppercase)
      if (group.names.length > 0) {
        const niceName = group.names.find(n => /^[A-ZА-ЯЁ]/.test(n)) || group.names[0];
        group.name = niceName;
      }
      // Sequential numbering per supplier group
      let posCounter = 1;
      group.children = group.children.map((child: any) => ({
        ...child,
        pos: String(posCounter++)
      }));
      return group;
    });

    // Sort: "БЕЗ ПОСТАВЩИКА" always last
    return result.sort((a, b) => {
      if (a.name === 'БЕЗ ПОСТАВЩИКА') return 1;
      if (b.name === 'БЕЗ ПОСТАВЩИКА') return -1;
      return a.name.localeCompare(b.name, 'ru');
    });
  }, []);

  const estimateTotal = React.useMemo(() => {
    const cost = estimateRows.reduce((acc: number, row: EstimateRow) => acc + (parseFloat(String(row.costSum).replace(/\s/g, '').replace(/,/g, '.')) || 0), 0);
    const client = estimateRows.reduce((acc: number, row: EstimateRow) => acc + (parseFloat(String(row.clientSum).replace(/\s/g, '').replace(/,/g, '.')) || 0), 0);
    return {
      cost: cost.toLocaleString('ru-RU'),
      client: client.toLocaleString('ru-RU')
    };
  }, [estimateRows]);

  // ─── Pure pipeline helpers ──────────────────────────────────────────────────

  /** Шаг 2a: Иерархический фильтр навигатора для original/merged режимов */
  const applyNavigatorFilter = (rows: any[], ids: string[]): any[] => {
    const result: any[] = [];
    let isInsideActiveGroup = false;
    let activeLevel = -1;
    for (const r of rows) {
      if (r.is_header) {
        const type = r.row_type || 'GROUP';
        const level = type === 'WORK_TYPE' ? 0 : type === 'LOCATION' ? 1 : 2;
        if (ids.includes(r.id)) {
          isInsideActiveGroup = true;
          activeLevel = level;
          result.push(r);
        } else if (isInsideActiveGroup && level > activeLevel) {
          result.push(r);
        } else {
          isInsideActiveGroup = false;
          activeLevel = -1;
        }
      } else {
        if (isInsideActiveGroup) result.push(r);
      }
    }
    return result;
  };

  /** Шаг 2б: Поиск по тексту с сохранением родительских заголовков */
  const applyHierarchySearchFilter = (rows: any[], query: string): any[] => {
    const q = query.trim().toLowerCase();
    const keepStatus = new Set<string>();
    let activeL0: string | null = null;
    let activeL1: string | null = null;
    let activeL2: string | null = null;
    for (const r of rows) {
      const type = r.row_type || (r.is_header ? 'GROUP' : 'ITEM');
      if (type === 'WORK_TYPE') { activeL0 = r.id; activeL1 = null; activeL2 = null; }
      else if (type === 'LOCATION') { activeL1 = r.id; activeL2 = null; }
      else if (type === 'GROUP') { activeL2 = r.id; }
      else {
        const name = String(r.name || '').toLowerCase();
        const code = String(r.code || '').toLowerCase();
        const note = String(r.note || '').toLowerCase();
        const supplier = String(r.supplier || '').toLowerCase();
        if (name.includes(q) || code.includes(q) || note.includes(q) || supplier.includes(q)) {
          keepStatus.add(r.id);
          if (activeL0) keepStatus.add(activeL0);
          if (activeL1) keepStatus.add(activeL1);
          if (activeL2) keepStatus.add(activeL2);
        }
      }
    }
    return rows.filter(r => keepStatus.has(r.id));
  };

  /** Шаг 3: Фильтр «Только выбранные» — сохраняет структурные заголовки */
  const applySelectedFilter = (rows: any[], frozenIds: string[]): any[] => {
    const keepStatus = new Set<string>();
    let activeL0: string | null = null;
    let activeL1: string | null = null;
    let activeL2: string | null = null;
    for (const r of rows) {
      const type = r.row_type || (r.is_header ? 'GROUP' : 'ITEM');
      if (type === 'WORK_TYPE') { activeL0 = r.id; activeL1 = null; activeL2 = null; }
      else if (type === 'LOCATION') { activeL1 = r.id; activeL2 = null; }
      else if (type === 'GROUP') { activeL2 = r.id; }
      else if (frozenIds.includes(r.id)) {
        keepStatus.add(r.id);
        if (activeL0) keepStatus.add(activeL0);
        if (activeL1) keepStatus.add(activeL1);
        if (activeL2) keepStatus.add(activeL2);
      }
    }
    return rows.filter(r => r.is_header ? keepStatus.has(r.id) : frozenIds.includes(r.id));
  };

  // ─── Мемоизированный конвейер данных (Stage 10) ──────────────────────────
  const isActuallyEmpty = (r: any): boolean => {
    // Если это заголовок, но у него пустое имя — это «фантомный» заголовок
    if (r.is_header && (!r.name || !r.name.trim())) return true;

    const fieldsToCheck = [
      'pos', 'name', 'brand', 'model', 'type', 'code', 'article', 
      'supplier', 'unit', 'quantity', 'mass', 'weight', 'note', 'comment'
    ];
    
    // Значения, которые не считаются «контентом», если в строке нет ничего другого
    const weakValues = new Set(['1', 'шт', '0', '0.00', '0,00', 'шт.', 'ед.', '0.0', '0,0']);

    return !fieldsToCheck.some(f => {
      const val = r[f];
      if (val === undefined || val === null) return false;
      const str = String(val).trim();
      if (str.length === 0) return false;
      // Если значение «слабое» — оно само по себе не делает строку непустой
      if (weakValues.has(str.toLowerCase())) return false;
      return true;
    });
  };


  const dataPipeline = React.useMemo(() => {
    // 1. БАЗА + ТЕКСТОВЫЙ ПОИСК
    let rawRows: any[] = [];
    if (currentStage === 'spec') rawRows = sortedSpecRows;
    else if (currentStage === 'request') rawRows = sortedRequestRows;
    else if (currentStage === 'invoice') rawRows = sortedInvoiceRows;
    else if (currentStage === 'estimate') rawRows = sortedEstimateRows;

    // ГЛОБАЛЬНАЯ ОЧИСТКА ПУСТЫХ СТРОК (Stage 12)
    // Убираем строки, в которых абсолютно все колонки пустые
    let result = rawRows.filter(r => !isActuallyEmpty(r));

    if (searchQuery && searchQuery.trim()) {
      result = applyHierarchySearchFilter(result, searchQuery);
    }

    // 2. ФИЛЬТР НАВИГАТОРА (Только для режима original!)
    // Для режима supplier этот фильтр должен сработать ПОСЛЕ трансформации (Step 3), 
    // так как заголовки поставщиков создаются динамически.
    if (currentStage === 'spec' && viewMode === 'original' && activeHeaderIds.length > 0) {
      result = applyNavigatorFilter(result, activeHeaderIds);
    }

    // 3. ТРАНСФОРМАЦИЯ (Группировка)
    if (currentStage === 'spec') {
      if (viewMode === 'merged') {
        result = getMergedRows(result as SpecRow[]);
      } else if (viewMode === 'supplier') {
        result = getSupplierRows(result as SpecRow[]);
        // Фильтр навигатора для ПОСТАВЩИКОВ (срабатывает после их создания)
        if (activeHeaderIds.length > 0) {
          result = result.filter(group => activeHeaderIds.includes(group.id));
        }
      }
    }


    // ВАЖНО: Захватываем ID всех строк текущего режима ДО применения фильтра «Только выделенные»
    // В режиме поставщиков собираем и ID заголовков, и ID всех товаров внутри них.
    const selectableIdsForMode = viewMode === 'supplier'
      ? result.flatMap(group => [group.id, ...(group.children?.map((c: any) => c.id) || [])])
      : result.map(r => r.id);

    // 4. ФИЛЬТР ЧЕКБОКСОВ
    // Теперь selectedIds гарантированно содержит ID из текущего режима (original/merged/supplier)
    if (isOnlySelectedView && selectedIds.length > 0) {
      if (viewMode === 'supplier') {
        // Иерархический фильтр для режима поставщиков
        result = result.map(group => {
          const isGroupSelected = selectedIds.includes(group.id);
          const selectedChildren = group.children?.filter((c: any) => selectedIds.includes(c.id)) || [];
          
          if (isGroupSelected || selectedChildren.length > 0) {
            return {
              ...group,
              // Если выбран сам поставщик — оставляем всех детей. Если нет — только выбранных.
              children: isGroupSelected ? group.children : selectedChildren
            };
          }
          return null;
        }).filter(Boolean);
      } else {
        // Умный фильтр для original/merged (убирает пустые заголовки)
        const keepHeaderIds = new Set<string>();
        let activeL0: string | null = null;
        let activeL1: string | null = null;
        let activeL2: string | null = null;

        // Пасс 1: Ищем заголовки, у которых есть выбранные дети
        for (const r of result) {
          const type = r.row_type || (r.is_header ? 'GROUP' : 'ITEM');
          if (type === 'WORK_TYPE') { activeL0 = r.id; activeL1 = null; activeL2 = null; }
          else if (type === 'LOCATION') { activeL1 = r.id; activeL2 = null; }
          else if (type === 'GROUP') { activeL2 = r.id; }
          
          if (selectedIds.includes(r.id)) {
            if (activeL0) keepHeaderIds.add(activeL0);
            if (activeL1) keepHeaderIds.add(activeL1);
            if (activeL2) keepHeaderIds.add(activeL2);
          }
        }

        // Пасс 2: Фильтруем
        result = result.filter(r => 
          selectedIds.includes(r.id) || 
          (r.is_header && keepHeaderIds.has(r.id))
        );
      }
    }



    // 5. ИТОГ И ПАГИНАЦИЯ
    // Подсчет только ЗНАЧИМЫХ позиций (товаров) для отображения в футере и навигации.
    // Убираем из счета заголовки видов работ, мест, групп и названия поставщиков.
    const totalProcessedCount = viewMode === 'supplier'
      ? result.reduce((acc, group) => acc + (group.children?.length || 0), 0)
      : result.filter(r => !r.is_header).length;

    let displayRows = result;

    if (currentStage === 'spec' && viewMode === 'merged') {
      const startIndex = (currentPage - 1) * rowsPerPage;
      displayRows = result.slice(startIndex, startIndex + rowsPerPage);
    }

    const isPaginationActive = currentStage === 'spec' && viewMode === 'merged';
    return { displayRows, totalProcessedCount, isPaginationActive, selectableIdsForMode };
  }, [
    currentStage, viewMode,
    sortedSpecRows, sortedRequestRows, sortedInvoiceRows, sortedEstimateRows,
    activeHeaderIds, isOnlySelectedView, selectedIds, searchQuery,
    currentPage, rowsPerPage,
    getMergedRows, getSupplierRows,
  ]);

  const { displayRows, totalProcessedCount, isPaginationActive, selectableIdsForMode } = dataPipeline;

  // ШАГ 6: Вычисляем количество ВЫБРАННЫХ ПОЗИЦИЙ (без учета заголовков)
  const selectedItemsCount = React.useMemo(() => {
    if (selectedIds.length === 0) return 0;
    
    // Собираем все текущие ряды (оригинальные) для быстрой проверки типа
    const allBaseRows = [...specRows, ...invoiceRows, ...estimateRows, ...requestRows];
    const headerIds = new Set(allBaseRows.filter(r => r.is_header).map(r => r.id));

    return selectedIds.filter(id => {
      // 1. Заголовки поставщиков — не считаем за позиции
      if (id.startsWith('supplier_')) return false;
      // 2. Оригинальные заголовки (Виды работ, места и т.д.) — не считаем
      if (headerIds.has(id)) return false;
      // 3. Все остальное (ITEM, merged_...) — это позиции
      return true;
    }).length;
  }, [selectedIds, specRows, invoiceRows, estimateRows, requestRows]);



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
    let targetIds = [id];

    // ШАГ 1: Обработка групп в режимах «Поставщики» и «Сводная»
    const isModeGroup = id.startsWith('supplier_') || id.startsWith('merged_');
    if (isModeGroup) {
      const g = displayRows.find(r => r.id === id);
      if (g && g.children) {
        g.children.forEach((c: any) => targetIds.push(c.id));
      }
    } else {
      // ШАГ 2: Обработка иерархии в режиме «Оригинал» (по плоскому списку)
      let activeRows: { id: string, row_type?: string, is_header?: boolean, pos?: string }[] = [];
      if (currentStage === 'spec') activeRows = specRows as any;
      else if (currentStage === 'invoice') activeRows = invoiceRows;
      else if (currentStage === 'estimate') activeRows = estimateRows;
      else if (currentStage === 'request') activeRows = requestRows as any;

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
  }, [currentStage, specRows, invoiceRows, estimateRows, requestRows, displayRows]);


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
    setSelectedIds(selectableIdsForMode);
  }, [selectableIdsForMode]);

  const deleteSelectedRows = useCallback(() => {
    if (selectedIds.length === 0) return;
    
    let baseRows: any[] = [];
    if (currentStage === 'spec') baseRows = specRows;
    else if (currentStage === 'request') baseRows = requestRows;
    else if (currentStage === 'invoice') baseRows = invoiceRows;
    else if (currentStage === 'estimate') baseRows = estimateRows;
    
    pushHistory(currentStage, baseRows);
    
    // ШАГ 4: Разрешение реальных ID из сводных строк
    const idsToDelete = new Set<string>();
    selectedIds.forEach(id => {
      if (id.startsWith('merged_') || id.startsWith('supplier_')) {
        const summaryRow = displayRows.find(r => r.id === id);
        if (summaryRow && summaryRow.children) {
          summaryRow.children.forEach((c: any) => idsToDelete.add(c.id));
        }
      } else {
        idsToDelete.add(id);
      }
    });

    let deleteStateL0 = false;
    let deleteStateL1 = false;
    let deleteStateL2 = false;

    const newRows = baseRows.filter(r => {
      const type = r.row_type || (r.is_header ? 'GROUP' : 'ITEM');
      if (type === 'WORK_TYPE') {
         deleteStateL0 = idsToDelete.has(r.id);
         deleteStateL1 = false;
         deleteStateL2 = false;
         return !deleteStateL0;
      }
      if (type === 'LOCATION') {
         deleteStateL1 = idsToDelete.has(r.id);
         deleteStateL2 = false;
         return !(deleteStateL0 || deleteStateL1);
      }
      if (type === 'GROUP') {
         deleteStateL2 = idsToDelete.has(r.id);
         return !(deleteStateL0 || deleteStateL1 || deleteStateL2);
      }
      return !(deleteStateL0 || deleteStateL1 || deleteStateL2 || idsToDelete.has(r.id));
    });

    if (currentStage === 'spec') setSpecRows(newRows);
    else if (currentStage === 'request') setRequestRows(newRows);
    else if (currentStage === 'invoice') setInvoiceRows(newRows);
    else if (currentStage === 'estimate') setEstimateRows(newRows);

    setSelectedIds([]);
    setIsOnlySelectedView(false);
  }, [selectedIds, currentStage, specRows, requestRows, invoiceRows, estimateRows, displayRows, pushHistory]);


  const keepSelectedRows = useCallback(() => {
    if (selectedIds.length === 0) return;
    
    let baseRows: any[] = [];
    if (currentStage === 'spec') baseRows = specRows;
    else if (currentStage === 'request') baseRows = requestRows;
    else if (currentStage === 'invoice') baseRows = invoiceRows;
    else if (currentStage === 'estimate') baseRows = estimateRows;

    pushHistory(currentStage, baseRows);

    // ШАГ 4: Разрешение реальных ID из сводных строк
    const idsToKeep = new Set<string>();
    selectedIds.forEach(id => {
      if (id.startsWith('merged_') || id.startsWith('supplier_')) {
        const summaryRow = displayRows.find(r => r.id === id);
        if (summaryRow && summaryRow.children) {
          summaryRow.children.forEach((c: any) => idsToKeep.add(c.id));
        }
      } else {
        idsToKeep.add(id);
      }
    });

    const keepStatus = new Map<string, boolean>();
    let activeL0: string | null = null;
    let activeL1: string | null = null;
    let activeL2: string | null = null;
    let keepL0 = false;
    let keepL1 = false;
    let keepL2 = false;

    for (const r of baseRows) {
      const type = r.row_type || (r.is_header ? 'GROUP' : 'ITEM');
      if (type === 'WORK_TYPE') {
         activeL0 = r.id; activeL1 = null; activeL2 = null;
         keepL0 = idsToKeep.has(r.id);
         keepL1 = false; keepL2 = false;
      } else if (type === 'LOCATION') {
         activeL1 = r.id; activeL2 = null;
         keepL1 = idsToKeep.has(r.id);
         keepL2 = false;
      } else if (type === 'GROUP') {
         activeL2 = r.id;
         keepL2 = idsToKeep.has(r.id);
      }
      
      const explicitlySelected = idsToKeep.has(r.id);
      const implicitlySelected = keepL0 || keepL1 || keepL2;
      
      if (explicitlySelected || implicitlySelected) {
         keepStatus.set(r.id, true);
         if (activeL0) keepStatus.set(activeL0, true);
         if (activeL1) keepStatus.set(activeL1, true);
         if (activeL2) keepStatus.set(activeL2, true);
      }
    }

    const newRows = baseRows.filter(r => keepStatus.has(r.id));

    if (currentStage === 'spec') setSpecRows(newRows);
    else if (currentStage === 'request') setRequestRows(newRows);
    else if (currentStage === 'invoice') setInvoiceRows(newRows);
    else if (currentStage === 'estimate') setEstimateRows(newRows);

    setSelectedIds([]);
    setIsOnlySelectedView(false);
  }, [selectedIds, currentStage, specRows, requestRows, invoiceRows, estimateRows, displayRows, pushHistory]);


  const getNavigatorTree = useCallback(() => {
    let baseRows: any[] = [];
    if (currentStage === 'spec') baseRows = specRows;
    else if (currentStage === 'request') baseRows = requestRows;
    else if (currentStage === 'invoice') baseRows = invoiceRows;
    else if (currentStage === 'estimate') baseRows = estimateRows;

    // Merged view has no section hierarchy to navigate
    if (viewMode === 'merged') return [];

    if (viewMode === 'supplier') {
      const grouped = getSupplierRows(baseRows);
      return grouped.map((r: any) => ({ id: r.id, name: r.name, row_type: 'SUPPLIER', children: [] as any[] }));
    }

    const tree: any[] = [];
    let currentL0: any = null;
    let currentL1: any = null;

    baseRows.forEach(r => {
      // Use row_type as primary signal — robust regardless of is_header value in cached data
      const type = r.row_type;
      if (!type || type === 'ITEM') return;
      // Skip rows with empty or blank names
      if (!r.name || !r.name.trim()) return;

      const node = { id: r.id, name: r.name.trim(), row_type: type, children: [] as any[] };
      if (type === 'WORK_TYPE') {
        currentL0 = node;
        currentL1 = null;
        tree.push(node);
      } else if (type === 'LOCATION') {
        currentL1 = node;
        if (currentL0) currentL0.children.push(node);
        else tree.push(node);
      } else if (type === 'GROUP') {
        if (currentL1) currentL1.children.push(node);
        else if (currentL0) currentL0.children.push(node);
        else tree.push(node);
      }
    });
    return tree;
  }, [currentStage, viewMode, specRows, requestRows, invoiceRows, estimateRows, getSupplierRows]);


  // Обратная совместимость: getCurrentRows возвращает displayRows из pipeline
  const getCurrentRows = useCallback(() => dataPipeline.displayRows, [dataPipeline]);

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
        viewMode,
        setViewMode,
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
        setIsOnlySelectedView: toggleOnlySelectedView,
        handleRowChange,
        currentStage,
        setCurrentStage,
        getCurrentRows,
        displayRows,
        totalProcessedCount,
        selectedItemsCount,
        isPaginationActive,
        reprocessAi,
        matchInvoiceToSpec,
        activeHeaderIds,
        setActiveHeaderIds,
        getNavigatorTree,
        keepSelectedRows,
        undo,
        redo,
        canUndo: history.past.length > 0,
        canRedo: history.future.length > 0,
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
