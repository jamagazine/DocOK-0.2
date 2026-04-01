import React, { useState, useEffect } from 'react';
import {
  Menu,
  LayoutGrid,
  Zap,
  Archive,
  Award,
  Cloud,
  DollarSign,
  UserCheck,
  Briefcase,
  FolderOpen,
  CheckCircle2,
  Circle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useData } from '../context/DataContext';
import { Input } from './ui/input';
import { Label } from './ui/label';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DashboardLeftPanelProps {
  expanded: boolean;
  onToggle: () => void;
}

const CATEGORIES = [
  { id: 'all',     label: 'Все проекты',  icon: LayoutGrid, count: 4 },
  { id: 'active',  label: 'Активные',     icon: Zap,        count: 2 },
  { id: 'archive', label: 'В архиве',     icon: Archive,    count: 1 },
  { id: 'tender',  label: 'Тендеры',      icon: Award,      count: 1 },
];

export function DashboardLeftPanel({ expanded, onToggle }: DashboardLeftPanelProps) {
  const [activeCategory, setActiveCategory] = useState('all');
  const { 
    estimateTotal, 
    yandexConfig, 
    saveYandexConfig,
    viewContext, 
    setViewContext 
  } = useData();
  const [showSettings, setShowSettings] = useState(false);
  const [isServerAvailable, setIsServerAvailable] = useState(true);

  const isApiConfigured = !!yandexConfig.apiKey && !!yandexConfig.catalogId;

  useEffect(() => {
    const checkServer = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/health');
        setIsServerAvailable(res.ok);
      } catch (e) {
        setIsServerAvailable(false);
      }
    };
    
    checkServer();
    const interval = setInterval(checkServer, 30000); 
    return () => clearInterval(interval);
  }, []);

  const handleConfigChange = (key: 'apiKey' | 'catalogId', value: string) => {
    saveYandexConfig({
      ...yandexConfig,
      [key]: value
    });
  };

  return (
    <div
      className={cn(
        'flex flex-col bg-white border-r border-slate-200 transition-all duration-300 ease-in-out shrink-0 h-full relative',
        expanded ? 'w-72' : 'w-16'
      )}
    >
      {/* ── Attic (Header) — mirrors LeftPanel header exactly ── */}
      <div className={cn(
        'p-4 border-b border-slate-200 h-[72px]',
        expanded ? 'grid grid-cols-4 items-center justify-items-center gap-0' : 'flex flex-col items-center gap-4 py-4 h-auto'
      )}>
        <button
          onClick={onToggle}
          className={cn(
            'rounded-lg text-slate-600 hover:bg-slate-100 transition-colors flex items-center justify-center',
            expanded ? 'w-9 h-9' : 'w-12 h-12'
          )}
          title="Свернуть/Развернуть"
        >
          <Menu className="size-5" />
        </button>

        <button 
          onClick={() => setViewContext('workspace')}
          className={cn(
            "rounded-lg transition-all flex items-center justify-center",
            expanded ? "w-9 h-9" : "w-12 h-12",
            viewContext === 'workspace' 
              ? "border-2 border-emerald-400 bg-emerald-50 text-emerald-600 shadow-sm" 
              : "text-slate-600 hover:bg-slate-100"
          )}
          title="Рабочее пространство"
        >
          <Briefcase className="size-5" />
        </button>

        <button 
          onClick={() => setViewContext('dashboard')}
          className={cn(
            "rounded-lg transition-all flex items-center justify-center",
            expanded ? "w-9 h-9" : "w-12 h-12",
            viewContext === 'dashboard' 
              ? "border-2 border-emerald-400 bg-emerald-50 text-emerald-600 shadow-sm" 
              : "text-slate-600 hover:bg-slate-100"
          )}
          title="Список проектов"
        >
          <FolderOpen className="size-5" />
        </button>

        {/* Phantom 4th slot */}
        {!expanded && <div className="w-12 h-12" aria-hidden="true" />}
        {expanded && <div />}
      </div>

      {/* ── Content — categories ── */}
      <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-1">
        <div className={cn('px-4 pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider', !expanded && 'sr-only')}>
          Категории
        </div>
        {CATEGORIES.map(({ id, label, icon: Icon, count }) => {
          const isActive = activeCategory === id;
          return (
            <button
              key={id}
              onClick={() => setActiveCategory(id)}
              className={cn(
                'w-full flex items-center px-4 py-3 transition-colors group',
                isActive ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700',
                !expanded && 'justify-center px-0 py-4'
              )}
              title={!expanded ? label : undefined}
            >
              <div className="shrink-0 flex items-center justify-center relative">
                <Icon className={cn('size-5', isActive ? 'text-indigo-600' : 'text-slate-400')} />
                {isActive && (
                  <span className="absolute -left-4 w-1 h-6 bg-indigo-600 rounded-r-full" />
                )}
              </div>
              {expanded && (
                <>
                  <span className="ml-3 text-sm font-medium whitespace-nowrap flex-1 text-left">{label}</span>
                  <span className={cn(
                    'text-xs font-semibold rounded-full px-2 py-0.5 min-w-[22px] text-center',
                    isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'
                  )}>{count}</span>
                </>
              )}
            </button>
          );
        })}
      </div>


      {/* Settings Panel (Unified with LeftPanel) */}
      <AnimatePresence>
        {(showSettings && expanded) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-slate-200 bg-slate-50/50 overflow-hidden relative z-50 shadow-inner"
          >
            <div className={cn("p-3 flex flex-col gap-2", !expanded && "items-center px-2")}>
              <div className="flex flex-col w-full">
                {expanded && <Label htmlFor="api-key" className="text-[9px] text-slate-500 uppercase font-bold px-1 mb-1">API Ключ</Label>}
                <Input 
                  id="api-key"
                  type="password" 
                  placeholder={expanded ? "Введите ключ..." : "Ключ"}
                  value={yandexConfig.apiKey}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleConfigChange('apiKey', e.target.value)}
                  className={cn("h-7 text-xs bg-white focus-visible:ring-1 focus-visible:ring-indigo-300", !expanded && "px-1 text-center")}
                  title="API Ключ"
                />
              </div>
              <div className="flex flex-col w-full">
                {expanded && <Label htmlFor="catalog-id" className="text-[9px] text-slate-500 uppercase font-bold px-1 mb-1">ID каталога</Label>}
                <Input 
                  id="catalog-id"
                  placeholder={expanded ? "Введите ID..." : "ID"}
                  value={yandexConfig.catalogId}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleConfigChange('catalogId', e.target.value)}
                  className={cn("h-7 text-xs bg-white focus-visible:ring-1 focus-visible:ring-indigo-300", !expanded && "px-1 text-center")}
                  title="ID каталога"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={cn(
        "border-t border-slate-200 flex shrink-0 relative z-50 bg-white h-16 items-center",
        expanded ? "flex-row px-4" : "justify-center"
      )}>
        {/* Logo - only shown when expanded */}
        {expanded && (
          <div className="flex items-center text-indigo-600 font-bold flex-1 text-2xl">
            DocOK
          </div>
        )}
        
        {/* API Settings Button */}
        <button 
          onClick={() => {
            if (!expanded) {
              onToggle();
              setShowSettings(true);
            } else {
              setShowSettings(!showSettings);
            }
          }}
          className={cn(
            "flex items-center justify-center transition-all duration-200 rounded-lg relative",
            showSettings ? "bg-indigo-100 text-indigo-600 shadow-inner" : "text-slate-500 hover:bg-slate-50",
            expanded ? "w-9 h-9 ml-2 shrink-0" : "w-12 h-12"
          )}
          title={!isServerAvailable ? "Сервер недоступен" : (isApiConfigured ? "API активно" : "Настройте API (Cloud Settings)")}
        >
          <Cloud className={cn(
            "size-5 transition-colors",
            !isServerAvailable ? "text-rose-500 animate-pulse" : (isApiConfigured ? "text-emerald-500 group-hover:text-emerald-600" : "text-slate-500 group-hover:text-indigo-600")
          )} />
        </button>
      </div>
    </div>
  );
}
