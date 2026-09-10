/**
 * Internationalization (i18n) Type Definitions
 */

export type Locale = 'en' | 'tr' | 'es';

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
  eventDetails: {
    title: string;
    notFound: string;
    notFoundDesc: string;
    hostedBy: string;
    dateAndTime: string;
    coHosts: string;
    attendees: string;
    agenda: string;
    privateNotice: string;
    rsvpGoing: string;
    rsvpMaybe: string;
    rsvpNotGoing: string;
    rsvpSubmitted: string;
    copyInviteLink: string;
    inviteCopied: string;
    downloadCalendar: string;
    shareWithOthers: string;
    publicBadge: string;
    privateBadge: string;
    decryptedBadge: string;
    participants: string;
    roleHost: string;
    roleAttendee: string;
    yourResponse: string;
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
    eyebrow: string;
    greeting: string;
    hostFallback: string;
    tabsLabel: string;
    availabilityTab: string;
    appointmentsTab: string;
    shareLink: {
      label: string;
      copy: string;
      copied: string;
      open: string;
    };
    stats: {
      upcoming: string;
      upcomingSub: string;
      pending: string;
      pendingSub: string;
      month: string;
      monthSubUp: string;
      monthSubDown: string;
      monthSubSame: string;
    };
    unauthenticated: {
      title: string;
      description: string;
      loginButton: string;
    };
    availability: {
      hoursTitle: string;
      hoursDescription: string;
      dayToggle: string;
      unavailable: string;
      startLabel: string;
      endLabel: string;
      durationsTitle: string;
      durationsLabel: string;
      durationsMinimum: string;
      settingsTitle: string;
      buffer: string;
      bufferOption: string;
      bufferNone: string;
      minNotice: string;
      noticeNone: string;
      noticeMinutes: string;
      noticeHours: string;
      noticeDays: string;
      save: string;
      saving: string;
      saved: string;
      savedLocalOnly: string;
      publishFailed: string;
      invalidHours: string;
      days: {
        sunday: string;
        monday: string;
        tuesday: string;
        wednesday: string;
        thursday: string;
        friday: string;
        saturday: string;
      };
    };
    appointments: {
      upcomingTitle: string;
      pastTitle: string;
      refresh: string;
      noUpcoming: string;
      noPast: string;
      noAppointments: string;
      loadFailed: string;
      statusAccepted: string;
      statusPending: string;
      statusDeclined: string;
      statusCancelled: string;
      encrypted: string;
      acceptAction: string;
      declineAction: string;
      cancelAction: string;
      copyLink: string;
      linkCopied: string;
      invite: string;
      inviteCopied: string;
      downloadIcs: string;
      joinMeeting: string;
      decryptAction: string;
      decrypting: string;
      defaultTitle: string;
      timeLine: string;
      confirmCancelTitle: string;
      confirmCancelText: string;
      keepMeeting: string;
      privateNotes: string;
      attendeeEmail: string;
      filtersLabel: string;
      filterAll: string;
      filterHosted: string;
      filterAttending: string;
    };
  };
  about: {
    eyebrowOpenSource: string;
    eyebrowSelfHost: string;
    titleLine1: string;
    titleLine2: string;
    lead: string;
    ctaGithub: string;
    ctaOwnPage: string;
    example: {
      eyebrow: string;
      title: string;
      nip05: string;
      npub: string;
      noAccount: string;
      noMiddleman: string;
      dataOnRelays: string;
    };
    pillars: {
      openSource: { title: string; text: string };
      ownKey: { title: string; text: string };
      selfHosted: { title: string; text: string };
    };
    steps: {
      eyebrow: string;
      title: string;
      titleShort: string;
      one: { title: string; text: string };
      two: { title: string; text: string };
      three: { title: string; text: string };
    };
    selfHost: {
      eyebrow: string;
      titleLine1: string;
      titleLine2: string;
      titleShort: string;
      text: string;
      repoLabel: string;
      codeLabel: string;
      commentFill: string;
      commentDeploy: string;
      copy: string;
      copied: string;
    };
    contribute: {
      title: string;
      text: string;
      issues: string;
      star: string;
      support: string;
      supportLabel: string;
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
