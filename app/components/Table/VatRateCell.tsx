import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, AlertTriangle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface VatRateCellProps {
  value: string;
  rowId: string;
  isInvalid?: boolean;
  isLegacy?: boolean;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent, rowId: string, colKey: string) => void;
}

const VAT_OPTIONS = [
  { value: '22%', label: '22%' },
  { value: '20%', label: '20% (старая)' },
  { value: '10%', label: '10%' },
  { value: '0%', label: '0%' },
  { value: 'Без НДС', label: 'Без НДС' },
];

export const VatRateCell = React.memo(({
  value,
  rowId,
  isInvalid,
  isLegacy,
  onChange,
  onKeyDown
}: VatRateCellProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (isEditing) {
          handleInputBlur();
        }
      }
    };

    if (isOpen || isEditing) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, isEditing]);

  const handleSelect = (selectedValue: string) => {
    console.log('[VatRateCell] handleSelect:', {
      rowId,
      selectedValue,
      oldValue: value
    });
    onChange(selectedValue);
    setInputValue(selectedValue);
    setIsOpen(false);
    setIsEditing(false);
  };

  const handleInputBlur = () => {
    if (inputValue !== value) {
      onChange(inputValue);
    }
    setIsEditing(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInputBlur();
    } else if (e.key === 'Escape') {
      setInputValue(value || '');
      setIsEditing(false);
    } else if (e.key === 'Tab') {
      handleInputBlur();
      onKeyDown?.(e as any, rowId, 'vat_rate');
    }
  };

  const handleCellKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isEditing && !isOpen) {
      e.preventDefault();
      setIsEditing(true);
    } else if (!isEditing && !isOpen) {
      onKeyDown?.(e, rowId, 'vat_rate');
    }
  };

  const displayValue = value || '—';
  const showWarning = isInvalid || isLegacy;

  // Вычисляем позицию dropdown при открытии
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX
      });
    }
  }, [isOpen]);

  return (
    <div
      ref={dropdownRef}
      className="relative w-full h-full flex items-center justify-center"
      onKeyDown={handleCellKeyDown}
      tabIndex={isEditing || isOpen ? -1 : 0}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          className="w-full h-full px-2 py-1 text-center text-sm text-slate-900 bg-white border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Введите НДС"
        />
      ) : (
        <button
          ref={buttonRef}
          onClick={() => setIsOpen(!isOpen)}
          onDoubleClick={() => setIsEditing(true)}
          className={cn(
            "w-full h-full px-2 py-1 flex items-center justify-center gap-1 text-sm transition-colors rounded group",
            "hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500",
            showWarning && "text-amber-600",
            !showWarning && "text-slate-700"
          )}
        >
          {showWarning && (
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="truncate">{displayValue}</span>
          <ChevronDown className={cn(
            "w-3.5 h-3.5 shrink-0 transition-transform text-slate-400 group-hover:text-slate-600",
            isOpen && "rotate-180"
          )} />
        </button>
      )}

      {isOpen && !isEditing && createPortal(
        <div
          className="fixed bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: '160px',
            zIndex: 9999
          }}
        >
          {VAT_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={cn(
                "w-full px-3 py-2 text-left text-sm transition-colors",
                "hover:bg-indigo-50 hover:text-indigo-700",
                value === option.value && "bg-indigo-100 text-indigo-700 font-medium"
              )}
            >
              {option.label}
            </button>
          ))}
          <div className="border-t border-slate-200">
            <button
              onClick={() => {
                setIsOpen(false);
                setIsEditing(true);
              }}
              className="w-full px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
            >
              Ввести вручную...
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});

VatRateCell.displayName = 'VatRateCell';
