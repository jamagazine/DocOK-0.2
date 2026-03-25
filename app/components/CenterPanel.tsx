import React from 'react';
import {
  Search,
  Folder,
  Edit2,
  Upload,
  GripHorizontal,
  FolderOpen,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  AlertCircle,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreVertical,
  Undo2,
  Table as TableIcon,
  ChevronDown,
  Split,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Stage, SpecRow, EstimateRow, UploadedFile } from '../types';
import { FilesPanel } from './FilesPanel';
import { useData, genId, emptyInvoiceRow, InvoiceRow, SPEC_COLUMNS, emptySpecRow } from '../context/DataContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CenterPanelProps {
  currentStage: Stage;
  projectName: string;
  setProjectName: (name: string) => void;
  files: UploadedFile[];
}

export function CenterPanel({ currentStage, projectName, setProjectName, files }: CenterPanelProps) {
  const {
    uploadStatuses,
    invoiceRows,
    specRows,
    requestRows,
    estimateRows,
    setInvoiceRows,
    setSpecRows,
    setRequestRows,
    setEstimateRows,
    searchQuery,
    setSearchQuery,
    handleFile,
    selectedIds,
    setSelectedIds,
    toggleRowSelection,
    currentPage,
    setCurrentPage,
    rowsPerPage,
    setRowsPerPage,
    isOnlySelectedView,
    setIsOnlySelectedView,
    handleRowChange
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

  // Reset pagination and selection when currentStage changes
  React.useEffect(() => {
    setCurrentPage(1);
    setSelectedIds([]); // Clear selection on stage change
    setIsOnlySelectedView(false); // Reset "Only Selected" view
  }, [currentStage, setCurrentPage, setSelectedIds, setIsOnlySelectedView]);

  // Reset pagination on search query change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, setCurrentPage]);

  return (
    <div className="flex flex-col flex-1 bg-white relative min-w-0 h-full">
      <div className="flex flex-col h-full flex-1 min-h-0">
        {/* Header - Attic */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shadow-sm h-[72px] shrink-0">

          {/* Left: Project Name */}
          <div className="flex-1 min-w-0 flex items-center gap-2">
            {isEditingName ? (
              <input
                ref={inputRef}
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onBlur={() => setIsEditingName(false)}
                onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                className="text-xl font-bold text-slate-900 bg-slate-100 rounded-md px-2 py-1 outline-none ring-2 ring-indigo-500 w-full max-w-sm"
              />
            ) : (
              <div
                className="group flex items-center gap-2 cursor-pointer max-w-sm hover:bg-slate-50 rounded-md px-2 py-1 -ml-2 transition-colors"
                onClick={() => setIsEditingName(true)}
                title="Редактировать название"
              >
                <h1 className="text-xl font-bold text-slate-800 truncate">{projectName}</h1>
                <Edit2 className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>

          {/* Center: Search */}
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

          {/* Right: Upload Statuses & Files Button */}
          <div className="flex-1 flex justify-end items-center gap-4 min-w-0">

            {/* Upload Statuses List */}
            {fileEntries.length > 0 && (
              <div className="flex flex-row-reverse items-center gap-2 overflow-hidden max-w-[250px] mr-2">
                {fileEntries.map(([filename, data]) => (
                  <div key={filename} className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 px-2 py-1 rounded-md shrink-0" title={`${filename}: ${data.status}`}>
                    {data.status.includes('Ошибка') ? <AlertCircle size={14} className="text-red-500 shrink-0" />
                      : data.status.includes('Готово') ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                        : <Clock size={14} className="text-indigo-500 animate-pulse shrink-0" />}
                    <span className="truncate max-w-[80px] text-slate-700 font-medium">{filename}</span>
                  </div>
                ))}
              </div>
            )}

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
              {files.length > 0 && (
                <span className="flex items-center justify-center bg-indigo-100 text-indigo-700 rounded-full w-5 h-5 text-[10px] ml-1">
                  {files.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Middle: Table Container */}
        <div className="flex-1 overflow-auto relative bg-white">
          <div className="min-w-max h-full">
            {currentStage === 'spec' && <SpecTable />}
            {currentStage === 'request' && <RequestTable />}
            {currentStage === 'invoice' && <InvoiceTable />}
            {currentStage === 'estimate' && <EstimateTable />}
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />

      {/* Slide-in Files Overlay */}
      <FilesPanel isOpen={filesOpen} onClose={() => setFilesOpen(false)} files={files} />
    </div>
  );
}

function Footer() {
  const {
    currentStage,
    getCurrentRows,
    selectedIds,
    currentPage,
    setCurrentPage,
    rowsPerPage,
    setRowsPerPage,
    isOnlySelectedView,
    setIsOnlySelectedView
  } = useData();

  const totalRows = getCurrentRows().length;

  const totalPages = Math.ceil(totalRows / rowsPerPage) || 1;

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  return (
    <div className="h-14 border-t border-slate-200 bg-white px-6 grid grid-cols-3 items-center">
      <div className="flex items-center gap-4 text-sm min-w-[200px]">
        <div className="flex items-center gap-1.5 text-slate-400 whitespace-nowrap">
          <span>Всего строк:</span>
          <span className="font-semibold text-slate-700">{totalRows}</span>
          
          {selectedIds.length > 0 && (
            <>
              <span className="mx-0.5">/</span>
              <button
                onClick={() => setIsOnlySelectedView(!isOnlySelectedView)}
                className={cn(
                  "px-1.5 py-0.5 rounded transition-all group",
                  isOnlySelectedView 
                    ? "bg-indigo-600 text-white shadow-sm" 
                    : "text-slate-700 hover:bg-slate-100 font-semibold"
                )}
                title={isOnlySelectedView ? "Показать все" : "Показать только выбранные"}
              >
                {selectedIds.length}
                {isOnlySelectedView && <Search className="w-3 h-3 inline-block ml-1 mb-0.5" />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Center: Pagination */}
      <div className="flex items-center justify-center gap-1">
        <button
          onClick={() => setCurrentPage(1)}
          disabled={currentPage === 1 || totalPages === 1}
          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
          title="Первая страница"
        >
          <ChevronsLeft size={16} />
        </button>
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1 || totalPages === 1}
          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 disabled:opacity-20 disabled:hover:bg-transparent transition-colors mr-2"
          title="Назад"
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
          title="Вперед"
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={() => setCurrentPage(totalPages)}
          disabled={currentPage === totalPages || totalPages === 1}
          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
          title="Последняя страница"
        >
          <ChevronsRight size={16} />
        </button>
      </div>

      {/* Right: Rows per page */}
      <div className="flex items-center justify-end gap-3 text-xs text-slate-400">
        <span className="hidden sm:inline">Строк на странице:</span>
        <select
          className="bg-transparent border-none focus:ring-0 text-slate-600 font-medium cursor-pointer py-0"
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

interface Column {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  width?: string;
}

function TableHeader({ columns, pageIds = [] }: { columns: Column[], pageIds?: string[] }) {
  const {
    sortConfig,
    handleSort,
    selectedIds,
    toggleSelectAllPage
  } = useData();

  const [isHovered, setIsHovered] = React.useState(false);

  // Состояние выбора для всей страницы
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
            {idx === 0 && col.key === '№' ? (
              <div 
                className="flex items-center justify-center w-full"
                onClick={(e) => e.stopPropagation()}
              >
                {(isHovered || isAllSelected || isSomeSelected) ? (
                  <div 
                    className="relative flex items-center justify-center cursor-pointer"
                    onClick={() => toggleSelectAllPage(pageIds)}
                  >
                    <input
                      type="checkbox"
                      className={cn(
                        "w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer transition-all",
                        isSomeSelected && "opacity-100"
                      )}
                      checked={isAllSelected}
                      onChange={() => {}} // Обработка в onClick выше для стоп-пропагейшн
                      ref={(el) => {
                        if (el) el.indeterminate = isSomeSelected;
                      }}
                    />
                  </div>
                ) : (
                  <span className="text-slate-500 font-medium">{col.label}</span>
                )}
              </div>
            ) : (
              <span className="truncate">{col.label}</span>
            )}

            {isSortable && col.key !== '№' && (
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
  const { specRows, setSpecRows, handleFile, selectedIds, toggleRowSelection, currentPage, rowsPerPage, handleRowChange, isOnlySelectedView } = useData();
  const [expandedRows, setExpandedRows] = React.useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const columns: Column[] = [
    { key: '№', label: '№', width: '60px', align: 'center', sortable: false },
    { key: 'name', label: 'Наименование' },
    { key: 'brand', label: 'Марка', width: '120px' },
    { key: 'code', label: 'Код', width: '120px' },
    { key: 'supplier', label: 'Поставщик', width: '150px' },
    { key: 'unit', label: 'Ед. изм', width: '80px', align: 'center' },
    { key: 'quantity', label: 'Кол-во', width: '90px', align: 'right' },
    { key: 'mass', label: 'Масса, 1 ед., кг', width: '100px', align: 'left' },
    { key: 'note', label: 'Примечание', width: '150px' }
  ];

  const displayRows = isOnlySelectedView ? specRows.filter(r => selectedIds.includes(r.id)) : specRows;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const slicedRows = displayRows.slice(startIndex, startIndex + rowsPerPage);

  return (
    <div className="flex flex-col">
      {specRows.length > 0 ? (
        <div className="bg-white min-w-full">
          <TableHeader columns={columns} pageIds={slicedRows.map(r => r.id)} />
          <div className="divide-y divide-slate-100">
            {slicedRows.map((row, i) => {
              const actualIndex = startIndex + i;
              const hasChildren = row.children && row.children.length > 1;
              const isExpanded = !!expandedRows[row.id];
              const isSelected = selectedIds.includes(row.id);

              return (
                <React.Fragment key={row.id}>
                  <div
                    onClick={() => toggleRowSelection(row.id, false)}
                    className={cn(
                      "flex items-center text-sm border-b border-slate-100 hover:bg-slate-50/80 transition-colors group min-h-[48px] cursor-pointer",
                      hasChildren && "bg-slate-50/30",
                      isSelected && "bg-indigo-50/50"
                    )}
                  >
                    {columns.map(col => (
                      <div
                        key={col.key}
                        className={cn(
                          "px-4 py-3 overflow-hidden border-r border-slate-100 last:border-0 h-full flex items-center break-words whitespace-normal",
                          col.align === 'center' ? "justify-center" : col.align === 'right' ? "justify-end" : "justify-start"
                        )}
                        style={{
                          flex: col.width ? `0 0 ${col.width}` : (col.key === 'name' ? '2' : '1'),
                          minWidth: col.width || '100px'
                        }}
                        onClick={col.key === '№' ? (e) => {
                          e.stopPropagation();
                          toggleRowSelection(row.id, true);
                        } : undefined}
                      >
                          {col.key === '№' ? (
                            <div className="relative w-full h-full flex items-center justify-center font-medium">
                              {hasChildren && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleExpand(row.id);
                                  }}
                                  className="absolute left-0 p-0.5 hover:bg-slate-200 rounded transition-colors"
                                >
                                  {isExpanded ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
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
                                  onChange={() => {}}
                                />
                              ) : (
                                <>
                                  <span className="group-hover:hidden text-slate-400 tabular-nums">
                                    {(actualIndex + 1).toString().padStart(2, '0')}
                                  </span>
                                  <input
                                    type="checkbox"
                                    className="hidden group-hover:block w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                    checked={false}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleRowSelection(row.id, true);
                                    }}
                                    onChange={() => {}}
                                  />
                                </>
                              )}
                            </div>
                          ) : col.key === 'name' ? (
                            <div className="flex items-center justify-between w-full gap-2 overflow-hidden">
                              {selectedIds.length > 0 ? (
                                <div 
                                  className="px-1 w-full text-slate-900 break-words py-0"
                                >
                                  {row.name || ''}
                                </div>
                              ) : (
                                <textarea
                                  className="bg-transparent border-none focus:ring-2 focus:ring-indigo-500/20 rounded px-1 w-full text-slate-900 resize-none overflow-hidden py-0"
                                  rows={1}
                                  style={{ height: 'auto' }}
                                  value={row.name || ''}
                                  onClick={(e) => e.stopPropagation()}
                                  onInput={(e) => {
                                    const target = e.target as HTMLTextAreaElement;
                                    target.style.height = 'auto';
                                    target.style.height = target.scrollHeight + 'px';
                                  }}
                                  onChange={(e) => handleRowChange('spec', row.id, col.key, e.target.value)}
                              />
                            )}
                          </div>
                          ) : (
                            selectedIds.length > 0 ? (
                              <span 
                                className={cn(
                                  "px-1 w-full text-slate-600 cursor-pointer",
                                  col.align === 'center' ? "text-center" : col.align === 'right' ? "text-right" : "text-left"
                                )}
                              >
                                {String((row as any)[col.key] || '')}
                              </span>
                            ) : (
                              <input
                                className={cn(
                                  "bg-transparent border-none focus:ring-2 focus:ring-indigo-500/20 rounded px-1 w-full text-slate-600",
                                  col.align === 'center' ? "text-center" : col.align === 'right' ? "text-right" : "text-left"
                                )}
                                value={String((row as any)[col.key] || '')}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => handleRowChange('spec', row.id, col.key, e.target.value)}
                              />
                            )
                          )}
                        </div>
                    ))}
                  </div>

                  {isExpanded && row.children?.map((child, childIdx) => (
                    <div key={child.id} className="flex items-center text-xs bg-slate-50/20 border-b border-slate-100 h-10 italic group/child">
                      {columns.map(col => (
                        <div
                          key={col.key}
                          className={cn(
                            "px-4 py-1 overflow-hidden border-r border-slate-100/50 last:border-0 h-full flex items-center",
                            col.align === 'center' ? "justify-center" : col.align === 'right' ? "justify-end" : "justify-start"
                          )}
                          style={{
                            flex: col.key === 'name' ? '2' :
                              col.key === '№' ? '0 0 60px' :
                                col.key === 'unit' ? '0 0 100px' :
                                  col.key === 'quantity' ? '0 0 100px' : '1',
                            minWidth: col.key === '№' ? '60px' :
                              col.key === 'unit' ? '100px' :
                                col.key === 'quantity' ? '100px' : '100px'
                          }}
                        >
                          {col.key === '№' ? (
                            <div className="flex items-center gap-2 pl-6">
                              <span className="text-slate-300 tabular-nums">{(childIdx + 1)}</span>
                            </div>
                          ) : (
                            <span className="text-slate-500 truncate">{String((child as any)[col.key] || '')}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </React.Fragment>
              );
            })}
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
  const { requestRows, handleFile, selectedIds, toggleRowSelection, currentPage, rowsPerPage, isOnlySelectedView } = useData();

  const columns: Column[] = [
    { key: '№', label: '№', width: '60px', align: 'center', sortable: false },
    { key: 'name', label: 'Наименование' },
    { key: 'brand', label: 'Марка', width: '120px' },
    { key: 'code', label: 'Код', width: '120px' },
    { key: 'supplier', label: 'Поставщик', width: '150px' },
    { key: 'unit', label: 'Ед. изм', width: '80px', align: 'center' },
    { key: 'quantity', label: 'Кол-во', width: '90px', align: 'right' }
  ];

  const displayRows = isOnlySelectedView ? requestRows.filter(r => selectedIds.includes(r.id)) : requestRows;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const slicedRows = displayRows.slice(startIndex, startIndex + rowsPerPage);

  return (
    <div className="flex flex-col">
      {requestRows.length > 0 ? (
        <>
          <TableHeader columns={columns} pageIds={slicedRows.map(r => r.id)} />
          <div className="divide-y divide-slate-100">
            {slicedRows.map((row, i) => {
              const actualIndex = startIndex + i;
              const isSelected = selectedIds.includes(row.id);
              return (
                <div
                  key={row.id}
                  onClick={() => toggleRowSelection(row.id, false)}
                  className={cn(
                    "flex items-center text-sm border-b border-slate-50 hover:bg-slate-50 transition-colors group min-h-[48px] cursor-pointer",
                    isSelected && "bg-indigo-50/50"
                  )}
                >
                  {columns.map(col => (
                    <div
                      key={col.key}
                      className={cn(
                        "px-4 py-3 border-r border-slate-100 last:border-0 h-full flex items-center break-words whitespace-normal",
                        col.align === 'center' ? "justify-center" : col.align === 'right' ? "justify-end" : "justify-start"
                      )}
                      style={{
                        flex: col.width ? `0 0 ${col.width}` : (col.key === 'name' ? '2' : '1'),
                        minWidth: col.width || '100px'
                      }}
                      onClick={col.key === '№' ? (e) => {
                        e.stopPropagation();
                        toggleRowSelection(row.id, true);
                      } : undefined}
                    >
                      {col.key === '№' ? (
                        <div className="relative w-full h-full flex items-center justify-center font-medium">
                          {isSelected ? (
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              checked={true}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRowSelection(row.id, true);
                              }}
                              onChange={() => {}}
                            />
                          ) : (
                            <>
                              <span className="group-hover:hidden text-slate-400 tabular-nums">
                                {(actualIndex + 1).toString().padStart(2, '0')}
                              </span>
                              <input
                                type="checkbox"
                                className="hidden group-hover:block w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                checked={false}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleRowSelection(row.id, true);
                                }}
                                onChange={() => {}}
                              />
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-600">{String((row as any)[col.key] || '')}</span>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
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
  const { invoiceRows, setInvoiceRows, handleFile, selectedIds, toggleRowSelection, currentPage, rowsPerPage, handleRowChange, isOnlySelectedView } = useData();

  const columns: Column[] = [
    { key: '№', label: '№', width: '60px', align: 'center', sortable: false },
    { key: 'name', label: 'Наименование' },
    { key: 'article', label: 'Артикул', width: '120px' },
    { key: 'supplier', label: 'Поставщик', width: '150px' },
    { key: 'quantity', label: 'Кол-во', width: '90px', align: 'right' },
    { key: 'unit', label: 'Ед. изм', width: '80px', align: 'center' },
    { key: 'price', label: 'Цена', width: '100px', align: 'right' },
    { key: 'total', label: 'Итого', width: '110px', align: 'right' }
  ];

  const displayRows = isOnlySelectedView ? invoiceRows.filter(r => selectedIds.includes(r.id)) : invoiceRows;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const slicedRows = displayRows.slice(startIndex, startIndex + rowsPerPage);

  return (
    <div className="flex flex-col">
      {invoiceRows.length > 0 ? (
        <div className="bg-white">
          <TableHeader columns={columns} pageIds={slicedRows.map(r => r.id)} />
          <div className="divide-y divide-slate-100">
            {slicedRows.map((row, i) => {
              const actualIndex = startIndex + i;
              const isSelected = selectedIds.includes(row.id);
              return (
                <div
                  key={row.id}
                  onClick={() => toggleRowSelection(row.id, false)}
                  className={cn(
                    "flex items-center text-sm border-b border-slate-100 hover:bg-slate-50 transition-colors group min-h-[48px] cursor-pointer",
                    row.isUncertain && "bg-amber-50/50",
                    isSelected && "bg-indigo-50/50"
                  )}
                >
                  {columns.map(col => (
                    <div
                      key={col.key}
                      className={cn(
                        "px-4 py-3 border-r border-slate-100 last:border-0 h-full flex items-center break-words whitespace-normal",
                        col.align === 'center' ? "justify-center" : col.align === 'right' ? "justify-end" : "justify-start"
                      )}
                      style={{
                        flex: col.width ? `0 0 ${col.width}` : (col.key === 'name' ? '2' : '1'),
                        minWidth: col.width || '100px'
                      }}
                      onClick={col.key === '№' ? (e) => {
                        e.stopPropagation();
                        toggleRowSelection(row.id, true);
                      } : undefined}
                    >
                      {col.key === '№' ? (
                        <div className="relative w-full h-full flex items-center justify-center font-medium">
                          {isSelected ? (
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              checked={true}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRowSelection(row.id, true);
                              }}
                              onChange={() => {}}
                            />
                          ) : (
                            <>
                              {row.isUncertain && <AlertTriangle className="absolute left-1 w-3 h-3 text-amber-500 shrink-0" />}
                              <span className="group-hover:hidden text-slate-400 tabular-nums">
                                {(actualIndex + 1).toString().padStart(2, '0')}
                              </span>
                              <input
                                type="checkbox"
                                className="hidden group-hover:block w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                checked={false}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleRowSelection(row.id, true);
                                }}
                                onChange={() => {}}
                              />
                            </>
                          )}
                        </div>
                      ) : col.key === 'name' ? (
                        <div className="flex items-center justify-between w-full gap-2 overflow-hidden">
                          {selectedIds.length > 0 ? (
                            <div className="px-1 w-full text-slate-900 break-words py-0">
                              {row.name || ''}
                            </div>
                          ) : (
                            <textarea
                              className="bg-transparent border-none focus:ring-2 focus:ring-indigo-500/20 rounded px-1 w-full text-slate-900 resize-none overflow-hidden py-0"
                              rows={1}
                              style={{ height: 'auto' }}
                              value={row.name || ''}
                              onClick={(e) => e.stopPropagation()}
                              onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = 'auto';
                                target.style.height = target.scrollHeight + 'px';
                              }}
                              onChange={(e) => handleRowChange('invoice', row.id, 'name', e.target.value)}
                            />
                          )}
                        </div>
                      ) : (
                        selectedIds.length > 0 ? (
                          <span
                            className={cn(
                              "px-1 w-full text-slate-600 cursor-pointer",
                              col.align === 'center' ? "text-center" : col.align === 'right' ? "text-right" : "text-left"
                            )}
                          >
                            {String((row as any)[col.key] || '')}
                          </span>
                        ) : (
                          <input
                            className={cn(
                              "bg-transparent border-none focus:ring-2 focus:ring-indigo-500/20 rounded px-1 w-full text-slate-600",
                              col.align === 'center' ? "text-center" : col.align === 'right' ? "text-right" : "text-left"
                            )}
                            value={String((row as any)[col.key] || '')}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => handleRowChange('invoice', row.id, col.key, e.target.value)}
                          />
                        )
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
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
  const { estimateRows, handleFile, selectedIds, toggleRowSelection, currentPage, rowsPerPage, handleRowChange, isOnlySelectedView } = useData();

  const columns: Column[] = [
    { key: '№', label: '№', width: '60px', align: 'center', sortable: false },
    { key: 'workType', label: 'Вид работы', width: '150px' },
    { key: 'name', label: 'Наименование' },
    { key: 'unit', label: 'Ед. изм', width: '80px', align: 'center' },
    { key: 'quantity', label: 'Кол-во', width: '90px', align: 'right' },
    { key: 'costPrice', label: 'Себестоимость', width: '120px', align: 'right' },
    { key: 'clientPrice', label: 'Цена заказчика', width: '120px', align: 'right' }
  ];

  const displayRows = isOnlySelectedView ? estimateRows.filter(r => selectedIds.includes(r.id)) : estimateRows;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const slicedRows = displayRows.slice(startIndex, startIndex + rowsPerPage);

  return (
    <div className="flex flex-col">
      {estimateRows.length > 0 ? (
        <div className="bg-white min-w-full shadow-sm rounded-xl overflow-hidden border border-slate-200/60">
          <TableHeader columns={columns} pageIds={slicedRows.map(r => r.id)} />
          <div className="divide-y divide-slate-100">
            {slicedRows.map((row, i) => {
              const actualIndex = startIndex + i;
              const isSelected = selectedIds.includes(row.id);
              return (
                <div
                  key={row.id}
                  onClick={() => toggleRowSelection(row.id, false)}
                  className={cn(
                    "flex items-center text-sm border-b border-slate-100 hover:bg-slate-50 transition-colors group min-h-[56px] cursor-pointer",
                    isSelected && "bg-indigo-50/50"
                  )}
                >
                  {columns.map(col => (
                    <div
                      key={col.key}
                      className={cn(
                        "px-4 py-3 border-r border-slate-100 last:border-0 h-full flex items-center break-words whitespace-normal",
                        col.align === 'center' ? "justify-center" : col.align === 'right' ? "justify-end" : "justify-start"
                      )}
                      style={{
                        flex: col.width ? `0 0 ${col.width}` : (col.key === 'name' ? '2' : '1'),
                        minWidth: col.width || '100px'
                      }}
                      onClick={col.key === '№' ? (e) => {
                        e.stopPropagation();
                        toggleRowSelection(row.id, true);
                      } : undefined}
                    >
                      {col.key === '№' ? (
                        <div className="relative w-full h-full flex items-center justify-center font-medium">
                          {isSelected ? (
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              checked={true}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRowSelection(row.id, true);
                              }}
                              onChange={() => {}}
                            />
                          ) : (
                            <>
                              <span className="group-hover:hidden text-slate-400 tabular-nums">
                                {(actualIndex + 1).toString().padStart(2, '0')}
                              </span>
                              <input
                                type="checkbox"
                                className="hidden group-hover:block w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                checked={false}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleRowSelection(row.id, true);
                                }}
                                onChange={() => {}}
                              />
                            </>
                          )}
                        </div>
                      ) : col.key === 'workType' ? (
                        selectedIds.length > 0 ? (
                          <div className="px-1 w-full text-slate-500 text-xs break-words cursor-pointer">
                            {row.workType || ''}
                          </div>
                        ) : (
                          <textarea
                            className="bg-transparent border-none focus:ring-2 focus:ring-indigo-500/20 rounded px-1 w-full text-slate-500 text-xs resize-none overflow-hidden"
                            rows={1}
                            style={{ height: 'auto' }}
                            value={row.workType || ''}
                            onClick={(e) => e.stopPropagation()}
                            onInput={(e) => {
                              const target = e.target as HTMLTextAreaElement;
                              target.style.height = 'auto';
                              target.style.height = target.scrollHeight + 'px';
                            }}
                            onChange={(e) => handleRowChange('estimate', row.id, 'workType', e.target.value)}
                          />
                        )
                      ) : col.key === 'name' ? (
                        selectedIds.length > 0 ? (
                          <div className="px-1 w-full text-slate-900 break-words cursor-pointer">
                            {row.name || ''}
                          </div>
                        ) : (
                          <textarea
                            className="bg-transparent border-none focus:ring-2 focus:ring-indigo-500/20 rounded px-1 w-full text-slate-900 resize-none overflow-hidden"
                            rows={1}
                            style={{ height: 'auto' }}
                            value={row.name || ''}
                            onClick={(e) => e.stopPropagation()}
                            onInput={(e) => {
                              const target = e.target as HTMLTextAreaElement;
                              target.style.height = 'auto';
                              target.style.height = target.scrollHeight + 'px';
                            }}
                            onChange={(e) => handleRowChange('estimate', row.id, 'name', e.target.value)}
                          />
                        )
                      ) : col.key === 'costPrice' || col.key === 'clientPrice' ? (
                        <div className="flex flex-col items-end w-full">
                          <input
                            className={cn(
                              "bg-transparent border-none focus:ring-2 focus:ring-indigo-500/20 rounded px-1 w-full text-right",
                              col.key === 'costPrice' ? "text-blue-600" : "text-emerald-600",
                              selectedIds.length === 0 ? "cursor-text" : "cursor-pointer"
                            )}
                            value={String((row as any)[col.key] || '')}
                            readOnly={selectedIds.length > 0}
                            onClick={(e) => {
                              if (selectedIds.length === 0) e.stopPropagation();
                            }}
                            onChange={(e) => handleRowChange('estimate', row.id, col.key as 'quantity' | 'price' | 'clientPrice', e.target.value)}
                          />
                          <span className="text-[10px] text-slate-400 px-1 antialiased">
                            {new Intl.NumberFormat('ru-RU').format(Number((row as any)[col.key] || 0))} ₽
                          </span>
                        </div>
                      ) : (
                        selectedIds.length > 0 ? (
                          <span 
                            className={cn(
                              "px-1 w-full text-slate-600 cursor-pointer",
                              col.align === 'center' ? "text-center" : col.align === 'right' ? "text-right" : "text-left"
                            )}
                          >
                            {String((row as any)[col.key] || '')}
                          </span>
                        ) : (
                          <input
                            className={cn(
                              "bg-transparent border-none focus:ring-2 focus:ring-indigo-500/20 rounded px-1 w-full text-slate-600",
                              col.align === 'center' ? "text-center" : col.align === 'right' ? "text-right" : "text-left"
                            )}
                            value={String((row as any)[col.key] || '')}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => handleRowChange('estimate', row.id, col.key, e.target.value)}
                          />
                        )
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
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
