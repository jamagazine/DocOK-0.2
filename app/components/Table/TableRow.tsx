import React, { Fragment } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  ChevronDown, 
  ChevronRight, 
  AlertTriangle, 
  Edit2, 
  Database, 
  MapPin, 
  Folders, 
  UserCheck, 
  Layers 
} from 'lucide-react';
import { EditableCell } from './EditableCell';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface Column {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  width?: string;
}

interface TableRowProps {
  row: any;
  columns: Column[];
  stage: 'spec' | 'request' | 'invoice' | 'estimate';
  actualIndex: number;
  isSelected: boolean;
  selectedIds: string[];
  toggleRowSelection: (id: string, isCellClick: boolean) => void;
  onUpdate: (rowId: string, colKey: string, value: any) => void;
  // Spec specific
  viewMode?: 'original' | 'supplier' | 'merged';
  isExpanded?: boolean;
  toggleExpand?: (id: string) => void;
  isCollapsed?: boolean;
  toggleCollapse?: (id: string) => void;
  // Invoice specific
  specRows?: any[]; // for the manual match dropdown
  // Optional navigation hooks
  onKeyDown?: (e: React.KeyboardEvent, rowId: string, colKey: string) => void;
}

export const TableRow = React.memo(({
  row,
  columns,
  stage,
  actualIndex,
  isSelected,
  selectedIds,
  toggleRowSelection,
  onUpdate,
  isExpanded: parentIsExpanded,
  toggleExpand: parentToggleExpand,
  isCollapsed,
  toggleCollapse,
  specRows = [],
  onKeyDown,
  viewMode = 'original'
}: TableRowProps) => {
  const [localExpanded, setLocalExpanded] = React.useState(false);

  const isMergedRow = String(row.id).startsWith('merged_');
  const isSupplierRow = String(row.id).startsWith('supplier_');
  const isSummaryRow = isMergedRow || isSupplierRow;

  // ШАГ 2: Реально сгруппированная строка (больше 1 элемента)
  const isActuallyMerged = isMergedRow && row.children && row.children.length > 1;


  const hasChildren = row.children && row.children.length > 0;
  // ШАГ 1: Более четкая категоризация заголовков и групп
  const isWorkType = row.row_type === 'WORK_TYPE' || (!row.pos && row.is_header && !isSummaryRow && row.name === String(row.name).toUpperCase() && String(row.name).length > 3);
  const isLocation = !isSummaryRow && (row.row_type === 'LOCATION' || row.pos === '§');
  const isGroup = !isSummaryRow && (row.row_type === 'GROUP' || (row.is_header && !isLocation && !isWorkType));
  
  // Ribbon Row — это любая строка, которая рендерится «на всю ширину» (заголовок или группа)
  const isRibbonRow = isWorkType || isLocation || isGroup || isSupplierRow || isActuallyMerged;
  const isHeader = isWorkType || isLocation || isGroup;

  const baseRowClasses = cn(
    "flex items-center text-sm border-b border-slate-100 transition-colors group cursor-pointer",
    stage === 'estimate' ? "min-h-[56px]" : "min-h-[48px]",
    isSelected && "bg-indigo-50/50",
    row.math_error && stage === 'request' && "bg-red-50/70 hover:bg-red-100/70",
    row.isUncertain && stage === 'invoice' && "bg-amber-50/50",
    (stage === 'request' || stage === 'invoice' || stage === 'estimate') && "hover:bg-slate-50",
    // Spec specific classes:
    // 1. Главный заголовок (Вид работ) - Чистый Индиго 600 с ярким акцентом
    stage === 'spec' && isWorkType && "bg-indigo-600 text-white hover:bg-indigo-500 border-l-4 border-l-indigo-400 border-b border-indigo-700 shadow-md transition-all",
    // 2. Место (Локация) - Глубокий Индиго 800 с мягким акцентом
    stage === 'spec' && isLocation && "bg-indigo-800 text-white hover:bg-indigo-900 font-bold border-l-4 border-l-indigo-400 border-b border-indigo-950 shadow-sm transition-all",
    // 3. Группы - Светлое Индиго с бортом
    stage === 'spec' && isGroup && "bg-indigo-50/50 text-indigo-900 border-l-4 border-l-indigo-500 hover:bg-indigo-100/60 transition-all",
    // 4. Поставщики - Голубой Индиго с бортом
    stage === 'spec' && isSupplierRow && "bg-blue-50/40 text-blue-900 border-l-4 border-l-blue-400 hover:bg-blue-100/50 transition-all",
    // 5. Сводные - Изумрудный Индиго с бортом
    stage === 'spec' && isActuallyMerged && cn(
      "bg-emerald-50/30 text-emerald-950 border-l-4 border-l-emerald-500 transition-all",
      (parentIsExpanded || localExpanded) ? "bg-emerald-100/50" : "hover:bg-emerald-100/40"
    ),

    stage === 'spec' && !isSummaryRow && hasChildren && !isHeader && "bg-slate-50/30",
    stage === 'spec' && !isRibbonRow && "hover:bg-slate-50/80 cursor-pointer"
  );

  return (
    <Fragment>
      <div
        onClick={() => {
          if (stage === 'spec' && isHeader) {
            toggleCollapse?.(row.id);
            return;
          }
          if (isSummaryRow) {
            if (toggleCollapse) toggleCollapse(row.id);
            else setLocalExpanded(!localExpanded);
            return;
          }
          toggleRowSelection(row.id, false);
        }}
        className={baseRowClasses}
      >
        {stage === 'spec' && isRibbonRow ? (
          // Ribbon Row Rendering (Full Width)
          <div className="flex w-full items-center select-none group/ribbon relative">
            {/* Позиция и Иконка */}
            <div 
              className="px-4 py-3 flex-none w-[60px] shrink-0 flex items-center justify-center border-r border-transparent group/poscell"
              onClick={(e) => {
                e.stopPropagation();
                toggleRowSelection(row.id, true);
              }}
            >
              <div className="relative w-full h-full flex items-center justify-center">
                {isSelected ? (
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    checked={true}
                    readOnly
                  />
                ) : (
                  <>
                    <div className="group-hover/poscell:hidden flex items-center justify-center">
                      {(isWorkType && !row.pos) && <Database className="w-4 h-4 opacity-70" />}
                      {(isLocation && row.pos !== '§') && <MapPin className="w-4 h-4 opacity-70" />}
                      {isGroup && <Folders className="w-4 h-4 text-indigo-500/70" />}
                      {isSupplierRow && <UserCheck className="w-4 h-4 text-blue-500/70" />}
                      {isActuallyMerged && <Layers className="w-4 h-4 text-emerald-600/70" />}
                      
                      {/* Если есть номер — показываем номер */}
                      {((isWorkType || isLocation) && row.pos) && (
                        <span className={cn(
                          "font-black tabular-nums whitespace-nowrap",
                          isLocation ? "text-emerald-100 text-lg" : "text-slate-400 text-sm"
                        )}>
                          {row.pos}
                        </span>
                      )}
                    </div>
                    <input
                      type="checkbox"
                      className="hidden group-hover/poscell:block w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      checked={false}
                      readOnly
                    />
                  </>
                )}
              </div>
            </div>
            {/* Content Area */}
            <div className={cn(
              "flex-grow px-4 py-3 tracking-tight flex items-center min-w-0",
              isWorkType ? "text-sm uppercase font-bold text-white" : 
              isLocation ? "text-base uppercase tracking-wide font-black text-white" : 
              isActuallyMerged ? "text-emerald-950 font-bold" :
              isSupplierRow ? "text-blue-900 font-bold" :
              "text-sm font-bold text-indigo-900"
            )}>
              <span className="truncate flex-grow mr-4">{row.name}</span>
              
              {(toggleCollapse || isSummaryRow) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (toggleCollapse) toggleCollapse(row.id);
                    else if (isSummaryRow) setLocalExpanded(!localExpanded);
                    else toggleCollapse?.(row.id);
                  }}
                  className={cn(
                    "p-1 rounded transition-colors flex-shrink-0 ml-auto flex items-center justify-center",
                    (isWorkType || isLocation) ? "text-white/70 hover:bg-white/20 hover:text-white" : 
                    isActuallyMerged ? "text-emerald-500 hover:bg-emerald-200/50" :
                    isSupplierRow ? "text-blue-500 hover:bg-blue-200/50" :
                    "text-indigo-500 hover:bg-indigo-200/50 hover:text-indigo-700"
                  )}
                >
                  {((isSummaryRow && !toggleCollapse) ? localExpanded : !isCollapsed) ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </button>
              )}
            </div>
          </div>
        ) : (
          // Standard Row Rendering
          columns.map(col => (
            <div
              key={col.key}
              className={cn(
                "px-4 py-3 border-r overflow-hidden border-slate-100 last:border-0 h-full flex items-center break-words whitespace-normal",
                col.align === 'center' ? "justify-center" : col.align === 'right' ? "justify-end" : "justify-start"
              )}
              style={{
                flex: col.width ? `0 0 ${col.width}` : (col.key === 'name' ? '2' : '1'),
                minWidth: col.width || '100px'
              }}
              onClick={col.key === 'pos' && !(stage === 'spec' && isHeader) ? (e) => {
                e.stopPropagation();
                toggleRowSelection(row.id, true);
              } : undefined}
            >
              {col.key === 'pos' ? (
                <div className="relative w-full h-full flex items-center justify-center font-medium">
                  {(stage === 'spec' && hasChildren && !isHeader && viewMode === 'merged') && !isMergedRow && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        parentToggleExpand?.(row.id);
                      }}
                      className="absolute left-0 p-1 hover:bg-slate-200 rounded transition-colors z-10"
                    >
                      {parentIsExpanded ? <ChevronDown className="w-4 h-4 text-slate-600" /> : <ChevronRight className="w-4 h-4 text-slate-600" />}
                    </button>
                  )}

                  {isSelected ? (
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      checked={true}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleRowSelection(row.id, true);
                      }}
                      onChange={() => { }}
                    />
                  ) : (stage === 'spec' && isHeader) ? (
                    <span className="text-slate-500 font-bold text-xs italic">{row.pos || '§'}</span>
                  ) : (
                    <>
                      {stage === 'invoice' && row.isUncertain && <AlertTriangle className="absolute left-1 w-3 h-3 text-amber-500 shrink-0" />}
                      <span className="group-hover:hidden text-slate-400 tabular-nums">
                        {stage === 'spec' 
                          ? (row.pos || '')
                          : (actualIndex + 1).toString().padStart(2, '0')
                        }
                      </span>
                      <input
                        type="checkbox"
                        className="hidden group-hover:block w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        checked={false}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRowSelection(row.id, true);
                        }}
                        onChange={() => { }}
                      />
                    </>
                  )}
                </div>
              ) : col.key === 'name' && (stage === 'spec' && (isHeader || isActuallyMerged)) ? (

                <div 
                  className="flex justify-between items-start gap-2 w-full overflow-hidden"
                  onClick={(e) => {
                    if (isSummaryRow && row.children?.length > 1) {
                      e.stopPropagation();
                      setLocalExpanded(!localExpanded);
                    }
                  }}
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className={cn(
                      "font-bold whitespace-normal break-words leading-tight",
                      isWorkType ? "text-base uppercase tracking-wider" : "text-sm",
                      isLocation && !isSupplierRow && "text-slate-100 underline underline-offset-8 decoration-white/20",
                      isSupplierRow && "text-indigo-900 border-b-2 border-indigo-200",
                      isActuallyMerged && "text-emerald-900"
                    )}>
                      {String(row.name || '')}
                    </span>


                  </div>

                  {isSummaryRow && row.children?.length > 1 && (
                    <div className="p-1 rounded bg-slate-100/50 text-slate-500 hover:bg-slate-200/80 transition-colors shrink-0 mt-1">
                      {localExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                  )}
                </div>
              ) : stage === 'invoice' && col.key === 'match_data' ? (
                <div className="relative w-full h-full flex items-center gap-2 group/match overflow-visible">
                  {row.match_data?.status === 'perfect' && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] shrink-0" title="Идеальное совпадение" />}
                  {row.match_data?.status === 'warning' && <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] shrink-0" title="Возможное совпадение" />}
                  {row.match_data?.status === 'none' && <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] shrink-0" title="Нет совпадений" />}

                  {(!row.match_data || row.match_data.status === 'none') && <span className="text-xs text-slate-400 italic">Связи нет</span>}

                  {row.match_data?.status === 'warning' && (
                    <div className="flex flex-col text-[11px] leading-tight min-w-0" title={row.match_data.target_name || ''}>
                      <span className="text-slate-700 truncate font-medium">{row.match_data.target_name}</span>
                      <span className="text-amber-600 font-semibold">{row.match_data.score}% сходства</span>
                    </div>
                  )}
                  {row.match_data?.status === 'perfect' && (
                    <div className="flex flex-col text-[11px] leading-tight min-w-0" title={row.match_data.target_name || ''}>
                      <span className="text-slate-700 truncate font-medium">{row.match_data.target_name}</span>
                      <span className="text-emerald-600 font-semibold">{row.match_data.score}%</span>
                    </div>
                  )}

                  {/* Manual Override Select */}
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover/match:opacity-100 transition-opacity">
                    <select
                      className="w-5 h-5 opacity-0 absolute inset-0 cursor-pointer z-10"
                      title="Изменить связь вручную"
                      value={row.match_data?.target_id || ''}
                      onChange={(e) => {
                        const specId = e.target.value;
                        if (!specId) return;
                        const specName = e.target.options[e.target.selectedIndex].text;
                        const newMatch = { target_id: specId, target_name: specName, score: 100, status: 'perfect' };
                        onUpdate(row.id, 'match_data', newMatch);
                      }}
                    >
                      <option value="">-- Выбрать из спецификации --</option>
                      {specRows.map(s => <option key={s.id} value={s.id}>{s.name || s.code}</option>)}
                    </select>
                    <div className="w-5 h-5 rounded hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer pointer-events-none">
                      <Edit2 className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              ) : stage === 'estimate' && (col.key === 'costPrice' || col.key === 'clientPrice') ? (
                <div className="flex flex-col items-end w-full">
                  <input
                    className={cn(
                      "bg-transparent border-none focus:ring-2 focus:ring-indigo-500/20 rounded px-1 w-full text-right",
                      col.key === 'costPrice' ? "text-blue-600" : "text-emerald-600",
                      selectedIds.length === 0 ? "cursor-text" : "cursor-pointer"
                    )}
                    value={String(row[col.key] || '')}
                    readOnly={selectedIds.length > 0}
                    tabIndex={selectedIds.length > 0 ? -1 : 0}
                    onClick={(e) => {
                      if (selectedIds.length === 0) e.stopPropagation();
                    }}
                    onChange={(e) => onUpdate(row.id, col.key, e.target.value)}
                  />
                  <span className="text-[10px] text-slate-400 px-1 antialiased">
                    {new Intl.NumberFormat('ru-RU').format(Number(row[col.key] || 0))} ₽
                  </span>
                </div>
              ) : (
                <EditableCell
                  value={String(row[col.key] || '')}
                  colKey={col.key}
                  rowId={row.id}
                  isReadOnly={selectedIds.length > 0 || (stage === 'spec' && isHeader) || (stage === 'request' || stage === 'invoice') || isActuallyMerged}

                  isHeader={stage === 'spec' && isHeader}
                  align={col.align}
                  onChange={(val) => onUpdate(row.id, col.key, val)}
                  onClick={(e) => {
                    if (selectedIds.length === 0 && !(stage === 'spec' && (isHeader || isSummaryRow))) e.stopPropagation();
                  }}
                  onKeyDown={onKeyDown}
                />
              )}
            </div>
          ))
        )}
      </div>

      {/* Children Rows Container with Inner Shadows */}
      {stage === 'spec' && ((isSummaryRow && !toggleCollapse) ? localExpanded : !isCollapsed) && hasChildren && (
        <div className="flex flex-col shadow-[inset_0_2px_4px_rgba(0,0,0,0.05),inset_0_-2px_4px_rgba(0,0,0,0.05)] bg-slate-50/60 border-y border-slate-200/60">
          {row.children.map((child: any, childIdx: number) => (
            <TableRow
              key={child.id || childIdx}
              row={child}
              columns={columns}
              stage={stage}
              actualIndex={childIdx}
              isSelected={selectedIds?.includes(child.id) || false}
              selectedIds={selectedIds}
              toggleRowSelection={toggleRowSelection}
              onUpdate={onUpdate}
              viewMode={viewMode}
              specRows={specRows}
              onKeyDown={onKeyDown}
            />
          ))}
        </div>
      )}
    </Fragment>
  );
});

TableRow.displayName = 'TableRow';
