import React from 'react';
import {
  Search,
  Edit2,
  Upload,
  FolderOpen,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Stage } from '../types';
import { FilesPanel } from './FilesPanel';
import { useData, emptyInvoiceRow, emptySpecRow } from '../context/DataContext';
import { useTableEditor } from '../hooks/useTableEditor';
import { useTableNavigation } from '../hooks/useTableNavigation';
import { TableRow, Column } from './Table/TableRow';
import { NoResultsState } from './Table/NoResultsState';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CenterPanelProps {
  currentStage: Stage;
}

export function CenterPanel({ currentStage }: CenterPanelProps) {
  const {
    uploadStatuses,
    searchQuery,
    setSearchQuery,
    setCurrentPage,
    setSelectedIds,
    setIsOnlySelectedView,
    projectName,
    setProjectName,
    activeProjectId,
    syncProjectName
  } = useData();

  const [isEditingName, setIsEditingName] = React.useState(false);
  const [filesOpen, setFilesOpen] = React.useState(false);
  const fileEntries = Object.entries((uploadStatuses || {}) as Record<string, { status: string; time: string }>);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditingName]);

  // Сброс пагинации и выборки при смене вкладки
  React.useEffect(() => {
    setCurrentPage(1);
    setSelectedIds([]);
    setIsOnlySelectedView(false);
  }, [currentStage, setCurrentPage, setSelectedIds, setIsOnlySelectedView]);

  const handleRename = () => {
    setIsEditingName(false);
    if (activeProjectId) {
      syncProjectName(activeProjectId, projectName);
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-white relative min-w-0 h-full">
      <div className="flex flex-col h-full flex-1 min-h-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shadow-sm h-[72px] shrink-0">
          <div className="flex-1 min-w-0 flex items-center gap-2">
            {isEditingName ? (
              <input
                ref={inputRef}
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                className="text-sm font-bold text-slate-900 bg-slate-100 rounded-md px-2 py-1 outline-none ring-2 ring-indigo-500 w-full max-w-sm"
              />
            ) : (
              <div
                className="group flex items-center gap-1.5 cursor-pointer max-w-sm hover:bg-slate-50 rounded-md px-2 py-1 -ml-2 transition-colors"
                onClick={() => setIsEditingName(true)}
                title="Редактировать название"
              >
                <h1 className="text-sm font-bold text-slate-800 truncate">{projectName}</h1>
                <Edit2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>

          <div className="flex-1 flex justify-center px-4">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Глобальный поиск по разделам..."
                className="w-full bg-slate-100 hover:bg-slate-200 focus:bg-white border border-transparent focus:border-indigo-300 rounded-full pl-10 pr-4 py-2 text-sm text-slate-700 outline-none transition-all shadow-sm focus:shadow-md"
              />
            </div>
          </div>

          <div className="flex-1 flex justify-end items-center gap-4 min-w-0">
            <button
              onClick={() => setFilesOpen(!filesOpen)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm border border-slate-200 hover:border-indigo-300",
                filesOpen ? "bg-indigo-50 text-indigo-700" : "bg-white text-slate-700 hover:bg-slate-50"
              )}
              title="Открыть панель файлов"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Файлы</span>
              {fileEntries.length > 0 && (
                <span className="flex items-center justify-center bg-indigo-100 text-indigo-700 rounded-full w-5 h-5 text-[10px] ml-1">
                  {fileEntries.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto relative bg-white">
          <div className="min-w-max h-full">
            {currentStage === 'spec' && <SpecTable />}
            {currentStage === 'request' && <RequestTable />}
            {currentStage === 'invoice' && <InvoiceTable />}
            {currentStage === 'estimate' && <EstimateTable />}
          </div>
        </div>
      </div>

      <Footer />
      <FilesPanel isOpen={filesOpen} onClose={() => setFilesOpen(false)} />
    </div>
  );
}

function Footer() {
  const {
    selectedIds,
    currentPage,
    setCurrentPage,
    rowsPerPage,
    setRowsPerPage,
    totalProcessedCount,
    selectedItemsCount,
    isPaginationActive,
  } = useData();

  // Единственная вычисляемая величина — кол-во страниц
  const totalPages = Math.ceil(totalProcessedCount / rowsPerPage) || 1;

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  return (
    <div className="h-16 border-t border-slate-200 bg-white px-6 grid grid-cols-3 items-center shrink-0">
      {/* Левая колонка: счётчик строк */}
      <div className="flex items-center gap-4 text-sm min-w-[200px]">
        <div className="flex items-center gap-1 text-slate-400 whitespace-nowrap">
          <span>Всего строк:</span>
          <span className="font-semibold text-slate-700">{totalProcessedCount}</span>
          {selectedItemsCount > 0 && (
            <>
              <span className="mx-0.5 text-slate-300">|</span>
              <span className="font-semibold text-indigo-600">{selectedItemsCount} выбрано</span>
            </>
          )}
        </div>
      </div>

      {/* Центральная колонка: пагинатор или заглушка */}
      {isPaginationActive ? (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1 || totalPages === 1}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
          >
            <ChevronsLeft size={16} />
          </button>
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || totalPages === 1}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 disabled:opacity-20 disabled:hover:bg-transparent transition-colors mr-2"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="flex items-center gap-1">
            {(() => {
              const pages: (number | string)[] = [];
              const maxVisible = 7;
              if (totalPages <= maxVisible) {
                for (let i = 1; i <= totalPages; i++) pages.push(i);
              } else {
                pages.push(1);
                if (currentPage > 3) pages.push('...');
                const start = Math.max(2, currentPage - 1);
                const end = Math.min(totalPages - 1, currentPage + 1);
                for (let i = start; i <= end; i++) {
                  if (!pages.includes(i)) pages.push(i);
                }
                if (currentPage < totalPages - 2) pages.push('...');
                pages.push(totalPages);
              }

              return pages.map((p, idx) => (
                p === '...' ? (
                  <span key={`dots-${idx}`} className="px-2 text-slate-400">...</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => handlePageChange(p as number)}
                    className={cn(
                      "w-8 h-8 rounded-md text-sm font-medium transition-all",
                      currentPage === p
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-600"
                    )}
                  >
                    {p}
                  </button>
                )
              ));
            })()}
          </div>

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || totalPages === 1}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 disabled:opacity-20 disabled:hover:bg-transparent transition-colors ml-2"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages || totalPages === 1}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
          >
            <ChevronsRight size={16} />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-center">
          <span className="text-xs text-slate-400">Отображаются все записи</span>
        </div>
      )}

      {/* Правая колонка: выбор кол-ва строк (только при активной пагинации) */}
      {isPaginationActive ? (
        <div className="flex items-center justify-end gap-3 text-sm text-slate-400">
          <span className="hidden sm:inline">Строк на странице:</span>
          <select
            className="bg-transparent border-none focus:ring-0 text-slate-700 font-semibold cursor-pointer py-0"
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      ) : (
        <div />
      )}
    </div>
  );
}

function EmptyStateBlock({ handleFile, currentStage }: { handleFile: any, currentStage: string }) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  return (
    <div
      className="m-8 p-12 border-2 border-dashed border-indigo-200 rounded-xl flex flex-col items-center justify-center bg-indigo-50/30 hover:bg-indigo-50/50 cursor-pointer transition-colors"
      onClick={() => fileInputRef.current?.click()}
    >
      <Upload className="w-12 h-12 text-indigo-300 mb-4" />
      <p className="text-slate-700 font-medium mb-2">Нажмите или перетащите файлы для начала работы</p>
      <p className="text-slate-500 text-sm mb-6 text-center max-w-md">Поддерживаются форматы Excel (.xlsx, .xls) и PDF. Можно выбрать несколько файлов одновременно.</p>
      <input
        type="file"
        multiple
        className="hidden"
        ref={fileInputRef}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFile(e.target.files, currentStage);
            e.target.value = '';
          }
        }}
      />
      <div className="px-6 py-2.5 bg-white border border-indigo-200 text-indigo-600 rounded-lg text-sm font-medium hover:border-indigo-400 hover:text-indigo-700 transition-colors shadow-sm">
        Выбрать файлы
      </div>
    </div>
  );
}

function TableHeader({ columns, pageIds = [] }: { columns: Column[], pageIds?: string[] }) {
  const { sortConfig, handleSort, selectedIds, toggleSelectAllPage } = useData();
  const [isHovered, setIsHovered] = React.useState(false);

  const isAllSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id));
  const isSomeSelected = pageIds.some(id => selectedIds.includes(id)) && !isAllSelected;

  return (
    <div className="flex bg-slate-100/80 backdrop-blur sticky top-0 z-10 border-b border-slate-300 h-12">
      {columns.map((col, idx) => {
        const isActive = sortConfig.key === col.key;
        const isSortable = col.sortable !== false;

        return (
          <div
            key={col.key}
            className={cn(
              "px-4 py-3 font-normal text-slate-700 text-sm flex items-center gap-2 select-none overflow-hidden border-r border-slate-200 last:border-0 transition-all",
              col.align === 'center' ? "justify-center" : col.align === 'right' ? "justify-end" : "justify-start",
              isSortable ? "cursor-pointer hover:bg-slate-200/50 group" : "cursor-default"
            )}
            style={{
              flex: col.width ? `0 0 ${col.width}` : (col.key === 'name' || col.label === 'Наименование' ? '2' : '1'),
              minWidth: col.width || '100px'
            }}
            onClick={() => isSortable && handleSort(col.key)}
            onMouseEnter={() => idx === 0 && setIsHovered(true)}
            onMouseLeave={() => idx === 0 && setIsHovered(false)}
          >
            {idx === 0 && col.key === 'pos' ? (
              <div className="flex items-center justify-center w-full" onClick={(e) => e.stopPropagation()}>
                {(isHovered || isAllSelected || isSomeSelected) ? (
                  <div className="relative flex items-center justify-center cursor-pointer" onClick={() => toggleSelectAllPage(pageIds)}>
                    <input
                      type="checkbox"
                      className={cn(
                        "w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer transition-all",
                        isSomeSelected && "opacity-100"
                      )}
                      checked={isAllSelected}
                      onChange={() => { }} 
                      ref={(el) => { if (el) el.indeterminate = isSomeSelected; }}
                    />
                  </div>
                ) : (
                  <span className="text-slate-500 font-medium">{col.label}</span>
                )}
              </div>
            ) : (
              <span className="break-words whitespace-normal">{col.label}</span>
            )}
            {isSortable && col.key !== 'pos' && (
              <div className={cn(
                "shrink-0 transition-opacity",
                isActive ? "opacity-100 text-indigo-600" : "opacity-0 group-hover:opacity-100 text-slate-400"
              )}>
                {isActive ? (
                  sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                ) : (
                  <ArrowUpDown className="w-3 h-3" />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SpecTable() {
  // SpecTable — «тупой» компонент: только рисует.
  // displayRows из pipeline уже содержит всё: фильтры, поиск, isOnlySelectedView, пагинацию.
  // Единственная UI-логика, которая остаётся здесь — аккордеон (collapsedIds).
  const {
    specRows, setSpecRows, handleFile, selectedIds, toggleRowSelection,
    displayRows, viewMode, isOnlySelectedView, searchQuery, setSearchQuery
  } = useData();
  const [expandedRows, setExpandedRows] = React.useState<Record<string, boolean>>({});
  const [collapsedIds, setCollapsedIds] = React.useState<Record<string, boolean>>({});
  const { handleCellUpdate } = useTableEditor('spec');
  const { handleKeyDown } = useTableNavigation();

  const toggleExpand = React.useCallback((id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const toggleCollapse = React.useCallback((id: string) => {
    setCollapsedIds(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const columns: Column[] = [
    { key: 'pos', label: '№', width: '60px', align: 'center', sortable: false },
    { key: 'name', label: 'Наименование' },
    { key: 'brand', label: 'Марка/Тип', width: '120px' },
    { key: 'code', label: 'Код', width: '120px' },
    { key: 'supplier', label: 'Поставщик', width: '150px' },
    { key: 'unit', label: 'Ед. изм', width: '100px', align: 'center' },
    { key: 'quantity', label: 'Кол-во', width: '100px', align: 'right' },
    { key: 'mass', label: 'Масса, 1 ед,кг', width: '150px', align: 'left' },
    { key: 'note', label: 'Примечание', width: '150px' }
  ];

  // UI-слой: аккордеон поверх pipeline-данных.
  // Для supplier-режима: разворачиваем дочерние элементы из children[] в плоский список.
  const visibleRows = React.useMemo(() => {
    // ШАГ 2: Режим merged — это плоский список. Отдаем как есть!
    if (viewMode === 'merged') return displayRows;

    const res: any[] = [];
    let hideUntilLevel = -1;
    const isSupplierMode = viewMode === 'supplier';
    const effectiveRows = displayRows;

    for (const row of effectiveRows) {
      const type = row.row_type || (row.is_header ? (row.pos === '§' ? 'LOCATION' : 'GROUP') : 'ITEM');
      const level = type === 'WORK_TYPE' ? 0 : type === 'LOCATION' ? 1 : type === 'GROUP' ? 2 : 3;

      // Выход из свёрнутой группы при встрече заголовка того же или выше уровня
      if (hideUntilLevel !== -1 && level <= hideUntilLevel && row.is_header) {
        hideUntilLevel = -1;
      }
      
      if (hideUntilLevel !== -1) continue;

      // У supplier-заголовка убираем children перед рендером (они уже развёрнуты)
      const renderedRow = (isSupplierMode && type === 'GROUP') ? { ...row, children: undefined } : row;
      res.push(renderedRow);
      
      // ШАГ 3: Если включен фильтр «Только выделенные», игнорируем схлопывание
      if (collapsedIds[row.id] && !isOnlySelectedView) {
        hideUntilLevel = level;
      }
    }

    return res;
  }, [displayRows, collapsedIds, viewMode, isOnlySelectedView]);

  const isActiveSearch = searchQuery.trim().length > 0;

  if (isActiveSearch && visibleRows.length === 0) {
    return (
      <NoResultsState 
        onReset={() => setSearchQuery('')} 
        currentQuery={searchQuery} 
        stage="spec"
      />
    );
  }




  return (
    <div className="flex flex-col">
      {specRows.length > 0 ? (
        <div className="bg-white min-w-full">
          <TableHeader columns={columns} pageIds={visibleRows.map((r: any) => r.id)} />
          <div className="divide-y divide-slate-100">
            {visibleRows.map((row: any, i: number) => (
              <TableRow
                key={row.id}
                row={row}
                columns={columns}
                stage="spec"
                actualIndex={i}
                isSelected={selectedIds.includes(row.id)}
                selectedIds={selectedIds}
                toggleRowSelection={toggleRowSelection}
                onUpdate={handleCellUpdate}
                viewMode={viewMode}
                isExpanded={!!expandedRows[row.id]}
                toggleExpand={toggleExpand}
                isCollapsed={!!collapsedIds[row.id]}
                toggleCollapse={toggleCollapse}
                onKeyDown={handleKeyDown}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="p-4">
          <EmptyStateBlock handleFile={handleFile} currentStage="spec" />
        </div>
      )}
      {specRows.length > 0 && (
        <button
          onClick={() => setSpecRows([...specRows, emptySpecRow()])}
          className="self-start flex items-center gap-2 px-4 py-2 mt-4 ml-4 mb-4 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Добавить строку спецификации
        </button>
      )}
    </div>
  );
}

function RequestTable() {
  const { requestRows, handleFile, selectedIds, toggleRowSelection, displayRows, searchQuery, setSearchQuery } = useData();
  const { handleCellUpdate } = useTableEditor('request');
  const { handleKeyDown } = useTableNavigation();

  const columns: Column[] = [
    { key: 'pos', label: '№', width: '60px', align: 'center', sortable: false },
    { key: 'name', label: 'Наименование' },
    { key: 'brand', label: 'Марка/Тип', width: '120px' },
    { key: 'code', label: 'Код', width: '120px' },
    { key: 'supplier', label: 'Поставщик', width: '150px' },
    { key: 'unit', label: 'Ед. изм', width: '100px', align: 'center' },
    { key: 'quantity', label: 'Кол-во', width: '100px', align: 'right' }
  ];

  const isActiveSearch = searchQuery.trim().length > 0;

  if (isActiveSearch && displayRows.length === 0) {
    return (
      <NoResultsState 
        onReset={() => setSearchQuery('')} 
        currentQuery={searchQuery} 
        stage="request"
      />
    );
  }

  return (
    <div className="flex flex-col">
      {requestRows.length > 0 ? (
        <>
          <TableHeader columns={columns} pageIds={displayRows.map(r => r.id)} />
          <div className="divide-y divide-slate-100">
            {displayRows.map((row, i) => (
              <TableRow
                key={row.id}
                row={row}
                columns={columns}
                stage="request"
                actualIndex={i}
                isSelected={selectedIds.includes(row.id)}
                selectedIds={selectedIds}
                toggleRowSelection={toggleRowSelection}
                onUpdate={handleCellUpdate}
                onKeyDown={handleKeyDown}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="p-4">
          <EmptyStateBlock handleFile={handleFile} currentStage="request" />
        </div>
      )}
    </div>
  );
}


function InvoiceTable() {
  const { invoiceRows, setInvoiceRows, handleFile, selectedIds, toggleRowSelection, specRows, displayRows, searchQuery, setSearchQuery } = useData();
  const { handleCellUpdate } = useTableEditor('invoice');
  const { handleKeyDown } = useTableNavigation();

  const columns: Column[] = [
    { key: 'pos', label: '№', width: '60px', align: 'center', sortable: false },
    { key: 'match_data', label: 'Совпадение', width: '200px' },
    { key: 'name', label: 'Наименование' },
    { key: 'article', label: 'Артикул', width: '120px' },
    { key: 'supplier', label: 'Поставщик', width: '150px' },
    { key: 'quantity', label: 'Кол-во', width: '100px', align: 'right' },
    { key: 'unit', label: 'Ед. изм', width: '100px', align: 'center' },
    { key: 'price', label: 'Цена', width: '100px', align: 'right' },
    { key: 'total', label: 'Итого', width: '110px', align: 'right' }
  ];

  const isActiveSearch = searchQuery.trim().length > 0;

  if (isActiveSearch && displayRows.length === 0) {
    return (
      <NoResultsState 
        onReset={() => setSearchQuery('')} 
        currentQuery={searchQuery} 
        stage="invoice"
      />
    );
  }

  return (
    <div className="flex flex-col">
      {invoiceRows.length > 0 ? (
        <div className="bg-white">
          <TableHeader columns={columns} pageIds={displayRows.map(r => r.id)} />
          <div className="divide-y divide-slate-100">
            {displayRows.map((row, i) => (
              <TableRow
                key={row.id}
                row={row}
                columns={columns}
                stage="invoice"
                actualIndex={i}
                isSelected={selectedIds.includes(row.id)}
                selectedIds={selectedIds}
                toggleRowSelection={toggleRowSelection}
                onUpdate={handleCellUpdate}
                specRows={specRows}
                onKeyDown={handleKeyDown}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="p-4">
          <EmptyStateBlock handleFile={handleFile} currentStage="invoice" />
        </div>
      )}

      {invoiceRows.length > 0 && (
        <button
          onClick={() => setInvoiceRows([...invoiceRows, emptyInvoiceRow()])}
          className="self-start flex items-center gap-2 px-4 py-2 mt-4 ml-4 mb-4 text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Добавить позицию из счета
        </button>
      )}
    </div>
  );
}

function EstimateTable() {
  const { estimateRows, handleFile, selectedIds, toggleRowSelection, displayRows, searchQuery, setSearchQuery } = useData();
  const { handleCellUpdate } = useTableEditor('estimate');
  const { handleKeyDown } = useTableNavigation();

  const columns: Column[] = [
    { key: 'pos', label: '№', width: '60px', align: 'center', sortable: false },
    { key: 'workType', label: 'Вид работы', width: '150px' },
    { key: 'name', label: 'Наименование' },
    { key: 'unit', label: 'Ед. изм', width: '100px', align: 'center' },
    { key: 'quantity', label: 'Кол-во', width: '100px', align: 'right' },
    { key: 'costPrice', label: 'Себестоимость', width: '120px', align: 'right' },
    { key: 'clientPrice', label: 'Цена заказчика', width: '120px', align: 'right' }
  ];

  const isActiveSearch = searchQuery.trim().length > 0;

  if (isActiveSearch && displayRows.length === 0) {
    return (
      <NoResultsState 
        onReset={() => setSearchQuery('')} 
        currentQuery={searchQuery} 
        stage="estimate"
      />
    );
  }

  return (
    <div className="flex flex-col">
      {estimateRows.length > 0 ? (
        <div className="bg-white min-w-full shadow-sm rounded-xl overflow-hidden border border-slate-200/60">
          <TableHeader columns={columns} pageIds={displayRows.map(r => r.id)} />
          <div className="divide-y divide-slate-100">
            {displayRows.map((row, i) => (
              <TableRow
                key={row.id}
                row={row}
                columns={columns}
                stage="estimate"
                actualIndex={i}
                isSelected={selectedIds.includes(row.id)}
                selectedIds={selectedIds}
                toggleRowSelection={toggleRowSelection}
                onUpdate={handleCellUpdate}
                onKeyDown={handleKeyDown}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="p-4">
          <EmptyStateBlock handleFile={handleFile} currentStage="estimate" />
        </div>
      )}
    </div>
  );
}

