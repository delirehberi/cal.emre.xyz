import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useTranslation } from '../../i18n';
import { ShieldAlert, Copy, Check } from 'lucide-react';

export interface GuestKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  npub: string;
  nsec: string;
}

export const GuestKeyModal: React.FC<GuestKeyModalProps> = ({
  isOpen,
  onClose,
  npub,
  nsec,
}) => {
  const { t } = useTranslation();
  const [copiedField, setCopiedField] = useState<'npub' | 'nsec' | null>(null);

  const handleCopy = async (field: 'npub' | 'nsec', text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('auth.guestKeyModal.title')}
      description={t('auth.guestKeyModal.description')}
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Warning Banner */}
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <p className="leading-relaxed">{t('auth.guestKeyModal.warning')}</p>
        </div>

        {/* Public Key (npub) */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
            {t('auth.guestKeyModal.npubLabel')}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={npub}
              className="block w-full truncate rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-mono text-stone-700 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-300 select-all"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleCopy('npub', npub)}
              leftIcon={
                copiedField === 'npub' ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )
              }
            >
              {copiedField === 'npub' ? t('common.copied') : t('common.copy')}
            </Button>
          </div>
        </div>

        {/* Secret Key (nsec) */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
            {t('auth.guestKeyModal.nsecLabel')}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={nsec}
              className="block w-full truncate rounded-lg border border-amber-300 bg-amber-50/50 px-3 py-2 text-xs font-mono text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300 select-all"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleCopy('nsec', nsec)}
              leftIcon={
                copiedField === 'nsec' ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )
              }
            >
              {copiedField === 'nsec' ? t('common.copied') : t('common.copy')}
            </Button>
          </div>
        </div>

        <div className="pt-2">
          <Button variant="primary" className="w-full" onClick={onClose}>
            {t('auth.guestKeyModal.doneButton')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
