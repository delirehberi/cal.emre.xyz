import React from 'react';
import { Clock } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { Card } from '../ui/Card';

export interface DurationPickerProps {
  durations: readonly number[];
  selectedDuration: number;
  onSelectDuration: (durationMinutes: number) => void;
}

export const DurationPicker: React.FC<DurationPickerProps> = ({
  durations,
  selectedDuration,
  onSelectDuration,
}) => {
  const { t } = useTranslation();

  return (
    <Card className="space-y-3 p-4!">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 dark:text-stone-300">
        <Clock className="h-4 w-4" />
        <span>{t('booking.durationPicker.title')}</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {durations.map((duration) => {
          const isSelected = selectedDuration === duration;
          return (
            <button
              key={duration}
              type="button"
              onClick={() => onSelectDuration(duration)}
              className={`flex flex-col items-center justify-center rounded-lg border py-2 px-3 text-center transition-all cursor-pointer ${
                isSelected
                  ? 'border-stone-900 bg-stone-900 text-stone-50 shadow-xs dark:border-stone-100 dark:bg-stone-100 dark:text-stone-900 font-semibold'
                  : 'border-stone-200 bg-stone-50 text-stone-700 hover:border-stone-300 hover:bg-stone-100 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-300 dark:hover:border-stone-700 dark:hover:bg-stone-800'
              }`}
            >
              <span className="text-sm">{duration}</span>
              <span className="text-[10px] opacity-75">{t('common.minutes')}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
};
