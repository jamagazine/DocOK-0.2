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
import { useData, genId, emptyInvoiceRow, InvoiceRow } from '../context/DataContext';

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

  const { uploadStatuses, invoiceRows } = useData();
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
           {currentStage === 'spec' && <SpecTable />}
           {currentStage === 'request' && <RequestTable />}
           {currentStage === 'invoice' && <InvoiceTable />}
           {currentStage === 'estimate' && <EstimateTable />}
        </div>
      </div>

      {/* Footer - Basement */}
      <div className="mx-4 mb-4 bg-white border border-slate-200 border-t-0 rounded-b-xl px-6 py-3 flex items-center justify-between text-sm text-slate-600 shadow-sm">
        {/* Left: Row Count */}
        <div className="flex items-center gap-4">
          <span className="text-slate-400 whitespace-nowrap">
            Всего строк: <span className="font-semibold text-slate-700">{invoiceRows.length}</span>
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

function SpecTable() {
  const { specRows } = useData();
  const columns = ['№', 'Наименование', 'Марка', 'Код', 'Поставщик', 'Количество', 'Единица измерения', 'Масса', 'Примечание'];

  return (
    <div className="border border-slate-200 rounded-lg shadow-sm bg-white overflow-hidden">
      <TableHeader columns={columns} />
      {specRows.map((row, i) => (
        <div key={row.id} className="grid border-b border-slate-200 hover:bg-indigo-50/50 text-sm text-slate-600 transition-colors" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(100px, 1fr))` }}>
          <div className="p-3 border-r border-slate-100 font-medium text-slate-400">{i + 1}</div>
          <div className="p-3 border-r border-slate-100 font-medium text-slate-900 truncate">{row.name}</div>
          <div className="p-3 border-r border-slate-100 truncate">{row.brand}</div>
          <div className="p-3 border-r border-slate-100 truncate">{row.code}</div>
          <div className="p-3 border-r border-slate-100 truncate text-indigo-600">{row.supplier}</div>
          <div className="p-3 border-r border-slate-100 text-right">{row.quantity}</div>
          <div className="p-3 border-r border-slate-100 text-center">{row.unit}</div>
          <div className="p-3 border-r border-slate-100 text-right">{row.mass}</div>
          <div className="p-3 text-slate-400 truncate text-xs flex items-center">{row.note}</div>
        </div>
      ))}
      {specRows.length === 0 && (
        <div className="p-8 text-center text-slate-400 text-sm">
          Нет добавленных позиций.
        </div>
      )}
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

function InvoiceTable() {
  const { invoiceRows, setInvoiceRows } = useData();
  const columns = ['№', 'Артикул', 'Наименование', 'Количество', 'Единица измерения', 'НДС (%)', 'Цена (с НДС)', 'Скидка', 'Цена со скидкой', 'Сумма без скидки', 'Сумма (с НДС)'];
  
  const handleRowChange = React.useCallback(
    (index: number, key: string, value: string) => {
      const updated = [...invoiceRows];
      updated[index] = { ...updated[index], [key]: value };

      // Очистка строк для расчетов
      const qtyStr = String(key === 'quantity' ? value : updated[index].quantity || '').replace(/\s/g, '').replace(/,/g, '.');
      const priceStr = String(key === 'price' ? value : updated[index].price || '').replace(/\s/g, '').replace(/,/g, '.');
      const discountStr = String(key === 'discount' ? value : updated[index].discount || '').replace(/\s/g, '').replace(/,/g, '.');

      const qty = parseFloat(qtyStr) || 0;
      const price = parseFloat(priceStr) || 0;
      
      const isPercent = discountStr.includes('%');
      let discountVal = parseFloat(discountStr) || 0;
      
      let priceAfterDist = price;
      if (discountVal > 0) {
        if (isPercent || discountVal <= 100) {
          priceAfterDist = price * (1 - (discountVal / 100)); // Процент
        } else {
          priceAfterDist = Math.max(0, price - discountVal); // Абсолютная скидка
        }
      }

      const totalBeforeDiscount = qty * price;
      const total = qty * priceAfterDist;

      if (totalBeforeDiscount > 0) {
        updated[index].priceAfterDiscount = priceAfterDist.toFixed(2);
        updated[index].totalBeforeDiscount = totalBeforeDiscount.toFixed(2);
        updated[index].total = total.toFixed(2);
      } else {
        updated[index].priceAfterDiscount = price > 0 ? priceAfterDist.toFixed(2) : '';
        updated[index].totalBeforeDiscount = '';
        updated[index].total = '';
      }

      setInvoiceRows(updated);
    },
    [invoiceRows, setInvoiceRows]
  );

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

function EstimateTable() {
  const { estimateRows } = useData();
  const columns = ['№', 'Вид', 'Наименование', 'Количество', 'Единица измерения', 'Себестоимость', 'Наценка (%)', 'Стоимость клиента'];
  
  return (
    <div className="border border-slate-200 rounded-lg shadow-sm bg-white overflow-hidden">
      <TableHeader columns={columns} />
      {estimateRows.map((row, i) => {
        const isMaterial = row.type === 'material';
        return (
          <div key={row.id} className="grid border-b border-slate-200 hover:bg-indigo-50/50 text-sm text-slate-600 transition-colors" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(100px, 1fr))` }}>
            <div className="p-3 border-r border-slate-100 font-medium text-slate-400">{i + 1}</div>
            <div className="p-3 border-r border-slate-100 flex items-center">
              <span className={cn(
                "px-2 py-1 rounded text-[10px] font-bold uppercase",
                isMaterial ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
              )}>
                {isMaterial ? 'Материал' : 'Работы'}
              </span>
            </div>
            <div className="p-3 border-r border-slate-100 font-medium text-slate-900 truncate">{row.name}</div>
            <div className="p-3 border-r border-slate-100 text-right">{row.quantity}</div>
            <div className="p-3 border-r border-slate-100 text-center">{row.unit}</div>
            <div className="p-3 border-r border-slate-100 text-right">{row.cost} ₽</div>
            <div className="p-3 border-r border-slate-100 text-center font-medium text-emerald-600">+{row.markup}%</div>
            <div className="p-3 text-right font-bold text-slate-900 bg-slate-50">{row.clientPrice} ₽</div>
          </div>
        );
      })}
      {estimateRows.length === 0 && (
        <div className="p-8 text-center text-slate-400 text-sm">
          Нет добавленных позиций для сметы.
        </div>
      )}
    </div>
  );
}
