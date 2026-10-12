import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { nostrPool, type HostAppointment } from '../nostr/relays';

export interface HostAppointmentsState {
  appointments: HostAppointment[];
  setAppointments: React.Dispatch<React.SetStateAction<HostAppointment[]>>;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  /** The host's own NIP-65 relays (empty until resolved or when none are published). */
  hostRelays: string[];
}

/** Loads the host's appointments from their relays and keeps them for optimistic updates. */
export function useHostAppointments(pubkey: string | undefined, relays?: string[]): HostAppointmentsState {
  const [appointments, setAppointments] = useState<HostAppointment[]>([]);
  const [hostRelays, setHostRelays] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(pubkey));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!pubkey) return;
    setIsLoading(true);
    setError(null);
    try {
      // Guests publish bookings to the host's own NIP-65 relays, so those must be queried too.
      let queryRelays = relays;
      if (!queryRelays) {
        try {
          queryRelays = (await nostrPool.fetchHostRelays(pubkey)).all;
        } catch (relayError) {
          console.error('Failed to resolve host relays, using defaults', relayError);
          queryRelays = [];
        }
      }
      setHostRelays(queryRelays);
      setAppointments(await nostrPool.fetchHostAppointments(pubkey, { relays: queryRelays }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [pubkey, relays]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { appointments, setAppointments, isLoading, error, reload, hostRelays };
}
