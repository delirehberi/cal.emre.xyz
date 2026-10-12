import React, { useState } from 'react';
import { useTranslation } from '../../i18n';
import { ChipGroup } from '../ui/Chip';
import { StepCard } from './StepCard';
import { cn } from '../../lib/cn';

export interface DurationPickerProps {
  durations: readonly number[];
  /** Offered behind the "longer…" chip. */
  extendedDurations?: readonly number[];
  selectedDuration: number;
  onSelectDuration: (durationMinutes: number) => void;
}

/** Step 1: how long the meeting lasts. */
export const DurationPicker: React.FC<DurationPickerProps> = ({
  durations,
  extendedDurations = [],
  selectedDuration,
  onSelectDuration,
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  // A chosen extended length must stay visible even if the list was collapsed.
  const showExtended = expanded || extendedDurations.includes(selectedDuration);

  const options = (showExtended ? [...durations, ...extendedDurations] : [...durations]).map((minutes) => ({
    value: minutes,
    label: t('booking.duration.minutes', { minutes }),
  }));

  return (
    <StepCard step={1} title={t('booking.steps.duration')}>
      <div className="flex flex-wrap gap-2">
        <ChipGroup
          className="contents"
          aria-label={t('booking.duration.groupLabel')}
          options={options}
          value={selectedDuration}
          onChange={onSelectDuration}
        />
        {extendedDurations.length > 0 && (
          <button
            type="button"
            aria-expanded={showExtended}
            onClick={() => setExpanded(!showExtended)}
            disabled={extendedDurations.includes(selectedDuration) && showExtended}
            className={cn(
              'inline-flex cursor-pointer items-center justify-center rounded-full border border-line bg-card px-[18px] py-2.5 font-sans text-body leading-ui font-medium whitespace-nowrap text-ink transition-colors hover:border-muted disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            {showExtended ? t('booking.duration.fewer') : t('booking.duration.longer')}
          </button>
        )}
      </div>
    </StepCard>
  );
};
