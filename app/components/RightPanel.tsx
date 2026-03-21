import React from 'react';
import { 
  Menu, 
  Settings2, 
  Info, 
  Calculator, 
  ArrowRight,
  Download,
  UploadCloud,
  RotateCcw,
  Rows3,
  ArrowUpDown,
  Calculator as CalcIcon,
  Percent,
  CheckCircle2
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Stage, RightPanelTab } from '../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface RightPanelProps {
  expanded: boolean;
  onToggle: () => void;
  currentStage: Stage;
  onNextStage: () => void;
  hasNextStage: boolean;
  canProceed: boolean;
}

export function RightPanel({ expanded, onToggle, currentStage, onNextStage, hasNextStage, canProceed }: RightPanelProps) {
  const [activeTab, setActiveTab] = React.useState<RightPanelTab>('tools');

  const renderTabIcon = (tab: RightPanelTab) => {
    switch (tab) {
      case 'tools': return <Settings2 className="w-5 h-5" />;
      case 'info': return <Info className="w-5 h-5" />;
      case 'calc': return <Calculator className="w-5 h-5" />;
    }
  };

  const tabs: { id: RightPanelTab; icon: React.ReactNode; label: string }[] = [
    { id: 'tools', icon: <Settings2 className={cn(expanded ? "w-5 h-5" : "w-6 h-6")} />, label: 'Инструменты' },
    { id: 'info', icon: <Info className={cn(expanded ? "w-5 h-5" : "w-6 h-6")} />, label: 'Информация' },
    { id: 'calc', icon: <Calculator className={cn(expanded ? "w-5 h-5" : "w-6 h-6")} />, label: 'Калькуляторы' },
  ];

  return (
    <div 
      className={cn(
        "flex flex-col bg-white border-l border-slate-200 transition-all duration-300 ease-in-out shrink-0 h-full",
        expanded ? "w-72" : "w-16"
      )}
    >
      {/* Header - Attic */}
      <div className={cn(
        "p-4 border-b border-slate-200 flex",
        expanded ? "flex-row justify-between items-center h-[72px]" : "flex-col items-center gap-4 py-4"
      )}>
        {tabs.map((tab) => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "p-2 rounded-lg transition-colors flex items-center justify-center",
              activeTab === tab.id ? "bg-indigo-100 text-indigo-700" : "hover:bg-slate-100 text-slate-600",
              !expanded && "w-12 h-12"
            )}
            title={tab.label}
          >
            {tab.icon}
          </button>
        ))}
        <button 
          onClick={onToggle}
          className={cn(
            "p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors flex items-center justify-center ml-auto",
            !expanded && "w-12 h-12 mt-4 ml-0"
          )}
          title="Свернуть/Развернуть"
        >
          <Menu className={cn(expanded ? "w-5 h-5" : "w-6 h-6")} />
        </button>
      </div>

      {/* Middle Content - Switchable based on activeTab */}
      <div className={cn("flex-1 overflow-y-auto", !expanded && "flex justify-center items-start pt-4")}>
        {activeTab === 'tools' && (
          <div className="flex flex-col gap-4 p-4">
            {expanded ? (
              <>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Действия</div>
                <button className="flex items-center gap-3 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-md transition-colors text-sm">
                  <UploadCloud className="w-4 h-4 text-slate-500" /> Импорт данных
                </button>
                <button className="flex items-center gap-3 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-md transition-colors text-sm">
                  <Download className="w-4 h-4 text-slate-500" /> Экспорт таблицы
                </button>
                <button className="flex items-center gap-3 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-red-600 rounded-md transition-colors text-sm">
                  <RotateCcw className="w-4 h-4 text-red-500" /> Сброс
                </button>

                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-4 mb-2">Работа с данными</div>
                <button className="flex items-center gap-3 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-md transition-colors text-sm">
                  <Rows3 className="w-4 h-4 text-slate-500" /> Группировка
                </button>
                <button className="flex items-center gap-3 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-md transition-colors text-sm">
                  <ArrowUpDown className="w-4 h-4 text-slate-500" /> Сортировка
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-4" title="Инструменты">
                 <UploadCloud className="w-6 h-6 text-slate-500 hover:text-indigo-600 cursor-pointer" />
                 <Download className="w-6 h-6 text-slate-500 hover:text-indigo-600 cursor-pointer" />
                 <RotateCcw className="w-6 h-6 text-red-500 hover:text-red-700 cursor-pointer" />
                 <div className="w-full h-px bg-slate-200 my-2" />
                 <Rows3 className="w-6 h-6 text-slate-500 hover:text-indigo-600 cursor-pointer" />
                 <ArrowUpDown className="w-6 h-6 text-slate-500 hover:text-indigo-600 cursor-pointer" />
              </div>
            )}
          </div>
        )}

        {activeTab === 'info' && (
          <div className="flex flex-col gap-4 p-4">
             {expanded ? (
               <>
                 <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Общая сводка</div>
                 <div className="bg-slate-50 p-4 rounded-lg flex flex-col gap-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Всего позиций:</span>
                      <span className="font-semibold text-slate-900">142</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Сумма (без НДС):</span>
                      <span className="font-semibold text-slate-900">890 000 ₽</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Сумма НДС:</span>
                      <span className="font-semibold text-slate-900">178 000 ₽</span>
                    </div>
                    <div className="h-px w-full bg-slate-200 my-1" />
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 font-medium">Итого:</span>
                      <span className="font-bold text-indigo-700">1 068 000 ₽</span>
                    </div>
                 </div>
               </>
             ) : (
               <div className="flex flex-col gap-4 items-center group cursor-help" title="Всего: 142 поз. | Итого: 1 068 000 ₽">
                  <Info className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 transition-colors" />
               </div>
             )}
          </div>
        )}

        {activeTab === 'calc' && (
          <div className="flex flex-col gap-4 p-4">
             {expanded ? (
               <>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Конвертеры</div>
                  <div className="bg-slate-50 p-3 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-indigo-50 transition-colors">
                    <div className="p-2 bg-white rounded-md shadow-sm"><CalcIcon className="w-4 h-4 text-indigo-600" /></div>
                    <span className="text-sm font-medium text-slate-700">Единицы измерения</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-indigo-50 transition-colors">
                    <div className="p-2 bg-white rounded-md shadow-sm"><Percent className="w-4 h-4 text-indigo-600" /></div>
                    <span className="text-sm font-medium text-slate-700">Расчет наценки</span>
                  </div>
               </>
             ) : (
               <div className="flex flex-col gap-4 items-center">
                  <CalcIcon className="w-6 h-6 text-slate-500 hover:text-indigo-600 cursor-pointer" title="Единицы измерения" />
                  <Percent className="w-6 h-6 text-slate-500 hover:text-indigo-600 cursor-pointer" title="Расчет наценки" />
               </div>
             )}
          </div>
        )}
      </div>

      {/* Footer - Basement (Next Button) */}
      <div className={cn(
        "border-t border-slate-200 p-4 flex justify-center items-center h-[72px]"
      )}>
        {hasNextStage ? (
          <button 
            onClick={onNextStage}
            disabled={!canProceed}
            className={cn(
              "w-full flex items-center justify-center gap-2 rounded-lg font-medium transition-all",
              expanded ? "px-4 py-3" : "w-12 h-12 p-0 rounded-xl",
              canProceed 
                ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm" 
                : "bg-slate-800 text-slate-400 cursor-not-allowed"
            )}
            title={canProceed ? "Перейти к следующему этапу" : "Данные не заполнены"}
          >
            {expanded && <span>Далее</span>}
            <ArrowRight className={cn(expanded ? "w-4 h-4" : "w-5 h-5")} />
          </button>
        ) : (
           <div className={cn(
            "w-full flex items-center justify-center gap-2 rounded-lg font-medium bg-indigo-600 text-white shadow-sm",
            expanded ? "px-4 py-3" : "w-12 h-12 p-0 rounded-xl"
          )}>
             {expanded && <span>Завершить</span>}
             <CheckCircle2 className={cn(expanded ? "w-4 h-4" : "w-5 h-5")} />
          </div>
        )}
      </div>
    </div>
  );
}
