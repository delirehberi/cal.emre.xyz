import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { NostrSigner, SignerType } from '../lib/nostr/signer';
import { PrivateKeySigner } from '../lib/nostr/signer';
import { Nip07Signer, hasNip07Extension } from '../lib/nostr/nip07';
import { Nip46Signer } from '../lib/nostr/nip46';
import {
  generateSecretKey,
  getPublicKey,
  encodeNpub,
  encodeNsec,
  decodeKeyToHex,
} from '../lib/nostr/keys';
import { nostrPool, type HostProfile } from '../lib/nostr/relays';

export interface AuthUser {
  pubkey: string;
  npub: string;
  nip05?: string;
  profile?: HostProfile;
  signerType: SignerType;
  isGuest?: boolean;
}

export interface AuthContextType {
  user: AuthUser | null;
  signer: NostrSigner | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  error: string | null;
  loginWithExtension: () => Promise<void>;
  loginWithBunker: (bunkerUri: string) => Promise<void>;
  loginWithNsec: (nsecOrHex: string) => Promise<void>;
  loginAsGuest: (secretKeyHex?: string) => { nsec: string; npub: string; signer: PrivateKeySigner };
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_SESSION_TYPE = 'cal_nostr_session_type';
const STORAGE_PRIVATE_KEY = 'cal_nostr_pk';
const STORAGE_BUNKER_URI = 'cal_nostr_bunker_uri';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [signer, setSigner] = useState<NostrSigner | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const loadUserProfile = useCallback(async (pubkey: string, signerType: SignerType, isGuest = false) => {
    const npub = encodeNpub(pubkey);
    let profile: HostProfile | undefined;

    try {
      const fetched = await nostrPool.fetchHostProfile(pubkey);
      if (fetched) {
        profile = fetched;
      }
    } catch {
      // Profile fetch failure is non-fatal
    }

    const authUser: AuthUser = {
      pubkey,
      npub,
      nip05: profile?.nip05,
      profile,
      signerType,
      isGuest,
    };

    setUser(authUser);
  }, []);

  const loginWithExtension = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (!hasNip07Extension() && typeof window !== 'undefined' && !window.nostr) {
        throw new Error('No NIP-07 browser extension (e.g. Alby, nos2x) detected.');
      }

      const extensionSigner = new Nip07Signer();
      const pubkey = await extensionSigner.getPublicKey();

      setSigner(extensionSigner);
      await loadUserProfile(pubkey, 'nip07', false);

      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(STORAGE_SESSION_TYPE, 'nip07');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [loadUserProfile]);

  const loginWithBunker = useCallback(
    async (bunkerUri: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const bunkerSigner = new Nip46Signer(bunkerUri);
        const pubkey = await bunkerSigner.getPublicKey();

        setSigner(bunkerSigner);
        await loadUserProfile(pubkey, 'nip46', false);

        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(STORAGE_SESSION_TYPE, 'nip46');
          localStorage.setItem(STORAGE_BUNKER_URI, bunkerUri);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [loadUserProfile]
  );

  const loginWithNsec = useCallback(
    async (nsecOrHex: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const trimmed = nsecOrHex.trim();
        const hex = decodeKeyToHex(trimmed);
        const privSigner = new PrivateKeySigner(hex);
        const pubkey = await privSigner.getPublicKey();

        setSigner(privSigner);
        await loadUserProfile(pubkey, 'privateKey', false);

        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(STORAGE_SESSION_TYPE, 'nsec');
          localStorage.setItem(STORAGE_PRIVATE_KEY, hex);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [loadUserProfile]
  );

  const loginAsGuest = useCallback(
    (secretKeyHex?: string) => {
      setError(null);
      const secretKeyBytes = secretKeyHex
        ? decodeKeyToHex(secretKeyHex)
        : generateSecretKey();

      const privSigner = new PrivateKeySigner(secretKeyBytes);
      const pubkeyHex = getPublicKey(
        typeof secretKeyBytes === 'string'
          ? (privSigner as unknown as { secretKey: Uint8Array })['secretKey'] || generateSecretKey()
          : secretKeyBytes
      );
      const npub = encodeNpub(pubkeyHex);
      const nsec = encodeNsec(privSigner.getSecretKeyHex());

      setSigner(privSigner);
      setUser({
        pubkey: pubkeyHex,
        npub,
        signerType: 'privateKey',
        isGuest: true,
      });

      return { nsec, npub, signer: privSigner };
    },
    []
  );

  const logout = useCallback(() => {
    setUser(null);
    setSigner(null);
    setError(null);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(STORAGE_SESSION_TYPE);
      localStorage.removeItem(STORAGE_PRIVATE_KEY);
      localStorage.removeItem(STORAGE_BUNKER_URI);
    }
  }, []);

  // Restore session on mount
  useEffect(() => {
    const restoreSession = async () => {
      if (typeof window === 'undefined' || !window.localStorage) {
        setIsLoading(false);
        return;
      }

      const sessionType = localStorage.getItem(STORAGE_SESSION_TYPE);
      if (!sessionType) {
        setIsLoading(false);
        return;
      }

      try {
        if (sessionType === 'nip07' && hasNip07Extension()) {
          const extensionSigner = new Nip07Signer();
          const pubkey = await extensionSigner.getPublicKey();
          setSigner(extensionSigner);
          await loadUserProfile(pubkey, 'nip07', false);
        } else if (sessionType === 'nsec') {
          const savedKey = localStorage.getItem(STORAGE_PRIVATE_KEY);
          if (savedKey) {
            const privSigner = new PrivateKeySigner(savedKey);
            const pubkey = await privSigner.getPublicKey();
            setSigner(privSigner);
            await loadUserProfile(pubkey, 'privateKey', false);
          }
        } else if (sessionType === 'bunker') {
          const savedUri = localStorage.getItem(STORAGE_BUNKER_URI);
          if (savedUri) {
            const bunkerSigner = new Nip46Signer(savedUri);
            const pubkey = await bunkerSigner.getPublicKey();
            setSigner(bunkerSigner);
            await loadUserProfile(pubkey, 'nip46', false);
          }
        }
      } catch {
        // Clear invalid saved session
        localStorage.removeItem(STORAGE_SESSION_TYPE);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, [loadUserProfile]);

  const value = useMemo(
    () => ({
      user,
      signer,
      isLoggedIn: !!user,
      isLoading,
      error,
      loginWithExtension,
      loginWithBunker,
      loginWithNsec,
      loginAsGuest,
      logout,
      clearError,
    }),
    [
      user,
      signer,
      isLoading,
      error,
      loginWithExtension,
      loginWithBunker,
      loginWithNsec,
      loginAsGuest,
      logout,
      clearError,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
