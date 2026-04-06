import { useState, useRef, useEffect } from "react";
import { Check, Edit2, Copy } from "lucide-react";
import { cn } from "../utils/cn";

interface EditableFieldProps {
  label: string;
  value: string | undefined | null;
  confidence: number;
  isVerified: boolean;
  onVerify: () => void;
  onChange: (newVal: string) => void;
  note?: string; // Пояснение (например, "Адрес скопирован")
}

export function EditableField({ label, value, confidence, isVerified, onVerify, onChange, note }: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tempValue, setTempValue] = useState(value || "");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const getStatusColor = () => {
    if (confidence <= 0.1) return "bg-red-500"; // Фейл математической валидации
    if (isVerified) return "bg-green-500";
    if (confidence >= 0.95) return "bg-green-500";
    if (confidence === 0.5) return "bg-orange-400"; // Оранжевый для дублей
    if (confidence >= 0.5) return "bg-yellow-500";
    return "bg-red-500";
  };

  const isGreen = isVerified || confidence >= 0.95;
  const isWarning = !isVerified && confidence < 0.95; // Желтые/красные поля, требующие внимания

  useEffect(() => { setTempValue(value || ""); }, [value]);

  const handleSave = () => {
    setIsEditing(false);
    if (tempValue !== value) onChange(tempValue);
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (value) {
      navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="group py-2 border-b border-border/40 last:border-0 relative">
      <div className="flex items-center gap-2 mb-1 h-4">
        <div 
          className={`w-2 h-2 rounded-full ${getStatusColor()} 
            ${(isGreen && !note) ? 'opacity-30 group-hover:opacity-100 transition-opacity' : 'opacity-100'}`} 
          title={note ? `${note} (${Math.round(confidence * 100)}%)` : `Уверенность: ${Math.round(confidence * 100)}%`} 
        />
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
        
        <button 
          onClick={handleCopy}
          className={cn(
            "p-0.5 rounded transition-all opacity-0 group-hover:opacity-100 shrink-0",
            copied ? "text-green-500 scale-110" : "text-muted-foreground hover:bg-slate-100"
          )}
          title={copied ? "Скопировано!" : "Копировать реквизит"}
        >
          {copied ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
        </button>
      </div>
      
      {isEditing ? (
        <div className="flex items-start gap-2 mt-1">
           <textarea 
             ref={inputRef}
             className="w-full text-sm bg-background border rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-primary resize-none no-scrollbar"
             value={tempValue}
             onChange={(e) => setTempValue(e.target.value)}
             onBlur={handleSave}
             autoFocus
             rows={2}
           />
        </div>
      ) : (
        <div 
           className="flex items-start justify-between gap-4 cursor-pointer"
           onDoubleClick={() => setIsEditing(true)}
        >
           <div className="flex flex-col flex-1 min-w-0">
             <span className="text-[13px] tracking-tight break-words whitespace-pre-wrap leading-tight text-foreground/90 font-medium">
               {value || "—"}
             </span>
             {confidence === 0.5 && note && (
                <p className="text-[9px] text-orange-500/80 italic mt-0.5 leading-none">
                  {note}
                </p>
             )}
           </div>
           
           <div className="flex items-center gap-1 ml-2">
              {/* Редактирование: только на ховере */}
              <button 
                 onClick={() => setIsEditing(true)} 
                 className="p-1 hover:bg-accent rounded text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                 title="Редактировать"
              >
                 <Edit2 className="w-3.5 h-3.5" />
              </button>

              {/* Галочка: видима сразу только для ЖЕЛТЫХ, для остальных - на ховере */}
              {!isVerified && (
                 <button 
                   onClick={onVerify} 
                   className={`p-1 hover:bg-green-500/20 text-green-600 rounded transition-all shrink-0 
                     ${isWarning ? 'opacity-100 bg-green-50/50 border border-green-200/50' : 'opacity-0 group-hover:opacity-100'}`}
                   title="подверждаю данные"
                 >
                    <Check className="w-3.5 h-3.5" />
                 </button>
              )}
           </div>
        </div>
      )}
    </div>
  );
}
