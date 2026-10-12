import React, { useRef } from 'react';
import { clsx } from 'clsx';

export interface ChipProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'role'> {
  selected?: boolean;
}

/** A single choice in a ChipGroup (e.g. a meeting duration). */
export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ selected = false, className, children, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      role="radio"
      aria-checked={selected}
      className={clsx(
        'inline-flex cursor-pointer items-center justify-center rounded-full border px-[18px] py-2.5 font-sans text-body leading-ui font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        selected ? 'border-ink bg-ink text-paper' : 'border-line bg-card text-ink hover:border-muted',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
);

Chip.displayName = 'Chip';

/**
 * Arrow-key navigation over the enabled chips of a group.
 * Left/Up go to the previous chip, Right/Down to the next (both wrap), Home/End to the ends.
 * Returns the option index to move to, or null when the key is not a navigation key.
 */
export const getNextChipIndex = (enabledIndexes: readonly number[], from: number, key: string): number | null => {
  const pos = enabledIndexes.indexOf(from);
  if (pos < 0 || enabledIndexes.length === 0) return null;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return enabledIndexes[(pos + 1) % enabledIndexes.length];
    case 'ArrowLeft':
    case 'ArrowUp':
      return enabledIndexes[(pos - 1 + enabledIndexes.length) % enabledIndexes.length];
    case 'Home':
      return enabledIndexes[0];
    case 'End':
      return enabledIndexes[enabledIndexes.length - 1];
    default:
      return null;
  }
};

export interface ChipOption<T extends string | number> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface ChipGroupProps<T extends string | number> {
  options: ReadonlyArray<ChipOption<T>>;
  value: T;
  onChange: (value: T) => void;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  className?: string;
}

/**
 * Radio group of chips with roving tabindex and arrow-key navigation (see getNextChipIndex).
 */
export function ChipGroup<T extends string | number>({
  options,
  value,
  onChange,
  className,
  ...aria
}: ChipGroupProps<T>): React.ReactElement {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
  const selectedIndex = options.findIndex((o) => o.value === value);
  const tabbableIndex = selectedIndex >= 0 && !options[selectedIndex].disabled ? selectedIndex : enabled[0];

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = getNextChipIndex(enabled, index, event.key);
    if (next === null) return;
    event.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" className={clsx('flex flex-wrap gap-2', className)} {...aria}>
      {options.map((option, index) => (
        <Chip
          key={String(option.value)}
          ref={(node) => {
            refs.current[index] = node;
          }}
          selected={option.value === value}
          disabled={option.disabled}
          tabIndex={index === tabbableIndex ? 0 : -1}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => handleKeyDown(event, index)}
        >
          {option.label}
        </Chip>
      ))}
    </div>
  );
}
