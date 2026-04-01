import React from 'react';
import { SearchX, RotateCcw } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface NoResultsStateProps {
  onReset: () => void;
  currentQuery: string;
  stage?: 'spec' | 'request' | 'invoice' | 'estimate';
}

export function NoResultsState({ onReset, currentQuery, stage = 'spec' }: NoResultsStateProps) {
  // Определяем базовый цвет в зависимости от этапа
  const themes = {
    spec: {
      text: 'text-indigo-600',
      bgLight: 'bg-indigo-50',
      border: 'border-indigo-100',
      button: 'hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50',
      gradient: 'from-indigo-500/10'
    },
    request: {
      text: 'text-blue-600',
      bgLight: 'bg-blue-50',
      border: 'border-blue-100',
      button: 'hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50',
      gradient: 'from-blue-500/10'
    },
    invoice: {
      text: 'text-emerald-600',
      bgLight: 'bg-emerald-50',
      border: 'border-emerald-100',
      button: 'hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50',
      gradient: 'from-emerald-500/10'
    },
    estimate: {
      text: 'text-emerald-600',
      bgLight: 'bg-emerald-50',
      border: 'border-emerald-100',
      button: 'hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50',
      gradient: 'from-emerald-500/10'
    }
  };

  const theme = themes[stage] || themes.spec;

  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both">
      {/* Декоративное пятно на фоне */}
      <div className={cn(
        "absolute pointer-events-none w-96 h-96 bg-radial blur-[100px] opacity-40 transition-colors duration-1000",
        theme.gradient, "to-transparent"
      )} />

      <div className="relative group">
        {/* Анимированный ореол */}
        <div className={cn(
          "absolute -inset-8 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-1000",
          theme.bgLight
        )} />
        
        <div className="relative flex items-center justify-center w-24 h-24 rounded-3xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 transform group-hover:scale-105 group-hover:-rotate-3 transition-all duration-500">
          <SearchX 
            className={cn("w-12 h-12 transition-colors duration-500", theme.text)} 
            strokeWidth={1.5} 
          />
          {/* Пульсирующая точка */}
          <div className={cn("absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white animate-pulse", theme.text.replace('text', 'bg'))} />
        </div>
      </div>
      
      <div className="relative mt-8 space-y-3">
        <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
          Позиция не найдена
        </h3>
        
        <p className="text-slate-500 max-w-sm mx-auto leading-relaxed text-base">
          В текущей спецификации нет ничего похожего на <br/>
          <span className={cn("inline-block px-1.5 py-0.5 rounded-md font-semibold italic", theme.bgLight, theme.text)}>
            "{currentQuery}"
          </span>
          <br/>
          Попробуйте сократить запрос или сбросить фильтры.
        </p>
      </div>

      <button
        onClick={onReset}
        className={cn(
          "mt-10 flex items-center gap-3 px-8 py-3.5 rounded-2xl border border-slate-200 bg-white text-slate-600 font-semibold shadow-sm transition-all duration-300 group",
          theme.button,
          "hover:shadow-lg hover:shadow-slate-200/50 active:scale-95"
        )}
      >
        <RotateCcw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-700 ease-in-out" />
        Сбросить поиск
      </button>
      
      {/* Декоративная линия */}
      <div className="mt-12 w-12 h-1 rounded-full bg-slate-100" />
    </div>
  );
}
