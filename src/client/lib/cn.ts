import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * Merge helper that knows the Kün type scale and line-height tokens.
 * Without it tailwind-merge reads `text-body` as a colour and drops it next to `text-ink`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'display-xl',
            'display-m',
            'display-s',
            'display-l',
            'display-ml',
            'stat',
            'date',
            'card-title',
            'eyebrow',
            'heading-xl',
            'heading-l',
            'heading-s',
            'heading-xs',
            'heading-m',
            'lead',
            'body-l',
            'body',
            'ui',
            'caption',
            'small',
            'label',
            'micro',
          ],
        },
      ],
      leading: [{ leading: ['ui'] }],
      rounded: [{ rounded: ['control', 'button', 'tab', 'field', 'card', 'panel', 'hero'] }],
    },
  },
});

export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
