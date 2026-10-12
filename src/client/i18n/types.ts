/**
 * Internationalization (i18n) Type Definitions
 */

export type Locale = 'en' | 'tr';

export interface TranslationDictionary {
  common: {
    loading: string;
    error: string;
    retry: string;
    save: string;
    cancel: string;
    close: string;
    copy: string;
    copied: string;
    back: string;
    next: string;
    confirm: string;
    minutes: string;
    hours: string;
    days: string;
    status: string;
    actions: string;
  };
  header: {
    homeAria: string;
    home: string;
    about: string;
    dashboard: string;
    support: string;
    login: string;
    logout: string;
    copyNpub: string;
    themeLight: string;
    themeDark: string;
    language: string;
    primaryNav: string;
    userMenu: string;
    openMenu: string;
    closeMenu: string;
  };
  booking: {
    hostCard: {
      verifiedBadge: string;
      timezone: string;
      viewProfile: string;
      defaultBio: string;
    };
    durationPicker: {
      title: string;
      minutesOption: string;
    };
    datePicker: {
      title: string;
      today: string;
      previousMonth: string;
      nextMonth: string;
      noAvailableSlots: string;
    };
    timeSlotGrid: {
      title: string;
      timezoneNotice: string;
      changeTimezone: string;
      selectPrompt: string;
      noSlotsForDate: string;
      busySlotTooltip: string;
    };
    form: {
      title: string;
      nameLabel: string;
      namePlaceholder: string;
      emailLabel: string;
      emailPlaceholder: string;
      emailHint: string;
      notesLabel: string;
      notesPlaceholder: string;
      submitButton: string;
      submitting: string;
      guestNotice: string;
    };
    nostrBanner: {
      title: string;
      description: string;
      learnMore: string;
    };
    success: {
      title: string;
      subtitle: string;
      addToGoogle: string;
      addToApple: string;
      addToOutlook: string;
      downloadIcs: string;
      eventNaddr: string;
      copyNaddr: string;
      guestKeyWarningTitle: string;
      guestKeyWarningText: string;
      copySecretKey: string;
      bookAnother: string;
    };
  };
  auth: {
    loginModalTitle: string;
    loginModalSubtitle: string;
    tabsLabel: string;
    tabs: {
      extension: string;
      bunker: string;
      key: string;
    };
    methods: {
      extension: {
        title: string;
        description: string;
        button: string;
      };
      bunker: {
        title: string;
        description: string;
        label: string;
        placeholder: string;
        button: string;
      };
      nsec: {
        title: string;
        description: string;
        label: string;
        placeholder: string;
        button: string;
        generate: string;
        generatedNote: string;
        show: string;
        hide: string;
      };
    };
    guestKeyModal: {
      title: string;
      description: string;
      npubLabel: string;
      nsecLabel: string;
      warning: string;
      doneButton: string;
    };
  };
  dashboard: {
    title: string;
    subtitle: string;
    availabilityTab: string;
    appointmentsTab: string;
    shareLink: {
      title: string;
      description: string;
      copied: string;
    };
    unauthenticated: {
      title: string;
      description: string;
      loginButton: string;
    };
    workingHours: {
      title: string;
      startHour: string;
      endHour: string;
      workingDays: string;
      meetingDuration: string;
      timezone: string;
      bufferMinutes: string;
      locationOrLink: string;
      locationPlaceholder: string;
      saveButton: string;
      savedSuccess: string;
    };
    appointments: {
      upcomingTitle: string;
      pastTitle: string;
      noAppointments: string;
      noUpcoming: string;
      noPast: string;
      statusAccepted: string;
      statusTentative: string;
      statusDeclined: string;
      acceptAction: string;
      declineAction: string;
      cancelAction: string;
      joinMeeting: string;
      copyLink: string;
      updatingStatus: string;
      confirmCancelTitle: string;
      confirmCancelText: string;
      encryptedBadge: string;
      decryptedBadge: string;
      decryptAction: string;
      decrypting: string;
      privateNotes: string;
      attendeeEmail: string;
    };
  };
  footer: {
    nostrBadge: string;
    linksLabel: string;
  };
  errors: {
    generic: string;
    invalidNip05: string;
    hostNotFound: string;
    relayPublishFailed: string;
    noRelaysConnected: string;
    signerNotFound: string;
    invalidNsec: string;
    invalidBunkerUri: string;
    slotUnavailable: string;
  };
}
