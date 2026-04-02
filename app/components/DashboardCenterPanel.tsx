import React, { useState, useRef } from 'react';
import { toast } from 'sonner';
import {
  Search,
  Building2,
  FileText,
  Clock,
  MoreVertical,
  Pencil,
  Copy,
  FolderOpen,
  Trash2,
  Plus,
  FolderInput,
  Download,
  ArrowUpDown,
  Check,
  SortAsc,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useData, Project } from '../context/DataContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from './ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Project Card ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  current: { label: 'Открыт',   color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
  active:  { label: 'Активный', color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
  archive: { label: 'Архив',    color: 'text-slate-500 bg-slate-50 border-slate-200' },
  tender:  { label: 'Тендер',   color: 'text-amber-600 bg-amber-50 border-amber-100' },
};

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
}

function ProjectCard({ project, onClick }: ProjectCardProps) {
  const { title, filesCount, lastModified, progress, status, id } = project;
  const { label, color } = STATUS_CONFIG[status] || { label: status, color: 'bg-slate-100' };
  const { 
    duplicateProject, 
    renameProject, 
    moveProject, 
    deleteProject, 
    categories,
    downloadProject 
  } = useData();

  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [newTitle, setNewTitle] = useState(title);

  const isLive = id === 'live-main';

  return (
    <>
      <div
        className={cn(
          'group relative flex flex-col bg-white rounded-2xl border border-slate-200 p-5 cursor-pointer',
          'transition-all duration-200 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 hover:border-slate-300',
          isLive && 'ring-2 ring-indigo-200'
        )}
        onClick={onClick}
      >
        {/* Top */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors',
            isLive ? 'bg-indigo-100 group-hover:bg-indigo-200' : 'bg-slate-100 group-hover:bg-slate-200'
          )}>
            <Building2 className={cn('w-6 h-6', isLive ? 'text-indigo-600' : 'text-slate-500')} />
          </div>
          
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className="flex items-center gap-2">
              <span className={cn('text-[11px] font-semibold px-2.5 py-0.5 rounded-full border', color)}>
                {label}
              </span>
              
              {/* Context Menu Button */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <button className="p-1 hover:bg-slate-100 rounded-md text-slate-400 group-hover:text-slate-600 transition-colors">
                    <MoreVertical className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setIsRenameOpen(true); }} className="gap-2">
                    <Pencil className="size-3.5" /> Переименовать
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); duplicateProject(id); }} className="gap-2">
                    <Copy className="size-3.5" /> Сделать копию
                  </DropdownMenuItem>
                  
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="gap-2">
                      <FolderOpen className="size-3.5" /> Переместить в...
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-48">
                      {categories.map(cat => (
                        <DropdownMenuItem 
                          key={cat.id} 
                          onClick={(e) => { e.stopPropagation(); moveProject(id, cat.id); }}
                          className={cn(project.categoryId === cat.id && "bg-slate-100 font-bold")}
                        >
                          {cat.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); downloadProject(id); }} className="gap-2">
                    <Download className="size-3.5" /> Скачать проект (.zip)
                  </DropdownMenuItem>

                  <DropdownMenuItem 
                    variant="destructive" 
                    onClick={(e) => { e.stopPropagation(); setIsDeleteOpen(true); }}
                    className="gap-2"
                  >
                    <Trash2 className="size-3.5" /> Удалить проект
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {isLive && (
              <span className="flex items-center gap-1 text-[10px] text-indigo-500 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                Текущий
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-sm font-bold text-slate-900 leading-snug mb-1 group-hover:text-indigo-700 transition-colors line-clamp-2">
          {title}
        </h3>

        {/* Meta */}
        <div className="flex items-center gap-3 mt-1 mb-4">
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <FileText className="w-3 h-3" />
            {filesCount} {filesCount === 1 ? 'файл' : filesCount < 5 ? 'файла' : 'файлов'}
          </span>
          <span className="w-1 h-1 rounded-full bg-slate-200" />
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <Clock className="w-3 h-3" />
            {lastModified}
          </span>
        </div>

        {/* Progress */}
        {progress !== undefined && (
          <div className="mt-auto">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-slate-400 font-medium">Готовность</span>
              <span className="text-[11px] font-bold text-slate-600">{progress}%</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  progress >= 80 ? 'bg-emerald-400' : progress >= 40 ? 'bg-indigo-400' : 'bg-amber-400'
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Rename Dialog */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Переименовать проект</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="proj-name" className="text-xs font-bold uppercase text-slate-500 mb-2 block">
              Новое название
            </Label>
            <Input
              id="proj-name"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTitle.trim()) {
                  renameProject(id, newTitle.trim());
                  setIsRenameOpen(false);
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsRenameOpen(false)}>Отмена</Button>
            <Button 
              disabled={!newTitle.trim()}
              onClick={() => {
                renameProject(id, newTitle.trim());
                setIsRenameOpen(false);
              }}
            >
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Проект и все его файлы будут удалены навсегда.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteOpen(false)}>Отмена</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-rose-600 hover:bg-rose-700" 
              onClick={() => deleteProject(id)}
            >
              Удалить навсегда
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Hybrid Action Card ────────────────────────────────────────────────────────

function HybridActionCard() {
  const { 
    addProject, 
    activeCategory, 
    setViewContext, 
    setProjectName, 
    setActiveProjectId,
    importProject 
  } = useData();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreate = async () => {
    const newProj = await addProject('', activeCategory);
    if (newProj) {
      setActiveProjectId(newProj.id);
      setProjectName(newProj.title);
      setViewContext('workspace');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const toastId = toast.loading("Импорт проекта...");
    try {
      const newProj = await importProject(file);
      if (newProj) {
        toast.success(`Проект "${newProj.title}" успешно импортирован`, { id: toastId });
        // Optionally switch to the new project immediately
        // setActiveProjectId(newProj.id);
        // setProjectName(newProj.title);
        // setViewContext('workspace');
      }
    } catch (err) {
      toast.error("Ошибка при импорте", { id: toastId });
    } finally {
      // Clear input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="group flex flex-col h-[200px] bg-white rounded-2xl border border-slate-200 overflow-hidden transition-all duration-200 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 hover:border-indigo-200">
      {/* Top (70%): Create New Project */}
      <div 
        onClick={(e) => { e.stopPropagation(); handleCreate(); }}
        className="flex-[7] flex flex-col items-center justify-center gap-3 bg-slate-50/50 hover:bg-indigo-50/50 cursor-pointer transition-colors border-b border-slate-100"
      >
        <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-indigo-500 group-hover:scale-110 group-hover:bg-indigo-500 group-hover:text-white transition-all shadow-sm">
          <Plus className="size-6" />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-sm font-bold text-slate-800">Создать новый проект</span>
          <span className="text-[10px] text-slate-400 mt-0.5">Личная рабочая область</span>
        </div>
      </div>

      {/* Bottom (30%): Import Project */}
      <div 
        className="flex-[3] flex items-center justify-center gap-2.5 bg-white hover:bg-slate-50 cursor-pointer transition-colors relative"
        onClick={(e) => { 
          e.stopPropagation(); 
          fileInputRef.current?.click();
        }}
      >
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".zip"
          className="hidden"
        />
        <FolderInput className="size-4 text-slate-400" />
        <span className="text-xs font-semibold text-slate-600">Импортировать проект...</span>
      </div>
    </div>
  );
}

// ─── Footer strip ─────────────────────────────────────────────────────────

function DashboardFooter({ count }: { count: number }) {
  return (
    <div className="h-16 flex items-center px-6 border-t border-slate-200 bg-white text-xs text-slate-400 shrink-0 gap-4">
      <span>Всего проектов: {count}</span>
      <span className="ml-auto">Список проектов</span>
    </div>
  );
}

// ─── Main Dashboard Center Panel ────────────────────────────────────────────

export function DashboardCenterPanel() {
  const { 
    projects, 
    activeCategory, 
    setViewContext,
    setActiveProjectId,
    setProjectName
  } = useData();
  
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sortOrder, setSortOrder] = React.useState<'newest' | 'oldest'>(() => {
    try {
      const saved = localStorage.getItem('docok_projects_sort');
      return (saved as 'newest' | 'oldest') || 'newest';
    } catch (e) { return 'newest'; }
  });

  React.useEffect(() => {
    localStorage.setItem('docok_projects_sort', sortOrder);
  }, [sortOrder]);

  const filteredProjects = projects.filter(p => {
    // Search
    if (searchQuery && !p.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    
    // Category mapping
    if (activeCategory === 'all') return true;
    if (activeCategory === 'active') return p.status === 'active' || p.status === 'current';
    if (activeCategory === 'archive') return p.status === 'archive';
    if (activeCategory === 'tender') return p.status === 'tender';
    
    return p.categoryId === activeCategory;
  });

  const sortedProjects = React.useMemo(() => {
    return [...filteredProjects].sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      
      if (sortOrder === 'newest') return dateB - dateA;
      return dateA - dateB;
    });
  }, [filteredProjects, sortOrder]);

  const openProject = (project: Project) => {
    setActiveProjectId(project.id);
    setProjectName(project.title);
    setViewContext('workspace');
  };

  return (
    <div className="flex flex-col flex-1 bg-white relative min-w-0 h-full">
      <div className="flex flex-col h-full flex-1 min-h-0">

        {/* ── Attic ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shadow-sm h-[72px] shrink-0">
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <h1 className="text-sm font-bold text-slate-800 truncate">Мои проекты</h1>
          </div>

          {/* Center: search */}
          <div className="flex-1 flex justify-center px-4">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                placeholder="Найти проект..."
                className="w-full bg-slate-100 hover:bg-slate-200 focus:bg-white border border-transparent focus:border-indigo-300 rounded-full pl-10 pr-4 py-2 text-sm text-slate-700 outline-none transition-all shadow-sm focus:shadow-md"
              />
            </div>
          </div>

          {/* Right: Sort button */}
          <div className="flex-1 flex justify-end items-center gap-4 min-w-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm border border-slate-200 outline-none',
                    'bg-white/80 backdrop-blur-md text-slate-700 hover:border-indigo-300 hover:bg-slate-50 active:scale-95'
                  )}
                  title="Сортировка"
                >
                  <ArrowUpDown className="w-4 h-4 text-indigo-500" />
                  <span>Сортировка</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-1.5 backdrop-blur-xl bg-white/90 border-slate-200/50 shadow-2xl animate-in fade-in zoom-in duration-100">
                <DropdownMenuItem 
                  onClick={() => setSortOrder('newest')}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-md hover:bg-indigo-50/50 group transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <SortAsc className="size-4 text-slate-400 group-hover:text-indigo-500" />
                    <span className={cn("text-sm", sortOrder === 'newest' ? "font-bold text-indigo-600" : "text-slate-600")}>Сначала новые</span>
                  </div>
                  {sortOrder === 'newest' && <Check className="size-4 text-indigo-600" />}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setSortOrder('oldest')}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-md hover:bg-indigo-50/50 group transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-slate-400 group-hover:text-indigo-500" />
                    <span className={cn("text-sm", sortOrder === 'oldest' ? "font-bold text-indigo-600" : "text-slate-600")}>Сначала старые</span>
                  </div>
                  {sortOrder === 'oldest' && <Check className="size-4 text-indigo-600" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex-1 overflow-auto relative bg-slate-50">
          <div className="p-6">
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {/* Hybrid Action Card first - always visible */}
              <HybridActionCard />
              
              {sortedProjects.map(p => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  onClick={() => openProject(p)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <DashboardFooter count={projects.length} />
    </div>
  );
}

