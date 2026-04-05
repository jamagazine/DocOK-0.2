import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AutoResizingTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
}

export const AutoResizingTextarea = forwardRef<HTMLTextAreaElement, AutoResizingTextareaProps>(
  ({ className, value, ...props }, ref) => {
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const combinedRef = (ref as React.RefObject<HTMLTextAreaElement>) || internalRef;

    const adjustHeight = useCallback(() => {
      const textarea = combinedRef.current;
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
    }, [combinedRef]);

    useEffect(() => {
      adjustHeight();
      const timer = setTimeout(adjustHeight, 10);
      return () => clearTimeout(timer);
    }, [value, adjustHeight]);

    return (
      <textarea
        ref={combinedRef}
        value={value}
        className={cn(
          "bg-transparent border-none focus:ring-0 rounded-none px-1 w-full text-slate-900 resize-none overflow-hidden py-0 block min-h-[1.5rem] antialiased",
          props.readOnly && "cursor-default",
          className
        )}
        rows={1}
        onInput={(e) => {
          adjustHeight();
          props.onInput?.(e);
        }}
        {...props}
      />
    );
  }
);
AutoResizingTextarea.displayName = 'AutoResizingTextarea';

interface EditableCellProps {
  value: string;
  colKey: string;
  rowId: string;
  isReadOnly: boolean;
  isHeader?: boolean;
  align?: 'left' | 'center' | 'right';
  className?: string;
  onChange: (value: string) => void;
  onClick?: (e: React.MouseEvent) => void;
  onKeyDown?: (e: React.KeyboardEvent, rowId: string, colKey: string) => void;
}

export const EditableCell = React.memo(({
  value,
  colKey,
  rowId,
  isReadOnly,
  isHeader,
  align,
  className,
  onChange,
  onClick,
  onKeyDown
}: EditableCellProps) => {
  return (
    <AutoResizingTextarea
      value={value}
      readOnly={isReadOnly}
      tabIndex={isReadOnly ? -1 : 0}
      onChange={(e) => onChange(e.target.value)}
      onClick={onClick}
      onKeyDown={(e) => onKeyDown?.(e, rowId, colKey)}
      className={cn(
        colKey === 'name' ? "text-slate-900 font-medium" : "text-slate-600",
        colKey === 'workType' && "text-slate-500 text-xs",
        align === 'center' ? "text-center" : align === 'right' ? "text-right" : "text-left",
        isHeader && "italic text-amber-700",
        className
      )}
    />
  );
});

EditableCell.displayName = 'EditableCell';

interface ConfidenceInputProps {
  initialValue: string | null;
  confidence?: number;
  onConfirm: (val: string) => void;
}

export const ConfidenceInput: React.FC<ConfidenceInputProps> = ({ 
  initialValue, 
  confidence = 1.0, 
  onConfirm 
}) => {
  const [value, setValue] = useState(initialValue || '');
  const [isVerified, setIsVerified] = useState(false);

  // Логика HITL: если уверенность ниже 95% или значение не найдено (null)
  const needsVerification = !isVerified && (confidence < 0.95 || initialValue === null || value === '');

  return (
    <div className="relative flex items-center w-full">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={cn(
          "w-full p-2 border rounded-md transition-colors",
          needsVerification 
            ? "bg-yellow-50 border-yellow-400 focus:ring-yellow-500" // Сомнительное поле
            : "bg-green-50 border-green-200 focus:ring-green-500", // Уверенное/подтвержденное поле
          !value && "bg-red-50 border-red-400" // Критически пустое поле
        )}
      />
      {needsVerification && (
        <button
          onClick={() => {
            setIsVerified(true);
            onConfirm(value);
          }}
          className="absolute right-2 px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 focus:outline-none"
        >
          Подтвердить
        </button>
      )}
    </div>
  );
};
