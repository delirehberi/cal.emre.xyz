import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, Check, Copy, Eye, EyeOff, Key, Radio, ShieldCheck } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Tabs, getPanelId, getTabId, type TabItem } from '../ui/Tabs';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import { generateGuestKeyPair } from '../../lib/nostr/keys';

export interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export type LoginTab = 'extension' | 'bunker' | 'nsec';

const TAB_ICON = 'h-[15px] w-[15px] shrink-0';

interface MethodIntroProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const MethodIntro: React.FC<MethodIntroProps> = ({ icon, title, description }) => (
  <div className="flex flex-col items-center gap-2.5 py-1 text-center">
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-line text-ink">{icon}</div>
    <h3 className="font-sans text-[16px] leading-ui font-semibold text-ink">{title}</h3>
    <p className="font-sans text-caption text-muted">{description}</p>
  </div>
);

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const { loginWithExtension, loginWithBunker, loginWithNsec, error, clearError } = useAuth();
  const idBase = useId();

  const [activeTab, setActiveTab] = useState<LoginTab>('extension');
  const [bunkerUri, setBunkerUri] = useState('');
  const [nsecInput, setNsecInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    []
  );

  const tabs: ReadonlyArray<TabItem<LoginTab>> = [
    { value: 'extension', label: t('auth.tabs.extension'), icon: <ShieldCheck aria-hidden="true" className={TAB_ICON} /> },
    { value: 'bunker', label: t('auth.tabs.bunker'), icon: <Radio aria-hidden="true" className={TAB_ICON} /> },
    { value: 'nsec', label: t('auth.tabs.key'), icon: <Key aria-hidden="true" className={TAB_ICON} /> },
  ];

  const resetSecrets = () => {
    setNsecInput('');
    setBunkerUri('');
    setShowKey(false);
    setGenerated(false);
    setCopied(false);
  };

  const handleClose = () => {
    clearError();
    setFormError(null);
    resetSecrets();
    onClose();
  };

  const selectTab = (tab: LoginTab) => {
    setActiveTab(tab);
    setFormError(null);
    clearError();
  };

  const run = async (login: () => Promise<void>) => {
    setIsLoading(true);
    setFormError(null);
    try {
      await login();
      onSuccess?.();
      handleClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleBunkerLogin = (event: React.FormEvent) => {
    event.preventDefault();
    const uri = bunkerUri.trim();
    if (uri) void run(() => loginWithBunker(uri));
  };

  const handleNsecLogin = (event: React.FormEvent) => {
    event.preventDefault();
    const key = nsecInput.trim();
    if (key) void run(() => loginWithNsec(key));
  };

  const handleGenerate = () => {
    const { nsec } = generateGuestKeyPair();
    setNsecInput(nsec);
    setShowKey(true);
    setGenerated(true);
    setCopied(false);
    setFormError(null);
  };

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(nsecInput);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const displayError = formError || error;
  const panelProps = (tab: LoginTab) => ({
    role: 'tabpanel' as const,
    id: getPanelId(idBase, tab),
    'aria-labelledby': getTabId(idBase, tab),
    className: 'flex flex-col gap-5',
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('auth.loginModalTitle')}
      description={t('auth.loginModalSubtitle')}
      maxWidth="md"
    >
      <div className="flex flex-col gap-5">
        <Tabs items={tabs} value={activeTab} onChange={selectTab} label={t('auth.tabsLabel')} idBase={idBase} />

        {displayError && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-button border border-ink bg-paper p-3 font-sans text-caption leading-ui font-semibold text-ink"
          >
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{displayError}</span>
          </p>
        )}

        {activeTab === 'extension' && (
          <div {...panelProps('extension')}>
            <MethodIntro
              icon={<ShieldCheck aria-hidden="true" className="h-[22px] w-[22px]" />}
              title={t('auth.methods.extension.title')}
              description={t('auth.methods.extension.description')}
            />
            <Button className="w-full" isLoading={isLoading} onClick={() => void run(loginWithExtension)}>
              {t('auth.methods.extension.button')}
            </Button>
          </div>
        )}

        {activeTab === 'bunker' && (
          <form {...panelProps('bunker')} onSubmit={handleBunkerLogin}>
            <MethodIntro
              icon={<Radio aria-hidden="true" className="h-[22px] w-[22px]" />}
              title={t('auth.methods.bunker.title')}
              description={t('auth.methods.bunker.description')}
            />
            <Input
              label={t('auth.methods.bunker.label')}
              value={bunkerUri}
              onChange={(event) => setBunkerUri(event.target.value)}
              placeholder={t('auth.methods.bunker.placeholder')}
              disabled={isLoading}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="font-mono"
            />
            <Button type="submit" className="w-full" isLoading={isLoading} disabled={!bunkerUri.trim()}>
              {t('auth.methods.bunker.button')}
            </Button>
          </form>
        )}

        {activeTab === 'nsec' && (
          <form {...panelProps('nsec')} onSubmit={handleNsecLogin}>
            <MethodIntro
              icon={<Key aria-hidden="true" className="h-[22px] w-[22px]" />}
              title={t('auth.methods.nsec.title')}
              description={t('auth.methods.nsec.description')}
            />
            <Input
              label={t('auth.methods.nsec.label')}
              type={showKey ? 'text' : 'password'}
              value={nsecInput}
              onChange={(event) => {
                setNsecInput(event.target.value);
                setGenerated(false);
              }}
              placeholder={t('auth.methods.nsec.placeholder')}
              helperText={generated ? t('auth.methods.nsec.generatedNote') : undefined}
              disabled={isLoading}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="pr-10 font-mono"
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowKey((value) => !value)}
                  aria-label={showKey ? t('auth.methods.nsec.hide') : t('auth.methods.nsec.show')}
                  aria-pressed={showKey}
                  className="cursor-pointer rounded-control p-1 text-muted transition-colors hover:text-ink"
                >
                  {showKey ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
                </button>
              }
            />
            {generated && (
              <Button
                variant="secondary"
                size="sm"
                className="self-start"
                onClick={() => void handleCopyKey()}
                leftIcon={
                  copied ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                }
              >
                {copied ? t('common.copied') : t('common.copy')}
              </Button>
            )}
            <Button type="submit" className="w-full" isLoading={isLoading} disabled={!nsecInput.trim()}>
              {t('auth.methods.nsec.button')}
            </Button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isLoading}
              className="mx-auto cursor-pointer rounded-control font-sans text-caption leading-ui font-semibold text-ink hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('auth.methods.nsec.generate')}
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
};
