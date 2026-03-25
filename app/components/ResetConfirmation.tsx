import React from 'react';
import { AlertCircle, X, RotateCcw } from 'lucide-react';
import { useData } from '../context/DataContext';
import { cn } from '../utils/cn'; // Assuming I have a cn util, if not I'll define it or use inline

export function ResetConfirmation() {
  const { isResetConfirmOpen, setIsResetConfirmOpen, resetProjectData } = useData();

  if (!isResetConfirmOpen) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-4 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="bg-white border border-red-100 shadow-2xl rounded-xl p-4 flex flex-col gap-3 overflow-hidden transition-all ring-4 ring-red-50/50">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-red-50 rounded-lg shrink-0">
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="text-sm font-bold text-slate-900">Вы уверены, что хотите очистить таблицы?</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Файлы останутся в списке, и вы сможете импортировать их снова в любой момент.
            </p>
          </div>
          <button 
            onClick={() => setIsResetConfirmOpen(false)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 mt-1">
          <button
            onClick={() => setIsResetConfirmOpen(false)}
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={resetProjectData}
            className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-all shadow-sm hover:shadow-md active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Сбросить всё
          </button>
        </div>
      </div>
    </div>
  );
}
