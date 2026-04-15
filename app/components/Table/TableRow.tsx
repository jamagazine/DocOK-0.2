import React, { Fragment } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  GripVertical,
  ListTree,
  Folders,
  Folder,
  Library,
  UserCheck,
  Layers,
  Edit2
} from 'lucide-react';
import { EditableCell } from './EditableCell';
import { VatRateCell } from './VatRateCell';

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
  stage: 'spec' | 'invoice' | 'estimate';
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
  const isSupplierRow = String(row.id).startsWith('supplier_header_'); // More specific check
  const isSItem = String(row.id).startsWith('s_item_');
  const isSummaryRow = isMergedRow || isSupplierRow || isSItem;



  // ШАГ 2: Реально сгруппированная строка (больше 1 элемента)
  const isActuallyMerged = (isMergedRow || String(row.id).startsWith('s_item_')) && row.children && row.children.length > 1;



  const hasChildren = row.children && row.children.length > 0;
  // ШАГ 1: Более четкая категоризация заголовков и групп
  const isWorkType = row.row_type === 'WORK_TYPE' || (!row.pos && row.is_header && !isSummaryRow && row.name === String(row.name).toUpperCase() && String(row.name).length > 3);
  const isLocation = !isSummaryRow && (row.row_type === 'LOCATION' || row.pos === '§');
  const isGroup = !isSummaryRow && (row.row_type === 'GROUP' || (row.is_header && !isLocation && !isWorkType));

  // Ribbon Row — это любая строка, которая рендерится «на всю ширину» (заголовок или группа)
  const isRibbonRow = isWorkType || isLocation || isGroup || isSupplierRow;
  const isHeader = isWorkType || isLocation || isGroup;

  const baseRowClasses = cn(
    "flex items-center text-sm border-b border-slate-100 transition-colors group cursor-pointer",
    stage === 'estimate' ? "min-h-[56px]" : "min-h-[48px]",
    isSelected && "bg-indigo-50/50",
    row.isUncertain && stage === 'invoice' && "bg-amber-50/50",
    row.is_valid === false && stage === 'invoice' && "bg-red-50/70",
    (stage === 'invoice' || stage === 'estimate') && "hover:bg-slate-50",
    // Spec specific classes based on Level Hierachy
    // Spec specific classes based on Level Hierachy (Inversion logic: high level = dark BG)
    stage === 'spec' && (row.level || 0) >= 3 && "bg-indigo-950 text-slate-50 font-black border-l-4 border-l-amber-500 border-b border-indigo-900 shadow-md transition-all hover:bg-indigo-900",
    stage === 'spec' && row.level === 2 && "bg-indigo-700 text-indigo-50 font-bold border-l-4 border-l-indigo-400 border-b border-indigo-600 transition-all hover:bg-indigo-600",
    stage === 'spec' && row.level === 1 && "bg-indigo-100/80 text-indigo-950 font-semibold border-l-4 border-l-indigo-300 border-b border-indigo-200 hover:bg-indigo-200/90 transition-all",

    // 4. Поставщики - Голубой Индиго с бортом
    stage === 'spec' && isSupplierRow && "bg-blue-50/40 text-blue-900 border-l-4 border-l-blue-400 hover:bg-blue-100/50 transition-all",
    // 5. Сводные - Обычный фон, но с зеленым бортом
    stage === 'spec' && isActuallyMerged && cn(
      "bg-white border-l-4 border-l-emerald-500 transition-all",
      (parentIsExpanded || localExpanded) ? "bg-slate-50" : "hover:bg-slate-50"
    ),

    stage === 'spec' && !isSummaryRow && hasChildren && !isHeader && "bg-slate-50/30",
    stage === 'spec' && !isRibbonRow && "hover:bg-slate-50/80 cursor-pointer"
  );

  return (
    <Fragment>
      <div
        id={`row-${row.id}`}
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
                      {/* Icons logic based on level (Matryoshka logic) */}
                      {stage === 'spec' && !isSummaryRow && !isSupplierRow && (
                        <div className="flex items-center gap-0.5 relative z-10 px-1">
                          {row.level === 1 && <Folder className="w-4 h-4 text-indigo-600" />}
                          {row.level === 2 && <Folders className="w-5 h-5 text-indigo-200" />}
                          {(row.level || 0) >= 3 && <Library className="w-5 h-5 text-indigo-300" />}
                          {/* Fallback for undefined level but old properties */}
                          {row.level === undefined && isWorkType && <Library className="w-5 h-5 text-indigo-300" />}
                          {row.level === undefined && isLocation && <Folders className="w-5 h-5 text-indigo-200" />}
                          {row.level === undefined && isGroup && <Folder className="w-4 h-4 text-indigo-600" />}
                        </div>
                      )}
                      {isSupplierRow && <UserCheck className="w-4 h-4 text-blue-500/70" />}

                      {/* Если есть номер — показываем номер */}
                      {((isWorkType || isLocation || isActuallyMerged || row.is_header) && row.pos) && (
                        <span className={cn(
                          "font-black tabular-nums whitespace-nowrap",
                          (row.level || 0) >= 2 ? "text-amber-400 text-sm" :
                            isActuallyMerged ? "text-emerald-600 text-sm" :
                              "text-slate-400 text-sm"
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
              (row.level || 0) >= 3 ? "text-sm uppercase font-black tracking-widest text-slate-50" :
                row.level === 2 ? "text-sm font-bold text-indigo-50" :
                  row.level === 1 ? "text-sm font-bold text-indigo-950" :
                    isActuallyMerged ? "text-slate-900" :
                      isSupplierRow ? "text-blue-900 font-bold" :
                        "text-sm font-bold text-indigo-900"
            )}>
              <span className="truncate flex-grow mr-4">{row.name}</span>

              {(toggleCollapse || isActuallyMerged || (isSupplierRow && hasChildren)) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (toggleCollapse) toggleCollapse(row.id);
                    else if (isActuallyMerged || isSupplierRow) setLocalExpanded(!localExpanded);
                  }}
                  className={cn(
                    "p-1 rounded transition-colors flex-shrink-0 ml-auto flex items-center justify-center",
                    (row.level || 0) >= 2 ? "text-indigo-200 hover:bg-white/10 hover:text-white" :
                      isActuallyMerged ? "text-emerald-500 hover:bg-emerald-200/50" :
                        isSupplierRow ? "text-blue-500 hover:bg-blue-200/50" :
                          "text-indigo-500 hover:bg-indigo-200/50 hover:text-indigo-700"
                  )}
                >
                  {(((isActuallyMerged || isSupplierRow) && !toggleCollapse) ? localExpanded : !isCollapsed) ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
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
                      {(isActuallyMerged || stage === 'spec') ? (
                        <span className={cn(
                          "group-hover:hidden tabular-nums font-bold",
                          isActuallyMerged ? "text-emerald-600 text-sm" : "text-slate-400 text-sm"
                        )}>
                          {row.pos || ''}
                        </span>
                      ) : (
                        <span className="group-hover:hidden text-slate-400 tabular-nums">
                          {(actualIndex + 1).toString().padStart(2, '0')}
                        </span>
                      )}
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
                  className="flex justify-between items-center gap-2 w-full overflow-hidden"
                  onClick={(e) => {
                    if (isActuallyMerged && row.children?.length > 1) {
                      e.stopPropagation();
                      if (toggleCollapse) toggleCollapse(row.id);
                      else setLocalExpanded(!localExpanded);
                    }
                  }}
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className={cn(
                      "whitespace-normal break-words leading-tight",
                      isWorkType ? "text-base uppercase tracking-wider font-bold" : "text-sm",
                      isLocation && !isSupplierRow && "text-slate-100 underline underline-offset-8 decoration-white/20 font-bold",
                      isSupplierRow && "text-indigo-900 border-b-2 border-indigo-200 font-bold",
                      isActuallyMerged ? "text-slate-900 font-normal" : "font-bold"
                    )}>
                      {String(row.name || '')}
                    </span>
                  </div>

                  {(isActuallyMerged && row.children?.length > 1) && (
                    <div className="p-1 rounded bg-emerald-100/80 text-emerald-600 hover:bg-emerald-200 transition-colors shrink-0">
                      {((isSummaryRow && !toggleCollapse) ? localExpanded : !isCollapsed) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
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
              ) : stage === 'invoice' && col.key === 'price_before_discount' ? (
                <span className="text-slate-700 font-medium tabular-nums">
                  {new Intl.NumberFormat('ru-RU', {
                    style: 'currency',
                    currency: 'RUB',
                    minimumFractionDigits: 2
                  }).format((row.quantity || 0) * (row.price_unit || 0))}
                </span>
              ) : stage === 'invoice' && col.key === 'discount' ? (
                (() => {
                  const discountStr = String(row.discount || '').trim();
                  const isPercentage = discountStr.includes('%');
                  const discountAmount = (row.quantity || 0) * (row.price_unit || 0) - (row.total || 0);

                  // Если нет скидки
                  if (!discountStr && discountAmount < 0.01) {
                    return <span className="text-slate-400 text-xs">—</span>;
                  }

                  // Если процент → показываем процент + вычисленную сумму
                  if (isPercentage) {
                    return (
                      <div className="flex flex-col items-end">
                        <span className="text-rose-600 font-medium text-sm">{discountStr}</span>
                        {discountAmount > 0.01 && (
                          <span className="text-xs text-slate-400">
                            {new Intl.NumberFormat('ru-RU', {
                              style: 'currency',
                              currency: 'RUB',
                              minimumFractionDigits: 2
                            }).format(discountAmount)}
                          </span>
                        )}
                      </div>
                    );
                  }

                  // Если сумма → показываем только сумму (без дублирования)
                  const numericDiscount = parseFloat(discountStr.replace(/[^\d.,]/g, '').replace(',', '.'));
                  if (!isNaN(numericDiscount) && numericDiscount > 0) {
                    return (
                      <span className="text-rose-600 font-medium text-sm">
                        {new Intl.NumberFormat('ru-RU', {
                          style: 'currency',
                          currency: 'RUB',
                          minimumFractionDigits: 2
                        }).format(numericDiscount)}
                      </span>
                    );
                  }

                  // Fallback: показываем как есть
                  return <span className="text-rose-600 font-medium text-sm">{discountStr}</span>;
                })()
              ) : stage === 'invoice' && col.key === 'vat_rate' ? (
                <VatRateCell
                  value={String(row.vat_rate || '')}
                  rowId={row.id}
                  isInvalid={row.vat_rate_invalid}
                  isLegacy={row.vat_rate_legacy}
                  onChange={(value) => onUpdate(row.id, 'vat_rate', value)}
                  onKeyDown={onKeyDown}
                />
              ) : stage === 'invoice' && col.key === 'vat_amount' ? (
                <span className="text-slate-700 font-medium tabular-nums">
                  {row.vat_amount ? new Intl.NumberFormat('ru-RU', {
                    style: 'currency',
                    currency: 'RUB',
                    minimumFractionDigits: 2
                  }).format(row.vat_amount) : '—'}
                </span>
              ) : stage === 'invoice' && col.key === 'price_without_vat' ? (
                <span className="text-slate-700 font-medium tabular-nums">
                  {row.price_without_vat ? new Intl.NumberFormat('ru-RU', {
                    style: 'currency',
                    currency: 'RUB',
                    minimumFractionDigits: 2
                  }).format(row.price_without_vat) : '—'}
                </span>
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
                  isReadOnly={selectedIds.length > 0 || (stage === 'spec' && isHeader) || stage === 'invoice' || isActuallyMerged}

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
