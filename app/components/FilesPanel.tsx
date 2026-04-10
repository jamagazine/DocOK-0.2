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
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FilesPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FilesPanel({ isOpen, onClose }: FilesPanelProps) {
  const { 
    uploadStatuses, filesMap, removeFile, retryFile, handleFile, 
    currentStage, resetFileData, reprocessAi,
    activeFileId, setActiveFileId, activeProjectId
  } = useData();
  const [pendingDelete, setPendingDelete] = React.useState<{ name: string; nuclear: boolean } | null>(null);
  const [isShiftPressed, setIsShiftPressed] = React.useState(false);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.shiftKey) setIsShiftPressed(true); };
    const up = (e: KeyboardEvent) => { if (!e.shiftKey) setIsShiftPressed(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

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
      try {
        const res = await fetch(`http://localhost:8000/api/storage/files/${fileName}?projectId=${activeProjectId}`);
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

  const handleReprocessClear = async (fileName: string) => {
    try {
      await fetch('http://localhost:8000/api/storage/files/reprocess_clear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileName, projectId: activeProjectId })
      });
      reprocessAi(fileName);
    } catch (e) {
      console.error('Reprocess clear failed:', e);
    }
  };

  const handleRestore = async (fileName: string) => {
    try {
      const res = await fetch(`http://localhost:8000/api/storage/files/${fileName}?projectId=${activeProjectId}`);
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
    const isReadyMD = statusStr === 'READY_MD' || statusStr === 'READY_MD_LOCAL';
    const isReadyOCR = statusStr === 'READY_MD_OCR';
    const isReadyAI = statusStr === 'READY_MD_AI';
    const isNeedOCR = statusStr === 'NEED_OCR';
    const isProcessed = statusStr === 'PROCESSED';
    const isProcessing = statusStr === 'PROCESSING' || (statusStr.includes('Анализ') && !isProcessed);
    const isOk = statusStr.includes('Готово') || isReadyMD || isReadyOCR || isReadyAI || isProcessed;
    const isError = statusStr.includes('Ошибка');
    const isLoading = !isOk && !isError && statusStr !== 'reset' && !isReadyMD && !isReadyOCR && !isReadyAI && !isProcessed && !isNeedOCR;
    const isReset = statusStr === 'reset';
    const method = (statusStr.includes('ИИ') || isProcessed || isReadyOCR || isReadyAI || (data.cost !== undefined && data.cost > 0)) ? 'AI' : 'Local';
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
          "group flex flex-col p-3 rounded-lg border shadow-sm transition-all cursor-pointer",
          activeFileId === fileName ? "border-indigo-500 bg-indigo-50/30 ring-1 ring-indigo-200" : "border-slate-200 bg-white hover:border-indigo-300",
          isResetItem && "opacity-60"
        )}
        onClick={() => setActiveFileId(fileName)}
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
                {isReset ? 'Данные сброшены' : (
                  isReadyMD ? 'Готово (программный парсинг)' : 
                  isReadyAI ? 'Готово (Yandex GPT)' :
                  isReadyOCR ? 'Готово (Yandex OCR)' : 
                  isNeedOCR ? 'Требуется OCR-анализ' :
                  isProcessed ? 'Готово (ИИ)' : statusStr
                )}
                {(!isProcessed && !isReset && ((data?.estimated_cost !== undefined ) || (data?.estimated_tokens && data.estimated_tokens > 0))) ? (
                  <span className="ml-2 text-[10px] text-slate-400 font-medium whitespace-nowrap">
                    ~ {data?.estimated_cost ? Number(data.estimated_cost).toFixed(2) : 0} ₽ (прогноз)
                  </span>
                ) : null}
              </span>
              
                {data.chunks_report && data.chunks_report.length > 0 && (
                  <div className="flex gap-0.5 mt-1 h-1.5 w-full">
                    {(data.chunks_report as {id: string, ok: boolean}[]).map((chunk) => (
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

              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <span className={cn(
                  "px-1.5 h-4 flex items-center rounded-sm text-[9px] font-bold uppercase tracking-wider",
                  method === 'AI' ? "bg-purple-50 text-purple-600 border border-purple-100" : "bg-blue-50 text-blue-600 border border-blue-100"
                )}>
                  {method}
                </span>
                <span className="text-slate-300 text-[10px]">|</span>
                {isReset ? (
                  <span className="text-[11px] text-slate-400 font-medium italic leading-none">Данные сброшены</span>
                ) : (
                  <span className="text-[11px] text-slate-500 font-medium leading-none">{data.time}</span>
                )}
                

                
                {data.model && (
                  <>
                    <span className="text-slate-300 text-[10px]">•</span>
                    <span className={cn(
                      "text-[10px] px-1.5 h-4 flex items-center rounded-sm font-medium",
                      data.model === 'CACHED' ? "bg-amber-50 text-amber-600 border border-amber-100" : "bg-slate-50 text-slate-500 border border-slate-100"
                    )}>
                      {data.model === 'CACHED' ? 'из памяти' : data.model === 'lite' ? 'lite' : data.model === 'pro' ? 'pro' : data.model}
                    </span>
                  </>
                )}
                
                {method === 'AI' && data.cost !== undefined && data.cost > 0 ? (
                  <>
                    <span className="text-slate-300 text-[10px]">•</span>
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5 cursor-help">
                            <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-200 shadow-sm py-0 px-2 h-4.5 text-[10px] font-bold leading-none">
                              {data.cost.toFixed(2)} ₽
                            </Badge>
                            <span className="text-[10px] text-slate-400 font-medium leading-none">
                              {data.tokens} токенов
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={6} className="py-2 px-3 text-xs bg-white border border-slate-100 rounded-md shadow-sm">
                          {data.usage?.cost_breakdown ? (() => {
                            // Агрегируем: все Header → "Реквизиты", все Items_Chunk_* → "Позиции"
                            let headerCost = 0;
                            let itemsCost = 0;
                            Object.entries(data.usage.cost_breakdown).forEach(([key, info]: [string, any]) => {
                              if (key.includes('Header')) headerCost += info.cost || 0;
                              else if (key.includes('Items') || key.includes('Chunk')) itemsCost += info.cost || 0;
                            });
                            const rows: { label: string; cost: number }[] = [];
                            if (headerCost > 0) rows.push({ label: 'Реквизиты', cost: headerCost });
                            if (itemsCost > 0) rows.push({ label: 'Позиции', cost: itemsCost });
                            if (rows.length === 0) return <span className="text-slate-400">Нет данных</span>;
                            return (
                              <div className="flex flex-col gap-1 min-w-[120px]">
                                {rows.map(row => (
                                  <div key={row.label} className="flex justify-between items-center gap-3">
                                    <span className="text-slate-500 font-normal">{row.label}</span>
                                    <span className="text-slate-900 font-bold tabular-nums">
                                      {row.cost.toFixed(2)} <span className="text-[10px] font-normal text-slate-400">₽</span>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            );
                          })() : (
                            <span className="text-slate-400">Нет данных</span>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </>
                ) : method === 'AI' ? (
                  <div className="flex flex-col gap-0.5 opacity-70 ml-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-slate-600 text-[10px]">~ {data.estimated_cost?.toFixed(2) || 0} ₽</span>
                      <span className="text-[10px] text-muted-foreground">(прогноз)</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground/50 italic pl-0.5 mt-0.5 leading-tight">
                      * реальная стоимость обычно ниже на 10-15%
                    </div>
                  </div>
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

            {statusStr === 'UPLOAD' && (
              <button
                onClick={() => handleAiProcess(fileName)}
                className="p-1.5 rounded-md text-amber-500 bg-amber-50 hover:text-amber-600 hover:bg-amber-100 transition-colors"
                title="Запустить AI-анализ"
                disabled={isLoading}
              >
                <Sparkles className="w-4 h-4" />
              </button>
            )}

            {(isProcessed || isReadyAI || isReadyMD || isReadyOCR || isError) && statusStr !== 'UPLOAD' && statusStr !== 'reset' && (
              <button
                onClick={() => handleReprocessClear(fileName)}
                className="p-1.5 rounded-md text-purple-500 bg-purple-50 hover:text-purple-600 hover:bg-purple-100 transition-colors"
                title="Перепарсить заново (токены спишутся повторно)"
                disabled={isLoading}
              >
                <Sparkles className="w-4 h-4" />
              </button>
            )}

            {fileName.toLowerCase().endsWith('.pdf') && !isLoading && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  reprocessAi(fileName, true);
                }}
                className="p-1.5 rounded-md text-indigo-400 bg-indigo-50 hover:text-indigo-600 hover:bg-indigo-100 transition-colors"
                title="Принудительное OCR-распознавание как картинки. Дольше и дороже, но спасает, если текст скопировался 'кракозябрами'."
                disabled={isLoading}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}

            {(isProcessed || isReadyAI || isReadyMD || isReadyOCR) && statusStr !== 'reset' && (
              <button
                onClick={() => resetFileData(fileName)}
                className="p-1.5 rounded-md text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                title="Стереть позиции из таблицы (оставит файл в списке)"
              >
                <Eraser className="w-4 h-4" />
              </button>
            )}

            {isReset && (
              <button
                onClick={() => retryFile(fileName, currentStage)}
                className="p-1.5 rounded-md text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                title="Восстановить данные из памяти (Бесплатно)"
                disabled={isLoading}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}

            {/* Delete */}
            <button
              onClick={(e) => setPendingDelete({ name: fileName, nuclear: isShiftPressed })}
              className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title={isShiftPressed ? "[ЯДЕРНОЕ УДАЛЕНИЕ] Удалить файл И стереть его стоимость из истории!" : "Удалить файл из проекта (затраты останутся в истории)"}
            >
              <Trash2 className={cn("w-4 h-4", isShiftPressed && "text-red-600")} />
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

              <div className="flex items-center gap-2 py-1 mb-2">
                <hr className="flex-1 border-slate-200" />
                <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">Файлы спецификаций</span>
                <hr className="flex-1 border-slate-200" />
              </div>

              {/* Sorted File Entries */}
              {Object.entries(uploadStatuses)
                .sort(([nameA, statusA]: [string, any], [nameB, statusB]: [string, any]) => {
                  const currentStageBase = currentStage.replace('_ai', '');
                  const isCurrentA = statusA.method?.includes(currentStageBase);
                  const isCurrentB = statusB.method?.includes(currentStageBase);
                  if (isCurrentA && !isCurrentB) return -1;
                  if (!isCurrentA && isCurrentB) return 1;

                  const isResetA = statusA.status === 'reset';
                  const isResetB = statusB.status === 'reset';
                  if (!isResetA && isResetB) return -1;
                  if (isResetA && !isResetB) return 1;

                  return 0;
                })
                .map(([fileName, data]: [string, any]) => {
                  return renderFileItem(fileName, data, data.status === 'reset');
                })}
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
