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
  ArrowUpDown,
  Calculator as CalcIcon,
  Percent,
  CheckCircle2,
  Merge,
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
  SaveAll,
  Check
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Stage, RightPanelTab } from '../types';
import { useData, SpecRow, InvoiceRow, EstimateRow } from '../context/DataContext';
import { exportGeometryToXLSX, exportToXLSX, exportSpecToExcel } from '../utils/fileUtils';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const NavNode = ({ 
  node, activeIds, onSolo, onToggle, level = 0 
}: { 
  key?: string; 
  node: any; 
  activeIds: string[]; 
  onSolo: (id: string) => void;
  onToggle: (id: string) => void; 
  level?: number 
}) => {
  const isSelected = activeIds.includes(node.id);
  const [isExpanded, setIsExpanded] = React.useState(true);
  const hasChildren = node.children && node.children.length > 0;

  // Visual style per level
  const labelStyle = level === 0
    ? 'text-[13px] font-bold text-slate-800'
    : level === 1
    ? 'text-[12px] font-semibold text-slate-700'
    : 'text-[11px] font-medium text-slate-600';

  const leftBorderClass = level === 1 ? 'border-l border-slate-200 ml-4 pl-1' : level === 2 ? 'border-l border-slate-100 ml-8 pl-1' : '';

  return (
    <div className={cn('flex flex-col', leftBorderClass, level === 0 && 'mt-0.5')}>
      <div
        className={cn(
          'flex items-center gap-1.5 rounded-md transition-colors py-0.5 px-1 group',
          isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'
        )}
      >
        {/* Expand/collapse toggle */}
        <div
          className={cn('w-3.5 h-3.5 flex shrink-0 items-center justify-center cursor-pointer text-slate-300 hover:text-slate-500 transition-colors', !hasChildren && 'opacity-0 pointer-events-none')}
          onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
        >
          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </div>

        {/* Checkbox — multi-select */}
        <div
          className={cn(
            'w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 transition-all cursor-pointer',
            isSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-300 bg-white group-hover:border-indigo-400'
          )}
          onClick={(e) => { e.stopPropagation(); onToggle(node.id); }}
        >
          {isSelected && <Check className="w-2 h-2 stroke-[3]" />}
        </div>

        {/* Label — solo focus click */}
        <span
          className={cn('flex-1 truncate select-none leading-tight cursor-pointer', labelStyle, isSelected && 'text-indigo-700')}
          title={node.name}
          onClick={() => onSolo(node.id)}
        >
          {node.name}
        </span>
      </div>

      {isExpanded && hasChildren && (
        <div className="flex flex-col">
          {node.children.map((child: any) => (
            <NavNode key={child.id} node={child} activeIds={activeIds} onSolo={onSolo} onToggle={onToggle} level={level + 1} />
          ))}
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
    resetData, sortRows, groupRows, filesMap, completeStage,
    selectedIds, setSelectedIds, selectAllRows, deleteSelectedRows,
    isOnlySelectedView, setIsOnlySelectedView, setIsResetConfirmOpen,
    matchInvoiceToSpec, getCurrentRows, projectName,
    activeHeaderIds, setActiveHeaderIds, getNavigatorTree,
    keepSelectedRows, undo, redo, canUndo, canRedo
  } = useData();

  const handleExport = () => {
    let headers: string[] = [];
    let data: string[][] = [];
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    const modeLabel = viewMode === 'merged' ? 'Сводная' : viewMode === 'supplier' ? 'Поставщики' : 'Оригинал';
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
    if (parseFloat(estimateTotal) > 0) return estimateTotal;
    
    if (currentStage === 'invoice') {
      return invoiceRows.reduce((acc: number, r: InvoiceRow) => acc + (parseFloat(String(r.total)) || 0), 0).toFixed(2);
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
                    {/* View switcher */}
                    <div className="shrink-0 bg-slate-50 border-b border-slate-200 p-2">
                      <div className="grid grid-cols-3 bg-slate-100 p-1 rounded-lg h-9">
                        <button onClick={() => setViewMode('original')} className={cn("flex items-center justify-center gap-1.5 rounded-md transition-all text-[11px] font-bold", viewMode === 'original' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700")} title="Оригинальный вид (ГОСТ)"><FileText className="w-3.5 h-3.5" />Док</button>
                        <button onClick={() => setViewMode('supplier')} className={cn("flex items-center justify-center gap-1.5 rounded-md transition-all text-[11px] font-bold", viewMode === 'supplier' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700")} title="Группировка по поставщикам"><Truck className="w-3.5 h-3.5" />Пост</button>
                        <button onClick={() => setViewMode('merged')} className={cn("flex items-center justify-center gap-1.5 rounded-md transition-all text-[11px] font-bold", viewMode === 'merged' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700")} title="Сводная таблица материалов"><Layers className="w-3.5 h-3.5" />Свод</button>
                      </div>
                    </div>
                    
                    {/* Navigator tree (hidden in merged mode) */}
                    {viewMode !== 'merged' && (
                      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 pb-3">
                        <div className="flex flex-col">
                          {getNavigatorTree().length === 0 ? (
                            <div className="text-xs text-slate-400 py-4 text-center">Нет структуры</div>
                          ) : (
                            getNavigatorTree().map((node: any) => (
                              <NavNode
                                key={node.id}
                                node={node}
                                activeIds={activeHeaderIds}
                                onSolo={(id: string) => setActiveHeaderIds([id])}
                                onToggle={(id: string) => setActiveHeaderIds((prev: string[]) => prev.includes(id) ? prev.filter((i: string) => i !== id) : [...prev, id])}
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
                      <Trash2 className="w-4 h-4" /> Удалить
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
                  <UploadCloud className="w-5 h-5 text-slate-400 hover:text-indigo-600 cursor-pointer" onClick={() => fileInputRef.current?.click()} title="Импорт" />
                  <Download className="w-5 h-5 text-slate-400 hover:text-emerald-600 cursor-pointer" onClick={handleExport} title="Экспорт" />
                  <RotateCcw className="w-5 h-5 text-slate-400 hover:text-red-500 cursor-pointer" onClick={() => setIsResetConfirmOpen(true)} title="Сброс" />
                </div>

                {/* View mode icons */}
                {currentStage === 'spec' && (
                  <div className="flex flex-col gap-3 p-2 bg-slate-50 rounded-full border border-slate-200">
                    <FileText className={cn("w-5 h-5 cursor-pointer", viewMode==='original'?"text-indigo-600":"text-slate-400 hover:text-indigo-600")} onClick={() => setViewMode('original')} title="Оригинал" />
                    <Truck className={cn("w-5 h-5 cursor-pointer", viewMode==='supplier'?"text-blue-600":"text-slate-400 hover:text-indigo-600")} onClick={() => setViewMode('supplier')} title="Поставщики" />
                    <Layers className={cn("w-5 h-5 cursor-pointer", viewMode==='merged'?"text-emerald-600":"text-slate-400 hover:text-indigo-600")} onClick={() => setViewMode('merged')} title="Сводная" />
                  </div>
                )}

                <div className="flex-1" />

                {/* Bottom action stack */}
                <div className="flex flex-col items-center gap-3 bg-slate-50 rounded-full p-2.5 border border-slate-200 mb-2">
                  <CheckSquare className="w-4 h-4 text-slate-400 hover:text-indigo-600 cursor-pointer" onClick={selectAllRows} title="Выбрать все" />
                  <XSquare className="w-4 h-4 text-slate-400 hover:text-indigo-600 cursor-pointer" onClick={() => { setSelectedIds([]); setActiveHeaderIds([]); setIsOnlySelectedView(false); }} title="Сброс выбора" />
                  <div className="w-6 h-px bg-slate-200 my-0.5" />
                  <Filter
                    className={cn("w-4 h-4 cursor-pointer transition-colors", isOnlySelectedView ? "text-emerald-500" : selectedIds.length > 0 ? "text-sky-500" : "text-slate-300 pointer-events-none")}
                    onClick={() => setIsOnlySelectedView(!isOnlySelectedView)}
                    title={isOnlySelectedView ? "Показать все" : "Оставить выбранные"}
                  />
                  <Trash2 className={cn("w-4 h-4 cursor-pointer", selectedIds.length>0 ? "text-red-500" : "text-slate-300 pointer-events-none")} onClick={deleteSelectedRows} title="Удалить выделенные" />
                  <div className="w-6 h-px bg-slate-200 my-0.5" />
                  <Undo2 className={cn("w-4 h-4 cursor-pointer transition-colors", canUndo?"text-slate-600 hover:text-indigo-600":"text-slate-200 pointer-events-none")} onClick={undo} title="Отменить" />
                  <Redo2 className={cn("w-4 h-4 cursor-pointer transition-colors", canRedo?"text-slate-600 hover:text-indigo-600":"text-slate-200 pointer-events-none")} onClick={redo} title="Повторить" />
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
                  <CalcIcon className="w-6 h-6 text-slate-400 hover:text-indigo-600 cursor-pointer transition-colors" title="Единицы измерения" />
                  <Percent className="w-6 h-6 text-slate-400 hover:text-indigo-600 cursor-pointer transition-colors" title="Расчет наценки" />
               </div>
             )}
          </div>
        )}
      </div>

      {/* Footer - Basement (Next Button) */}
      <div className={cn(
        "border-t border-slate-200 p-4 flex justify-center items-center h-20 bg-slate-50"
      )}>
        {hasNextStage ? (
          <button 
            onClick={() => {
              completeStage(currentStage);
              onNextStage();
            }}
            disabled={!canProceed}
            className={cn(
              "w-full flex items-center justify-center gap-3 rounded-xl font-extrabold transition-all",
              expanded ? "px-6 py-4" : "w-12 h-12 p-0",
              canProceed 
                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100 shadow-xl" 
                : "bg-slate-800 text-slate-500 cursor-not-allowed opacity-50"
            )}
            title={canProceed ? "Перейти к следующему этапу" : "Загрузите данные для продолжения"}
          >
            {expanded && <span className="uppercase tracking-widest text-xs">Продолжить</span>}
            <ArrowRight className={cn(expanded ? "w-5 h-5" : "w-6 h-6")} />
          </button>
        ) : (
           <div className={cn(
            "w-full flex items-center justify-center gap-3 rounded-xl font-extrabold bg-indigo-600 text-white shadow-indigo-100 shadow-xl",
            expanded ? "px-6 py-4" : "w-12 h-12 p-0"
          )}>
             {expanded && <span className="uppercase tracking-widest text-xs">Завершить</span>}
             <CheckCircle2 className={cn(expanded ? "w-5 h-5" : "w-6 h-6")} />
          </div>
        )}
      </div>
    </div>
  );
}
