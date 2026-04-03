import React from 'react';
import { Wand2, AlertTriangle, X } from 'lucide-react';
import { cn } from '../utils/cn';

interface OCRConfirmationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  count: number;
  hasLargeFile: boolean;
}

export const OCRConfirmationModal: React.FC<OCRConfirmationModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  count,
  hasLargeFile,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-indigo-600 p-6 flex items-center gap-4 text-white">
          <div className="bg-white/20 p-3 rounded-xl">
            <Wand2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Запустить OCR-анализ?</h3>
            <p className="text-indigo-100 text-sm">Обнаружены сканы или изображения</p>
          </div>
          <button 
            onClick={onCancel}
            className="ml-auto p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="flex items-start gap-4 p-4 bg-amber-50 rounded-xl border border-amber-100 mb-6 font-medium">
            <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
            <div className="text-sm text-amber-800 leading-relaxed">
              {hasLargeFile ? (
                <>Обнаружены <b>объемные документы (&gt;3 стр.)</b> или большая пачка файлов (<b>{count} шт.</b>). Автоматическое распознавание может занять некоторое время и задействует ресурсы аналитика.</>
              ) : (
                <>В очереди на загрузку <b>{count} файлов</b>, требующих распознавания. Запустить пакетную обработку OCR для создания таблиц?</>
              )}
            </div>
          </div>

          <p className="text-slate-600 text-sm leading-relaxed mb-8">
            Нажмите «Запустить», чтобы автоматически извлечь таблицы. Если вы нажмете «Нет», документы будут просто загружены, и вы сможете запустить анализ вручную для каждого файла позже.
          </p>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-6 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-all active:scale-95"
            >
              Только загрузить
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95"
            >
              Запустить OCR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
