import React, { useEffect, useId, useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Select } from '../ui/Input';
import { Toggle } from '../ui/Toggle';
import { TimeField } from '../ui/TimeField';
import { TimezoneSelect } from '../booking/TimeSlotGrid';
import { useTranslation } from '../../i18n';
import {
  type DayHours,
  type WorkingHoursConfig,
  getHostWorkingHours,
  saveHostWorkingHours,
} from '../../lib/calendar/slots';
import { createAvailabilityEventTemplate } from '../../lib/nostr/availability';
import { nostrPool } from '../../lib/nostr/relays';
import type { NostrSigner } from '../../lib/nostr/signer';
import { APP_CONFIG } from '../../../config';
import { cn } from '../../lib/cn';

export interface WorkingHoursFormProps {
  pubkey: string;
  signer?: NostrSigner | null;
  onSaved?: (config: WorkingHoursConfig) => void;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'localOnly' | 'publishFailed';

/** Week order shown in the editor; values are JavaScript weekdays (0 = Sunday). */
const WEEK: ReadonlyArray<{ day: number; key: keyof DayKeys }> = [
  { day: 1, key: 'monday' },
  { day: 2, key: 'tuesday' },
  { day: 3, key: 'wednesday' },
  { day: 4, key: 'thursday' },
  { day: 5, key: 'friday' },
  { day: 6, key: 'saturday' },
  { day: 0, key: 'sunday' },
];

interface DayKeys {
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  sunday: string;
}

const BUFFER_OPTIONS = [0, 5, 10, 15, 30, 60];
const NOTICE_OPTIONS = [0, 60, 120, 240, 720, 1440, 2880, 10080];
const DEFAULT_NOTICE_MINUTES = 15;

const sortedUnique = (values: number[]): number[] => Array.from(new Set(values)).sort((a, b) => a - b);

/**
 * "Müsaitlik ve Çalışma Saatleri" tab: per-day hours, offered meeting lengths and booking rules.
 * Saving stores the settings on this device and publishes them to the host's relays (NIP-78),
 * which is where the public booking page reads them.
 */
export const WorkingHoursForm: React.FC<WorkingHoursFormProps> = ({ pubkey, signer = null, onSaved }) => {
  const { t } = useTranslation();
  const formId = useId();

  const [config, setConfig] = useState<WorkingHoursConfig>(() => getHostWorkingHours(pubkey));
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setConfig(getHostWorkingHours(pubkey));
    setSaveState('idle');
  }, [pubkey]);

  const update = (patch: Partial<WorkingHoursConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
    setSaveState('idle');
    setError(null);
  };

  const dayWindow = (day: number): DayHours =>
    config.dayHours?.[day] ?? { start: config.startHour * 60, end: config.endHour * 60 };

  const toggleDay = (day: number, on: boolean) => {
    update({
      workingDays: sortedUnique(on ? [...config.workingDays, day] : config.workingDays.filter((d) => d !== day)),
      dayHours: on ? { ...config.dayHours, [day]: dayWindow(day) } : config.dayHours,
    });
  };

  const setDayTime = (day: number, edge: 'start' | 'end', minutes: number) => {
    update({ dayHours: { ...config.dayHours, [day]: { ...dayWindow(day), [edge]: minutes } } });
  };

  const offeredDurations = config.durations ?? [...APP_CONFIG.allowedDurationsMinutes];
  const durationChoices = sortedUnique([
    ...APP_CONFIG.allowedDurationsMinutes,
    ...APP_CONFIG.extendedDurationsMinutes,
    ...APP_CONFIG.longDurationsMinutes,
    ...offeredDurations,
  ]);

  const toggleDuration = (minutes: number) => {
    const next = offeredDurations.includes(minutes)
      ? offeredDurations.filter((d) => d !== minutes)
      : [...offeredDurations, minutes];
    if (next.length === 0) {
      setError(t('dashboard.availability.durationsMinimum'));
      return;
    }
    const sorted = sortedUnique(next);
    update({
      durations: sorted,
      defaultDuration:
        config.defaultDuration && sorted.includes(config.defaultDuration)
          ? config.defaultDuration
          : sorted.includes(APP_CONFIG.defaultDurationMinutes)
            ? APP_CONFIG.defaultDurationMinutes
            : sorted[0],
    });
  };

  const noticeLabel = (minutes: number): string => {
    if (minutes === 0) return t('dashboard.availability.noticeNone');
    if (minutes % 1440 === 0) return t('dashboard.availability.noticeDays', { count: minutes / 1440 });
    if (minutes % 60 === 0) return t('dashboard.availability.noticeHours', { count: minutes / 60 });
    return t('dashboard.availability.noticeMinutes', { count: minutes });
  };

  const bufferLabel = (minutes: number): string =>
    minutes === 0
      ? t('dashboard.availability.bufferNone')
      : t('dashboard.availability.bufferOption', { minutes });

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const hasInvalidWindow = config.workingDays.some((day) => {
      const hours = dayWindow(day);
      return hours.end <= hours.start;
    });
    if (hasInvalidWindow || config.workingDays.length === 0) {
      setError(t('dashboard.availability.invalidHours'));
      return;
    }

    const toSave: WorkingHoursConfig = {
      ...config,
      durations: config.durations ?? [...APP_CONFIG.allowedDurationsMinutes],
      minNoticeMinutes: config.minNoticeMinutes ?? DEFAULT_NOTICE_MINUTES,
    };
    setConfig(toSave);
    saveHostWorkingHours(pubkey, toSave);
    onSaved?.(toSave);

    if (!signer) {
      setSaveState('localOnly');
      return;
    }

    setSaveState('saving');
    try {
      const relayList = await nostrPool.fetchHostRelays(pubkey).catch(() => null);
      const signed = await signer.signEvent(createAvailabilityEventTemplate(toSave));
      const results = await nostrPool.publishEvent(nostrPool.getBootstrapRelays(relayList?.write), signed);
      setSaveState(results.some((r) => r.success) ? 'saved' : 'publishFailed');
    } catch {
      setSaveState('publishFailed');
    }
  };

  const message =
    saveState === 'saved'
      ? t('dashboard.availability.saved')
      : saveState === 'localOnly'
        ? t('dashboard.availability.savedLocalOnly')
        : saveState === 'publishFailed'
          ? t('dashboard.availability.publishFailed')
          : null;

  return (
    <form
      id={formId}
      onSubmit={(event) => void handleSave(event)}
      className="grid gap-6 desktop:grid-cols-[minmax(0,1fr)_400px] desktop:items-start"
    >
      <Card className="p-5 tablet:p-7">
        <div className="flex flex-col gap-1 pb-4">
          <h2 className="font-display text-heading-m font-bold text-ink">{t('dashboard.availability.hoursTitle')}</h2>
          <p className="font-sans text-ui leading-ui text-muted">{t('dashboard.availability.hoursDescription')}</p>
        </div>

        <ul>
          {WEEK.map(({ day, key }) => {
            const dayName = t(`dashboard.availability.days.${key}`);
            const on = config.workingDays.includes(day);
            const hours = dayWindow(day);
            return (
              <li key={day} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line py-3.5">
                <Toggle
                  checked={on}
                  onChange={(checked) => toggleDay(day, checked)}
                  aria-label={t('dashboard.availability.dayToggle', { day: dayName })}
                />
                <span
                  className={cn(
                    'w-[130px] font-sans text-body leading-ui font-medium',
                    on ? 'text-ink' : 'text-muted'
                  )}
                >
                  {dayName}
                </span>
                {on ? (
                  <div className="flex items-center gap-3">
                    <TimeField
                      value={hours.start}
                      onChange={(minutes) => setDayTime(day, 'start', minutes)}
                      aria-label={t('dashboard.availability.startLabel', { day: dayName })}
                    />
                    <span aria-hidden="true" className="font-sans text-body leading-ui text-muted">
                      –
                    </span>
                    <TimeField
                      value={hours.end}
                      onChange={(minutes) => setDayTime(day, 'end', minutes)}
                      aria-label={t('dashboard.availability.endLabel', { day: dayName })}
                    />
                  </div>
                ) : (
                  <span className="font-sans text-ui leading-ui text-muted">{t('dashboard.availability.unavailable')}</span>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="flex flex-col gap-6">
        <Card className="flex flex-col gap-[18px] p-6 tablet:p-6 desktop:p-6">
          <h2 id={`${formId}-durations`} className="font-display text-heading-xs font-bold text-ink">
            {t('dashboard.availability.durationsTitle')}
          </h2>
          <div role="group" aria-labelledby={`${formId}-durations`} className="flex flex-wrap gap-2">
            {durationChoices.map((minutes) => {
              const selected = offeredDurations.includes(minutes);
              return (
                <button
                  key={minutes}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleDuration(minutes)}
                  className={cn(
                    'inline-flex cursor-pointer items-center justify-center rounded-full border px-[18px] py-2.5 font-sans text-body leading-ui font-medium whitespace-nowrap transition-colors',
                    selected ? 'border-ink bg-ink text-paper' : 'border-line bg-card text-ink hover:border-muted'
                  )}
                >
                  {t('booking.duration.minutes', { minutes })}
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="flex flex-col gap-[18px] p-6 tablet:p-6 desktop:p-6">
          <h2 className="font-display text-heading-xs font-bold text-ink">{t('dashboard.availability.settingsTitle')}</h2>

          <TimezoneSelect
            value={config.timezone}
            hostTimezone={config.timezone}
            onChange={(timezone) => update({ timezone })}
          />

          <Select
            label={t('dashboard.availability.buffer')}
            value={config.bufferMinutes ?? 0}
            onChange={(event) => update({ bufferMinutes: Number(event.target.value) })}
          >
            {sortedUnique([...BUFFER_OPTIONS, config.bufferMinutes ?? 0]).map((minutes) => (
              <option key={minutes} value={minutes}>
                {bufferLabel(minutes)}
              </option>
            ))}
          </Select>

          <Select
            label={t('dashboard.availability.minNotice')}
            value={config.minNoticeMinutes ?? DEFAULT_NOTICE_MINUTES}
            onChange={(event) => update({ minNoticeMinutes: Number(event.target.value) })}
          >
            {sortedUnique([...NOTICE_OPTIONS, config.minNoticeMinutes ?? DEFAULT_NOTICE_MINUTES]).map((minutes) => (
              <option key={minutes} value={minutes}>
                {noticeLabel(minutes)}
              </option>
            ))}
          </Select>

          <Button type="submit" size="md" className="w-full" isLoading={saveState === 'saving'}>
            {saveState === 'saving' ? t('dashboard.availability.saving') : t('dashboard.availability.save')}
          </Button>

          <div aria-live="polite" className="font-sans text-caption leading-ui font-semibold text-ink empty:hidden">
            {error ?? message}
          </div>
        </Card>
      </div>
    </form>
  );
};
