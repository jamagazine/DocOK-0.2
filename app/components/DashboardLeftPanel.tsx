import React, { useState, useEffect } from 'react';
import {
  Menu,
  LayoutGrid,
  Zap,
  Archive,
  Award,
  Cloud,
  Briefcase,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  Folder,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useData } from '../context/DataContext';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DashboardLeftPanelProps {
  expanded: boolean;
  onToggle: () => void;
}

const ICON_MAP: Record<string, any> = {
  LayoutGrid,
  Zap,
  Archive,
  Award,
  Folder
};

export function DashboardLeftPanel({ expanded, onToggle }: DashboardLeftPanelProps) {
  const { 
    yandexConfig, 
    saveYandexConfig,
    viewContext, 
    setViewContext,
    categories,
    addCategory,
    deleteCategory,
    activeCategory,
    setActiveCategory
  } = useData();
  const [showSettings, setShowSettings] = useState(false);
  const [isServerAvailable, setIsServerAvailable] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');

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
        {categories.map((cat) => {
          const isActive = activeCategory === cat.id;
          const Icon = ICON_MAP[cat.icon] || Folder;
          return (
            <div key={cat.id} className="relative group/item">
              <button
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  'w-full flex items-center px-4 py-3 transition-colors group',
                  isActive ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700',
                  !expanded && 'justify-center px-0 py-4'
                )}
                title={!expanded ? cat.label : undefined}
              >
                <div className="shrink-0 flex items-center justify-center relative">
                  <Icon className={cn('size-5', isActive ? 'text-indigo-600' : 'text-slate-400')} />
                  {isActive && (
                    <span className="absolute -left-4 w-1 h-6 bg-indigo-600 rounded-r-full" />
                  )}
                </div>
                {expanded && (
                  <>
                    <span className="ml-3 text-sm font-medium whitespace-nowrap flex-1 text-left">{cat.label}</span>
                    <span className={cn(
                      'text-xs font-semibold rounded-full px-2 py-0.5 min-w-[22px] text-center transition-opacity',
                      isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400',
                      cat.type === 'custom' && 'group-hover/item:opacity-0'
                    )}>{cat.count}</span>
                  </>
                )}
              </button>

              {/* Management Menu (Three dots) for custom folders */}
              {expanded && cat.type === 'custom' && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1 hover:bg-slate-200 rounded text-slate-400">
                        <MoreHorizontal className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        variant="destructive"
                        onClick={() => deleteCategory(cat.id)}
                        className="gap-2"
                      >
                        <Trash2 className="size-3.5" />
                        Удалить
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          );
        })}

        {/* Add Folder Button */}
        <div className="mt-2 px-4">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <button
                className={cn(
                  'flex items-center gap-2 p-3 w-full rounded-xl border border-dashed border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all group',
                  !expanded && 'justify-center p-4 border-none bg-transparent hover:bg-indigo-50'
                )}
                title="Добавить папку"
              >
                <FolderPlus className={cn("size-5", expanded && "size-4")} />
                {expanded && <span className="text-xs font-bold uppercase tracking-tighter">Добавить папку</span>}
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Создать новую папку</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="folder-name" className="text-xs font-bold uppercase text-slate-500 mb-2 block">
                  Название папки
                </Label>
                <Input
                  id="folder-name"
                  placeholder="Например: Спецпроекты..."
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newCatName.trim()) {
                      addCategory(newCatName.trim());
                      setNewCatName('');
                      setIsDialogOpen(false);
                    }
                  }}
                />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Отмена</Button>
                <Button 
                  disabled={!newCatName.trim()}
                  onClick={() => {
                    addCategory(newCatName.trim());
                    setNewCatName('');
                    setIsDialogOpen(false);
                  }}
                >
                  Создать
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
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
