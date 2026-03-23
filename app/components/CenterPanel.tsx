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
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Stage, SpecRow, EstimateRow, UploadedFile } from '../types';
import { FilesPanel } from './FilesPanel';
import { useData, genId, emptyInvoiceRow, InvoiceRow, SPEC_COLUMNS, emptySpecRow } from '../context/DataContext';
import { ChevronDown, ChevronRight, Split, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

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
  const [isEditingName, setIsEditingName] = React.useState(false);
  const [filesOpen, setFilesOpen] = React.useState(false);
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
    handleFile
  } = useData();
  const fileEntries = Object.entries((uploadStatuses || {}) as Record<string, { status: string; time: string }>);

  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditingName]);

  const handleRowChange = React.useCallback(
    (index: number, field: string, value: string) => {
      // ... row change logic (keep it same but fix dependencies)
      if (currentStage === 'spec') {
        const updated = [...specRows];
        updated[index] = { ...updated[index], [field]: value };
        setSpecRows(updated);
      } else if (currentStage === 'invoice') {
        const updated = [...invoiceRows];
        updated[index] = { ...updated[index], [field]: value } as InvoiceRow;

        const qty = parseFloat(String(field === 'quantity' ? value : updated[index].quantity).replace(/\s/g, '').replace(/,/g, '.')) || 0;
        const price = parseFloat(String(field === 'price' ? value : updated[index].price).replace(/\s/g, '').replace(/,/g, '.')) || 0;
        const discountStr = String(field === 'discount' ? value : updated[index].discount || '');
        const isPercent = discountStr.includes('%');
        let dVal = parseFloat(discountStr) || 0;

        let pad = price;
        if (dVal > 0) {
          pad = isPercent ? price * (1 - dVal / 100) : Math.max(0, price - dVal);
        }

        updated[index].priceAfterDiscount = pad.toFixed(2);
        updated[index].totalBeforeDiscount = (qty * price).toFixed(2);
        updated[index].total = (qty * pad).toFixed(2);

        setInvoiceRows(updated);
      } else if (currentStage === 'estimate') {
        const updated = [...estimateRows];
        updated[index] = { ...updated[index], [field]: value };

        if (field === 'price' || field === 'quantity') {
          const q = parseFloat(String(updated[index].quantity).replace(/\s/g, '').replace(/,/g, '.')) || 0;
          const p = parseFloat(String(updated[index].price).replace(/\s/g, '').replace(/,/g, '.')) || 0;
          updated[index].sum = (q * p).toFixed(2);
        }
        setEstimateRows(updated);
      }
    },
    [currentStage, specRows, invoiceRows, estimateRows, setSpecRows, setInvoiceRows, setEstimateRows]
  );

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
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProjectName(e.target.value)}
                onBlur={() => setIsEditingName(false)}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && setIsEditingName(false)}
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
            {currentStage === 'spec' && <SpecTable handleRowChange={handleRowChange} />}
            {currentStage === 'request' && <RequestTable />}
            {currentStage === 'invoice' && <InvoiceTable handleRowChange={handleRowChange} />}
            {currentStage === 'estimate' && <EstimateTable handleRowChange={handleRowChange} />}
          </div>
        </div>
      </div>

      {/* Footer - Basement */}
      <div className="bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between text-sm text-slate-600">
        {/* Left: Row Count */}
        <div className="flex items-center gap-4">
          <span className="text-slate-400 whitespace-nowrap">
            Всего строк: <span className="font-semibold text-slate-700">
              {currentStage === 'spec' ? specRows.length :
                currentStage === 'request' ? requestRows.length :
                  currentStage === 'invoice' ? invoiceRows.length :
                    estimateRows.length}
            </span>
          </span>
          <div className="w-px h-4 bg-slate-200" />
          <span className="text-slate-400 whitespace-nowrap">
            Выбрано: <span className="font-semibold text-slate-700">0</span>
          </span>
        </div>

        {/* Middle: Pagination */}
        <div className="flex items-center gap-1">
          <button className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
            <span className="sr-only">Предыдущая</span>
            &larr;
          </button>
          <button className="w-8 h-8 flex items-center justify-center rounded-md bg-indigo-50 text-indigo-700 font-bold">1</button>
          <button className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-600">2</button>
          <button className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-600">3</button>
          <span className="px-1 text-slate-300">...</span>
          <button className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-600">15</button>
          <button className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-100">
            <span className="sr-only">Следующая</span>
            &rarr;
          </button>
        </div>

        {/* Right: Page Size */}
        <div className="flex items-center gap-3">
          <span className="text-slate-400">Показывать по:</span>
          <select className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer">
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
      </div>

      {/* Slide-in Files Overlay */}
      <FilesPanel isOpen={filesOpen} onClose={() => setFilesOpen(false)} files={files} />
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

// Subcomponents for tables

interface Column {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
}

function TableHeader({ columns }: { columns: Column[] }) {
  const { sortConfig, handleSort } = useData();

  return (
    <div
      className="flex bg-slate-100/80 backdrop-blur sticky top-0 z-10 border-b border-slate-300 h-12"
    >
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
              flex: col.key === 'name' || col.label === 'Наименование' ? '2' :
                col.key === '№' ? '0 0 60px' :
                  col.key === 'unit' ? '0 0 100px' :
                    col.key === 'quantity' ? '0 0 100px' : '1',
              minWidth: col.key === '№' ? '60px' :
                col.key === 'unit' ? '100px' :
                  col.key === 'quantity' ? '100px' : '100px'
            }}
            onClick={() => isSortable && handleSort(col.key)}
          >
            <span className="truncate">{col.label}</span>
            {isSortable && (
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

interface SpecTableProps {
  handleRowChange: (index: number, field: string, value: string) => void;
}

function SpecTable({ handleRowChange }: SpecTableProps) {
  const { specRows, setSpecRows, handleUnmerge, handleFile } = useData();
  const [expandedRows, setExpandedRows] = React.useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const columns: Column[] = [
    { key: '№', label: '№', align: 'center', sortable: false },
    { key: 'name', label: 'Наименование' },
    { key: 'brand', label: 'Марка' },
    { key: 'code', label: 'Код' },
    { key: 'supplier', label: 'Поставщик' },
    { key: 'unit', label: 'Ед. изм', align: 'center' },
    { key: 'quantity', label: 'Кол-во', align: 'right' },
    { key: 'mass', label: 'Масса', align: 'left' },
    { key: 'note', label: 'Прим.' }
  ];

  const handleDeleteRow = (index: number) => {
    setSpecRows(specRows.filter((_, i) => i !== index));
  };

  const handleAddRow = () => {
    setSpecRows([...specRows, emptySpecRow()]);
  };

  return (
    <div className="flex flex-col">
      <div className="bg-white min-w-full">
        <TableHeader columns={columns} />
        <div className="divide-y divide-slate-100">
          {specRows.map((row, idxRender) => {
            const hasChildren = row.children && row.children.length > 1;
            const isExpanded = !!expandedRows[row.id];

            return (
              <React.Fragment key={row.id}>
                <div
                  className={cn(
                    "flex items-center text-sm border-b border-slate-100 hover:bg-slate-50/80 transition-colors group h-12",
                    hasChildren && "bg-slate-50/30"
                  )}
                >
                  {columns.map(col => (
                    <div
                      key={col.key}
                      className={cn(
                        "px-4 py-2 overflow-hidden border-r border-slate-100 last:border-0 h-full flex items-center",
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
                        <div className="relative w-full h-full flex items-center justify-center">
                          {hasChildren && (
                            <button
                              onClick={() => toggleExpand(row.id)}
                              className="absolute left-0 p-0.5 hover:bg-slate-200 rounded transition-colors"
                            >
                              {isExpanded ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
                            </button>
                          )}
                          <span className="text-slate-400 tabular-nums">{(idxRender + 1).toString().padStart(2, '0')}</span>
                        </div>
                      ) : col.key === 'name' ? (
                        <div className="flex items-center justify-between w-full gap-2 overflow-hidden">
                          <input
                            className="bg-transparent border-none focus:ring-2 focus:ring-indigo-500/20 rounded px-1 w-full text-slate-900 truncate"
                            value={row.name || ''}
                            onChange={(e) => handleRowChange(idxRender, col.key, e.target.value)}
                          />
                          <button onClick={() => handleDeleteRow(idxRender)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 transition-opacity shrink-0">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ) : (
                        <input
                          className={cn(
                            "bg-transparent border-none focus:ring-2 focus:ring-indigo-500/20 rounded px-1 w-full text-slate-600 truncate",
                            col.align === 'center' ? "text-center" : col.align === 'right' ? "text-right" : "text-left"
                          )}
                          value={String((row as any)[col.key] || '')}
                          onChange={(e) => handleRowChange(idxRender, col.key, e.target.value)}
                        />
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
                        ) : col.key === 'name' ? (
                          <div className="flex items-center justify-between w-full pr-2">
                            <span className="text-slate-500 truncate">{child.name}</span>
                            <button
                              onClick={() => handleUnmerge(row.id, child.id)}
                              title="Разделить позицию"
                              className="opacity-0 group-hover/child:opacity-100 p-1 hover:bg-indigo-100 text-indigo-500 rounded transition-all"
                            >
                              <Split className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 truncate">{String((child as any)[col.key] || '')}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </React.Fragment>
            );
          })}
          {specRows.length === 0 && (
            <div className="p-4">
              <EmptyStateBlock handleFile={handleFile} currentStage="spec" />
            </div>
          )}
        </div>
      </div>
      {specRows.length > 0 && (
        <button
          onClick={handleAddRow}
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
  const { requestRows, handleFile } = useData();

  const columns: Column[] = [
    { key: '№', label: '№', align: 'center', sortable: false },
    { key: 'name', label: 'Наименование' },
    { key: 'brand', label: 'Марка' },
    { key: 'code', label: 'Код' },
    { key: 'supplier', label: 'Поставщик' },
    { key: 'unit', label: 'Ед. изм', align: 'center' },
    { key: 'quantity', label: 'Кол-во', align: 'right' }
  ];

  return (
    <div className="bg-white">
      <TableHeader columns={columns} />
      <div className="divide-y divide-slate-100">
        {requestRows.map((row, i) => (
          <div key={row.id} className="flex items-center text-sm border-b border-slate-50 hover:bg-slate-50 transition-colors group h-12">
            {columns.map(col => (
              <div
                key={col.key}
                className={cn(
                  "px-4 py-2 border-r border-slate-100 last:border-0 h-full flex items-center",
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
                  <span className="text-slate-400 tabular-nums">{(i + 1).toString().padStart(2, '0')}</span>
                ) : (
                  <span className="text-slate-600 truncate">{String((row as any)[col.key] || '')}</span>
                )}
              </div>
            ))}
          </div>
        ))}
        {requestRows.length === 0 && (
          <div className="p-4">
            <EmptyStateBlock handleFile={handleFile} currentStage="request" />
          </div>
        )}
      </div>
    </div>
  );
}

interface InvoiceTableProps {
  handleRowChange: (index: number, field: string, value: string) => void;
}

function InvoiceTable({ handleRowChange }: InvoiceTableProps) {
  const { invoiceRows, setInvoiceRows, handleFile } = useData();

  const columns: Column[] = [
    { key: '№', label: '№', align: 'center', sortable: false },
    { key: 'name', label: 'Наименование' },
    { key: 'article', label: 'Артикул' },
    { key: 'supplier', label: 'Поставщик' },
    { key: 'quantity', label: 'Кол-во', align: 'right' },
    { key: 'unit', label: 'Ед. изм', align: 'center' },
    { key: 'price', label: 'Цена', align: 'right' },
    { key: 'total', label: 'Итого', align: 'right' }
  ];

  const handleAddRow = () => {
    setInvoiceRows([...invoiceRows, emptyInvoiceRow()]);
  };

  const handleDeleteRow = (index: number) => {
    setInvoiceRows(invoiceRows.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col">
      <div className="bg-white">
        <TableHeader columns={columns} />
        <div className="divide-y divide-slate-100">
          {invoiceRows.map((row, i) => (
            <div
              key={row.id}
              className={cn(
                "flex items-center text-sm border-b border-slate-100 hover:bg-slate-50 transition-colors group h-12",
                row.isUncertain && "bg-amber-50/50"
              )}
            >
              {columns.map(col => (
                <div
                  key={col.key}
                  className={cn(
                    "px-4 py-2 border-r border-slate-100 last:border-0 h-full flex items-center",
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
                    <div className="relative w-full h-full flex items-center justify-center">
                      {row.isUncertain && <AlertTriangle className="absolute left-1 w-3 h-3 text-amber-500 shrink-0" />}
                      <span className="text-slate-400 tabular-nums">{(i + 1).toString().padStart(2, '0')}</span>
                    </div>
                  ) : col.key === 'name' ? (
                    <div className="flex items-center justify-between w-full gap-2 overflow-hidden">
                      <input
                        className="bg-transparent border-none focus:ring-2 focus:ring-indigo-500/20 rounded px-1 w-full text-slate-900 truncate"
                        value={row.name || ''}
                        onChange={(e) => handleRowChange(i, 'name', e.target.value)}
                      />
                      <button onClick={() => handleDeleteRow(i)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 transition-opacity shrink-0">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : (
                    <input
                      className={cn(
                        "bg-transparent border-none focus:ring-2 focus:ring-indigo-500/20 rounded px-1 w-full text-slate-600 truncate",
                        col.align === 'center' ? "text-center" : col.align === 'right' ? "text-right" : "text-left"
                      )}
                      value={String((row as any)[col.key] || '')}
                      onChange={(e) => handleRowChange(i, col.key, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
          ))}
          {invoiceRows.length === 0 && (
            <div className="p-4">
              <EmptyStateBlock handleFile={handleFile} currentStage="invoice" />
            </div>
          )}
        </div>
      </div>
      {invoiceRows.length > 0 && (
        <button
          onClick={handleAddRow}
          className="self-start flex items-center gap-2 px-4 py-2 mt-4 ml-4 mb-4 text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Добавить позицию из счета
        </button>
      )}
    </div>
  );
}

interface EstimateTableProps {
  handleRowChange: (index: number, field: string, value: string) => void;
}

function EstimateTable({ handleRowChange }: EstimateTableProps) {
  const { estimateRows, handleFile } = useData();

  const columns: Column[] = [
    { key: '№', label: '№', align: 'center', sortable: false },
    { key: 'workType', label: 'Вид работы' },
    { key: 'name', label: 'Наименование' },
    { key: 'unit', label: 'Ед. изм', align: 'center' },
    { key: 'quantity', label: 'Кол-во', align: 'right' },
    { key: 'costPrice', label: 'Себестоимость', align: 'right' },
    { key: 'clientPrice', label: 'Цена заказчика', align: 'right' }
  ];

  return (
    <div className="bg-white min-w-full">
      <TableHeader columns={columns} />
      <div className="divide-y divide-slate-100">
        {estimateRows.map((row, i) => (
          <div key={row.id} className="flex items-center text-sm border-b border-slate-50 hover:bg-slate-50 transition-colors group h-14">
            {columns.map(col => (
              <div
                key={col.key}
                className={cn(
                  "px-4 py-2 border-r border-slate-100 last:border-0 h-full flex items-center",
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
                  <span className="text-slate-400 tabular-nums">{(i + 1).toString().padStart(2, '0')}</span>
                ) : col.key === 'workType' ? (
                  <input
                    className="bg-transparent border-none focus:ring-2 focus:ring-indigo-500/20 rounded px-1 w-full text-slate-500 text-xs"
                    value={row.workType || ''}
                    onChange={(e) => handleRowChange(i, 'workType', e.target.value)}
                  />
                ) : col.key === 'name' ? (
                  <input
                    className="bg-transparent border-none focus:ring-2 focus:ring-indigo-500/20 rounded px-1 w-full text-slate-900 truncate"
                    value={row.name || ''}
                    onChange={(e) => handleRowChange(i, 'name', e.target.value)}
                  />
                ) : col.key === 'costPrice' || col.key === 'clientPrice' ? (
                  <div className="flex flex-col items-end w-full">
                    <input
                      className={cn(
                        "bg-transparent border-none focus:ring-2 focus:ring-indigo-500/20 rounded px-1 w-full text-right",
                        col.key === 'costPrice' ? "text-blue-600" : "text-emerald-600"
                      )}
                      value={String((row as any)[col.key] || '')}
                      onChange={(e) => handleRowChange(i, col.key, e.target.value)}
                    />
                    <span className="text-[10px] text-slate-400 px-1 antialiased">
                      {col.key === 'costPrice' ? row.costSum : row.clientSum} ₽
                    </span>
                  </div>
                ) : (
                  <input
                    className={cn(
                      "bg-transparent border-none focus:ring-2 focus:ring-indigo-500/20 rounded px-1 w-full text-slate-600 truncate",
                      col.align === 'center' ? "text-center" : col.align === 'right' ? "text-right" : "text-left"
                    )}
                    value={String((row as any)[col.key] || '')}
                    onChange={(e) => handleRowChange(i, col.key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        ))}
        {estimateRows.length === 0 && (
          <div className="p-4">
            <EmptyStateBlock handleFile={handleFile} currentStage="estimate" />
          </div>
        )}
      </div>
    </div>
  );
}
