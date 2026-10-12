import React from 'react';
import { Check, Code2, KeyRound, Server } from 'lucide-react';
import { useTranslation } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { CodeCard, type CodeLine } from '../components/about/CodeCard';
import { APP_CONFIG } from '../../config';

const EYEBROW = 'font-mono text-label leading-ui font-medium text-muted uppercase';
const PRIMARY_LINK =
  'inline-flex items-center justify-center rounded-button border border-transparent bg-ink px-5 py-3 font-sans text-body leading-ui font-semibold whitespace-nowrap text-paper transition-opacity hover:opacity-90';
const SECONDARY_LINK =
  'inline-flex items-center justify-center rounded-button border border-line bg-card px-5 py-3 font-sans text-body leading-ui font-semibold whitespace-nowrap text-ink transition-colors hover:border-muted';

/** lucide-react ships no brand icons, so the GitHub mark is inlined. */
const GithubMark: React.FC<{ className?: string }> = ({ className }) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
  </svg>
);

const Pill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <li className="inline-flex items-center gap-1.5 rounded-full bg-slot-soft py-1.5 pr-3 pl-2.5 font-sans text-small leading-ui font-semibold text-ink">
    <Check aria-hidden="true" className="h-[13px] w-[13px] shrink-0" />
    {children}
  </li>
);

const UrlBox: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex w-full flex-col gap-1.5">
    <p className="font-sans text-small leading-ui font-medium text-muted">{label}</p>
    <p className="overflow-x-auto rounded-button border border-line bg-paper px-3.5 py-3 font-mono text-eyebrow leading-ui font-medium whitespace-nowrap text-ink tablet:text-caption">
      {value}
    </p>
  </div>
);

const Pillar: React.FC<{ icon: React.ReactNode; title: string; text: string }> = ({ icon, title, text }) => (
  <li className="flex flex-col gap-3 rounded-card border border-line bg-card p-5 tablet:p-7">
    <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-button bg-slot-soft text-ink">
      {icon}
    </span>
    <h3 className="font-display text-heading-m font-bold text-ink">{title}</h3>
    <p className="font-sans text-body leading-[22px] text-muted">{text}</p>
  </li>
);

const Step: React.FC<{ number: number; title: string; text: string }> = ({ number, title, text }) => (
  <li className="flex flex-col gap-3 rounded-card border border-line bg-card p-5 tablet:p-7">
    <span
      aria-hidden="true"
      className="flex h-7 w-7 items-center justify-center rounded-full bg-ink font-mono text-caption leading-ui font-medium text-paper"
    >
      {number}
    </span>
    <h3 className="font-display text-heading-m font-bold text-ink">{title}</h3>
    <p className="font-sans text-body leading-[22px] text-muted">{text}</p>
  </li>
);

/** The /#/about page: what Kün is, how to use it, and how to host your own. */
export const AboutPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, isLoggedIn } = useAuth();

  const host = window.location.host;
  const exampleNip05 = `${host}/#/${APP_CONFIG.defaultHostNip05}`;
  const ownPageHref = isLoggedIn && user ? `#/${user.nip05 || user.npub}` : '#/dashboard';

  const codeLines: CodeLine[] = [
    [{ text: `git clone ${APP_CONFIG.repoUrl.replace('https://', '')}` }],
    [{ text: 'cd cal.emre.xyz && cp .env.example .env' }],
    [{ text: t('about.selfHost.commentFill'), tone: 'comment' }],
    [{ text: 'DEFAULT_HOST_NIP05=' }, { text: 'you@example.com', tone: 'value' }],
    [{ text: 'DEFAULT_HOST_PUBKEY=' }, { text: '<hex public key>', tone: 'value' }],
    [{ text: t('about.selfHost.commentDeploy'), tone: 'comment' }],
    [{ text: 'make install && make deploy' }],
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-12 px-4 pt-8 pb-12 tablet:gap-24 tablet:px-8 tablet:pt-20 tablet:pb-28 desktop:px-20">
      <section className="flex flex-col gap-7 desktop:flex-row desktop:items-center desktop:gap-16">
        <div className="flex min-w-0 flex-1 flex-col gap-4 tablet:gap-6">
          <p className={`${EYEBROW} whitespace-pre`}>
            {t('about.eyebrowOpenSource')}
            {'  ·  '}
            {t('about.eyebrowSelfHost')}
          </p>
          <h1 className="font-display text-display-l leading-[1.05] font-extrabold text-ink tablet:text-display-m tablet:leading-[1.19] desktop:text-display-xl desktop:leading-[78px]">
            <span className="tablet:block">{t('about.titleLine1')} </span>
            <span className="tablet:block">{t('about.titleLine2')}</span>
          </h1>
          <p className="font-sans text-prose text-muted tablet:text-lead-l">{t('about.lead')}</p>
          <div className="flex flex-wrap gap-2.5">
            <a href={APP_CONFIG.repoUrl} target="_blank" rel="noopener noreferrer" className={PRIMARY_LINK}>
              {t('about.ctaGithub')}
            </a>
            <a href={ownPageHref} className={SECONDARY_LINK}>
              {t('about.ctaOwnPage')}
            </a>
          </div>
        </div>

        <section
          aria-labelledby="about-example-title"
          className="flex w-full flex-col gap-4 rounded-card border border-line bg-card p-5 tablet:p-7 desktop:w-[500px] desktop:shrink-0"
        >
          <p className={EYEBROW}>{t('about.example.eyebrow')}</p>
          <h2 id="about-example-title" className="font-display text-heading-m font-bold text-ink">
            {t('about.example.title')}
          </h2>
          <UrlBox label={t('about.example.nip05')} value={exampleNip05} />
          <UrlBox label={t('about.example.npub')} value={`${host}/#/npub1…`} />
          <ul className="flex flex-wrap gap-2">
            <Pill>{t('about.example.noAccount')}</Pill>
            <Pill>{t('about.example.noMiddleman')}</Pill>
            <Pill>{t('about.example.dataOnRelays')}</Pill>
          </ul>
        </section>
      </section>

      <section aria-label={t('about.eyebrowOpenSource')}>
        <ul className="grid gap-3.5 tablet:grid-cols-3 tablet:gap-6">
          <Pillar
            icon={<Code2 className="h-[22px] w-[22px]" />}
            title={t('about.pillars.openSource.title')}
            text={t('about.pillars.openSource.text')}
          />
          <Pillar
            icon={<KeyRound className="h-[22px] w-[22px]" />}
            title={t('about.pillars.ownKey.title')}
            text={t('about.pillars.ownKey.text')}
          />
          <Pillar
            icon={<Server className="h-[22px] w-[22px]" />}
            title={t('about.pillars.selfHosted.title')}
            text={t('about.pillars.selfHosted.text')}
          />
        </ul>
      </section>

      <section aria-labelledby="about-steps-title" className="flex flex-col gap-7">
        <header className="flex flex-col gap-2.5">
          <p className={EYEBROW}>{t('about.steps.eyebrow')}</p>
          <h2 id="about-steps-title" className="font-display text-section font-extrabold text-ink tablet:text-display-l">
            <span className="tablet:hidden">{t('about.steps.titleShort')}</span>
            <span className="hidden tablet:inline">{t('about.steps.title')}</span>
          </h2>
        </header>
        <ol className="grid gap-3.5 tablet:grid-cols-3 tablet:gap-6">
          <Step number={1} title={t('about.steps.one.title')} text={t('about.steps.one.text', { example: `${host}/#/ad@alanadi.com` })} />
          <Step number={2} title={t('about.steps.two.title')} text={t('about.steps.two.text')} />
          <Step number={3} title={t('about.steps.three.title')} text={t('about.steps.three.text')} />
        </ol>
      </section>

      <section aria-labelledby="about-selfhost-title" className="flex flex-col gap-6 desktop:flex-row desktop:items-center desktop:gap-14">
        <div className="flex min-w-0 flex-1 flex-col gap-3.5">
          <p className={EYEBROW}>{t('about.selfHost.eyebrow')}</p>
          <h2
            id="about-selfhost-title"
            className="font-display text-section font-extrabold text-ink tablet:text-display-l tablet:leading-[48px]"
          >
            <span className="tablet:hidden">{t('about.selfHost.titleShort')}</span>
            <span className="hidden tablet:inline">
              <span className="block">{t('about.selfHost.titleLine1')}</span>
              <span className="block">{t('about.selfHost.titleLine2')}</span>
            </span>
          </h2>
          <p className="font-sans text-prose text-muted">{t('about.selfHost.text')}</p>
          <a
            href={APP_CONFIG.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('about.selfHost.repoLabel')}
            className="inline-flex items-center gap-2 self-start rounded-control font-mono text-small leading-ui font-medium text-ink hover:underline tablet:text-caption"
          >
            <GithubMark className="h-[18px] w-[18px]" />
            {APP_CONFIG.repoUrl.replace('https://', '')}
          </a>
        </div>
        <CodeCard
          lines={codeLines}
          label={t('about.selfHost.codeLabel')}
          copyLabel={t('about.selfHost.copy')}
          copiedLabel={t('about.selfHost.copied')}
          className="w-full desktop:w-[560px] desktop:shrink-0"
        />
      </section>

      <section
        aria-labelledby="about-contribute-title"
        className="flex flex-col gap-[18px] rounded-panel border border-slot bg-slot-soft px-5 py-6 tablet:flex-row tablet:items-center tablet:gap-8 tablet:px-12 tablet:py-11"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h2 id="about-contribute-title" className="font-display text-cta font-extrabold text-ink tablet:text-display-s">
            {t('about.contribute.title')}
          </h2>
          <p className="font-sans text-body leading-[22px] text-muted">
            {t('about.contribute.text')}{' '}
            <a
              href={`${APP_CONFIG.repoUrl}/issues`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-ink underline underline-offset-2"
            >
              {t('about.contribute.issues')}
            </a>
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <a href={APP_CONFIG.repoUrl} target="_blank" rel="noopener noreferrer" className={PRIMARY_LINK}>
            {t('about.contribute.star')}
          </a>
          <a
            href={`lightning:${APP_CONFIG.lightningAddress}`}
            aria-label={t('about.contribute.supportLabel')}
            className={SECONDARY_LINK}
          >
            {t('about.contribute.support')}
          </a>
        </div>
      </section>
    </div>
  );
};
