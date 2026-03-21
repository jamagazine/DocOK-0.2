import React from 'react';
import { 
  X, 
  FileText, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  AlertCircle
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { UploadedFile } from '../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FilesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  files: UploadedFile[];
}

export function FilesPanel({ isOpen, onClose, files }: FilesPanelProps) {
  if (!isOpen) return null;

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

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {files.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <FileText className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm">Нет загруженных файлов</p>
            </div>
          ) : (
            files.map((file) => (
              <div 
                key={file.id} 
                className="group flex flex-col p-3 rounded-lg border border-slate-200 bg-white shadow-sm hover:border-indigo-300 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1 overflow-hidden">
                    {/* Status Icon */}
                    <div className="shrink-0 mt-1">
                      {file.status === 'ok' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                      {file.status === 'loading' && <Clock className="w-5 h-5 text-amber-500 animate-pulse" />}
                      {file.status === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                    </div>
                    
                    {/* File Details */}
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="font-medium text-slate-900 truncate" title={file.name}>
                        {file.name}
                      </span>
                      <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded-md text-[10px] font-medium uppercase",
                          file.method === 'AI' ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                        )}>
                          {file.method}
                        </span>
                        <span>•</span>
                        {file.uploadTime}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                    <button 
                      className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      title="Повторить загрузку"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button 
                      className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Удалить"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Footer (Optional) */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 text-center">
          Поддерживаемые форматы: PDF, Excel, Word, JPEG, PNG
        </div>
      </div>
    </>
  );
}
