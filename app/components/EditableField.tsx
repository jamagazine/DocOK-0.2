import { useState, useRef, useEffect } from "react";
import { Check, Edit2 } from "lucide-react";

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

  useEffect(() => { setTempValue(value || ""); }, [value]);

  const handleSave = () => {
    setIsEditing(false);
    if (tempValue !== value) onChange(tempValue);
  };

  return (
    <div className="group py-2 border-b border-border/40 last:border-0 relative">
      <div className="flex items-center gap-2 mb-1">
        <div 
          className={`w-2 h-2 rounded-full ${getStatusColor()} 
            ${(isGreen && !note) ? 'opacity-30 group-hover:opacity-100 transition-opacity' : 'opacity-100'}`} 
          title={note ? `${note} (${Math.round(confidence * 100)}%)` : `Уверенность: ${Math.round(confidence * 100)}%`} 
        />
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
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
             <span className="text-sm break-words whitespace-pre-wrap leading-tight text-foreground/90">{value || "—"}</span>
             {confidence === 0.5 && note && (
               <p className="text-[9px] text-orange-500/80 italic mt-0.5 leading-none">
                 {note}
               </p>
             )}
           </div>
           <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => setIsEditing(true)} className="p-1 hover:bg-accent rounded text-muted-foreground">
                 <Edit2 className="w-3.5 h-3.5" />
              </button>
              {!isVerified && (
                 <button onClick={onVerify} className="p-1 hover:bg-green-500/20 text-green-600 rounded">
                    <Check className="w-3.5 h-3.5" />
                 </button>
              )}
           </div>
        </div>
      )}
    </div>
  );
}
