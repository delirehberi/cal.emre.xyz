import React, { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface DropdownItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: (DropdownItem | 'divider')[];
  align?: 'left' | 'right';
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  items,
  align = 'right',
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className={twMerge('relative inline-block text-left', className)} ref={dropdownRef}>
      <div onClick={() => setIsOpen((prev) => !prev)} className="cursor-pointer">
        {trigger}
      </div>

      {isOpen && (
        <div
          role="menu"
          className={twMerge(
            clsx(
              'absolute z-50 mt-2 min-w-[12rem] rounded-xl border border-stone-200 bg-white p-1.5 shadow-xl transition-all dark:border-stone-800 dark:bg-stone-900 animate-in fade-in zoom-in-95 duration-150',
              align === 'right' ? 'right-0' : 'left-0'
            )
          )}
        >
          {items.map((item, idx) => {
            if (item === 'divider') {
              return (
                <div
                  key={`divider-${idx}`}
                  className="my-1 border-t border-stone-200 dark:border-stone-800"
                  role="separator"
                />
              );
            }

            return (
              <button
                key={item.id}
                role="menuitem"
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  item.onClick();
                  setIsOpen(false);
                }}
                className={clsx(
                  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors text-left cursor-pointer',
                  item.danger
                    ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40'
                    : 'text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800',
                  item.disabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                {item.icon && <span className="h-4 w-4 shrink-0 text-current">{item.icon}</span>}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
