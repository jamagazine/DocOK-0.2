import React from 'react';
import {
  Menu,
  Plus,
  FolderInput,
  Clock,
  FileText,
  ChevronRight,
  Settings2,
  Info,
  Calculator
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useData } from '../context/DataContext';
import { toast } from 'sonner';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DashboardRightPanelProps {
  expanded: boolean;
  onToggle: () => void;
}

const TABS = [
  { id: 'actions', icon: <Settings2 className="size-5" />, label: 'Действия' },
  { id: 'info',    icon: <Info className="size-5" />,      label: 'Информация' },
  { id: 'calc',    icon: <Calculator className="size-5" />, label: 'Конвертеры' },
];

export function DashboardRightPanel({ expanded, onToggle }: DashboardRightPanelProps) {
  const [activeTab, setActiveTab] = React.useState('actions');
  const { uploadStatuses, projectName } = useData();

  const recentFiles = Object.entries(uploadStatuses || {})
    .slice(0, 5)
    .map(([name, data]: [string, any]) => ({ name, time: data.time || '—' }));

  return (
    <div
      className={cn(
        'flex flex-col bg-white border-l border-slate-200 transition-all duration-300 ease-in-out shrink-0 h-full overflow-hidden shadow-lg z-20',
        expanded ? 'w-72' : 'w-16'
      )}
    >
      {/* ── Attic — mirrors RightPanel header exactly ── */}
      <div className={cn(
        'p-4 border-b border-slate-200 shrink-0 h-[72px] flex items-center',
        expanded ? 'justify-end' : 'flex-col gap-4 py-4 h-auto'
      )}>
        {!expanded && (
          <button
            onClick={onToggle}
            className="w-12 h-12 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors flex items-center justify-center"
            title="Развернуть"
          >
            <Menu className="size-5" />
          </button>
        )}

        {/* Hidden for now: 
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'rounded-lg transition-colors flex items-center justify-center',
              activeTab === tab.id ? 'bg-indigo-100 text-indigo-700 font-bold' : 'hover:bg-slate-100 text-slate-600',
              expanded ? 'w-9 h-9' : 'w-12 h-12'
            )}
            title={tab.label}
          >
            {tab.icon}
          </button>
        ))}
        */}

        {expanded && (
          <button
            onClick={onToggle}
            className="w-9 h-9 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors flex items-center justify-center"
            title="Свернуть"
          >
            <Menu className="size-5" />
          </button>
        )}
      </div>

      {/* ── Content ── */}
      <div className={cn(
        'flex-1 flex flex-col min-h-0 overflow-hidden',
        expanded ? 'px-4 py-4 gap-4' : 'items-center px-2 py-4 gap-4'
      )}>
        {activeTab === 'actions' && expanded && (
          <div className="flex flex-col gap-3 w-full">
            {/* Quick action buttons */}
            <div className="flex items-center justify-between shrink-0 bg-slate-50 p-2 rounded-xl border border-slate-200">
              <button
                onClick={() => toast.info('Функция в разработке', { description: 'Создание нового проекта будет доступно в следующем обновлении.' })}
                className="p-3 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all flex flex-col items-center gap-1 flex-1"
                title="Создать проект"
              >
                <Plus className="w-5 h-5" />
                <span className="text-[10px] font-bold uppercase tracking-tighter">Создать</span>
              </button>
              <div className="w-px h-8 bg-slate-200" />
              <button
                onClick={() => toast.info('Функция в разработке', { description: 'Импорт папки будет доступен в следующем обновлении.' })}
                className="p-3 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all flex flex-col items-center gap-1 flex-1"
                title="Импорт папки"
              >
                <FolderInput className="w-5 h-5" />
                <span className="text-[10px] font-bold uppercase tracking-tighter">Импорт</span>
              </button>
            </div>

            {/* Recent files */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 px-1 pb-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Недавние</span>
              </div>
              {recentFiles.length > 0 ? (
                recentFiles.map(({ name, time }) => (
                  <div
                    key={name}
                    className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors group cursor-default"
                  >
                    <div className="w-7 h-7 rounded-md bg-indigo-50 flex items-center justify-center shrink-0">
                      <FileText className="w-3.5 h-3.5 text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{name}</p>
                      <p className="text-[11px] text-slate-400">{time}</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 px-2 py-3">Нет недавних файлов</p>
              )}
            </div>
          </div>
        )}

        {/* Collapsed icon shortcut */}
        {!expanded && (
          <>
            <button
              onClick={() => toast.info('Функция в разработке')}
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
              title="Создать проект"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button
              onClick={() => toast.info('Функция в разработке')}
              className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-slate-100 text-slate-500 transition-colors"
              title="Импорт папки"
            >
              <FolderInput className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {/* ── Footer — current project name ── */}
      {expanded && (
        <div className="border-t border-slate-200 px-4 h-16 flex flex-col justify-center shrink-0">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-0.5">Текущий проект</p>
          <p className="text-xs text-slate-700 font-medium truncate leading-tight">{projectName}</p>
        </div>
      )}
    </div>
  );
}
