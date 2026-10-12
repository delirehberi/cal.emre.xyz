import React, { useState } from 'react';
import { CheckCircle2, XCircle, Radio } from 'lucide-react';
import { Button } from './Button';
import { useTranslation } from '../../i18n';
import { cn } from '../../lib/cn';
import type { PublishResult } from '../../lib/nostr/relays';
import type { RelaySource } from '../../lib/nostr/nip65';

export interface RelayReportProps {
  results: PublishResult[];
  /** Re-publishes the event; when omitted no broadcast button is rendered. */
  onBroadcast?: (extraRelay?: string) => Promise<PublishResult[]>;
  /** Shows an optional input for one extra relay URL used by the broadcast. */
  allowExtraRelay?: boolean;
  defaultOpen?: boolean;
}

const SOURCE_LABEL_KEYS: Record<RelaySource, string> = {
  host: 'relayReport.sourceHost',
  creator: 'relayReport.sourceCreator',
  attendee: 'relayReport.sourceAttendee',
  extra: 'relayReport.sourceExtra',
  default: 'relayReport.sourceDefault',
};

type BroadcastState = 'idle' | 'running' | 'done' | 'failed';

export const RelayReport: React.FC<RelayReportProps> = ({
  results,
  onBroadcast,
  allowExtraRelay = false,
  defaultOpen = false,
}) => {
  const { t } = useTranslation();
  const [current, setCurrent] = useState<PublishResult[]>(results);
  const [extraRelay, setExtraRelay] = useState('');
  const [state, setState] = useState<BroadcastState>('idle');

  const accepted = current.filter((r) => r.success).length;
  const allFailed = current.length > 0 && accepted === 0;

  const handleBroadcast = async () => {
    if (!onBroadcast) return;
    setState('running');
    try {
      const next = await onBroadcast(extraRelay.trim() || undefined);
      setCurrent(next);
      setState('done');
    } catch (err) {
      console.error('Broadcast failed', err);
      setState('failed');
    }
  };

  return (
    <details
      open={defaultOpen || allFailed}
      className="rounded-button border border-line bg-paper p-3 font-sans text-caption leading-ui"
    >
      <summary className="flex cursor-pointer items-center gap-2 rounded-control font-semibold text-ink">
        <Radio aria-hidden="true" className="h-4 w-4 text-muted" />
        <span>{t('relayReport.title')}</span>
        {current.length > 0 && (
          <span
            className={cn('ml-auto font-normal', allFailed ? 'font-semibold text-ink' : 'text-muted')}
          >
            {t('relayReport.summary', { accepted, total: current.length })}
          </span>
        )}
      </summary>

      <div className="mt-3 space-y-3">
        {allFailed && (
          <p className="font-semibold text-ink" role="alert">
            {t('relayReport.allFailed')}
          </p>
        )}

        <ul className="space-y-1.5">
          {current.map((result) => (
            <li key={result.relay} className="flex items-start gap-2">
              {result.success ? (
                <CheckCircle2
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink"
                  aria-label={t('relayReport.accepted')}
                />
              ) : (
                <XCircle
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted"
                  aria-label={t('relayReport.failed')}
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-small break-all text-ink">
                    {result.relay}
                  </span>
                  {result.sources?.map((source) => (
                    <span
                      key={source}
                      className="rounded-control bg-line px-1.5 font-mono text-micro font-medium text-ink uppercase"
                    >
                      {t(SOURCE_LABEL_KEYS[source])}
                    </span>
                  ))}
                </div>
                {!result.success && result.error && (
                  <div className="font-sans text-small text-muted">{result.error}</div>
                )}
              </div>
            </li>
          ))}
        </ul>

        {onBroadcast && (
          <div className="space-y-2">
            {allowExtraRelay && (
              <label className="block space-y-1">
                <span className="font-sans text-small leading-ui font-medium text-muted">
                  {t('relayReport.extraRelayLabel')}
                </span>
                <input
                  type="text"
                  value={extraRelay}
                  onChange={(e) => setExtraRelay(e.target.value)}
                  placeholder={t('relayReport.extraRelayPlaceholder')}
                  disabled={state === 'running'}
                  className="block w-full rounded-field border border-line bg-card px-3 py-2 font-mono text-caption leading-ui text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                />
              </label>
            )}
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleBroadcast}
                isLoading={state === 'running'}
                leftIcon={<Radio aria-hidden="true" className="h-3.5 w-3.5" />}
              >
                {state === 'running' ? t('relayReport.broadcasting') : t('relayReport.broadcast')}
              </Button>
              {state === 'done' && (
                <span className="font-semibold text-ink">{t('relayReport.broadcastDone')}</span>
              )}
              {state === 'failed' && (
                <span className="font-semibold text-ink" role="alert">
                  {t('relayReport.broadcastFailed')}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </details>
  );
};
