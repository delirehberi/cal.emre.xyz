import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useTranslation } from '../../i18n';
import {
  type WorkingHoursConfig,
  getHostWorkingHours,
  saveHostWorkingHours,
} from '../../lib/calendar/slots';
import { APP_CONFIG } from '../../../config';
import { Clock, Globe, MapPin, CheckCircle, ShieldCheck } from 'lucide-react';

export interface WorkingHoursFormProps {
  pubkey: string;
  onSaved?: (config: WorkingHoursConfig) => void;
}

const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/Istanbul',
  'Europe/Kyiv',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
];

const DAYS_OF_WEEK = [
  { day: 1, labelEn: 'Mon', labelTr: 'Pzt' },
  { day: 2, labelEn: 'Tue', labelTr: 'Sal' },
  { day: 3, labelEn: 'Wed', labelTr: 'Çar' },
  { day: 4, labelEn: 'Thu', labelTr: 'Per' },
  { day: 5, labelEn: 'Fri', labelTr: 'Cum' },
  { day: 6, labelEn: 'Sat', labelTr: 'Cmt' },
  { day: 0, labelEn: 'Sun', labelTr: 'Paz' },
];

export const WorkingHoursForm: React.FC<WorkingHoursFormProps> = ({ pubkey, onSaved }) => {
  const { t, locale } = useTranslation();

  const [config, setConfig] = useState<WorkingHoursConfig>(() => getHostWorkingHours(pubkey));
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setConfig(getHostWorkingHours(pubkey));
  }, [pubkey]);

  const handleDayToggle = (day: number) => {
    setConfig((prev) => {
      const exists = prev.workingDays.includes(day);
      const newDays = exists
        ? prev.workingDays.filter((d) => d !== day)
        : [...prev.workingDays, day].sort((a, b) => a - b);
      return { ...prev, workingDays: newDays };
    });
    setIsSaved(false);
  };

  const handleStartHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseInt(e.target.value, 10);
    setConfig((prev) => ({ ...prev, startHour: val }));
    setIsSaved(false);
  };

  const handleEndHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseInt(e.target.value, 10);
    setConfig((prev) => ({ ...prev, endHour: val }));
    setIsSaved(false);
  };

  const handleDurationChange = (duration: number) => {
    setConfig((prev) => ({ ...prev, defaultDuration: duration }));
    setIsSaved(false);
  };

  const handleTimezoneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setConfig((prev) => ({ ...prev, timezone: e.target.value }));
    setIsSaved(false);
  };

  const handleBufferChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseInt(e.target.value, 10);
    setConfig((prev) => ({ ...prev, bufferMinutes: val }));
    setIsSaved(false);
  };

  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig((prev) => ({ ...prev, location: e.target.value }));
    setIsSaved(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (config.workingDays.length === 0) {
      setError(locale === 'tr' ? 'En az bir çalışma günü seçmelisiniz.' : 'Please select at least one active working day.');
      return;
    }

    if (config.startHour >= config.endHour) {
      setError(
        locale === 'tr'
          ? 'Bitiş saati başlangıç saatinden sonra olmalıdır.'
          : 'End hour must be later than start hour.'
      );
      return;
    }

    saveHostWorkingHours(pubkey, config);
    setIsSaved(true);
    if (onSaved) {
      onSaved(config);
    }
  };

  // Ensure current timezone is in options
  const timezoneOptions = Array.from(new Set([config.timezone, ...COMMON_TIMEZONES])).filter(Boolean);

  return (
    <Card className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
          <Clock className="h-5 w-5 text-stone-700 dark:text-stone-300" />
          {t('dashboard.workingHours.title')}
        </h3>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
          {t('dashboard.subtitle')}
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Working Days Selector */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-400">
            {t('dashboard.workingHours.workingDays')}
          </label>
          <div className="flex flex-wrap gap-2">
            {DAYS_OF_WEEK.map(({ day, labelEn, labelTr }) => {
              const isSelected = config.workingDays.includes(day);
              const label = locale === 'tr' ? labelTr : labelEn;
              return (
                <button
                  type="button"
                  key={day}
                  onClick={() => handleDayToggle(day)}
                  className={`h-10 min-w-12 rounded-lg px-3 text-xs font-semibold transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-stone-900 border-stone-900 text-white shadow-xs dark:bg-stone-100 dark:border-stone-100 dark:text-stone-900'
                      : 'bg-white dark:bg-stone-950 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Start and End Hours */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
              {t('dashboard.workingHours.startHour')}
            </label>
            <select
              value={config.startHour}
              onChange={handleStartHourChange}
              className="block w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100 dark:focus:ring-stone-100"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {String(i).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
              {t('dashboard.workingHours.endHour')}
            </label>
            <select
              value={config.endHour}
              onChange={handleEndHourChange}
              className="block w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100 dark:focus:ring-stone-100"
            >
              {Array.from({ length: 24 }, (_, i) => i + 1).map((i) => (
                <option key={i} value={i}>
                  {String(i === 24 ? 0 : i).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Meeting Duration & Buffer Minutes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
              {t('dashboard.workingHours.meetingDuration')}
            </label>
            <div className="flex gap-2">
              {APP_CONFIG.allowedDurationsMinutes.map((dur) => (
                <button
                  type="button"
                  key={dur}
                  onClick={() => handleDurationChange(dur)}
                  className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors border cursor-pointer ${
                    (config.defaultDuration || 30) === dur
                      ? 'bg-stone-900 border-stone-900 text-white dark:bg-stone-100 dark:border-stone-100 dark:text-stone-900'
                      : 'bg-white dark:bg-stone-950 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800'
                  }`}
                >
                  {dur} {t('common.minutes')}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300">
              {t('dashboard.workingHours.bufferMinutes')}
            </label>
            <select
              value={config.bufferMinutes || 5}
              onChange={handleBufferChange}
              className="block w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100 dark:focus:ring-stone-100"
            >
              <option value={0}>0 {t('common.minutes')}</option>
              <option value={5}>5 {t('common.minutes')}</option>
              <option value={10}>10 {t('common.minutes')}</option>
              <option value={15}>15 {t('common.minutes')}</option>
              <option value={30}>30 {t('common.minutes')}</option>
            </select>
          </div>
        </div>

        {/* Timezone Selection */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-stone-400" />
            {t('dashboard.workingHours.timezone')}
          </label>
          <select
            value={config.timezone}
            onChange={handleTimezoneChange}
            className="block w-full rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100 dark:focus:ring-stone-100"
          >
            {timezoneOptions.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>

        {/* Meeting Location / Video Call Link */}
        <Input
          label={t('dashboard.workingHours.locationOrLink')}
          placeholder={t('dashboard.workingHours.locationPlaceholder')}
          value={config.location || ''}
          onChange={handleLocationChange}
          leftIcon={<MapPin className="h-4 w-4" />}
          helperText={
            locale === 'tr'
              ? 'Toplantı davetiyesi .ics dosyalarında ve randevu onayında otomatik olarak yer alır.'
              : 'Included in generated calendar events and invitation emails.'
          }
        />

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/50 dark:text-red-400">
            {error}
          </div>
        )}

        {isSaved && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span>{t('dashboard.workingHours.savedSuccess')}</span>
          </div>
        )}

        <div className="pt-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-stone-500 dark:text-stone-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>{locale === 'tr' ? 'Ayarlar tarayıcınızda güvenle saklanır' : 'Saved locally for your sovereign pubkey'}</span>
          </div>

          <Button type="submit" variant="primary">
            {t('dashboard.workingHours.saveButton')}
          </Button>
        </div>
      </form>
    </Card>
  );
};
