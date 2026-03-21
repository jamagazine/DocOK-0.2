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
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Stage, SpecRow, EstimateRow, UploadedFile } from '../types';
import { FilesPanel } from './FilesPanel';
import { useData, genId, emptyInvoiceRow, InvoiceRow, SPEC_COLUMNS, emptySpecRow } from '../context/DataContext';
import { ChevronDown, ChevronRight, Split } from 'lucide-react';

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
  const [isDragging, setIsDragging] = React.useState(false);

  const { uploadStatuses, invoiceRows, specRows, requestRows, estimateRows, setInvoiceRows, setSpecRows, setRequestRows, setEstimateRows } = useData();
  const fileEntries = Object.entries((uploadStatuses || {}) as Record<string, { status: string; time: string }>);

  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditingName]);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    // Simulating file upload
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      // In a real app we'd trigger an upload process
      console.log('Загружено файлов:', droppedFiles.length);
      // For now we just show a toast or feedback
    }
  };

  const handleRowChange = React.useCallback(
    (index: number, field: string, value: string) => {
      if (currentStage === 'spec') {
        const updated = [...specRows];
        updated[index] = { ...updated[index], [field]: value };
        setSpecRows(updated);
      } else if (currentStage === 'invoice') {
        const updated = [...invoiceRows];
        updated[index] = { ...updated[index], [field]: value } as InvoiceRow;

        // Расчеты для инвойса
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
    <div className="flex flex-col flex-1 bg-slate-50 relative min-w-0 h-full">
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
      <div 
        className="flex-1 overflow-auto relative bg-white m-4 mb-0 rounded-t-xl border-x border-t border-slate-200 shadow-sm"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 bg-indigo-50/90 z-20 flex flex-col items-center justify-center border-2 border-dashed border-indigo-400 rounded-xl transition-all">
            <Upload className="w-16 h-16 text-indigo-500 mb-4 animate-bounce" />
            <p className="text-xl font-semibold text-indigo-800">Перетащите файлы сюда</p>
            <p className="text-sm text-indigo-600 mt-2">для загрузки в текущий раздел</p>
          </div>
        )}

        <div className="min-w-max p-4 pb-0">
           {currentStage === 'spec' && <SpecTable handleRowChange={handleRowChange} />}
           {currentStage === 'request' && <RequestTable />}
           {currentStage === 'invoice' && <InvoiceTable handleRowChange={handleRowChange} />}
           {currentStage === 'estimate' && <EstimateTable handleRowChange={handleRowChange} />}
        </div>
      </div>

      {/* Footer - Basement */}
      <div className="mx-4 mb-4 bg-white border border-slate-200 border-t-0 rounded-b-xl px-6 py-3 flex items-center justify-between text-sm text-slate-600 shadow-sm">
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

// Subcomponents for tables

function TableHeader({ columns }: { columns: string[] }) {
  return (
    <div className="grid border-b border-slate-300 bg-slate-100 rounded-t-lg font-semibold text-slate-700 text-sm sticky top-0" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(100px, 1fr))` }}>
      {columns.map((col, idx) => (
        <div key={idx} className="p-3 border-r border-slate-200 last:border-0 truncate flex items-center">
           {col === '№' ? <GripHorizontal className="w-4 h-4 text-slate-400 mr-2 opacity-50" /> : null}
           {col}
        </div>
      ))}
    </div>
  );
}

interface SpecTableProps {
  handleRowChange: (index: number, field: string, value: string) => void;
}

function SpecTable({ handleRowChange }: SpecTableProps) {
  const { specRows, setSpecRows, handleUnmerge } = useData();
  const [expandedRows, setExpandedRows] = React.useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDeleteRow = React.useCallback(
    (index: number) => {
      setSpecRows(specRows.filter((_, i) => i !== index));
    },
    [specRows, setSpecRows]
  );

  const handleAddRow = React.useCallback(() => {
    setSpecRows([...specRows, emptySpecRow()]);
  }, [specRows, setSpecRows]);

  const columnNames = ['№', ...SPEC_COLUMNS.map(c => c.label)];

  return (
    <div className="flex flex-col gap-2">
      <div className="border border-slate-200 rounded-lg shadow-sm bg-white overflow-hidden min-w-full">
        <TableHeader columns={columnNames} />
        {specRows.map((row, i) => {
          const hasChildren = row.children && row.children.length > 1;
          const isExpanded = expandedRows[row.id];

          return (
            <React.Fragment key={row.id}>
              <div className={cn(
                "grid border-b border-slate-200 hover:bg-indigo-50/30 text-sm text-slate-600 transition-colors",
                hasChildren && "bg-slate-50/50"
              )} style={{ gridTemplateColumns: `80px repeat(${SPEC_COLUMNS.length}, minmax(150px, 1fr))` }}>
                
                <div className="p-3 border-r border-slate-100 flex items-center justify-between group">
                  <div className="flex items-center gap-1">
                    {hasChildren && (
                      <button onClick={() => toggleExpand(row.id)} className="p-0.5 hover:bg-slate-200 rounded text-slate-500">
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    )}
                    <span className="font-medium text-slate-400">{i + 1}</span>
                  </div>
                  <button onClick={() => handleDeleteRow(i)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 transition-opacity">
                    <Trash2 size={14} />
                  </button>
                </div>

                {SPEC_COLUMNS.map(col => (
                  <div key={col.key} className="p-3 border-r border-slate-100 flex items-center">
                    <input 
                      type="text"
                      className={cn(
                        "w-full bg-transparent outline-none",
                        col.key === 'name' ? "font-medium text-slate-900" : "text-slate-600",
                        (col.key === 'quantity' || col.key === 'mass') && "text-right"
                      )}
                      value={(row as any)[col.key] || ''}
                      onChange={(e) => handleRowChange(i, col.key, e.target.value)}
                    />
                  </div>
                ))}
              </div>

              {hasChildren && isExpanded && (
                <div className="bg-white border-b border-slate-100">
                  {row.children?.map((child, childIdx) => (
                    <div key={child.id} className="grid text-xs text-slate-500 border-b border-slate-50 hover:bg-slate-50 pl-8" style={{ gridTemplateColumns: `80px repeat(${SPEC_COLUMNS.length}, minmax(150px, 1fr))` }}>
                      <div className="p-2 border-r border-slate-50 flex items-center justify-between group">
                        <span>{i + 1}.{childIdx + 1}</span>
                        <button 
                          onClick={() => handleUnmerge(row.id, child.id)}
                          className="opacity-0 group-hover:opacity-100 text-indigo-400 hover:text-indigo-600 transition-opacity p-0.5"
                          title="Вынести из группы"
                        >
                          <Split size={12} />
                        </button>
                      </div>
                      {SPEC_COLUMNS.map(col => (
                        <div key={col.key} className="p-2 border-r border-slate-50 italic">
                          {(child as any)[col.key]}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </React.Fragment>
          );
        })}
        {specRows.length === 0 && (
          <div className="p-8 text-center text-slate-400 text-sm">
            Нет добавленных позиций. Загрузите файл или добавьте строку вручную.
          </div>
        )}
      </div>
      <button 
        onClick={handleAddRow}
        className="self-start flex items-center gap-2 px-4 py-2 mt-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200"
      >
        <Plus className="w-4 h-4" />
        Добавить строку спецификации
      </button>
    </div>
  );
}

function RequestTable() {
  const { requestRows } = useData();
  const columns = ['№', 'Наименование', 'Марка', 'Код', 'Поставщик', 'Количество', 'Единица измерения', 'Масса', 'Примечание'];
  
  return (
    <div className="border border-slate-200 rounded-lg shadow-sm bg-white overflow-hidden">
      <TableHeader columns={columns} />
      {requestRows.map((row, i) => (
        <div key={row.id} className="grid border-b border-slate-200 hover:bg-amber-50/50 text-sm text-slate-600 transition-colors" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(100px, 1fr))` }}>
          <div className="p-3 border-r border-slate-100 font-medium text-slate-400">{i + 1}</div>
          <div className="p-3 border-r border-slate-100 font-medium text-slate-900 truncate">{row.name}</div>
          <div className="p-3 border-r border-slate-100 truncate">{row.brand}</div>
          <div className="p-3 border-r border-slate-100 truncate">{row.code}</div>
          <div className="p-3 border-r border-slate-100 truncate text-amber-600 font-medium">{row.supplier || 'Ожидание...'}</div>
          <div className="p-3 border-r border-slate-100 text-right">{row.quantity}</div>
          <div className="p-3 border-r border-slate-100 text-center">{row.unit}</div>
          <div className="p-3 border-r border-slate-100 text-right">{row.mass}</div>
          <div className="p-3 text-slate-400 truncate text-xs flex items-center">{row.note}</div>
        </div>
      ))}
      {requestRows.length === 0 && (
        <div className="p-8 text-center text-slate-400 text-sm">
          Нет добавленных запросов.
        </div>
      )}
    </div>
  );
}

interface InvoiceTableProps {
  handleRowChange: (index: number, field: string, value: string) => void;
}

function InvoiceTable({ handleRowChange }: InvoiceTableProps) {
  const { invoiceRows, setInvoiceRows } = useData();
  const columns = ['№', 'Артикул', 'Наименование', 'Количество', 'Единица измерения', 'НДС (%)', 'Цена (с НДС)', 'Скидка', 'Цена со скидкой', 'Сумма без скидки', 'Сумма (с НДС)'];
  
  const handleAddRow = React.useCallback(() => {
    setInvoiceRows([...invoiceRows, emptyInvoiceRow()]);
  }, [invoiceRows, setInvoiceRows]);

  const handleDeleteRow = React.useCallback((index: number) => {
    setInvoiceRows(invoiceRows.filter((_, i: number) => i !== index));
  }, [invoiceRows, setInvoiceRows]);

  // If table is totally empty, optionally show one row
  React.useEffect(() => {
    if (invoiceRows.length === 0) {
      setInvoiceRows([emptyInvoiceRow()]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="border border-slate-200 rounded-lg shadow-sm bg-white overflow-hidden">
        <TableHeader columns={columns} />
        {invoiceRows.map((row: InvoiceRow, i: number) => (
          <div key={row.id} className={cn(
            "grid border-b transition-colors text-sm",
            row.isUncertain 
              ? "border-amber-400 bg-amber-50 hover:bg-amber-100" 
              : "border-slate-200 hover:bg-emerald-50/50 text-slate-600"
          )} style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(100px, 1fr))` }}>
            <div className="p-3 border-r flex items-center justify-between group" style={{ borderColor: 'inherit' }}>
              <span className={cn(row.isUncertain ? "text-amber-700 font-bold flex items-center gap-1" : "text-slate-400 font-medium")}>
                {row.isUncertain && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                {i + 1}
              </span>
              <button 
                onClick={() => handleDeleteRow(i)} 
                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 transition-opacity"
                title="Удалить строку"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-3 border-r font-mono text-xs flex items-center" style={{ borderColor: 'inherit' }}>
              <input 
                type="text" 
                className="w-full bg-transparent outline-none truncate text-inherit" 
                value={row.article || ''} 
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleRowChange(i, 'article', e.target.value)} 
                placeholder="Артикул..."
              />
            </div>
            
            <div className="p-3 border-r font-medium flex items-center" style={{ borderColor: 'inherit' }}>
              <input 
                type="text" 
                className={cn("w-full bg-transparent outline-none truncate", !row.isUncertain && "text-slate-900")} 
                value={row.name || ''} 
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleRowChange(i, 'name', e.target.value)} 
                placeholder="Наименование..."
              />
            </div>
            
            <div className="p-3 border-r flex items-center justify-end" style={{ borderColor: 'inherit' }}>
              <input 
                type="text" 
                className="w-full bg-transparent outline-none text-right" 
                value={row.quantity !== undefined ? row.quantity : ''} 
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleRowChange(i, 'quantity', e.target.value)} 
                placeholder="Кол-во"
              />
            </div>
            
            <div className="p-3 border-r flex items-center justify-center" style={{ borderColor: 'inherit' }}>
              <input 
                type="text" 
                className="w-full bg-transparent outline-none text-center" 
                value={row.unit || ''} 
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleRowChange(i, 'unit', e.target.value)} 
              />
            </div>
            
            <div className="p-3 border-r flex items-center justify-center" style={{ borderColor: 'inherit' }}>
              <input 
                type="text" 
                className="w-full bg-transparent outline-none text-center opacity-70" 
                value={row.vatRate || ''} 
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleRowChange(i, 'vatRate', e.target.value)} 
              />
            </div>
            
            <div className="p-3 border-r flex items-center justify-end" style={{ borderColor: 'inherit' }}>
              <input 
                type="text" 
                className="w-full bg-transparent outline-none text-right" 
                value={row.price !== undefined ? row.price : ''} 
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleRowChange(i, 'price', e.target.value)} 
                placeholder="0.00"
              />
            </div>
            
            <div className="p-3 border-r flex items-center justify-end" style={{ borderColor: 'inherit' }}>
              <input 
                type="text" 
                className="w-full bg-transparent outline-none text-right text-emerald-600 font-medium" 
                value={row.discount || ''} 
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleRowChange(i, 'discount', e.target.value)} 
                placeholder="Скидка"
              />
            </div>
            
            <div className="p-3 border-r flex items-center justify-end font-medium" style={{ borderColor: 'inherit' }}>
              {row.priceAfterDiscount ? `${row.priceAfterDiscount} ₽` : ''}
            </div>
            
            <div className="p-3 border-r flex items-center justify-end" style={{ borderColor: 'inherit' }}>
              {row.totalBeforeDiscount ? `${row.totalBeforeDiscount} ₽` : ''}
            </div>
            
            <div className={cn("p-3 flex items-center justify-end font-bold", row.isUncertain ? "text-amber-900 bg-amber-200/50" : "text-slate-900 bg-slate-50")}>
              {row.total ? `${row.total} ₽` : ''}
            </div>
          </div>
        ))}
        {invoiceRows.length === 0 && (
          <div className="p-8 text-center text-slate-400 text-sm">
            Нет добавленных позиций.
          </div>
        )}
      </div>
      
      <button 
        onClick={handleAddRow}
        className="self-start flex items-center gap-2 px-4 py-2 mt-2 text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200"
      >
        <Plus className="w-4 h-4" />
        Добавить позицию
      </button>
    </div>
  );
}

interface EstimateTableProps {
  handleRowChange: (index: number, field: string, value: string) => void;
}

function EstimateTable({ handleRowChange }: EstimateTableProps) {
  const { estimateRows } = useData();
  const columns = ['№', 'Наименование', 'Кол-во (спец)', 'Ед. изм', 'Цена (счёт)', 'Сумма', 'Поставщик'];
  
  return (
    <div className="border border-slate-200 rounded-lg shadow-sm bg-white overflow-hidden">
      <div className="grid bg-slate-50 border-b border-slate-200 divide-x divide-slate-200" style={{ gridTemplateColumns: '50px 1.5fr 100px 80px 120px 120px 1fr' }}>
        {columns.map((col, idx) => (
          <div key={idx} className="p-3 text-xs font-bold text-slate-500 uppercase flex items-center justify-center text-center">
            {col}
          </div>
        ))}
      </div>
      <div className="divide-y divide-slate-100">
        {estimateRows.map((row, i) => (
          <div key={row.id} className="grid hover:bg-indigo-50/30 text-sm text-slate-600 transition-colors divide-x divide-slate-100" style={{ gridTemplateColumns: '50px 1.5fr 100px 80px 120px 120px 1fr' }}>
            <div className="p-3 flex items-center justify-center font-medium text-slate-400">{i + 1}</div>
            
            <div className="p-3 flex items-center font-medium text-slate-800">
              {row.name}
            </div>
            
            <div className="p-3 flex items-center justify-center">
              <input 
                type="text"
                className="w-full bg-transparent text-center outline-none"
                value={row.quantity}
                onChange={(e) => handleRowChange(i, 'quantity', e.target.value)}
              />
            </div>
            
            <div className="p-3 flex items-center justify-center text-slate-500 italic">
              {row.unit}
            </div>
            
            <div className="p-3 flex items-center justify-end font-semibold text-blue-600">
               <input 
                 type="text"
                 className="w-full bg-transparent text-right outline-none font-semibold text-blue-600"
                 value={row.price}
                 onChange={(e) => handleRowChange(i, 'price', e.target.value)}
                 placeholder="---"
               />
            </div>
            
            <div className="p-3 flex items-center justify-end font-bold text-slate-900">
              {row.sum ? `${row.sum} ₽` : ''}
            </div>
            
            <div className="p-3 flex items-center text-xs text-slate-500 truncate">
               <input 
                 type="text"
                 className="w-full bg-transparent outline-none"
                 value={row.supplier}
                 onChange={(e) => handleRowChange(i, 'supplier', e.target.value)}
                 placeholder="Поставщик..."
               />
            </div>
          </div>
        ))}
        {estimateRows.length === 0 && (
          <div className="p-8 text-center text-slate-400 text-sm italic">
            Начните со Спецификаций и Счетов, чтобы сформировать смету.
          </div>
        )}
      </div>
    </div>
  );
}
