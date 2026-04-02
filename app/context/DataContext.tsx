import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
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

export interface Category {
  id: string;
  label: string;
  icon: string;
  count: number;
  type?: 'system' | 'custom';
}

export type ProjectStatus = 'current' | 'active' | 'archive' | 'tender';

export interface Project {
  id: string;
  title: string;
  filesCount: number;
  lastModified: string;
  createdAt: string;
  progress: number;
  status: ProjectStatus;
  categoryId: string;
  version?: string;
  // Dynamic rows persistence
  specRows?: SpecRow[];
  requestRows?: SpecRow[];
  invoiceRows?: InvoiceRow[];
  estimateRows?: EstimateRow[];
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

function getSortPriority(s: string): number {
  if (!s) return 4;
  // Игнорируем спецсимволы в начале для определения приоритета
  const clean = s.replace(/^[^a-zA-Zа-яА-ЯёЁ0-9]+/, '');
  if (!clean) return 4;
  const first = clean[0];
  if (/[0-9]/.test(first)) return 1;
  if (/[а-яА-ЯёЁ]/.test(first)) return 2;
  if (/[a-zA-Z]/.test(first)) return 3;
  return 4;
}

export function priorityCompare(a: string, b: string, dir: 'asc' | 'desc' = 'asc'): number {
  const pA = getSortPriority(a);
  const pB = getSortPriority(b);
  if (pA !== pB) return (pA - pB) * (dir === 'asc' ? 1 : -1);

  const cleanA = a.replace(/^[^a-zA-Zа-яА-ЯёЁ0-9]+/, '');
  const cleanB = b.replace(/^[^a-zA-Zа-яА-ЯёЁ0-9]+/, '');
  return cleanA.localeCompare(cleanB, 'ru') * (dir === 'asc' ? 1 : -1);
}

export const applySortAndFilter = <T extends { id: string }>(rows: T[], config: SortConfig, query: string, searchFields: string[]): T[] => {
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

    if (!isNaN(numA) && !isNaN(numB)) {
      return config.direction === 'asc' ? numA - numB : numB - numA;
    }

    // Handle strings with priority: Digital -> RU -> EN
    const strA = String(valA || '');
    const strB = String(valB || '');
    
    const pA = getSortPriority(strA);
    const pB = getSortPriority(strB);

    if (pA !== pB) {
      return (pA - pB) * (config.direction === 'asc' ? 1 : -1);
    }

    const cleanA = strA.replace(/^[^a-zA-Zа-яА-ЯёЁ0-9]+/, '');
    const cleanB = strB.replace(/^[^a-zA-Zа-яА-ЯёЁ0-9]+/, '');
    return cleanA.localeCompare(cleanB, 'ru') * (config.direction === 'asc' ? 1 : -1);
  });
};

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
  is_header?: boolean;
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
  is_header?: boolean;
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
  selectedItemsCount: number;
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
  // Navigation context
  viewContext: 'dashboard' | 'workspace';
  setViewContext: (ctx: 'dashboard' | 'workspace') => void;
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;

  // Category management
  categories: Category[];
  addCategory: (label: string) => void;
  deleteCategory: (id: string) => void;

  // Project management
  projects: Project[];
  addProject: (title: string, categoryId?: string) => Promise<Project | null>;
  downloadProject: (id: string) => void;
  duplicateProject: (id: string) => void;
  renameProject: (id: string, newTitle: string) => void;
  syncProjectName: (id: string, newTitle: string) => void;
  moveProject: (id: string, categoryId: string) => void;
  deleteProject: (id: string) => void;
  importProject: (file: File) => Promise<Project | null>;

  // Active category for filtering
  activeCategory: string;
  setActiveCategory: (id: string) => void;

  // New project sync functions
  saveTableData: () => Promise<void>;
  fetchHistory: (type: 'text' | 'xlsx') => void;
}

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [viewContext, setViewContext] = useState<'dashboard' | 'workspace'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.has('project')) return 'workspace';
    }
    return 'dashboard';
  });

  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlId = params.get('project');
      if (urlId) return urlId;
    }
    try {
      const saved = localStorage.getItem('docok_activeProjectId');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });

  const [projects, setProjects] = useState<Project[]>([]);
  const isInitializing = useRef(false);
  
  const activeProject = projects.find(p => p.id === activeProjectId);
  const projectName = activeProject?.title || 'Новый проект';
  const setProjectName = (name: string) => {
    if (activeProjectId) {
      setProjects(prev => prev.map(p => p.id === activeProjectId ? { ...p, title: name } : p));
    }
  };

  useEffect(() => {
    if (activeProjectId) {
      localStorage.setItem('docok_activeProjectId', JSON.stringify(activeProjectId));
    } else {
      localStorage.removeItem('docok_activeProjectId');
    }
  }, [activeProjectId]);

  const [currentStage, setCurrentStageRaw] = useState<Stage>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlStage = params.get('stage') as Stage;
      if (['spec', 'request', 'invoice', 'estimate'].includes(urlStage)) return urlStage;
      
      const saved = localStorage.getItem('docok_currentStage');
      if (saved && ['spec', 'request', 'invoice', 'estimate'].includes(saved)) return saved as Stage;
    }
    return 'spec';
  });

  const setCurrentStage = useCallback((stage: Stage) => {
    setCurrentStageRaw(stage);
    localStorage.setItem('docok_currentStage', stage);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('stage', stage);
      window.history.replaceState({}, '', url.toString());
    }
    setSelectedIds([]); // Сбрасываем выборку при смене вкладок
    setIsOnlySelectedView(false); // Отключаем фильтр фокуса
  }, []);

  const [categories, setCategories] = useState<Category[]>(() => {
    try {
      const saved = localStorage.getItem('docok_categories');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [
      { id: 'all',     label: 'Все проекты',  icon: 'LayoutGrid', count: 4, type: 'system' },
      { id: 'active',  label: 'Активные',     icon: 'Zap',        count: 2, type: 'system' },
      { id: 'archive', label: 'В архиве',     icon: 'Archive',    count: 1, type: 'system' },
      { id: 'tender',  label: 'Тендеры',      icon: 'Award',      count: 1, type: 'system' },
    ];
  });

  useEffect(() => {
    localStorage.setItem('docok_categories', JSON.stringify(categories));
  }, [categories]);

  const addCategory = useCallback((label: string) => {
    setCategories(prev => [
      ...prev,
      { id: genId(), label, icon: 'Folder', count: 0, type: 'custom' }
    ]);
    toast.success(`Папка "${label}" создана`);
  }, []);

  const deleteCategory = useCallback((id: string) => {
    setCategories(prev => {
      const cat = prev.find(c => c.id === id);
      if (cat?.type === 'system') {
        toast.error('Системные папки нельзя удалять');
        return prev;
      }
      toast.success(`Папка "${cat?.label}" удалена`);
      return prev.filter(c => c.id !== id);
    });
  }, []);

  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:8000/api/projects');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data)) {
          setProjects(data);
          
          // --- Validation: Reset if ID from localStorage no longer exists on server ---
          if (activeProjectId && !data.some((p: any) => p.id === activeProjectId)) {
            setActiveProjectId(null);
            setViewContext('dashboard');
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch projects:', e);
    } finally {
      setIsLoadingProjects(false);
    }
  }, [activeProjectId, setViewContext]);

  // Initial fetch
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // --- URL & State Synchronization ---
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const params = new URLSearchParams(window.location.search);
    
    if (viewContext === 'dashboard') {
      params.delete('project');
      params.delete('stage');
    } else {
      if (activeProjectId) params.set('project', activeProjectId);
      if (currentStage) params.set('stage', currentStage);
    }
    
    const newRelativePathQuery = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
    window.history.replaceState(null, '', newRelativePathQuery);
  }, [viewContext, activeProjectId, currentStage]);

  // Sync projects to backend when they change (handled by explicit actions now)

  const addProject = useCallback(async (title: string, categoryId?: string): Promise<Project | null> => {
    try {
      const res = await fetch('http://localhost:8000/api/projects/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: title, categoryId: categoryId || 'all' })
      });
      if (res.ok) {
        const newProject = await res.json();
        setProjects(prev => [...prev, newProject]);
        toast.success(`Проект "${newProject.title}" создан`);
        return newProject;
      }
    } catch (e) {
      toast.error('Ошибка создания проекта на сервере');
    }
    return null;
  }, []);

  const downloadProject = useCallback((id: string) => {
    window.location.href = `http://localhost:8000/api/projects/${id}/download`;
  }, []);

  const duplicateProject = useCallback(async (id: string) => {
    const project = projects.find(p => p.id === id);
    if (!project) return;
    
    try {
      const res = await fetch('http://localhost:8000/api/projects/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, title: project.title })
      });
      if (res.ok) {
        const data = await res.json();
        const newProject: Project = {
          ...project,
          id: data.id,
          title: `${project.title} — Копия`,
          lastModified: new Date().toLocaleString('ru-RU')
        };
        setProjects(prev => [...prev, newProject]);
        toast.success(`Создана копия проекта "${project.title}"`);
      }
    } catch (e) {
      toast.error('Ошибка при копировании проекта');
    }
  }, [projects]);

  const syncProjectName = useCallback(async (id: string, newTitle: string) => {
    try {
      const res = await fetch(`http://localhost:8000/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle })
      });
      if (res.ok) {
        setProjects(prev => prev.map(p => p.id === id ? { ...p, title: newTitle } : p));
        toast.success(`Проект переименован в "${newTitle}"`);
      }
    } catch (e) {
      toast.error('Ошибка при переименовании');
    }
  }, []);

  const renameProject = useCallback(async (id: string, newTitle: string) => {
    return await syncProjectName(id, newTitle);
  }, [syncProjectName]);

  const moveProject = useCallback(async (id: string, categoryId: string) => {
    const project = projects.find(p => p.id === id);
    if (!project) return;

    const category = categories.find(c => c.id === categoryId);
    const isSystem = categoryId === 'active' || categoryId === 'archive' || categoryId === 'tender';
    const updated = { 
      ...project, 
      categoryId, 
      status: isSystem ? (categoryId as ProjectStatus) : project.status 
    };

    try {
      await fetch('http://localhost:8000/api/projects/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      setProjects(prev => prev.map(p => p.id === id ? updated : p));
      toast.success(`Проект перемещен в "${category?.label || categoryId}"`);
    } catch (e) {
      toast.error('Ошибка при перемещении');
    }
  }, [projects, categories]);

  const deleteProject = useCallback(async (id: string) => {
    const project = projects.find(p => p.id === id);
    if (!project) return;

    try {
      const res = await fetch(`http://localhost:8000/api/projects/delete/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setProjects(prev => prev.filter(p => p.id !== id));
        toast.success(`Проект "${project.title}" удален`);
      }
    } catch (e) {
      toast.error('Ошибка при удалении проекта');
    }
  }, [projects]);

  const importProject = useCallback(async (file: File): Promise<Project | null> => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('http://localhost:8000/api/projects/import', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const newProject = await res.json();
        // Since the backend returns the full project state, we can add it to our list
        setProjects(prev => [...prev, newProject]);
        toast.success(`Проект "${newProject.title}" импортирован`);
        return newProject;
      } else {
        const err = await res.json();
        toast.error(`Ошибка импорта: ${err.detail || 'Неизвестная ошибка'}`);
      }
    } catch (e) {
      console.error('Import failed:', e);
      toast.error('Ошибка при отправке архива на сервер');
    }
    return null;
  }, []);

  // Dynamic counts for categories
  const categoriesWithCounts = React.useMemo(() => {
    return categories.map(cat => {
      let count = 0;
      if (cat.id === 'all') {
        count = projects.length;
      } else if (cat.id === 'active') {
        count = projects.filter(p => p.status === 'active' || p.status === 'current').length;
      } else if (cat.id === 'archive') {
        count = projects.filter(p => p.status === 'archive').length;
      } else if (cat.id === 'tender') {
        count = projects.filter(p => p.status === 'tender').length;
      } else {
        // Custom folders: projects explicitly assigned to this category
        count = projects.filter(p => p.categoryId === cat.id).length;
      }
      return { ...cat, count };
    });
  }, [categories, projects]);

  const [activeCategory, setActiveCategory] = useState('all');

  // Remove redundant storage of projectName - it's in the projects array!
  useEffect(() => {
    // No-op
  }, []);

  const [specRows, setSpecRows] = useState<SpecRow[]>([]);
  const [requestRows, setRequestRows] = useState<SpecRow[]>([]);
  const [invoiceRows, setInvoiceRows] = useState<InvoiceRow[]>([]);
  const [estimateRows, setEstimateRows] = useState<EstimateRow[]>([]);

  // Store previous project ID to avoid clearing rows on every list update
  const prevProjectIdRef = useRef<string | null>(null);

  // Project-specific persistence
  useEffect(() => {
    if (!activeProjectId) {
      prevProjectIdRef.current = null;
      return;
    }
    
    const projectChanged = prevProjectIdRef.current !== activeProjectId;
    prevProjectIdRef.current = activeProjectId;

    isInitializing.current = true;
    
    // ONLY clear rows if we actually switched projects
    if (projectChanged) {
      setSpecRows([]);
      setRequestRows([]);
      setInvoiceRows([]);
      setEstimateRows([]);
      setSelectedIds([]);
      setActiveHeaderIds([]);
    }

    const loadLocal = (key: string) => {
      try {
        const saved = localStorage.getItem(`docok_p_${activeProjectId}_${key}`);
        return saved ? JSON.parse(saved) : null;
      } catch (e) { return null; }
    };

    // 1. Try SERVER data first (from pre-fetched projects list)
    const project = projects.find(p => p.id === activeProjectId);
    if (project) {
      // If server has rows, use them. Otherwise fallback to local.
      // We check length to avoid empty server data from overwriting local data if current project matches
      if (project.specRows && project.specRows.length > 0) setSpecRows(project.specRows);
      else if (!specRows.length) { const s = loadLocal('specRows'); if (s) setSpecRows(s); }

      if (project.requestRows && project.requestRows.length > 0) setRequestRows(project.requestRows);
      else if (!requestRows.length) { const s = loadLocal('requestRows'); if (s) setRequestRows(s); }

      if (project.invoiceRows && project.invoiceRows.length > 0) setInvoiceRows(project.invoiceRows);
      else if (!invoiceRows.length) { const s = loadLocal('invoiceRows'); if (s) setInvoiceRows(s); }

      if (project.estimateRows && project.estimateRows.length > 0) setEstimateRows(project.estimateRows);
      else if (!estimateRows.length) { const s = loadLocal('estimateRows'); if (s) setEstimateRows(s); }
    } else {
      // 2. Fallback to LocalStorage if project not yet in memory (e.g. brand new or still loading list)
      const savedSpec = loadLocal('specRows');
      if (savedSpec) setSpecRows(savedSpec);

      const savedReq = loadLocal('requestRows');
      if (savedReq) setRequestRows(savedReq);

      const savedInv = loadLocal('invoiceRows');
      if (savedInv) setInvoiceRows(savedInv);

      const savedEst = loadLocal('estimateRows');
      if (savedEst) setEstimateRows(savedEst);
    }

    // End initialization block after state updates are scheduled
    const timer = setTimeout(() => { isInitializing.current = false; }, 200);
    return () => clearTimeout(timer);

  }, [activeProjectId, projects]);

  const fetchHistory = useCallback((type: 'text' | 'xlsx') => {
    if (!activeProjectId) return;
    const url = type === 'xlsx' 
      ? `http://localhost:8000/api/storage/history/export_xlsx?projectId=${activeProjectId}`
      : `http://localhost:8000/api/storage/history/export?projectId=${activeProjectId}`;
    window.open(url, '_blank');
  }, [activeProjectId]);

  const saveTableData = useCallback(async () => {
    if (!activeProjectId || isInitializing.current) return;
    
    // Local persistence
    localStorage.setItem(`docok_p_${activeProjectId}_specRows`, JSON.stringify(specRows));
    localStorage.setItem(`docok_p_${activeProjectId}_requestRows`, JSON.stringify(requestRows));
    localStorage.setItem(`docok_p_${activeProjectId}_invoiceRows`, JSON.stringify(invoiceRows));
    localStorage.setItem(`docok_p_${activeProjectId}_estimateRows`, JSON.stringify(estimateRows));

    // Server-side project state sync
    const project = projects.find(p => p.id === activeProjectId);
    if (!project) return;
    
    const updated: Project = {
      ...project,
      lastModified: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) + ' | ' + new Date().toLocaleDateString('ru-RU'),
      specRows,
      requestRows,
      invoiceRows,
      estimateRows
    };
    
    try {
      // Quiet save (No loading toast/spinner)
      await fetch('http://localhost:8000/api/projects/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      // Update local projects list to reflect real sync
      setProjects(prev => prev.map(p => p.id === activeProjectId ? updated : p));
    } catch (e) {
      console.warn('Quiet save failed:', e);
    }
  }, [activeProjectId, specRows, requestRows, invoiceRows, estimateRows, projects]);

  // --- Hybrid Saving UX ---
  
  // 1. Debounced Auto-Save (5s)
  useEffect(() => {
    if (!activeProjectId || viewContext !== 'workspace') return;
    
    const timer = setTimeout(() => {
      saveTableData();
    }, 5000);

    return () => clearTimeout(timer);
  }, [specRows, requestRows, invoiceRows, estimateRows, activeProjectId, viewContext, saveTableData]);

  // 2. Mandatory Save on Exit (Workspace -> Dashboard)
  const lastViewContext = useRef(viewContext);
  useEffect(() => {
    if (lastViewContext.current === 'workspace' && viewContext === 'dashboard') {
      saveTableData();
      fetchProjects(); // Refresh project list to update file counters on Dashboard
    }
    lastViewContext.current = viewContext;
  }, [viewContext, saveTableData, fetchProjects]);

  // Sync rows to local storage whenever they change
  useEffect(() => {
    if (activeProjectId && !isInitializing.current) {
      localStorage.setItem(`docok_p_${activeProjectId}_specRows`, JSON.stringify(specRows));
    }
  }, [specRows, activeProjectId]);

  useEffect(() => {
    if (activeProjectId && !isInitializing.current) {
      localStorage.setItem(`docok_p_${activeProjectId}_requestRows`, JSON.stringify(requestRows));
    }
  }, [requestRows, activeProjectId]);

  useEffect(() => {
    if (activeProjectId && !isInitializing.current) {
      localStorage.setItem(`docok_p_${activeProjectId}_invoiceRows`, JSON.stringify(invoiceRows));
    }
  }, [invoiceRows, activeProjectId]);

  useEffect(() => {
    if (activeProjectId && !isInitializing.current) {
      localStorage.setItem(`docok_p_${activeProjectId}_estimateRows`, JSON.stringify(estimateRows));
    }
  }, [estimateRows, activeProjectId]);

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




  const [viewMode, setViewModeRaw] = useState<'original' | 'supplier' | 'merged'>('original');
  const setViewMode = useCallback((mode: 'original' | 'supplier' | 'merged') => {
    setViewModeRaw(mode);
    setCurrentPage(1); // Лечит прыжок пагинации
    setSelectedIds([]); // Сбрасываем выборку для чистоты ID
    setIsOnlySelectedView(false); // Отключаем фильтр фокуса
  }, []);
  
  const isMerged = viewMode === 'merged';
  const toggleMerge = useCallback(() => {
    setViewMode(viewMode === 'merged' ? 'original' : 'merged');
  }, [viewMode, setViewMode]);




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

  const updateFileStatusOnServer = async (fileName: string, status: FileStatus) => {
    if (!activeProjectId) return;
    try {
      await fetch(`http://localhost:8000/api/storage/files/${encodeURIComponent(fileName)}?projectId=${activeProjectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
    } catch (e) {
      console.error(`Failed to update status for ${fileName}:`, e);
    }
  };

  // Load files from storage when project changes
  useEffect(() => {
    const fetchStorageFiles = async () => {
      if (!activeProjectId) return;
      try {
        const res = await fetch(`http://localhost:8000/api/storage/files?projectId=${activeProjectId}`);
        if (res.ok) {
          const files = await res.json();
          const restoredStatuses: Record<string, UploadStatus> = {};
          files.forEach((f: any) => {
            restoredStatuses[f.name] = {
              status: f.status === 'reset' ? 'reset' : 'Готово (Хранилище)',
              time: f.time,
              size: f.size,
              cost: f.cost || 0,
              tokens: f.tokens || 0,
              estimated_cost: f.estimated_cost || 0,
              estimated_tokens: f.estimated_tokens || 0,
              model: f.model || '',
              method: f.method || '',
            };
          });
          setUploadStatuses(restoredStatuses);
        }
      } catch (e) {
        console.error('Failed to fetch storage files:', e);
      }
    };
    fetchStorageFiles();
  }, [activeProjectId]);

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
        
        // ТЗ №2: Очистка технических «призраков» и мусора
        if (!name.trim() || name.includes('---') || name.includes('===')) {
          return null;
        }

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
        const name = cols[1] || '';
        
        // ТЗ №2: Очистка технических «призраков»
        if (!name.trim() || name.includes('---') || name.includes('===')) {
          return null;
        }

        r.name = name;
        r.quantity = cols[2] || '1';
        r.unit = cols[3] || 'шт';
        r.price = cols[4] || '0';
        r.total = cols[5] || '0';
        return r;
      }).filter(Boolean);
    }
  };

  const syncProjectFilesCount = useCallback(async () => {
    if (!activeProjectId) return;
    
    try {
      // 1. Get real file list from server
      const res = await fetch(`http://localhost:8000/api/storage/files?projectId=${activeProjectId}`);
      if (!res.ok) return;
      const files = await res.json();
      const count = files.length;
      
      // 2. Find current project state
      const project = projects.find(p => p.id === activeProjectId);
      if (!project) return;
      
      // 3. Update server-side project state
      const updated = { ...project, filesCount: count };
      await fetch('http://localhost:8000/api/projects/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      
      // 4. Update local projects list
      setProjects(prev => prev.map(p => p.id === activeProjectId ? updated : p));
      
    } catch (e) {
      console.error('Failed to sync files count:', e);
    }
  }, [activeProjectId, projects]);

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
        if (activeProjectId) {
          uploadData.append('projectId', activeProjectId);
        }
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
        if (activeProjectId) {
          formData.append('projectId', activeProjectId);
        }
        
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
                  updateFileStatusOnServer(file.name, 'Готово (ИИ)');
                  // Update project file count
                  syncProjectFilesCount();
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
      } else {
        // Just uploaded without AI
        syncProjectFilesCount();
      }
    }); // closes forEach

  }, [yandexConfig, updateFileStatusOnServer, activeProjectId, syncProjectFilesCount]);

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

  const getMergedRows = useCallback((items: SpecRow[], config: SortConfig) => {
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

    // 3. Сортируем с учетом глобального конфига или по умолчанию по имени
    const sortedResult = rawResult.sort((a: any, b: any) => {
      if (!config.key || !config.direction) {
         return priorityCompare(a.name, b.name, 'asc');
      }
      
      const valA = a[config.key!];
      const valB = b[config.key!];
      
      // Numbers
      const nA = parseFloat(String(valA).replace(/\s/g, '').replace(/,/g, '.'));
      const nB = parseFloat(String(valB).replace(/\s/g, '').replace(/,/g, '.'));
      if (!isNaN(nA) && !isNaN(nB) && config.key !== 'name') {
         return (nA - nB) * (config.direction === 'asc' ? 1 : -1);
      }
      
      // Strings
      return priorityCompare(String(valA), String(valB), config.direction);
    });

    // 4. Присвоение иерархических номеров (N и N.M)
    sortedResult.forEach((row, idx) => {
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

  const getSupplierRows = useCallback((items: SpecRow[], config: SortConfig) => {
    const onlyItems = items.filter(r => !r.is_header);
    // map: supplierKey -> { id, name, is_header, row_type, quantity, itemsMap: fingerprint -> mergedItem, names[] }
    const supplierMap = new Map<string, { 
      id: string; 
      name: string; 
      is_header: boolean; 
      row_type: string; 
      quantity: string; 
      itemsMap: Map<string, any>; 
      names: string[] 
    }>();

    onlyItems.forEach(item => {
      const rawSupplier = (item.supplier || '').trim();
      const sKey = rawSupplier.toLowerCase() || 'без поставщика';
      
      if (!supplierMap.has(sKey)) {
        const safeId = `supplier_header_${sKey}`;
        supplierMap.set(sKey, { 
          id: safeId, 
          name: rawSupplier || 'БЕЗ ПОСТАВЩИКА', 
          is_header: true, 
          row_type: 'LOCATION',
          quantity: '0',
          itemsMap: new Map<string, any>(),
          names: rawSupplier ? [rawSupplier] : []
        });
      }

      const group = supplierMap.get(sKey)!;
      if (rawSupplier) group.names.push(rawSupplier);

      // Local merge within supplier: fingerprint by name, brand, code, unit
      const fingerprint = `${String(item.name || '').trim()}|${String(item.brand || '').trim()}|${String(item.code || '').trim()}|${String(item.unit || '').trim()}`.toLowerCase();
      
      const q = parseFloat(String(item.quantity).replace(/\s/g, '').replace(/,/g, '.')) || 0;
      const m = parseFloat(String(item.mass || item.weight || 0).replace(/\s/g, '').replace(/,/g, '.')) || 0;

      if (group.itemsMap.has(fingerprint)) {
        const existing = group.itemsMap.get(fingerprint)!;
        const oldQ = parseFloat(String(existing.quantity).replace(/\s/g, '').replace(/,/g, '.')) || 0;
        const oldM = parseFloat(String(existing.mass).replace(/\s/g, '').replace(/,/g, '.')) || 0;
        
        existing.quantity = String(oldQ + q);
        existing.mass = String(oldM + m);
        
        if (item.note && !existing.note.includes(item.note)) {
          existing.note = existing.note ? `${existing.note}; ${item.note}` : item.note;
        }
        
        // Track original rows for drill-down (pivot behavior)
        if (!existing.children) existing.children = [];
        existing.children.push({ ...item });
        
        if (item.id) {
           if (!existing.originalRowsIds) existing.originalRowsIds = [existing.id];
           existing.originalRowsIds.push(item.id);
        }
      } else {
        // Create a stable ID for the merged item within this supplier
        const itemSafeId = `s_item_${sKey}_${fingerprint.replace(/[^a-z0-9]/g, '_')}`;
        group.itemsMap.set(fingerprint, { 
          ...item, 
          id: itemSafeId,
          quantity: String(q),
          mass: String(m),
          is_header: false,
          row_type: 'ITEM',
          children: [{ ...item }], // Initialize children with the first occurrence
          originalRowsIds: [item.id]
        });
      }

      
      // Update total quantity for supplier header
      const totalQ = parseFloat(String(group.quantity).replace(/\s/g, '').replace(/,/g, '.')) || 0;
      group.quantity = String(totalQ + q);
    });

    const result = Array.from(supplierMap.values()).map(group => {
      // Pick the "nicest" name
      if (group.names.length > 0) {
        const niceName = group.names.find(n => /^[A-ZА-ЯЁ]/.test(n)) || group.names[0];
        group.name = niceName;
      }
      
      // Flatten merged items and assign sequential positions
      let posCounter = 1;
      const children = Array.from(group.itemsMap.values())
        .sort((a, b) => {
          if (!config.key || !config.direction) {
            return priorityCompare(a.name, b.name, 'asc');
          }
          const valA = a[config.key!];
          const valB = b[config.key!];
          
          // Numbers
          const nA = parseFloat(String(valA).replace(/\s/g, '').replace(/,/g, '.'));
          const nB = parseFloat(String(valB).replace(/\s/g, '').replace(/,/g, '.'));
          if (!isNaN(nA) && !isNaN(nB) && config.key !== 'name') {
            return (nA - nB) * (config.direction === 'asc' ? 1 : -1);
          }
          
          return priorityCompare(String(valA), String(valB), config.direction);
        })
        .map(child => {
          let qStr = String(child.quantity);
          if (Number(qStr) % 1 !== 0) qStr = Number(qStr).toFixed(2);
          
          let mStr = String(child.mass);
          if (Number(mStr) > 0) mStr = Number(mStr).toFixed(2);

          return {
            ...child,
            quantity: qStr,
            mass: mStr,
            pos: String(posCounter++),
            is_header: false,
            row_type: 'ITEM'
          };
        });

      let headerQ = group.quantity;
      if (Number(headerQ) % 1 !== 0) headerQ = Number(headerQ).toFixed(2);

      return {
        id: group.id,
        name: group.name,
        is_header: group.is_header,
        row_type: group.row_type,
        quantity: headerQ,
        children: children
      };
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
    const weakValues = new Set([
      '1', 'шт', '0', '0.00', '0,00', 'шт.', 'ед.', '0.0', '0,0',
      '-', '—', '.', ',', 'null', 'undefined', '(пусто)', 'null'
    ]);

    return !fieldsToCheck.some(f => {
      const val = r[f];
      if (val === undefined || val === null) return false;
      const str = String(val).trim();
      if (str.length === 0) return false;
      // Если значение «слабое» — оно само по себе не делает строку непустой
      if (weakValues.has(str.toLowerCase())) return false;
      // ТЗ №2: Игнорируем технические разделители в именах
      if (f === 'name' && (str.includes('---') || str.includes('==='))) return false;
      return true;
    });
  };


  const dataPipeline = React.useMemo(() => {
    // 1. БАЗА (Берем ОРИГИНАЛЬНЫЙ порядок для корректной работы навигатора)
    let baseRows: any[] = [];
    let searchFields: string[] = [];
    if (currentStage === 'spec') { baseRows = specRows; searchFields = ['name', 'code', 'supplier']; }
    else if (currentStage === 'request') { baseRows = requestRows; searchFields = ['name', 'code', 'supplier']; }
    else if (currentStage === 'invoice') { baseRows = invoiceRows; searchFields = ['name', 'article', 'supplier']; }
    else if (currentStage === 'estimate') { baseRows = estimateRows; searchFields = ['name', 'workType', 'supplier']; }

    // ГЛОБАЛЬНАЯ ОЧИСТКА ПУСТЫХ СТРОК
    let result = baseRows.filter(r => !isActuallyEmpty(r));

    // 2. ФИЛЬТР НАВИГАТОРА (Работает только на оригинальном порядке!)
    if (activeHeaderIds.length > 0 && (viewMode === 'original' || viewMode === 'merged')) {
      result = applyNavigatorFilter(result, activeHeaderIds);
    }

    // 3. ТЕКСТОВЫЙ ПОИСК
    if (searchQuery && searchQuery.trim()) {
      result = applyHierarchySearchFilter(result, searchQuery);
    }

    // 4. ТРАНСФОРМАЦИЯ (Группировка) И СОРТИРОВКА
    const isSortingActive = !!(sortConfig.key && sortConfig.direction);

    if (currentStage === 'spec') {
      if (viewMode === 'merged') {
        result = getMergedRows(result as SpecRow[], sortConfig);
      } else if (viewMode === 'supplier') {
        result = getSupplierRows(result as SpecRow[], sortConfig);
        // Фильтр навигатора для ПОСТАВЩИКОВ (срабатывает после их создания)
        if (activeHeaderIds.length > 0) {
          result = result.filter(group => activeHeaderIds.includes(group.id));
        }
      } else if (viewMode === 'original') {
        // В оригинальном режиме сначала сортируем
        if (isSortingActive) {
          result = applySortAndFilter(result, sortConfig, '', []); // Поиск уже применен выше
          // СКРЫВАЕМ ЗАГОЛОВКИ ПРИ СОРТИРОВКЕ (Плоский список)
          result = result.filter(r => !r.is_header);
        }
      }
    } else {
      // Для остальных вкладок (не spec) просто применяем сортировку, если она активна
      if (isSortingActive) {
        result = applySortAndFilter(result, sortConfig, '', []);
      }
    }


    // 4. ГЛОБАЛЬНАЯ ПЕРЕНУМЕРАЦИЯ (Если активна сортировка)
    if (isSortingActive) {
       let globalPos = 1;
       result = result.map(r => {
         // Для поставщиков нумеруем дочерние элементы, саму группу не трогаем (она уже пронумерована внутри)
         // Но если это плоский список (original + sort), нумеруем всё подряд.
         if (viewMode === 'original') {
            return { ...r, pos: String(globalPos++) };
         }
         return r;
       });
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
        // Умный фильтр для original/merged (сохраняет иерархию папок)
        const keepIds = new Set<string>();
        let activeL0Id: string | null = null;
        let activeL1Id: string | null = null;
        let activeL2Id: string | null = null;

        for (const r of result) {
          const type = r.row_type || (r.is_header ? 'GROUP' : 'ITEM');
          
          // Отслеживаем текущие "родительские" заголовки по мере обхода
          if (type === 'WORK_TYPE') { activeL0Id = r.id; activeL1Id = null; activeL2Id = null; }
          else if (type === 'LOCATION') { activeL1Id = r.id; activeL2Id = null; }
          else if (type === 'GROUP') { activeL2Id = r.id; }
          
          // Если строка выбрана ОШИБОЧНО или ПРЯМО
          if (selectedIds.includes(r.id)) {
            keepIds.add(r.id);
            // Если выбран "ребенок", сохраняем всю цепочку родителей
            if (type === 'ITEM' || String(r.id).startsWith('merged_')) {
              if (activeL0Id) keepIds.add(activeL0Id);
              if (activeL1Id) keepIds.add(activeL1Id);
              if (activeL2Id) keepIds.add(activeL2Id);
            }
          }
        }
        
        result = result.filter(r => keepIds.has(r.id));
      }
    }



    // 5. ИТОГ И ПАГИНАЦИЯ
    // Подсчет только ЗНАЧИМЫХ позиций (товаров) для отображения в футере и навигации.
    // Убираем из счета заголовки видов работ, мест, групп и названия поставщиков.
    const totalProcessedCount = viewMode === 'supplier'
      ? result.reduce((acc, group) => acc + (group.children?.length || 0), 0)
      : result.filter(r => !r.is_header && !String(r.id).startsWith('supplier_')).length;

    let displayRows = result;

    if (currentStage === 'spec' && viewMode === 'merged') {
      const startIndex = (currentPage - 1) * rowsPerPage;
      displayRows = result.slice(startIndex, startIndex + rowsPerPage);
    }

    const isPaginationActive = currentStage === 'spec' && viewMode === 'merged';
    return { displayRows, totalProcessedCount, isPaginationActive, selectableIdsForMode };
  }, [
    currentStage, viewMode,
    specRows, requestRows, invoiceRows, estimateRows,
    activeHeaderIds, isOnlySelectedView, selectedIds, searchQuery,
    sortConfig,
    currentPage, rowsPerPage,
    getMergedRows, getSupplierRows,
  ]);


  const { displayRows, totalProcessedCount, isPaginationActive, selectableIdsForMode } = dataPipeline;

  // ШАГ 6: Вычисляем количество ВЫБРАННЫХ ПОЗИЦИЙ (без учета заголовков)
  const selectedItemsCount = React.useMemo(() => {
    if (selectedIds.length === 0) return 0;
    
    // Собираем все текущие ряды (оригинальные) для быстрой проверки типа через ID
    const allBaseRows = [...specRows, ...invoiceRows, ...estimateRows, ...requestRows];
    const headerIds = new Set(allBaseRows.filter(r => r.is_header).map(r => r.id));

    return selectedIds.filter(id => {
      // 1. Заголовки (Виды работ, места и т.д.) — не считаем
      if (headerIds.has(id)) return false;
      // 2. Заголовки поставщиков (префикс supplier_) — не считаем
      if (String(id).startsWith('supplier_')) return false;
      // 3. Все остальное (ITEM, merged_...) — это значимые позиции (товары)
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

  const removeFile = useCallback(async (fileName: string, nuclear: boolean = false) => {
    if (!activeProjectId) return;

    // 1. Delete from physical storage on server (Waiting for real deletion)
    try {
      const res = await fetch(`http://localhost:8000/api/storage/files/${encodeURIComponent(fileName)}?projectId=${activeProjectId}&nuclear=${nuclear}`, { 
        method: 'DELETE' 
      });
      if (!res.ok) {
        toast.error(`Файл ${fileName} не был удален на сервере`);
        return;
      }
    } catch (e) {
      console.error('Failed to delete file from storage:', e);
      toast.error('Ошибка сети при удалении файла');
      return;
    }

    // 2. Remove from uploadStatuses and filesMap (Local state)
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

    // 3. Remove specRows (including cascade in merged groups)
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

    // 4. Remove other stage rows
    setRequestRows(prev => prev.filter((r: SpecRow) => r.fileId !== fileName));
    setInvoiceRows(prev => prev.filter((r: InvoiceRow) => r.fileId !== fileName));
    setEstimateRows(prev => prev.filter((r: EstimateRow) => r.fileId !== fileName));

    // 5. Final Sync: Update project state and Dashboard counters
    await syncProjectFilesCount();
    toast.success(`Файл ${fileName} удален`);
  }, [activeProjectId, syncProjectFilesCount, setUploadStatuses, setFilesMap, setSpecRows, setRequestRows, setInvoiceRows, setEstimateRows]);

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

        if (field === 'costPrice' || field === 'quantity' || field === 'clientPrice') {
          const q = parseFloat(String(updatedRow.quantity).replace(/\s/g, '').replace(/,/g, '.')) || 0;
          const p = parseFloat(String(updatedRow.costPrice).replace(/\s/g, '').replace(/,/g, '.')) || 0;
          const cp = parseFloat(String(updatedRow.clientPrice).replace(/\s/g, '').replace(/,/g, '.')) || 0;

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
      const grouped = getSupplierRows(baseRows, sortConfig);
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
        selectedItemsCount,
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
        viewContext,
        setViewContext,
        activeProjectId,
        setActiveProjectId,
        saveTableData,
        fetchHistory,
        categories: categoriesWithCounts,
        addCategory,
        deleteCategory,
        projects,
        addProject,
        downloadProject,
        duplicateProject,
        renameProject,
        syncProjectName,
        moveProject,
        deleteProject,
        importProject,
        activeCategory,
        setActiveCategory
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
