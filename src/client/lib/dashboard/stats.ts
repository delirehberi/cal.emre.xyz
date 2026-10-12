import type { HostAppointment } from '../nostr/relays';

export interface AppointmentStats {
  /** Appointments that have not ended yet and are still on the calendar. */
  upcoming: number;
  /** Upcoming appointments starting within the next seven days. */
  upcomingThisWeek: number;
  /** Upcoming appointments the host has not answered yet. */
  pending: number;
  /** Appointments starting in the current calendar month (host time zone). */
  thisMonth: number;
  /** This month minus last month. */
  monthDelta: number;
}

const DEFAULT_DURATION_SECONDS = 30 * 60;
const WEEK_SECONDS = 7 * 24 * 60 * 60;

export const getAppointmentEnd = (appointment: HostAppointment): number => {
  const { start, end } = appointment.event;
  return end && end > start ? end : start + DEFAULT_DURATION_SECONDS;
};

/** Cancelled and declined appointments no longer occupy the calendar. */
export const isActiveAppointment = (appointment: HostAppointment): boolean =>
  !appointment.isDeleted &&
  appointment.effectiveStatus !== 'canceled' &&
  appointment.effectiveStatus !== 'declined';

const monthIndex = (timestampSeconds: number, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric' }).formatToParts(
    new Date(timestampSeconds * 1000)
  );
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  return year * 12 + (month - 1);
};

export function computeAppointmentStats(
  appointments: readonly HostAppointment[],
  nowSeconds: number,
  timeZone: string
): AppointmentStats {
  const active = appointments.filter(isActiveAppointment);
  const upcoming = active.filter((a) => getAppointmentEnd(a) >= nowSeconds);
  const currentMonth = monthIndex(nowSeconds, timeZone);

  const thisMonth = active.filter((a) => monthIndex(a.event.start, timeZone) === currentMonth).length;
  const lastMonth = active.filter((a) => monthIndex(a.event.start, timeZone) === currentMonth - 1).length;

  return {
    upcoming: upcoming.length,
    upcomingThisWeek: upcoming.filter((a) => a.event.start <= nowSeconds + WEEK_SECONDS).length,
    pending: upcoming.filter((a) => a.effectiveStatus === 'tentative').length,
    thisMonth,
    monthDelta: thisMonth - lastMonth,
  };
}

export interface AppointmentGroups {
  upcoming: HostAppointment[];
  past: HostAppointment[];
}

/** Upcoming first-to-last; past newest first. Cancelled appointments appear only in the past list. */
export function groupAppointments(appointments: readonly HostAppointment[], nowSeconds: number): AppointmentGroups {
  const upcoming = appointments
    .filter((a) => isActiveAppointment(a) && getAppointmentEnd(a) >= nowSeconds)
    .sort((a, b) => a.event.start - b.event.start);
  const past = appointments
    .filter((a) => !isActiveAppointment(a) || getAppointmentEnd(a) < nowSeconds)
    .sort((a, b) => b.event.start - a.event.start);
  return { upcoming, past };
}
