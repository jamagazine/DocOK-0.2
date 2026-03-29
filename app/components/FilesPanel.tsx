import React from 'react';
import {
  X,
  FileText,
  Trash2,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  Circle,
  Eraser
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useData } from '../context/DataContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FilesPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FilesPanel({ isOpen, onClose }: FilesPanelProps) {
  const { uploadStatuses, filesMap, removeFile, retryFile, handleFile, currentStage, resetFileData, reprocessAi } = useData();
  const [pendingDelete, setPendingDelete] = React.useState<{ name: string; nuclear: boolean } | null>(null);

  if (!isOpen) return null;

  const fileEntries = Object.entries(uploadStatuses);

  const isTableFile = (name: string) => /\.(xlsx?|xls|csv)$/i.test(name);

  const handleDeleteConfirm = () => {
    if (pendingDelete) {
      removeFile(pendingDelete.name, pendingDelete.nuclear);
      setPendingDelete(null);
    }
  };

  const handleAiProcess = async (fileName: string) => {
    let file = filesMap[fileName];
    if (!file) {
      // Auto-restore from storage if file is missing in memory (e.g. after refresh)
      try {
        const res = await fetch(`http://localhost:8000/api/storage/files/${fileName}`);
        if (!res.ok) throw new Error('Failed to fetch file from storage');
        const blob = await res.blob();
        file = new File([blob], fileName, { type: blob.type });
      } catch (e) {
        console.error('Auto-restore for AI failed:', e);
        return;
      }
    }
    await handleFile([file], currentStage, true);
  };

  const handleRestore = async (fileName: string) => {
    try {
      const res = await fetch(`http://localhost:8000/api/storage/files/${fileName}`);
      if (!res.ok) throw new Error('Failed to fetch file from storage');
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: blob.type });
      await handleFile([file], currentStage, false);
    } catch (e) {
      console.error('Restore failed:', e);
    }
  };

  const renderFileItem = (fileName: string, data: any, isResetItem: boolean) => {
    const statusStr = data.status || '';
    const isReadyMD = statusStr === 'READY_MD';
    const isProcessed = statusStr === 'PROCESSED';
    const isProcessing = statusStr === 'PROCESSING' || (statusStr.includes('Анализ') && !isProcessed);
    const isOk = statusStr.includes('Готово') || isReadyMD || isProcessed;
    const isError = statusStr.includes('Ошибка');
    const isLoading = !isOk && !isError && statusStr !== 'reset' && !isReadyMD && !isProcessed;
    const isReset = statusStr === 'reset';
    const method = (statusStr.includes('ИИ') || isProcessed) ? 'AI' : 'Local';
    const isAiProcessed = method === 'AI';
    const file = filesMap[fileName];
    const fileSize = data.size || 0;
    
    // Naming logic: clean display name, keep full name in title
    const displayName = fileName.replace(/\.[^/.]+$/, "");
    
    // Real cost if already processed by AI (cost > 0)
    const realCost = (data.cost && data.cost > 0) ? data.cost : null;
    // Pre-estimation for AI processing
    const preEstimate = (!isAiProcessed && !realCost && data.estimated_cost !== undefined && data.estimated_cost > 0)
      ? Number(data.estimated_cost).toFixed(2)
      : null;

    return (
      <div
        key={fileName}
        className={cn(
          "group flex flex-col p-3 rounded-lg border border-slate-200 bg-white shadow-sm hover:border-indigo-300 transition-all",
          isResetItem && "opacity-60"
        )}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1 overflow-hidden">
            {/* Status Icon */}
            <div className="shrink-0 mt-1">
              {isOk && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
              {isReset && <Circle className="w-5 h-5 text-slate-300" />}
              {isLoading && <RefreshCw className="w-5 h-5 text-indigo-500 animate-spin" />}
              {isError && (
                <div title={data.error || statusStr}>
                  <AlertCircle className="w-5 h-5 text-red-500" />
                </div>
              )}
            </div>

            {/* File Details */}
            <div className="flex flex-col flex-1 min-w-0">
              <span className="font-medium text-slate-900 truncate" title={fileName}>
                {displayName}
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5">
                {isReset ? 'Данные сброшены' : (isReadyMD ? 'Ожидает анализа' : (isProcessed ? 'Готово (ИИ)' : statusStr))}
                {(!isProcessed && !isReset && ((data?.estimated_cost !== undefined ) || (data?.estimated_tokens && data.estimated_tokens > 0))) ? (
                  <span className="ml-2 text-[10px] text-slate-400 font-medium">
                    ~{data?.estimated_cost || 0} ₽ { (data?.estimated_tokens && data.estimated_tokens > 0) ? `• ~${data.estimated_tokens} токенов` : ''} (прогноз)
                  </span>
                ) : null}
              </span>
              
              {/* Segmented Progress Bar (for finished AI with reports) */}
              {data.chunks_report && data.chunks_report.length > 0 && (
                <div className="flex gap-0.5 mt-1 h-1.5 w-full">
                  {data.chunks_report.map((chunk) => (
                    <div 
                      key={chunk.id} 
                      className={cn("flex-1 rounded-sm", chunk.ok ? "bg-green-500" : "bg-red-500")} 
                      title={`Чанк ${chunk.id}: ${chunk.ok ? 'Успех' : 'Ошибка'}`}
                    />
                  ))}
                </div>
              )}

              {/* Inline Progress Bar for Loading State (when no report yet) */}
              {isLoading && (!data.chunks_report || data.chunks_report.length === 0) && (
                <>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full mt-1 overflow-hidden">
                    <div 
                      className={cn("h-full bg-indigo-500", statusStr.includes('ИИ') ? "transition-all duration-500 ease-out" : "w-[90%] transition-all duration-[2000ms] ease-out")}
                      style={statusStr.includes('ИИ') ? { 
                        width: data.current_step === 'prep' ? '5%' : 
                               data.current_step === 'ai' ? `${5 + ((data.processed_count || 0) / (data.total_chunks || 1)) * 90}%` : 
                               (data.current_step === 'final' || data.status?.includes('Готово')) ? '100%' : '5%'
                      } : undefined}
                    />
                  </div>
                  {data.current_step && (
                    <div className="text-[10px] text-indigo-600 mt-0.5 font-medium animate-pulse">
                      {data.current_step === 'prep' && 'Подготовка...'}
                      {data.current_step === 'ai' && `Обработка: [${data.processed_count || 0} из ${data.total_chunks || '?'}] чанков...`}
                      {data.current_step === 'final' && 'Сборка данных...'}
                    </div>
                  )}
                </>
              )}

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                <span className={cn(
                  "px-1.5 py-0.5 rounded-md text-[10px] font-medium uppercase",
                  method === 'AI' ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                )}>
                  {method}
                </span>
                <span className="text-xs text-slate-400">•</span>
                {isReset ? (
                  <span className="text-xs text-slate-400 font-medium italic">Данные сброшены</span>
                ) : (
                  <span className="text-xs text-slate-500">{data.time}</span>
                )}
                
                {method === 'AI' && data.tokens && (
                  <>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                      {data.tokens} токенов
                    </span>
                  </>
                )}
                
                {data.model && (
                  <>
                    <span className="text-xs text-slate-400">•</span>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded font-mono",
                      data.model === 'CACHED' ? "bg-amber-100 text-amber-700 font-bold" : "bg-slate-100 text-slate-600"
                    )}>
                      {data.model === 'CACHED' ? 'из памяти' : data.model === 'lite' ? 'lite • ИИ текст' : data.model === 'pro' ? 'pro • ИИ зрение' : `${data.model} • ${data.method}`}
                    </span>
                  </>
                )}
                
                {method === 'AI' && (data.cost !== undefined && data.cost > 0) ? (
                  <>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold" title="Итоговая цена парсинга">
                      {data.cost || 0} ₽
                    </span>
                  </>
                ) : ( (data.estimated_cost !== undefined && data.estimated_cost > 0) || (data.estimated_tokens && data.estimated_tokens > 0) ) && method !== 'AI' ? (
                  <>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-medium" title="Прогноз цены AI-парсинга">
                      ~{data.estimated_cost || 0} ₽ {data.estimated_tokens ? `• ~${data.estimated_tokens} токенов` : ''}
                    </span>
                  </>
                ) : null}
              </div>
              {isError && data.error && (
                <span className="text-[10px] text-red-500 mt-1 line-clamp-1 truncate" title={data.error}>
                  {data.error}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
            {/* Retry AI: shown for error states where file is available */}
            {isError && file && (
              <button
                onClick={() => reprocessAi(fileName)}
                className="p-1.5 rounded-md text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                title="Перезапустить через ИИ"
                disabled={isLoading}
              >
                <Sparkles className="w-4 h-4" />
              </button>
            )}

            {/* Sparkles: AI re-process for Table files (xls/xlsx/csv) only if not yet fully processed by AI */}
            {isTableFile(fileName) && !isProcessed && !isProcessing && !isError && (
              <button
                onClick={() => handleAiProcess(fileName)}
                className="p-1.5 rounded-md text-amber-500 bg-amber-50 hover:text-purple-600 hover:bg-purple-100 transition-colors"
                title="Анализ ИИ (Редактор Markdown)"
                disabled={isLoading}
              >
                <Sparkles className="w-4 h-4" />
              </button>
            )}

            {/* Restore / Retry */}
            {file ? (
              <button
                onClick={() => retryFile(fileName, currentStage)}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  isReset ? "text-indigo-600 bg-indigo-50 hover:bg-indigo-100" : "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                )}
                title={isReset ? "Восстановить данные" : "Повторить загрузку"}
                disabled={isLoading}
              >
                <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
              </button>
            ) : (
              <button
                onClick={() => handleRestore(fileName)}
                className="p-1.5 rounded-md text-amber-600 bg-amber-50 hover:bg-amber-100 transition-colors"
                title="Восстановить из хранилища"
                disabled={isLoading}
              >
                <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
              </button>
            )}

            {/* Reset File Data Only */}
            {!isReset && (
              <button
                onClick={() => resetFileData(fileName)}
                className="p-1.5 rounded-md text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                title="Сбросить строки из текущей таблицы (без удаления файла)"
              >
                <Eraser className="w-4 h-4" />
              </button>
            )}

            {/* Delete */}
            <button
              onClick={(e) => setPendingDelete({ name: fileName, nuclear: e.shiftKey })}
              className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Удалить файл и связанные данные (Shift + Click для Ядерного удаления из истории)"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="absolute inset-0 z-10 bg-slate-900/10 backdrop-blur-[1px] transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="absolute right-0 top-0 bottom-0 w-[400px] sm:w-[33vw] z-20 bg-white border-l border-slate-200 shadow-xl flex flex-col transform transition-transform duration-300 ease-in-out">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-500" />
            Файлы раздела
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format Info - Moved to Top */}
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500">
          <p className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Поддерживаемые форматы: <b>PDF, Excel (xlsx/xls), CSV, JPEG, PNG</b>
          </p>
          <p className="flex items-center gap-2 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Максимальный размер: 20 МБ
          </p>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {fileEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <FileText className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm">Нет загруженных файлов</p>
            </div>
          ) : (
            <>
              {/* Active Files */}
              {fileEntries
                .filter(([_, data]: [string, any]) => data.status !== 'reset')
                .map(([fileName, data]: [string, any]) => {
                  return renderFileItem(fileName, data, false);
                })}

              {/* Reset Files Divider */}
              {fileEntries.some(([_, data]: [string, any]) => data.status === 'reset') && (
                <>
                  {fileEntries.some(([_, data]: [string, any]) => data.status !== 'reset') && (
                    <div className="flex items-center gap-2 py-2">
                      <hr className="flex-1 border-slate-200" />
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                        Сброшенные данные
                      </span>
                      <hr className="flex-1 border-slate-200" />
                    </div>
                  )}
                  {fileEntries
                    .filter(([_, data]: [string, any]) => data.status === 'reset')
                    .map(([fileName, data]: [string, any]) => {
                      return renderFileItem(fileName, data, true);
                    })}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer with Progress & Total */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-4">
          {fileEntries.length > 0 && (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-medium">
                  <span className="text-slate-600">Общий прогресс обработки</span>
                  <span className="text-indigo-600">
                    {Math.round(
                      (fileEntries.filter(([_, d]: [string, any]) => d.status.includes('Готово') || d.status === 'reset').length /
                        fileEntries.length) *
                        100
                    )}
                    %
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-500 ease-out"
                    style={{
                      width: `${
                        (fileEntries.filter(([_, d]: [string, any]) => d.status.includes('Готово') || d.status === 'reset').length /
                          fileEntries.length) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                  Итого за проект:
                  <button 
                    onClick={async () => {
                      try {
                        const res = await fetch('http://localhost:8000/api/storage/history/export_xlsx');
                        const blob = await res.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `Детализация - ${new Date().toLocaleDateString('ru-RU')}.xlsx`;
                        a.click();
                        window.URL.revokeObjectURL(url);
                      } catch(e) { console.error('Failed to download XLSX', e); }
                    }} 
                    title="Скачать финансовую детализацию (XLSX) через Blob" 
                    className="p-1 ml-1 rounded hover:bg-slate-200 text-slate-500 hover:text-indigo-600 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                </span>
                <span className="text-sm font-bold text-indigo-700">
                  {fileEntries
                    .reduce((acc: number, [_, d]: [string, any]) => acc + (d.cost || 0), 0)
                    .toFixed(2)}{' '}
                  ₽
                </span>
              </div>
            </>
          )}
          <div className="text-[10px] text-slate-400 text-center uppercase tracking-wider font-semibold pt-1">
            DocOK Professional Import v0.2.5
          </div>
        </div>
      </div>

      {/* AlertDialog: Confirm Delete */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Удалить файл?</h3>
                <p className="text-sm text-slate-500 mt-0.5">Все данные, загруженные из этого файла, будут удалены из таблицы.</p>
              </div>
            </div>
            <p className="text-sm font-medium text-slate-700 bg-slate-50 rounded-lg px-3 py-2 mb-2 truncate" title={pendingDelete.name}>
              {pendingDelete.name}
            </p>
            {pendingDelete.nuclear && (
              <p className="text-[11px] font-medium text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5 mb-3 leading-tight">
                ⚠️ ВНИМАНИЕ: Запрошено ЯДЕРНОЕ удаление. Файл будет безвозвратно стерт из финансовой истории (history.json).
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setPendingDelete(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
