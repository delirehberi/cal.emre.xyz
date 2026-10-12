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
    intro: {
      eyebrow: string;
      title: string;
      subtitle: string;
    };
    hostCard: {
      eyebrow: string;
      verifiedBadge: string;
      defaultBio: string;
    };
    steps: {
      duration: string;
      day: string;
      time: string;
      details: string;
    };
    duration: {
      groupLabel: string;
      minutes: string;
      longer: string;
      fewer: string;
    };
    datePicker: {
      previousMonth: string;
      nextMonth: string;
      legend: string;
      weekdays: string;
      dayAvailable: string;
      dayUnavailable: string;
    };
    timeSlots: {
      timezone: string;
      dayLine: string;
      slotsLabel: string;
      noSlots: string;
      folded: string;
      show: string;
      hide: string;
      unavailableLabel: string;
      busyTooltip: string;
    };
    form: {
      selectedTime: string;
      change: string;
      titleLabel: string;
      titlePlaceholder: string;
      titleFallback: string;
      nameLabel: string;
      emailLabel: string;
      emailPublicNote: string;
      notesLabel: string;
      notesPlaceholder: string;
      participantsLabel: string;
      participantsPlaceholder: string;
      participantsAdd: string;
      participantsRemove: string;
      participantsListLabel: string;
      participantInvalid: string;
      participantDuplicate: string;
      privacyLabel: string;
      encryptedTitle: string;
      encryptedHint: string;
      publicTitle: string;
      publicHint: string;
      submit: string;
      submitting: string;
      guestNote: string;
      learnMore: string;
    };
    stickyBar: {
      continue: string;
      summary: string;
      meta: string;
    };
    success: {
      addToCalendar: string;
      privateKeyLabel: string;
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
