import React, { useRef } from 'react';
import {
  Menu,
  Settings2,
  Info,
  Calculator,
  ArrowRight,
  Download,
  UploadCloud,
  RotateCcw,
  Rows3,
  Calculator as CalcIcon,
  Percent,
  CheckCircle2,
  CheckSquare,
  XSquare,
  Trash2,
  Filter,
  Layers,
  Truck,
  FileText,
  ChevronDown,
  ChevronRight,
  Undo2,
  Redo2,
  Check,
  Folder,
  ListTree
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Stage, RightPanelTab } from '../types';
import { useData, SpecRow, InvoiceRow, EstimateRow } from '../context/DataContext';
import { exportGeometryToXLSX, exportToXLSX, exportSpecToExcel } from '../utils/fileUtils';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface NavNodeData {
  id: string;
  name: string;
  children?: NavNodeData[];
  count?: number;
}

const NavNode = ({
  node, activeIds, onToggle, onSolo, level = 0, spyId
}: {
  spyId?: string | null;
  node: NavNodeData;
  activeIds: string[];
  onToggle: (id: string, isolate?: boolean) => void;
  onSolo?: (id: string) => void;
  level?: number
}) => {
  const isActive = activeIds.includes(node.id);
  const [isExpanded, setIsExpanded] = React.useState(true);
  const hasChildren = node.children && node.children.length > 0;

  // Typography per hierarchy level
  const labelCls = level === 0
    ? 'text-[12px] font-bold tracking-tight'
    : level === 1
      ? 'text-[11px] font-semibold'
      : 'text-[11px] font-medium';

  const isSpy = spyId === node.id;
  // Text color uniformly black/dark as requested. Bold if it is currently in viewport (scroll spy).
  const colorCls = isActive ? 'text-indigo-700' : isSpy ? 'text-slate-900 font-extrabold pr-2 underline' : 'text-slate-900';

  const handleLabelClick = () => {
    const el = document.getElementById(`row-${node.id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const renderIcon = () => {
    if (level === 0) return <ListTree className="w-[14px] h-[14px]" />;
    if (level === 1) return (
      <div className="relative w-[14px] h-[14px]">
        <Folder className="w-full h-full" />
        <Folder className="w-full h-full absolute top-[3px] left-[3px] opacity-40" />
      </div>
    );
    return <Folder className="w-[14px] h-[14px]" />;
  };

  return (
    <div className="flex flex-col">
      <div
        className={cn(
          'flex items-center gap-1.5 rounded-md transition-all py-1.5 px-2 group cursor-default',
          isActive
            ? 'bg-indigo-50 border-l-[3px] border-l-indigo-500 pl-[5px]'
            : 'border-l-[3px] border-l-transparent hover:bg-slate-50/80'
        )}
        style={{ marginLeft: `${level * 12}px` }}
      >
        {/* Expand/collapse chevron */}
        <div
          className={cn(
            'w-4 h-4 flex shrink-0 items-center justify-center rounded transition-colors',
            hasChildren ? 'cursor-pointer text-slate-400 hover:text-indigo-600 hover:bg-indigo-100' : 'opacity-0 pointer-events-none'
          )}
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
        >
          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </div>

        {/* Checkbox — multi-select / isolate */}
        <div
          className={cn(
            'w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all cursor-pointer',
            isActive
              ? 'bg-indigo-500 border-indigo-500 text-white shadow-sm shadow-indigo-200'
              : 'border-slate-300 bg-white group-hover:border-indigo-400'
          )}
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); onToggle(node.id, !e.shiftKey && !e.metaKey && !e.ctrlKey); }}
        >
          {isActive && <Check className="w-2 h-2 stroke-[3]" />}
        </div>
        
        {/* Dynamic Icon */}
        <div className={cn("text-slate-400 flex items-center justify-center", isActive && "text-indigo-500")}>
           {renderIcon()}
        </div>

        {/* Label — scroll to row */}
        <span
          className={cn('flex-1 truncate select-none leading-snug cursor-pointer hover:underline', labelCls, colorCls)}
          title={node.name}
          onClick={handleLabelClick}
        >
          {node.name}
        </span>
        
        {/* Item count badge */}
        {((node.count ?? 0) > 0 || hasChildren) && (
          <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full tabular-nums">
            {node.count || 0}
          </span>
        )}
      </div>

      {/* Children with visual tree line */}
      {isExpanded && hasChildren && (
        <div className="flex flex-col" style={{ marginLeft: `${level * 16 + 10}px` }}>
          <div className="border-l-2 border-slate-200/80 pl-0">
            {node.children?.map((child) => (
              <NavNode 
                key={child.id} 
                node={child} 
                activeIds={activeIds} 
                onToggle={onToggle} 
                onSolo={onSolo}
                level={level + 1} 
                spyId={spyId} 
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface RightPanelProps {
  expanded: boolean;
  onToggle: () => void;
  currentStage: Stage;
  onNextStage: () => void;
  hasNextStage: boolean;
  canProceed: boolean;
}

export function RightPanel({ expanded, onToggle, currentStage, onNextStage, hasNextStage, canProceed }: RightPanelProps) {
  const [activeTab, setActiveTab] = React.useState<RightPanelTab>('tools');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    handleFile, viewMode, setViewMode, pdfGeometry,
    estimateRows, estimateTotal, specRows, invoiceRows,
    resetData, handleSort, groupRows, filesMap, completeStage,
    selectedIds, setSelectedIds, selectAllRows, deleteSelectedRows,
    isOnlySelectedView, setIsOnlySelectedView, setIsResetConfirmOpen,
    matchInvoiceToSpec, getCurrentRows, projectName,
    activeHeaderIds, setActiveHeaderIds, getNavigatorTree,
    keepSelectedRows, undo, redo, canUndo, canRedo,
    uploadStatuses
  } = useData();

  const [spyId, setSpyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (currentStage !== 'spec') return;
    const container = document.querySelector('.flex-1.overflow-auto.relative.bg-white') || document.body;
    let lastSpyId: string | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout>;
    let lastExecution = 0;
    const throttleTime = 100;

    const handleScroll = () => {
      const now = Date.now();
      if (now - lastExecution < throttleTime) return;
      lastExecution = now;

      const parentRect = container === document.body 
        ? { top: 0 } as DOMRect 
        : container.getBoundingClientRect();
      
      const rows = document.querySelectorAll('[id^="row-"]');
      let minPos = Infinity;
      let matchedId: string | null = null;
      
      rows.forEach(r => {
        const box = r.getBoundingClientRect();
        const offset = box.top - parentRect.top;
        if (offset > -200 && offset < 300 && offset < minPos) {
          minPos = offset;
          matchedId = r.id.replace('row-', '');
        }
      });

      if (matchedId && matchedId !== lastSpyId) {
        lastSpyId = matchedId;
        setSpyId(matchedId);
      }
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    fallbackTimer = setTimeout(handleScroll, 500);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(fallbackTimer);
    };
  }, [currentStage]);

  const handleExport = () => {
    let headers: string[] = [];
    let data: string[][] = [];
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    const modeLabel = viewMode === 'merged' ? 'Сводная' : viewMode === 'supplier' ? 'Поставщик' : 'Оригинал';
    let filename = `${projectName || 'Новый проект'}_${modeLabel}_${dateStr}_${timeStr}.xlsx`;

    if (currentStage === 'spec') {
      const currentRows = getCurrentRows();
      let rowsToExport = currentRows;

      if (selectedIds.length > 0) {
        rowsToExport = currentRows.filter(r => selectedIds.includes(r.id));
      }

      exportSpecToExcel(rowsToExport, filename, viewMode || 'original');
      return; // Early return for spec
    } else if (currentStage === 'invoice') {
      headers = ['№', 'Наименование', 'Артикул', 'Кол-во', 'Цена', 'Сумма', 'Поставщик'];
      data = invoiceRows.map((r: InvoiceRow, i: number) => [
        String(i + 1), r.name || '', r.article || '', String(r.quantity || ''), String(r.price || ''), String(r.total || ''), r.supplier || ''
      ]);
    } else if (currentStage === 'estimate') {
      headers = ['№', 'Вид работы', 'Наименование', 'Ед. изм.', 'Количество', 'Себестоимость', 'Цена заказчика'];
      data = estimateRows.map((r: EstimateRow, i: number) => [
        String(i + 1), r.workType || '', r.name || '', r.unit || '', String(r.quantity || ''), String(r.costPrice || ''), String(r.clientPrice || '')
      ]);
      data.push(['', '', 'ИТОГО', '', '', estimateTotal.cost, estimateTotal.client]);
    }

    if (headers.length > 0) {
      exportToXLSX(headers, data, [], filename);
    }
  };

  const getStageLabel = (stage: Stage) => {
    switch (stage) {
      case 'spec': return 'Позиций спецификации';
      case 'invoice': return 'Строк в счетах';
      case 'request': return 'Позиций в заявке';
      case 'estimate': return 'Позиций сметы';
      default: return 'Позиций';
    }
  };

  const getIntermediateTotal = () => {
    // estimateTotal is { cost: string, client: string }
    const estVal = parseFloat(String(estimateTotal.client).replace(/\s/g, '').replace(/,/g, '.'));
    if (estVal > 0) return estimateTotal.client;

    if (currentStage === 'invoice') {
      return invoiceRows.reduce((acc: number, r: InvoiceRow) => acc + (parseFloat(String(r.total)) || 0), 0).toLocaleString('ru-RU');
    }
    return '0.00';
  };

  const currentCount = () => {
    if (currentStage === 'spec') return specRows.length;
    if (currentStage === 'invoice') return invoiceRows.length;
    if (currentStage === 'estimate') return estimateRows.length;
    return 0;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFile(e.target.files, currentStage, false);
    e.target.value = '';
  };

  const tabs: { id: RightPanelTab; icon: React.ReactNode; label: string }[] = [
    { id: 'tools', icon: <Settings2 className="size-5" />, label: 'Инструменты' },
    { id: 'info', icon: <Info className="size-5" />, label: 'Информация' },
    { id: 'calc', icon: <Calculator className="size-5" />, label: 'Конвертеры' },
  ];

  return (
    <div
      className={cn(
        "flex flex-col bg-white border-l border-slate-200 transition-all duration-300 ease-in-out shrink-0 h-full overflow-hidden shadow-lg z-20",
        expanded ? "w-72" : "w-16"
      )}
    >
      <input type="file" multiple className="hidden" ref={fileInputRef} accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg" onChange={handleFileChange} />

      {/* Header - Attic */}
      <div className={cn(
        "p-4 border-b border-slate-200 shrink-0 h-[72px]",
        expanded ? "grid grid-cols-4 items-center justify-items-center gap-0" : "flex flex-col items-center gap-4 py-4 h-auto"
      )}>
        {!expanded && (
          <button
            onClick={onToggle}
            className="w-12 h-12 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors flex items-center justify-center"
            title="Развернуть"
          >
            <Menu className="size-5" />
          </button>
        )}

        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "w-9 h-9 rounded-lg transition-colors flex items-center justify-center",
              activeTab === tab.id ? "bg-indigo-100 text-indigo-700 font-bold" : "hover:bg-slate-100 text-slate-600",
              !expanded && "w-12 h-12"
            )}
            title={tab.label}
          >
            {tab.icon}
          </button>
        ))}

        {expanded && (
          <button
            onClick={onToggle}
            className="w-9 h-9 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors flex items-center justify-center ml-auto"
            title="Свернуть"
          >
            <Menu className="size-5" />
          </button>
        )}
      </div>

      {/* Middle Content */}
      <div className={cn("flex-1 flex flex-col min-h-0 overflow-hidden", expanded ? "px-4 py-4 gap-4" : "items-center px-2 py-4 gap-4")}>
        {activeTab === 'tools' && (
          <div className="flex flex-col h-full w-full gap-4 overflow-hidden">
            {expanded ? (
              <>
                {/* 3-Icon Toolbar */}
                <div className="flex items-center justify-between shrink-0 bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <button onClick={() => fileInputRef.current?.click()} className="p-3 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all flex flex-col items-center gap-1 min-w-[70px]" title="Импорт данных"><UploadCloud className="w-5 h-5" /><span className="text-[10px] font-bold uppercase tracking-tighter">Импорт</span></button>
                  <div className="w-px h-8 bg-slate-200" />
                  <button onClick={handleExport} className="p-3 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all flex flex-col items-center gap-1 min-w-[70px]" title="Экспорт таблицы"><Download className="w-5 h-5" /><span className="text-[10px] font-bold uppercase tracking-tighter">Экспорт</span></button>
                  <div className="w-px h-8 bg-slate-200" />
                  <button onClick={() => setIsResetConfirmOpen(true)} className="p-3 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all flex flex-col items-center gap-1 min-w-[70px]" title="Сброс проекта"><RotateCcw className="w-5 h-5" /><span className="text-[10px] font-bold uppercase tracking-tighter">Сброс</span></button>
                </div>

                {/* View Mode Switcher + Navigator (unified block, Spec Only) */}
                {currentStage === 'spec' && (
                  <div className="flex-1 overflow-hidden flex flex-col gap-0 border border-slate-200 rounded-xl bg-white min-h-[120px]">
                    {/* View switcher — expanded: text only, no icons */}
                    <div className="shrink-0 bg-slate-50 border-b border-slate-200 p-2">
                      <div className="grid grid-cols-3 bg-slate-100 p-1 rounded-lg h-9">
                        <button onClick={() => setViewMode('original')} className={cn("flex items-center justify-center rounded-md transition-all text-[11px] font-bold", viewMode === 'original' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700")} title="Оригинальный вид документа">Оригинал</button>
                        <button onClick={() => setViewMode('supplier')} className={cn("flex items-center justify-center rounded-md transition-all text-[11px] font-bold", viewMode === 'supplier' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700")} title="Группировка по поставщикам">Поставщик</button>
                        <button onClick={() => setViewMode('merged')} className={cn("flex items-center justify-center rounded-md transition-all text-[11px] font-bold", viewMode === 'merged' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700")} title="Сводная таблица материалов">Сводная</button>
                      </div>
                    </div>

                    {/* Navigator tree (hidden in merged mode) */}
                    {viewMode !== 'merged' && (
                      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 pb-3">
                        <div className="flex flex-col">
                          {getNavigatorTree().length === 0 ? (
                            <div className="text-xs text-slate-400 py-4 text-center">Нет структуры</div>
                          ) : (
                            getNavigatorTree().map((node) => (
                              <NavNode
                                key={node.id}
                                node={node}
                                activeIds={activeHeaderIds}
                                onSolo={(id: string) => setActiveHeaderIds((prev: string[]) => prev.length === 1 && prev[0] === id ? [] : [id])}
                                onToggle={(id: string, isolate?: boolean) => {
                                  if (isolate) {
                                    setActiveHeaderIds((prev: string[]) => prev.length === 1 && prev[0] === id ? [] : [id]);
                                  } else {
                                    setActiveHeaderIds((prev: string[]) => prev.includes(id) ? prev.filter((i: string) => i !== id) : [...prev, id]);
                                  }
                                }}
                              />
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Grid of actions at the bottom */}
                <div className="shrink-0 flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={selectAllRows} className="flex items-center justify-center gap-1.5 p-2.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-[10px] font-bold transition-colors" title="Выбрать все строки">
                      <CheckSquare className="w-4 h-4" /> Выбрать все
                    </button>
                    <button onClick={() => { setSelectedIds([]); setActiveHeaderIds([]); setIsOnlySelectedView(false); }} className="flex items-center justify-center gap-1.5 p-2.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-[10px] font-bold transition-colors" title="Сбросить выделение и навигатор">
                      <XSquare className="w-4 h-4" /> Сброс
                    </button>
                    <button
                      onClick={() => setIsOnlySelectedView(!isOnlySelectedView)}
                      disabled={selectedIds.length === 0 && !isOnlySelectedView}
                      className={cn(
                        "flex items-center justify-center gap-1.5 p-2.5 rounded-lg border text-[10px] font-bold transition-colors",
                        isOnlySelectedView
                          ? "bg-emerald-500 border-emerald-600 text-white hover:bg-emerald-600"
                          : selectedIds.length === 0
                            ? "bg-white border-slate-200 text-slate-300 cursor-not-allowed"
                            : "bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100"
                      )}
                      title={isOnlySelectedView ? "Показать все строки" : "Показать только выделенные"}
                    >
                      <Filter className="w-4 h-4" /> {isOnlySelectedView ? 'Показать все' : 'Оставить выбранные'}
                    </button>
                    <button onClick={deleteSelectedRows} disabled={selectedIds.length === 0} className={cn("flex items-center justify-center gap-1.5 p-2.5 rounded-lg border text-[10px] font-bold transition-colors", selectedIds.length === 0 ? "bg-white border-slate-200 text-slate-300 cursor-not-allowed" : "bg-red-50 border-red-200 text-red-600 hover:bg-red-100")} title="Удалить выделенные строки (с историей)">
                      <Trash2 className="w-4 h-4" /> Удалить выбранные
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={undo} disabled={!canUndo} className={cn("flex items-center justify-center gap-1.5 p-2.5 rounded-lg border text-[10px] font-bold transition-colors", !canUndo ? "bg-white border-slate-200 text-slate-200 cursor-not-allowed" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100")} title="Отменить последнее действие">
                      <Undo2 className="w-4 h-4" /> Шаг назад
                    </button>
                    <button onClick={redo} disabled={!canRedo} className={cn("flex items-center justify-center gap-1.5 p-2.5 rounded-lg border text-[10px] font-bold transition-colors", !canRedo ? "bg-white border-slate-200 text-slate-200 cursor-not-allowed" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100")} title="Повторить последнее действие">
                      <Redo2 className="w-4 h-4" /> Возврат
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4 h-full">
                {/* Top file actions */}
                <div className="flex flex-col gap-3 p-2 bg-slate-50 rounded-full border border-slate-200">
                  <span title="Импорт" className="cursor-pointer text-slate-400 hover:text-indigo-600 transition-colors" onClick={() => fileInputRef.current?.click()}>
                    <UploadCloud className="w-5 h-5" />
                  </span>
                  <span title="Экспорт" className="cursor-pointer text-slate-400 hover:text-emerald-600 transition-colors" onClick={handleExport}>
                    <Download className="w-5 h-5" />
                  </span>
                  <span title="Сброс" className="cursor-pointer text-slate-400 hover:text-red-500 transition-colors" onClick={() => setIsResetConfirmOpen(true)}>
                    <RotateCcw className="w-5 h-5" />
                  </span>
                </div>

                {/* View mode icons — collapsed: icons with blue highlight for active */}
                {currentStage === 'spec' && (
                  <div className="flex flex-col gap-3 p-2 bg-slate-50 rounded-full border border-slate-200">
                    <div
                      className={cn("w-8 h-8 flex items-center justify-center rounded-full cursor-pointer transition-colors", viewMode === 'original' ? "bg-indigo-100 text-indigo-600" : "text-slate-400 hover:text-indigo-600")}
                      onClick={() => setViewMode('original')} title="Оригинал"
                    >
                      <FileText className="w-4 h-4" />
                    </div>
                    <div
                      className={cn("w-8 h-8 flex items-center justify-center rounded-full cursor-pointer transition-colors", viewMode === 'supplier' ? "bg-blue-100 text-blue-600" : "text-slate-400 hover:text-blue-500")}
                      onClick={() => setViewMode('supplier')} title="Поставщик"
                    >
                      <Truck className="w-4 h-4" />
                    </div>
                    <div
                      className={cn("w-8 h-8 flex items-center justify-center rounded-full cursor-pointer transition-colors", viewMode === 'merged' ? "bg-emerald-100 text-emerald-600" : "text-slate-400 hover:text-emerald-500")}
                      onClick={() => setViewMode('merged')} title="Сводная"
                    >
                      <Layers className="w-4 h-4" />
                    </div>
                  </div>
                )}

                <div className="flex-1" />

                {/* Bottom action stack */}
                <div className="flex flex-col items-center gap-3 bg-slate-50 rounded-full p-2.5 border border-slate-200 mb-2">
                  <span title="Выбрать все" className="cursor-pointer text-slate-400 hover:text-indigo-600 transition-colors" onClick={selectAllRows}>
                    <CheckSquare className="w-4 h-4" />
                  </span>
                  <span title="Сброс выбора" className="cursor-pointer text-slate-400 hover:text-indigo-600 transition-colors" onClick={() => { setSelectedIds([]); setActiveHeaderIds([]); setIsOnlySelectedView(false); }}>
                    <XSquare className="w-4 h-4" />
                  </span>
                  <div className="w-6 h-px bg-slate-200 my-0.5" />
                  <span title={isOnlySelectedView ? "Показать все" : "Оставить выбранные"} className={cn("cursor-pointer transition-colors", isOnlySelectedView ? "text-emerald-500" : selectedIds.length > 0 ? "text-sky-500" : "text-slate-300 pointer-events-none")} onClick={() => setIsOnlySelectedView(!isOnlySelectedView)}>
                    <Filter className="w-4 h-4" />
                  </span>
                  <span title="Удалить выделенные" className={cn("cursor-pointer transition-colors", selectedIds.length > 0 ? "text-red-500" : "text-slate-300 pointer-events-none")} onClick={deleteSelectedRows}>
                    <Trash2 className="w-4 h-4" />
                  </span>
                  <div className="w-6 h-px bg-slate-200 my-0.5" />
                  <span title="Отменить" className={cn("cursor-pointer transition-colors", canUndo ? "text-slate-600 hover:text-indigo-600" : "text-slate-200 pointer-events-none")} onClick={undo}>
                    <Undo2 className="w-4 h-4" />
                  </span>
                  <span title="Повторить" className={cn("cursor-pointer transition-colors", canRedo ? "text-slate-600 hover:text-indigo-600" : "text-slate-200 pointer-events-none")} onClick={redo}>
                    <Redo2 className="w-4 h-4" />
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'info' && (
          <div className="flex flex-col gap-6">
            {expanded ? (
              <>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Общая сводка</div>
                <div className="flex flex-col gap-4">
                  {/* Metadata from Stamp (summary_md) */}
                  {(() => {
                    // Try to find the summary from any file in the current stage
                    const activeSummary = Object.values(uploadStatuses || {}).find(s => s.summary_md)?.summary_md;
                    
                    if (activeSummary) {
                      return (
                        <div className="bg-white p-5 rounded-xl border border-slate-200 text-slate-700 text-xs leading-relaxed shadow-sm">
                          <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                            {activeSummary.replace(/### Общая сводка\n\n/, '')}
                          </div>
                        </div>
                      );
                    }
                    
                    return (
                      <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 flex flex-col gap-4 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 font-medium">{getStageLabel(currentStage)}:</span>
                          <span className="font-bold text-slate-900 tabular-nums">{currentCount()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 font-medium">Загружено файлов:</span>
                          <span className="font-bold text-slate-900 tabular-nums">
                            {currentStage === 'invoice'
                              ? Array.from(new Set(invoiceRows.map((i: InvoiceRow) => i.documentName))).length
                              : currentStage === 'estimate'
                                ? new Set(estimateRows.map(r => r.fileId)).size
                                : Object.keys(filesMap || {}).length
                            }
                          </span>
                        </div>
                        <div className="h-px w-full bg-slate-200" />
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-tight">Итого по этапу</span>
                          <span className="font-extrabold text-indigo-700 text-xl tabular-nums">{getIntermediateTotal()} ₽</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {currentStage === 'invoice' && invoiceRows.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Статус связей</div>
                    <div className="bg-indigo-50/40 border border-indigo-100 p-5 rounded-xl flex flex-col gap-4 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-3 font-medium text-slate-700">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Идеальных:
                        </span>
                        <span className="font-bold text-emerald-700 tabular-nums">{invoiceRows.filter(r => r.match_data?.status === 'perfect').length}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-3 font-medium text-slate-700">
                          <div className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Неточных:
                        </span>
                        <span className="font-bold text-amber-700 tabular-nums">{invoiceRows.filter(r => r.match_data?.status === 'warning').length}</span>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-indigo-100">
                        <span className="flex items-center gap-3 font-medium text-slate-700">
                          <div className="w-2.5 h-2.5 rounded-full bg-red-400" /> Без связи:
                        </span>
                        <span className="font-bold text-red-600 tabular-nums">{invoiceRows.filter(r => !r.match_data || r.match_data.status === 'none').length}</span>
                      </div>
                      <div className="flex flex-col gap-1 pt-1">
                        <span className="text-[10px] uppercase font-bold text-red-400 tracking-tight">Сумма не связанных</span>
                        <span className="text-red-700 font-extrabold text-lg tabular-nums">{
                          invoiceRows
                            .filter(r => !r.match_data || r.match_data.status === 'none')
                            .reduce((acc, r) => acc + (parseFloat(String(r.total)) || 0), 0)
                            .toFixed(2)
                        } ₽</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col gap-4 items-center group cursor-help" title={`Итого: ${getIntermediateTotal()} ₽`}>
                <Info className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 transition-colors" />
              </div>
            )}
          </div>
        )}

        {activeTab === 'calc' && (
          <div className="flex flex-col gap-4">
            {expanded ? (
              <>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Помощники</div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center gap-4 cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 transition-all group">
                  <div className="p-2.5 bg-white rounded-lg shadow-sm group-hover:scale-110 transition-transform"><CalcIcon className="w-5 h-5 text-indigo-600" /></div>
                  <span className="text-sm font-bold text-slate-700">Единицы измерения</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center gap-4 cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 transition-all group">
                  <div className="p-2.5 bg-white rounded-lg shadow-sm group-hover:scale-110 transition-transform"><Percent className="w-5 h-5 text-indigo-600" /></div>
                  <span className="text-sm font-bold text-slate-700">Расчет наценки</span>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-6 items-center">
                <span title="Единицы измерения" className="cursor-pointer text-slate-400 hover:text-indigo-600 transition-colors">
                  <CalcIcon className="w-6 h-6" />
                </span>
                <span title="Расчет наценки" className="cursor-pointer text-slate-400 hover:text-indigo-600 transition-colors">
                  <Percent className="w-6 h-6" />
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer - Basement (Next Button) */}
      <div className="border-t border-slate-200 px-4 py-2 flex justify-center items-center h-16 bg-slate-50">
        {hasNextStage ? (
          <button
            onClick={() => {
              completeStage(currentStage);
              onNextStage();
            }}
            disabled={!canProceed}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl font-extrabold transition-all h-12",
              expanded ? "w-full px-6" : "w-12 p-0",
              canProceed
                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                : "bg-slate-800 text-slate-500 cursor-not-allowed opacity-50"
            )}
            title={canProceed ? "Перейти к следующему этапу" : "Загрузите данные для продолжения"}
          >
            {expanded && <span className="uppercase tracking-widest text-[#9fffcb] text-[10px] font-black">Продолжить</span>}
            <ArrowRight className={cn(expanded ? "w-4 h-4" : "w-5 h-5")} />
          </button>
        ) : (
          <div className={cn(
            "flex items-center justify-center gap-2 rounded-xl font-extrabold bg-indigo-600 text-white shadow-sm h-12",
            expanded ? "w-full px-6" : "w-12 p-0"
          )}>
            {expanded && <span className="uppercase tracking-widest text-[10px] font-black">Завершить</span>}
            <CheckCircle2 className={cn(expanded ? "w-4 h-4" : "w-5 h-5")} />
          </div>
        )}
      </div>
    </div>
  );
}
