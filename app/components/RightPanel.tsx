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
  Filter
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
    handleFile, isMerged, toggleMerge, pdfGeometry, 
    estimateRows, estimateTotal, specRows, invoiceRows,
    resetData, sortRows, groupRows, filesMap, completeStage,
    selectedIds, setSelectedIds, selectAllRows, deleteSelectedRows,
    isOnlySelectedView, setIsOnlySelectedView
  } = useData();

  const handleExport = () => {
    let headers: string[] = [];
    let data: string[][] = [];
    let filename = `DocOK_${currentStage}.xlsx`;

    if (currentStage === 'spec') {
      headers = ['№', 'Наименование', 'Артикул', 'Кол-во', 'Ед. изм.', 'Примечание'];
      data = specRows.map((r: SpecRow, i: number) => [
        String(i + 1), r.name || '', r.code || '', String(r.quantity || ''), r.unit || '', r.note || ''
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
    const f = e.target.files?.[0];
    if (f) handleFile(f, currentStage, false);
    e.target.value = '';
  };

  const renderTabIcon = (tab: RightPanelTab) => {
    switch (tab) {
      case 'tools': return <Settings2 className="size-5" />;
      case 'info': return <Info className="size-5" />;
      case 'calc': return <Calculator className="size-5" />;
    }
  };

  const tabs: { id: RightPanelTab; icon: React.ReactNode; label: string }[] = [
    { id: 'tools', icon: <Settings2 className="size-5" />, label: 'Инструменты' },
    { id: 'info', icon: <Info className="size-5" />, label: 'Информация' },
    { id: 'calc', icon: <Calculator className="size-5" />, label: 'Конвертеры' },
  ];

  return (
    <div 
      className={cn(
        "flex flex-col bg-white border-l border-slate-200 transition-all duration-300 ease-in-out shrink-0 h-full",
        expanded ? "w-72" : "w-16"
      )}
    >
      <input type="file" className="hidden" ref={fileInputRef} accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg" onChange={handleFileChange} />

      {/* Header - Attic */}
      <div className={cn(
        "p-4 border-b border-slate-200 h-[72px]",
        expanded ? "grid grid-cols-4 items-center justify-items-center gap-0" : "flex flex-col items-center gap-4 py-4 h-auto"
      )}>
        {/* Toggle button always first in collapsed view */}
        {!expanded && (
          <button 
            onClick={onToggle}
            className="w-12 h-12 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors flex items-center justify-center mb-0"
            title="Развернуть"
          >
            <Menu className="size-5" />
          </button>
        )}

        {/* Tab buttons */}
        {tabs.map((tab) => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "w-9 h-9 rounded-lg transition-colors flex items-center justify-center",
              activeTab === tab.id ? "bg-indigo-100 text-indigo-700" : "hover:bg-slate-100 text-slate-600",
              !expanded && "w-12 h-12"
            )}
            title={tab.label}
          >
            {tab.icon}
          </button>
        ))}

        {/* Toggle button always last in expanded view */}
        {expanded && (
          <button 
            onClick={onToggle}
            className="w-9 h-9 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors flex items-center justify-center"
            title="Свернуть"
          >
            <Menu className="size-5" />
          </button>
        )}
      </div>

      {/* Middle Content - Switchable based on activeTab */}
      <div className={cn("flex-1 overflow-y-auto", !expanded && "flex justify-center items-start pt-4")}>
        {activeTab === 'tools' && (
          <div className="flex flex-col gap-4 p-4">
            {expanded ? (
              <>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Действия</div>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-3 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-md transition-colors text-sm">
                  <UploadCloud className="w-4 h-4 text-slate-500" /> Импорт данных
                </button>
                 <button 
                  onClick={handleExport}
                  className="flex items-center gap-3 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-md transition-colors text-sm">
                  <Download className="w-4 h-4 text-slate-500" /> Экспорт таблицы
                </button>
                <button 
                  onClick={() => resetData(currentStage)}
                  className="flex items-center gap-3 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-red-600 rounded-md transition-colors text-sm">
                  <RotateCcw className="w-4 h-4 text-red-500" /> Сброс
                </button>

                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-4 mb-2">Работа с данными</div>
                {currentStage === 'spec' && (
                  <>
                    <button 
                      onClick={toggleMerge}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2 rounded-md transition-colors text-sm w-full",
                        isMerged ? "bg-indigo-50 text-indigo-700 font-semibold" : "bg-slate-50 hover:bg-slate-100 text-slate-700"
                      )}
                    >
                      {isMerged ? <RotateCcw className="w-4 h-4" /> : <Merge className="w-4 h-4" />}
                      {isMerged ? "Разъединить дубли" : "Объединить дубли"}
                    </button>
                    {pdfGeometry && (
                      <button 
                        onClick={() => exportGeometryToXLSX(pdfGeometry, 'geometry_spec.xlsx')}
                        className="flex items-center gap-3 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-md transition-colors text-sm w-full"
                      >
                        <Download className="w-4 h-4 text-emerald-500" /> Экспорт геометрии
                      </button>
                    )}
                  </>
                )}
                {currentStage === 'estimate' && (
                  <button 
                    onClick={handleExport}
                    className="flex items-center gap-3 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all text-sm font-bold shadow-md hover:shadow-lg w-full"
                  >
                    <Download className="w-4 h-4" /> Экспорт финальной сметы
                  </button>
                )}
                <button 
                  onClick={() => groupRows(currentStage, 'name')}
                  className="flex items-center gap-3 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-md transition-colors text-sm">
                  <Rows3 className="w-4 h-4 text-slate-500" /> Группировка
                </button>
                <button 
                  onClick={() => sortRows(currentStage, 'name')}
                  className="flex items-center gap-3 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-md transition-colors text-sm">
                  <ArrowUpDown className="w-4 h-4 text-slate-500" /> Сортировка
                </button>

                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-4 mb-2">Выделение</div>
                <button 
                  onClick={selectAllRows}
                  className="flex items-center gap-3 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-md transition-colors text-sm">
                  <CheckSquare className="w-4 h-4 text-slate-500" /> Выбрать все
                </button>
                <button 
                  onClick={() => setSelectedIds([])}
                  disabled={selectedIds.length === 0}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2 rounded-md transition-colors text-sm",
                    selectedIds.length === 0 ? "bg-slate-50 text-slate-300 cursor-not-allowed" : "bg-slate-50 hover:bg-slate-100 text-slate-700"
                  )}>
                  <XSquare className="w-4 h-4" /> Сброс выделения
                </button>
                <button 
                  onClick={deleteSelectedRows}
                  disabled={selectedIds.length === 0}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2 rounded-md transition-colors text-sm",
                    selectedIds.length === 0 ? "bg-slate-50 text-slate-300 cursor-not-allowed" : "bg-red-50 hover:bg-red-100 text-red-600"
                  )}>
                  <Trash2 className="w-4 h-4" /> Удалить выбранные
                </button>
                <button 
                  onClick={() => setIsOnlySelectedView(!isOnlySelectedView)}
                  disabled={selectedIds.length === 0 && !isOnlySelectedView}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2 rounded-md transition-colors text-sm w-full",
                    isOnlySelectedView 
                      ? "bg-indigo-50 text-indigo-700 font-semibold" 
                      : selectedIds.length === 0 
                        ? "bg-slate-50 text-slate-300 cursor-not-allowed" 
                        : "bg-slate-50 hover:bg-slate-100 text-slate-700"
                  )}>
                  <Filter className="w-4 h-4" />
                  {isOnlySelectedView ? 'Показать все' : 'Оставить выделенные'}
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-4" title="Инструменты">
                 <UploadCloud className="w-6 h-6 text-slate-500 hover:text-indigo-600 cursor-pointer" onClick={() => fileInputRef.current?.click()} />
                 <Download className="w-6 h-6 text-slate-500 hover:text-indigo-600 cursor-pointer" onClick={handleExport} />
                 <RotateCcw className="w-6 h-6 text-red-500 hover:text-red-700 cursor-pointer" onClick={() => resetData(currentStage)} />
                 <div className="w-full h-px bg-slate-200 my-2" />
                 {currentStage === 'spec' && (
                   <>
                     {isMerged ? (
                       <RotateCcw className="w-6 h-6 text-indigo-600 cursor-pointer" onClick={toggleMerge} title="Разъединить дубли" />
                     ) : (
                       <Merge className="w-6 h-6 text-slate-500 hover:text-indigo-600 cursor-pointer" onClick={toggleMerge} title="Объединить дубли" />
                     )}
                   </>
                 )}
                 {currentStage === 'estimate' && (
                   <Download className="w-6 h-6 text-indigo-600 cursor-pointer" onClick={handleExport} title="Экспорт сметы" />
                 )}
                 <Rows3 className="w-6 h-6 text-slate-500 hover:text-indigo-600 cursor-pointer" onClick={() => groupRows(currentStage, 'name')} />
                 <ArrowUpDown className="w-6 h-6 text-slate-500 hover:text-indigo-600 cursor-pointer" onClick={() => sortRows(currentStage, 'name')} />
              </div>
            )}
          </div>
        )}

        {activeTab === 'info' && (
          <div className="flex flex-col gap-4 p-4">
             {expanded ? (
               <>
                 <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Общая сводка</div>
                 <div className="bg-slate-50 p-4 rounded-lg flex flex-col gap-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">{getStageLabel(currentStage)}:</span>
                      <span className="font-semibold text-slate-900">{currentCount()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Загружено файлов:</span>
                      <span className="font-semibold text-slate-900">
                        {currentStage === 'invoice' 
                          ? Array.from(new Set(invoiceRows.map((i: InvoiceRow) => i.documentName))).length 
                          : Object.keys(filesMap || {}).length}
                      </span>
                    </div>
                    <div className="h-px w-full bg-slate-200 my-1" />
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-medium whitespace-nowrap">Итого по этапу:</span>
                      <span className="font-bold text-indigo-700 text-right">{getIntermediateTotal()} ₽</span>
                    </div>
                 </div>
               </>
             ) : (
               <div className="flex flex-col gap-4 items-center group cursor-help" title={`Итого: ${getIntermediateTotal()} ₽`}>
                  <Info className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 transition-colors" />
               </div>
             )}
          </div>
        )}

        {activeTab === 'calc' && (
          <div className="flex flex-col gap-4 p-4">
             {expanded ? (
               <>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Конвертеры</div>
                  <div className="bg-slate-50 p-3 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-indigo-50 transition-colors">
                    <div className="p-2 bg-white rounded-md shadow-sm"><CalcIcon className="w-4 h-4 text-indigo-600" /></div>
                    <span className="text-sm font-medium text-slate-700">Единицы измерения</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-indigo-50 transition-colors">
                    <div className="p-2 bg-white rounded-md shadow-sm"><Percent className="w-4 h-4 text-indigo-600" /></div>
                    <span className="text-sm font-medium text-slate-700">Расчет наценки</span>
                  </div>
               </>
             ) : (
               <div className="flex flex-col gap-4 items-center">
                  <CalcIcon className="w-6 h-6 text-slate-500 hover:text-indigo-600 cursor-pointer" title="Единицы измерения" />
                  <Percent className="w-6 h-6 text-slate-500 hover:text-indigo-600 cursor-pointer" title="Расчет наценки" />
               </div>
             )}
          </div>
        )}
      </div>

      {/* Footer - Basement (Next Button) */}
      <div className={cn(
        "border-t border-slate-200 p-4 flex justify-center items-center h-[72px]"
      )}>
        {hasNextStage ? (
          <button 
            onClick={() => {
              completeStage(currentStage);
              onNextStage();
            }}
            disabled={!canProceed}
            className={cn(
              "w-full flex items-center justify-center gap-2 rounded-lg font-medium transition-all",
              expanded ? "px-4 py-3" : "w-12 h-12 p-0 rounded-xl",
              canProceed 
                ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm" 
                : "bg-slate-800 text-slate-400 cursor-not-allowed"
            )}
            title={canProceed ? "Перейти к следующему этапу" : "Данные не заполнены"}
          >
            {expanded && <span>Далее</span>}
            <ArrowRight className={cn(expanded ? "w-4 h-4" : "w-5 h-5")} />
          </button>
        ) : (
           <div className={cn(
            "w-full flex items-center justify-center gap-2 rounded-lg font-medium bg-indigo-600 text-white shadow-sm",
            expanded ? "px-4 py-3" : "w-12 h-12 p-0 rounded-xl"
          )}>
             {expanded && <span>Завершить</span>}
             <CheckCircle2 className={cn(expanded ? "w-4 h-4" : "w-5 h-5")} />
          </div>
        )}
      </div>
    </div>
  );
}
