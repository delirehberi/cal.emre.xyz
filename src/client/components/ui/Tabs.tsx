import React, { useRef } from 'react';
import { cn } from '../../lib/cn';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

export const getTabId = (idBase: string, value: string): string => `${idBase}-tab-${value}`;
export const getPanelId = (idBase: string, value: string): string => `${idBase}-panel-${value}`;

/**
 * Next tab for an arrow-key press: Left/Right wrap around, Home/End jump to the ends.
 * Returns null when the key is not a navigation key.
 */
export const getNextTabIndex = (count: number, from: number, key: string): number | null => {
  if (count === 0) return null;
  switch (key) {
    case 'ArrowRight':
      return (from + 1) % count;
    case 'ArrowLeft':
      return (from - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
};

export interface TabsProps<T extends string> {
  items: ReadonlyArray<TabItem<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Accessible name of the tab list. */
  label: string;
  /** Prefix for tab/panel ids; use `getTabId` / `getPanelId` with the same base on the panels. */
  idBase: string;
  /** `segmented` is a boxed control; `underline` is a page-level tab bar with an ink underline. */
  variant?: 'segmented' | 'underline';
  className?: string;
}

/**
 * Segmented tab list (WAI-ARIA tabs with automatic activation and a roving tabindex).
 * Render each panel with `role="tabpanel"`, `id={getPanelId(idBase, value)}` and `aria-labelledby={getTabId(idBase, value)}`.
 */
export function Tabs<T extends string>({ items, value, onChange, label, idBase, variant = 'segmented', className }: TabsProps<T>): React.ReactElement {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = getNextTabIndex(items.length, index, event.key);
    if (next === null) return;
    event.preventDefault();
    onChange(items[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        variant === 'underline'
          ? 'flex items-end shadow-[inset_0_-1px_0_0] shadow-line'
          : 'flex gap-1 rounded-button border border-line bg-paper p-1',
        className
      )}
    >
      {items.map((item, index) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={getTabId(idBase, item.value)}
            aria-selected={selected}
            aria-controls={getPanelId(idBase, item.value)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              variant === 'underline'
                ? [
                    'flex min-w-0 flex-1 cursor-pointer items-start justify-center gap-1.5 border-b-2 px-2 py-3.5 text-center font-sans text-caption leading-ui font-semibold transition-colors tablet:flex-none tablet:px-5 tablet:text-body tablet:whitespace-nowrap',
                    selected ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink',
                  ]
                : [
                    'flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-tab border py-[9px] font-sans text-caption leading-ui font-medium transition-colors',
                    selected ? 'border-line bg-card text-ink' : 'border-transparent text-muted hover:text-ink',
                  ]
            )}
          >
            {item.icon}
            <span className={variant === 'underline' ? undefined : 'truncate'}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
