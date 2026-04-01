import React from 'react';
import {
  Search,
  Edit2,
  ArrowUpDown,
  Building2,
  FileText,
  Clock,
  Zap
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useData } from '../context/DataContext';
import { toast } from 'sonner';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Project Card ─────────────────────────────────────────────────────────────

type ProjectStatus = 'current' | 'active' | 'archive' | 'tender';

const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string }> = {
  current: { label: 'Открыт',   color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
  active:  { label: 'Активный', color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
  archive: { label: 'Архив',    color: 'text-slate-500 bg-slate-50 border-slate-200' },
  tender:  { label: 'Тендер',   color: 'text-amber-600 bg-amber-50 border-amber-100' },
};

interface ProjectCardProps {
  title: string;
  filesCount: number;
  lastModified: string;
  progress?: number;
  status: ProjectStatus;
  isLive?: boolean;
  onClick: () => void;
}

function ProjectCard({ title, filesCount, lastModified, progress, status, isLive, onClick }: ProjectCardProps) {
  const { label, color } = STATUS_CONFIG[status];

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative flex flex-col bg-white rounded-2xl border border-slate-200 p-5 cursor-pointer',
        'transition-all duration-200 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 hover:border-slate-300',
        isLive && 'ring-2 ring-indigo-200'
      )}
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
          <span className={cn('text-[11px] font-semibold px-2.5 py-0.5 rounded-full border', color)}>
            {label}
          </span>
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

      {/* Hover arrow */}
      <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div className="w-7 h-7 rounded-full bg-indigo-50 flex items-center justify-center">
          <Zap className="w-3.5 h-3.5 text-indigo-500" />
        </div>
      </div>
    </div>
  );
}

// ─── Footer strip — mirrors CenterPanel Footer ─────────────────────────────

function DashboardFooter() {
  return (
    <div className="h-16 flex items-center px-6 border-t border-slate-200 bg-white text-xs text-slate-400 shrink-0 gap-4">
      <span>Всего проектов: 4</span>
      <span className="ml-auto">Список проектов</span>
    </div>
  );
}

// ─── Main Dashboard Center Panel ────────────────────────────────────────────

const STUB_PROJECTS = [
  { id: 'stub-1', title: 'ЖК Скандинавия — инженерные системы', filesCount: 12, lastModified: '27 мар', progress: 65,  status: 'active'  as ProjectStatus },
  { id: 'stub-2', title: 'Тендер: Вентиляция ТЦ «Европолис»',   filesCount: 5,  lastModified: '14 мар', progress: 30,  status: 'tender'  as ProjectStatus },
  { id: 'stub-3', title: 'БЦ Сити — слаботочка и ОПС',          filesCount: 8,  lastModified: '2 янв',  progress: 100, status: 'archive' as ProjectStatus },
];

export function DashboardCenterPanel() {
  const { projectName, setProjectName, uploadStatuses, setViewContext } = useData();
  const [isEditingName, setIsEditingName] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isSortOpen, setIsSortOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const fileCount = Object.keys(uploadStatuses || {}).length;
  const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

  React.useEffect(() => {
    if (isEditingName && inputRef.current) inputRef.current.focus();
  }, [isEditingName]);

  const openProject = () => setViewContext('workspace');

  return (
    <div className="flex flex-col flex-1 bg-white relative min-w-0 h-full">
      <div className="flex flex-col h-full flex-1 min-h-0">

        {/* ── Attic — strict clone of CenterPanel header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shadow-sm h-[72px] shrink-0">

          {/* Left: section title (mirrors project name slot) */}
          <div className="flex-1 min-w-0 flex items-center gap-2">
            {isEditingName ? (
              <input
                ref={inputRef}
                type="text"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                onBlur={() => setIsEditingName(false)}
                onKeyDown={e => e.key === 'Enter' && setIsEditingName(false)}
                className="text-sm font-bold text-slate-900 bg-slate-100 rounded-md px-2 py-1 outline-none ring-2 ring-indigo-500 w-full max-w-sm"
              />
            ) : (
              <div
                className="group flex items-center gap-1.5 cursor-pointer max-w-sm hover:bg-slate-50 rounded-md px-2 py-1 -ml-2 transition-colors"
                onClick={() => setIsEditingName(true)}
                title="Редактировать название"
              >
                <h1 className="text-sm font-bold text-slate-800 truncate">Мои проекты</h1>
                <Edit2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>

          {/* Center: search — same as CenterPanel */}
          <div className="flex-1 flex justify-center px-4">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Найти проект..."
                className="w-full bg-slate-100 hover:bg-slate-200 focus:bg-white border border-transparent focus:border-indigo-300 rounded-full pl-10 pr-4 py-2 text-sm text-slate-700 outline-none transition-all shadow-sm focus:shadow-md"
              />
            </div>
          </div>

          {/* Right: Sort button — same position/size as "Files" button in CenterPanel */}
          <div className="flex-1 flex justify-end items-center gap-4 min-w-0">
            <button
              onClick={() => setIsSortOpen(!isSortOpen)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm border border-slate-200 hover:border-indigo-300',
                isSortOpen ? 'bg-indigo-50 text-indigo-700' : 'bg-white text-slate-700 hover:bg-slate-50'
              )}
              title="Сортировка"
            >
              <ArrowUpDown className="w-4 h-4" />
              <span>Сортировка</span>
            </button>
          </div>
        </div>

        {/* ── Content — cards grid (mirrors table content area) ── */}
        <div className="flex-1 overflow-auto relative bg-slate-50">
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Live card */}
              <ProjectCard
                title={projectName}
                filesCount={fileCount}
                lastModified={today}
                progress={fileCount > 0 ? 50 : 10}
                status="current"
                isLive
                onClick={openProject}
              />
              {/* Stubs */}
              {STUB_PROJECTS.map(p => (
                <ProjectCard
                  key={p.id}
                  title={p.title}
                  filesCount={p.filesCount}
                  lastModified={p.lastModified}
                  progress={p.progress}
                  status={p.status}
                  onClick={openProject}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer — mirrors CenterPanel Footer ── */}
      <DashboardFooter />
    </div>
  );
}
