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
  FileText
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Stage, RightPanelTab } from '../types';
import { useData, SpecRow, InvoiceRow, EstimateRow } from '../context/DataContext';
import { exportGeometryToXLSX, exportToXLSX } from '../utils/fileUtils';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
    matchInvoiceToSpec
  } = useData();

  const handleExport = () => {
    let headers: string[] = [];
    let data: string[][] = [];
    let filename = `DocOK_${currentStage}.xlsx`;

    if (currentStage === 'spec') {
      headers = ['Поз.', 'Наименование', 'Марка/Тип', 'Код', 'Поставщик', 'Ед. изм.', 'Кол-во', 'Масса 1 ед, кг', 'Примечание'];
      data = specRows.map((r: SpecRow, i: number) => [
        r.pos || String(i + 1), r.name || '', r.brand || '', r.code || '', r.supplier || '', r.unit || '', String(r.quantity || ''), r.mass || '', r.note || ''
      ]);
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
        "flex flex-col bg-white border-l border-slate-200 transition-all duration-300 ease-in-out shrink-0 h-full shadow-lg z-20",
        expanded ? "w-72" : "w-16"
      )}
    >
      <input type="file" multiple className="hidden" ref={fileInputRef} accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg" onChange={handleFileChange} />

      {/* Header - Attic */}
      <div className={cn(
        "p-4 border-b border-slate-200 h-[72px]",
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
      <div className={cn("flex-1 overflow-y-auto px-4 py-6", !expanded && "flex justify-center items-start pt-4")}>
        {activeTab === 'tools' && (
          <div className="flex flex-col gap-6">
            {expanded ? (
              <>
                {/* 3-Icon Toolbar */}
                <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all flex flex-col items-center gap-1 min-w-[70px]"
                    title="Импорт данных"
                  >
                    <UploadCloud className="w-5 h-5" />
                    <span className="text-[10px] font-bold uppercase tracking-tighter">Импорт</span>
                  </button>
                  <div className="w-px h-8 bg-slate-200" />
                  <button 
                    onClick={handleExport}
                    className="p-3 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all flex flex-col items-center gap-1 min-w-[70px]"
                    title="Экспорт таблицы"
                  >
                    <Download className="w-5 h-5" />
                    <span className="text-[10px] font-bold uppercase tracking-tighter">Экспорт</span>
                  </button>
                  <div className="w-px h-8 bg-slate-200" />
                  <button 
                    onClick={() => setIsResetConfirmOpen(true)}
                    className="p-3 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all flex flex-col items-center gap-1 min-w-[70px]"
                    title="Сброс проекта"
                  >
                    <RotateCcw className="w-5 h-5" />
                    <span className="text-[10px] font-bold uppercase tracking-tighter">Сброс</span>
                  </button>
                </div>

                {/* View Mode Switcher (Spec Only) */}
                {currentStage === 'spec' && (
                  <div className="space-y-3">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Режим отображения</div>
                    <div className="grid grid-cols-3 bg-slate-100 p-1 rounded-lg border border-slate-200 h-11">
                      <button
                        onClick={() => setViewMode('original')}
                        className={cn(
                          "flex items-center justify-center gap-1.5 rounded-md transition-all text-[11px] font-bold",
                          viewMode === 'original' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                        title="Оригинальный вид (ГОСТ)"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Док.
                      </button>
                      <button
                        onClick={() => setViewMode('supplier')}
                        className={cn(
                          "flex items-center justify-center gap-1.5 rounded-md transition-all text-[11px] font-bold",
                          viewMode === 'supplier' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                        title="Группировка по поставщикам"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        Пост.
                      </button>
                      <button
                        onClick={() => setViewMode('merged')}
                        className={cn(
                          "flex items-center justify-center gap-1.5 rounded-md transition-all text-[11px] font-bold",
                          viewMode === 'merged' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                        title="Сводная таблица материалов"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        Свод.
                      </button>
                    </div>
                  </div>
                )}

                {currentStage === 'invoice' && invoiceRows.length > 0 && (
                   <button 
                     onClick={matchInvoiceToSpec}
                     className="flex items-center justify-center gap-3 w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all text-sm font-bold shadow-indigo-100 shadow-lg group">
                     <Merge className="w-4 h-4 text-indigo-200 group-hover:scale-110 transition-transform" />
                     Связать со спецификой
                   </button>
                )}

                {currentStage === 'spec' && pdfGeometry && (
                  <button 
                    onClick={() => exportGeometryToXLSX(pdfGeometry, 'geometry_spec.xlsx')}
                    className="flex items-center gap-3 px-4 py-2 border border-emerald-100 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-700 rounded-lg transition-colors text-xs font-semibold w-full"
                  >
                    <Download className="w-4 h-4 text-emerald-500" /> Экспорт геометрии
                  </button>
                )}

                {currentStage === 'estimate' && (
                  <button 
                    onClick={handleExport}
                    className="flex items-center justify-center gap-3 px-4 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all text-sm font-bold shadow-indigo-200 shadow-xl w-full group"
                  >
                    <Download className="w-5 h-5 text-indigo-200 group-hover:translate-y-0.5 transition-transform" />
                    Экспорт финальной сметы
                  </button>
                )}

                <div className="w-full h-px bg-slate-100 my-2" />

                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Выделение и фильтры</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={selectAllRows}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg transition-colors text-[11px] font-bold border border-slate-200">
                      <CheckSquare className="w-3.5 h-3.5 text-slate-500" /> Все
                    </button>
                    <button 
                      onClick={() => setSelectedIds([])}
                      disabled={selectedIds.length === 0}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-50 disabled:opacity-50 hover:bg-slate-100 text-slate-700 rounded-lg transition-colors text-[11px] font-bold border border-slate-200">
                      <XSquare className="w-3.5 h-3.5 text-slate-500" /> Сброс
                    </button>
                  </div>
                  
                  <button 
                    onClick={deleteSelectedRows}
                    disabled={selectedIds.length === 0}
                    className={cn(
                      "flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg transition-all text-xs font-bold w-full border",
                      selectedIds.length === 0 
                        ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed" 
                        : "bg-red-50 border-red-100 text-red-600 hover:bg-red-100"
                    )}>
                    <Trash2 className="w-4 h-4" /> Удалить выбранные ({selectedIds.length})
                  </button>

                  <button 
                    onClick={() => setIsOnlySelectedView(!isOnlySelectedView)}
                    disabled={selectedIds.length === 0 && !isOnlySelectedView}
                    className={cn(
                      "flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg transition-all text-xs font-bold w-full border",
                      isOnlySelectedView 
                        ? "bg-indigo-600 border-indigo-700 text-white shadow-md shadow-indigo-100" 
                        : selectedIds.length === 0 
                          ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed" 
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    )}>
                    <Filter className={cn("w-4 h-4", isOnlySelectedView ? "text-indigo-200" : "text-slate-500")} />
                    {isOnlySelectedView ? 'Показать все строки' : 'Только выделенные'}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-6 items-center" title="Инструменты">
                 <UploadCloud className="w-6 h-6 text-slate-400 hover:text-indigo-600 cursor-pointer transition-colors" onClick={() => fileInputRef.current?.click()} title="Импорт" />
                 <Download className="w-6 h-6 text-slate-400 hover:text-emerald-600 cursor-pointer transition-colors" onClick={handleExport} title="Экспорт" />
                 <RotateCcw className="w-6 h-6 text-slate-400 hover:text-red-500 cursor-pointer transition-colors" onClick={() => resetData(currentStage)} title="Сброс" />
                 
                 <div className="w-8 h-px bg-slate-200 my-2" />
                 
                 <Layers className={cn(
                   "w-6 h-6 cursor-pointer transition-colors",
                   viewMode === 'merged' ? "text-emerald-600" : "text-slate-400 hover:text-indigo-600"
                 )} onClick={() => setViewMode('merged')} title="Сводная" />
                 
                 <Truck className={cn(
                   "w-6 h-6 cursor-pointer transition-colors",
                   viewMode === 'supplier' ? "text-blue-600" : "text-slate-400 hover:text-indigo-600"
                 )} onClick={() => setViewMode('supplier')} title="Поставщики" />

                 <div className="w-8 h-px bg-slate-200 my-2" />
                 
                 {selectedIds.length > 0 && <Trash2 className="w-6 h-6 text-red-400 hover:text-red-600 cursor-pointer" onClick={deleteSelectedRows} />}
                 <Filter className={cn(
                   "w-6 h-6 cursor-pointer transition-colors",
                   isOnlySelectedView ? "text-indigo-600" : "text-slate-400 hover:text-indigo-600"
                 )} onClick={() => setIsOnlySelectedView(!isOnlySelectedView)} />
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
