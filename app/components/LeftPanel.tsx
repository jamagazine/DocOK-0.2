import React from 'react';
import { 
  Menu, 
  Home, 
  FolderOpen, 
  CheckCircle2, 
  CircleAlert, 
  Circle,
  Briefcase,
  DollarSign,
  UserCheck
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Stage, StageInfo } from '../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LeftPanelProps {
  expanded: boolean;
  onToggle: () => void;
  currentStage: Stage;
  onSetStage: (stage: Stage) => void;
}

const STAGES: StageInfo[] = [
  { id: 'spec', label: 'Спецификация', status: 'done' },
  { id: 'request', label: 'Запрос поставщику', status: 'partial' },
  { id: 'invoice', label: 'Счет поставщика', status: 'not_started' },
  { id: 'estimate', label: 'Смета', status: 'not_started' },
];

export function LeftPanel({ expanded, onToggle, currentStage, onSetStage }: LeftPanelProps) {
  const renderStatusIcon = (status: string) => {
    switch (status) {
      case 'done': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'partial': return <CircleAlert className="w-5 h-5 text-amber-500" />;
      default: return <Circle className="w-5 h-5 text-slate-300" />;
    }
  };

  return (
    <div 
      className={cn(
        "flex flex-col bg-white border-r border-slate-200 transition-all duration-300 ease-in-out shrink-0 h-full",
        expanded ? "w-72" : "w-16"
      )}
    >
      {/* Header - Attic */}
      <div className={cn(
        "p-4 border-b border-slate-200 flex",
        expanded ? "flex-row justify-between items-center h-[72px]" : "flex-col items-center gap-4 py-4"
      )}>
        <button 
          onClick={onToggle}
          className={cn(
            "p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors flex items-center justify-center",
            !expanded && "w-12 h-12"
          )}
          title="Свернуть/Развернуть"
        >
          <Menu className={cn(expanded ? "w-5 h-5" : "w-6 h-6")} />
        </button>
        <button 
          className={cn(
            "p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors flex items-center justify-center",
             !expanded && "w-12 h-12"
          )}
          title="Главная страница"
        >
          <Home className={cn(expanded ? "w-5 h-5" : "w-6 h-6")} />
        </button>
        <button 
          className={cn(
            "p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors flex items-center justify-center",
             !expanded && "w-12 h-12"
          )}
          title="Список проектов"
        >
          <FolderOpen className={cn(expanded ? "w-5 h-5" : "w-6 h-6")} />
        </button>
      </div>

      {/* Middle Top - Workflow Stages */}
      <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-1">
        <div className={cn("px-4 pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider", !expanded && "sr-only")}>
          Этапы работы
        </div>
        {STAGES.map((stage) => (
          <button
            key={stage.id}
            onClick={() => onSetStage(stage.id)}
            className={cn(
              "w-full flex items-center px-4 py-3 transition-colors group",
              currentStage === stage.id ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-50 text-slate-700",
              !expanded && "justify-center px-0 py-4"
            )}
            title={!expanded ? stage.label : undefined}
          >
            <div className="shrink-0 flex items-center justify-center relative">
              {renderStatusIcon(stage.status)}
              {currentStage === stage.id && (
                <span className="absolute -left-4 w-1 h-6 bg-indigo-600 rounded-r-full" />
              )}
            </div>
            {expanded && (
              <span className="ml-3 text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                {stage.label}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Middle Bottom - Estimate Info */}
      <div className="border-t border-slate-200 py-4 flex flex-col gap-2">
         <div className={cn("px-4 pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider", !expanded && "sr-only")}>
          Общая информация
        </div>
        <div 
          className={cn(
            "px-4 py-2 flex items-center gap-3 text-slate-600 group cursor-help",
            !expanded && "justify-center"
          )}
          title="Себестоимость проекта: 1 250 000 ₽"
        >
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-slate-200 transition-colors">
            <DollarSign className="w-4 h-4 text-slate-500" />
          </div>
          {expanded && (
            <div className="flex flex-col text-sm overflow-hidden">
              <span className="text-slate-500 text-xs">Себестоимость</span>
              <span className="font-semibold text-slate-900 truncate">1 250 000 ₽</span>
            </div>
          )}
        </div>
        <div 
          className={cn(
            "px-4 py-2 flex items-center gap-3 text-slate-600 group cursor-help",
            !expanded && "justify-center"
          )}
          title="Стоимость клиента: 1 500 000 ₽"
        >
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-slate-200 transition-colors">
            <UserCheck className="w-4 h-4 text-slate-500" />
          </div>
          {expanded && (
             <div className="flex flex-col text-sm overflow-hidden">
               <span className="text-slate-500 text-xs">Стоимость клиента</span>
               <span className="font-semibold text-slate-900 truncate">1 500 000 ₽</span>
             </div>
          )}
        </div>
      </div>

      {/* Footer - Basement */}
      <div className={cn(
        "border-t border-slate-200 flex",
        expanded ? "flex-row p-4 items-center" : "flex-col-reverse items-center py-4 gap-4"
      )}>
        {/* Logo */}
        <div className={cn(
          "flex items-center text-indigo-600 font-bold",
          expanded ? "flex-1 text-2xl" : "w-12 h-12 justify-center text-xs bg-indigo-50 rounded-lg"
        )}>
          {expanded ? "DocOK" : "DOK"}
        </div>
        
        {/* API Auth Button */}
        <button 
          className={cn(
            "flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors rounded-lg",
            expanded ? "w-10 h-10 ml-2 shrink-0" : "w-12 h-12"
          )}
          title="Авторизация API"
        >
          <Briefcase className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
