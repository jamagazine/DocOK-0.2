import React from 'react';
import { 
  Search, 
  Folder, 
  Edit2, 
  Upload,
  GripHorizontal,
  FolderOpen
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Stage, SpecRow, InvoiceRow, EstimateRow, UploadedFile } from '../types';
import { FilesPanel } from './FilesPanel';

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

  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditingName]);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
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
              placeholder="Глобальный поиск по разделам..."
              className="w-full bg-slate-100 hover:bg-slate-200 focus:bg-white border border-transparent focus:border-indigo-300 rounded-full pl-10 pr-4 py-2 text-sm text-slate-700 outline-none transition-all shadow-sm focus:shadow-md"
            />
          </div>
        </div>

        {/* Right: Files Button */}
        <div className="flex-1 flex justify-end min-w-0">
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
            Всего строк: <span className="font-semibold text-slate-700">142</span>
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
  const columns = ['№', 'Наименование', 'Марка', 'Код', 'Поставщик', 'Количество', 'Единица измерения', 'Масса', 'Примечание'];
  
  // Mock Data
  const data = Array.from({ length: 15 }).map((_, i) => (
    <div key={i} className="grid border-b border-slate-200 hover:bg-indigo-50/50 text-sm text-slate-600 transition-colors" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(100px, 1fr))` }}>
      <div className="p-3 border-r border-slate-100 font-medium text-slate-400">{i + 1}</div>
      <div className="p-3 border-r border-slate-100 font-medium text-slate-900 truncate">Светильник потолочный {i}</div>
      <div className="p-3 border-r border-slate-100 truncate">LED-Pro-X</div>
      <div className="p-3 border-r border-slate-100 truncate">LPR-{(i+1)*123}</div>
      <div className="p-3 border-r border-slate-100 truncate text-indigo-600">СветПромОпт</div>
      <div className="p-3 border-r border-slate-100 text-right">{Math.floor(Math.random() * 50) + 1}</div>
      <div className="p-3 border-r border-slate-100 text-center">шт</div>
      <div className="p-3 border-r border-slate-100 text-right">{(Math.random() * 2).toFixed(2)}</div>
      <div className="p-3 text-slate-400 truncate text-xs flex items-center">Уточнить наличие</div>
    </div>
  ));

  return (
    <div className="border border-slate-200 rounded-lg shadow-sm bg-white overflow-hidden">
      <TableHeader columns={columns} />
      {data}
    </div>
  );
}

function RequestTable() {
  const columns = ['№', 'Наименование', 'Марка', 'Код', 'Поставщик', 'Количество', 'Единица измерения', 'Масса', 'Примечание'];
  
   // Mock Data - visually similar but implies request state
  const data = Array.from({ length: 10 }).map((_, i) => (
    <div key={i} className="grid border-b border-slate-200 hover:bg-amber-50/50 text-sm text-slate-600 transition-colors" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(100px, 1fr))` }}>
      <div className="p-3 border-r border-slate-100 font-medium text-slate-400">{i + 1}</div>
      <div className="p-3 border-r border-slate-100 font-medium text-slate-900 truncate">Кабель ВВГнг-LS 3x2.5 {i}</div>
      <div className="p-3 border-r border-slate-100 truncate">ГОСТ</div>
      <div className="p-3 border-r border-slate-100 truncate">CBL-{i}</div>
      <div className="p-3 border-r border-slate-100 truncate text-amber-600 font-medium">Ожидание...</div>
      <div className="p-3 border-r border-slate-100 text-right">{(i+1)*100}</div>
      <div className="p-3 border-r border-slate-100 text-center">м</div>
      <div className="p-3 border-r border-slate-100 text-right">{(Math.random() * 20).toFixed(1)}</div>
      <div className="p-3 text-slate-400 truncate text-xs flex items-center">Бухта</div>
    </div>
  ));

  return (
    <div className="border border-slate-200 rounded-lg shadow-sm bg-white overflow-hidden">
      <TableHeader columns={columns} />
      {data}
    </div>
  );
}

function InvoiceTable() {
  const columns = ['№', 'Артикул', 'Наименование', 'Количество', 'Единица измерения', 'НДС (%)', 'Цена (с НДС)', 'Скидка', 'Цена со скидкой', 'Сумма без скидки', 'Сумма (с НДС)'];
  
  const data = Array.from({ length: 8 }).map((_, i) => {
    const qty = Math.floor(Math.random() * 10) + 1;
    const price = Math.floor(Math.random() * 5000) + 500;
    return (
      <div key={i} className="grid border-b border-slate-200 hover:bg-emerald-50/50 text-sm text-slate-600 transition-colors" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(100px, 1fr))` }}>
        <div className="p-3 border-r border-slate-100 font-medium text-slate-400">{i + 1}</div>
        <div className="p-3 border-r border-slate-100 font-mono text-xs text-slate-500 flex items-center">{Math.random().toString(36).substring(2, 8).toUpperCase()}</div>
        <div className="p-3 border-r border-slate-100 font-medium text-slate-900 truncate">Выключатель авт. {i}</div>
        <div className="p-3 border-r border-slate-100 text-right">{qty}</div>
        <div className="p-3 border-r border-slate-100 text-center">шт</div>
        <div className="p-3 border-r border-slate-100 text-center text-slate-400">20%</div>
        <div className="p-3 border-r border-slate-100 text-right">{price} ₽</div>
        <div className="p-3 border-r border-slate-100 text-right text-emerald-600">5%</div>
        <div className="p-3 border-r border-slate-100 text-right font-medium">{Math.floor(price * 0.95)} ₽</div>
        <div className="p-3 border-r border-slate-100 text-right">{price * qty} ₽</div>
        <div className="p-3 text-right font-bold text-slate-900 bg-slate-50">{Math.floor(price * 0.95 * qty)} ₽</div>
      </div>
    );
  });

  return (
    <div className="border border-slate-200 rounded-lg shadow-sm bg-white overflow-hidden">
      <TableHeader columns={columns} />
      {data}
    </div>
  );
}

function EstimateTable() {
  const columns = ['№', 'Вид', 'Наименование', 'Количество', 'Единица измерения', 'Себестоимость', 'Наценка', 'Стоимость клиента'];
  
  const data = Array.from({ length: 12 }).map((_, i) => {
    const qty = Math.floor(Math.random() * 20) + 1;
    const cost = Math.floor(Math.random() * 10000) + 1000;
    const isMaterial = i % 3 !== 0;
    const markup = isMaterial ? 15 : 40;
    return (
      <div key={i} className="grid border-b border-slate-200 hover:bg-indigo-50/50 text-sm text-slate-600 transition-colors" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(100px, 1fr))` }}>
        <div className="p-3 border-r border-slate-100 font-medium text-slate-400">{i + 1}</div>
        <div className="p-3 border-r border-slate-100 flex items-center">
          <span className={cn(
            "px-2 py-1 rounded text-[10px] font-bold uppercase",
            isMaterial ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
          )}>
            {isMaterial ? 'Материал' : 'Работы'}
          </span>
        </div>
        <div className="p-3 border-r border-slate-100 font-medium text-slate-900 truncate">Позиция сметы {i}</div>
        <div className="p-3 border-r border-slate-100 text-right">{qty}</div>
        <div className="p-3 border-r border-slate-100 text-center">{isMaterial ? 'шт' : 'чел/час'}</div>
        <div className="p-3 border-r border-slate-100 text-right">{cost} ₽</div>
        <div className="p-3 border-r border-slate-100 text-center font-medium text-emerald-600">+{markup}%</div>
        <div className="p-3 text-right font-bold text-slate-900 bg-slate-50">{Math.floor(cost * (1 + markup/100))} ₽</div>
      </div>
    );
  });

  return (
    <div className="border border-slate-200 rounded-lg shadow-sm bg-white overflow-hidden">
      <TableHeader columns={columns} />
      {data}
    </div>
  );
}
