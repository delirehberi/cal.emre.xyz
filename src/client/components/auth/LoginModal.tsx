import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import { Key, ShieldCheck, Radio, AlertCircle } from 'lucide-react';

export interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type TabType = 'extension' | 'bunker' | 'nsec';

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const { loginWithExtension, loginWithBunker, loginWithNsec, error, clearError } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('extension');
  const [bunkerUri, setBunkerUri] = useState('');
  const [nsecInput, setNsecInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleClose = () => {
    clearError();
    setFormError(null);
    onClose();
  };

  const handleExtensionLogin = async () => {
    setIsLoading(true);
    setFormError(null);
    try {
      await loginWithExtension();
      onSuccess?.();
      handleClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleBunkerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bunkerUri.trim()) return;

    setIsLoading(true);
    setFormError(null);
    try {
      await loginWithBunker(bunkerUri.trim());
      onSuccess?.();
      handleClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleNsecLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nsecInput.trim()) return;

    setIsLoading(true);
    setFormError(null);
    try {
      await loginWithNsec(nsecInput.trim());
      onSuccess?.();
      handleClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const displayError = formError || error;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('auth.loginModalTitle')}
      description={t('auth.loginModalSubtitle')}
      maxWidth="md"
    >
      {/* Tab Navigation */}
      <div className="flex rounded-lg border border-stone-200 bg-stone-100/70 p-1 dark:border-stone-800 dark:bg-stone-950 mb-5">
        <button
          type="button"
          onClick={() => {
            setActiveTab('extension');
            setFormError(null);
          }}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors cursor-pointer ${
            activeTab === 'extension'
              ? 'bg-white text-stone-900 shadow-xs dark:bg-stone-800 dark:text-stone-50'
              : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Extension</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('bunker');
            setFormError(null);
          }}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors cursor-pointer ${
            activeTab === 'bunker'
              ? 'bg-white text-stone-900 shadow-xs dark:bg-stone-800 dark:text-stone-50'
              : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200'
          }`}
        >
          <Radio className="h-3.5 w-3.5" />
          <span>Bunker</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('nsec');
            setFormError(null);
          }}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors cursor-pointer ${
            activeTab === 'nsec'
              ? 'bg-white text-stone-900 shadow-xs dark:bg-stone-800 dark:text-stone-50'
              : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200'
          }`}
        >
          <Key className="h-3.5 w-3.5" />
          <span>Key</span>
        </button>
      </div>

      {displayError && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-900/50">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{displayError}</span>
        </div>
      )}

      {/* Tab 1: Extension (NIP-07) */}
      {activeTab === 'extension' && (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              {t('auth.methods.extension.title')}
            </h3>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              {t('auth.methods.extension.description')}
            </p>
          </div>
          <Button
            variant="primary"
            className="w-full"
            isLoading={isLoading}
            onClick={handleExtensionLogin}
          >
            {t('auth.methods.extension.button')}
          </Button>
        </div>
      )}

      {/* Tab 2: Nostr Connect (NIP-46 Bunker) */}
      {activeTab === 'bunker' && (
        <form onSubmit={handleBunkerLogin} className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              {t('auth.methods.bunker.title')}
            </h3>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              {t('auth.methods.bunker.description')}
            </p>
          </div>
          <Input
            value={bunkerUri}
            onChange={(e) => setBunkerUri(e.target.value)}
            placeholder={t('auth.methods.bunker.placeholder')}
            disabled={isLoading}
            autoFocus
          />
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            isLoading={isLoading}
            disabled={!bunkerUri.trim()}
          >
            {t('auth.methods.bunker.button')}
          </Button>
        </form>
      )}

      {/* Tab 3: Secret Key (nsec) */}
      {activeTab === 'nsec' && (
        <form onSubmit={handleNsecLogin} className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              {t('auth.methods.nsec.title')}
            </h3>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              {t('auth.methods.nsec.description')}
            </p>
          </div>
          <Input
            type="password"
            value={nsecInput}
            onChange={(e) => setNsecInput(e.target.value)}
            placeholder={t('auth.methods.nsec.placeholder')}
            disabled={isLoading}
            autoFocus
          />
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            isLoading={isLoading}
            disabled={!nsecInput.trim()}
          >
            {t('auth.methods.nsec.button')}
          </Button>
        </form>
      )}
    </Modal>
  );
};
