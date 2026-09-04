'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { playerNameContainsForbiddenChars } from '@wanasatna/shared';
import { replaceHomeClean } from '@/lib/public/home-url';
import { HOME_ROOM_ACTIONS_ID } from '@/lib/public/routes';
import { getRuntimeId, recordContinuity } from '@/lib/room-v2/continuity';
import { getRoomSessionManager, notifyResumeDiscovery, type ActiveRoomSession } from '@/lib/room-v2';
import {
  EMPTY_RESUME_CLAIMS,
  getResumeDiscoveryListSnapshot,
  subscribeResumeDiscovery,
} from '@/lib/room-v2/discover-claim';
import { useVerifiedResumeClaims } from '@/lib/room-v2/use-verified-resume-claims';
import { getRoomSocket } from '@/lib/room/socket';

type FieldErrors = {
  createPlayerName?: boolean;
  joinPlayerName?: boolean;
  joinCode?: boolean;
};

function resetSubmissionFlags(
  setIsCreating: (value: boolean) => void,
  setIsJoining: (value: boolean) => void,
) {
  setIsCreating(false);
  setIsJoining(false);
}

function readInviteCode(searchParams: Pick<URLSearchParams, 'get'>): string {
  const raw = searchParams.get('code')?.trim() ?? '';
  const code = raw.replace(/\D/g, '');
  return /^\d{6}$/.test(code) ? code : '';
}

/**
 * Home Create/Join — V2: network completes HERE, then navigate to canonical lobby URL.
 * Lobby never executes create/join commands.
 * `?code=` is invite form prefill only — never Room identity / never survives explicit Leave.
 */
export function useRoomActions() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createPlayerName, setCreatePlayerName] = useState('');
  const [joinPlayerName, setJoinPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState(() => readInviteCode(searchParams));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const inFlightRef = useRef(false);

  const scrollToRoomActions = useCallback(() => {
    document.getElementById(HOME_ROOM_ACTIONS_ID)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  // Invite prefill OR clear after explicit Leave / clean Home.
  // Do not clear the leave-suppress flag until URL is already `/` without code —
  // otherwise a still-mounted Lobby bootstrap can rewrite /?code=OLD after Home consumed it.
  useEffect(() => {
    const manager = getRoomSessionManager();

    if (manager.shouldSuppressInvitePrefill()) {
      setJoinCode('');
      // Never yank Home clean while Create/Join is in flight or after it owns the session.
      if (searchParams.get('code') && !manager.isEnterInFlight() && manager.getState().status !== 'active') {
        replaceHomeClean(router);
        return;
      }
      if (!searchParams.get('code')) {
        manager.clearExplicitLeaveHome();
      }
      return;
    }

    const code = readInviteCode(searchParams);
    setJoinCode(code);
  }, [searchParams, router]);

  const discoveredResumeClaims = useSyncExternalStore(
    subscribeResumeDiscovery,
    () => getResumeDiscoveryListSnapshot(readInviteCode(searchParams) || null),
    () => EMPTY_RESUME_CLAIMS,
  );
  const resumeClaims = useVerifiedResumeClaims(discoveredResumeClaims);

  useEffect(() => {
    recordContinuity('HOME_READY', {
      socketId: getRoomSocket().id ?? null,
      detail: `runtime=${getRuntimeId()}`,
    });
  }, []);

  useEffect(() => {
    function handleRestore() {
      resetSubmissionFlags(setIsCreating, setIsJoining);
      inFlightRef.current = false;
    }

    window.addEventListener('pageshow', handleRestore);
    return () => window.removeEventListener('pageshow', handleRestore);
  }, []);

  const handleCreateRoom = useCallback(() => {
    if (isCreating || isJoining || inFlightRef.current) {
      return;
    }

    const trimmedName = createPlayerName.trim();

    if (!trimmedName) {
      setErrorMessage('يرجى إدخال اسمك لإنشاء غرفة.');
      setFieldErrors({ createPlayerName: true });
      scrollToRoomActions();
      return;
    }

    if (trimmedName.length < 2) {
      setErrorMessage('يجب أن يكون الاسم حرفين على الأقل.');
      setFieldErrors({ createPlayerName: true });
      scrollToRoomActions();
      return;
    }

    if (trimmedName.length > 20) {
      setErrorMessage('يجب ألا يزيد الاسم عن 20 حرفاً.');
      setFieldErrors({ createPlayerName: true });
      scrollToRoomActions();
      return;
    }

    if (playerNameContainsForbiddenChars(trimmedName)) {
      setErrorMessage('الاسم يحتوي على رموز غير مسموحة.');
      setFieldErrors({ createPlayerName: true });
      scrollToRoomActions();
      return;
    }

    setErrorMessage(null);
    setFieldErrors({});
    inFlightRef.current = true;
    setIsCreating(true);

    void (async () => {
      const manager = getRoomSessionManager();
      try {
        // Create = NEW room. Discard stale invite code as entry intent (form + URL only).
        // Room authority was already cleared by Leave; avoid extra generation bumps here.
        manager.clearExplicitLeaveHome();
        setJoinCode('');
        if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('code')) {
          replaceHomeClean(router);
        }

        const result = await manager.create(trimmedName);
        if (!result.success) {
          setErrorMessage(result.error.message);
          return;
        }

        manager.clearExplicitLeaveHome();
        const lobbyUrl = `/lobby?code=${encodeURIComponent(result.data.roomCode)}`;
        // After Explicit Leave in this runtime, App Router soft-nav can revive the
        // left room's /lobby?code= from client cache (proven in continuity dumps:
        // CREATE_SUCCESS=B then URL settles on A). Full document navigation to the
        // NEW lobby matches what a manual refresh achieves for this handoff only.
        if (
          typeof window !== 'undefined' &&
          manager.hasExplicitlyLeftRoomThisRuntime()
        ) {
          window.location.assign(lobbyUrl);
          return;
        }
        if (typeof window !== 'undefined') {
          window.history.replaceState(window.history.state, '', lobbyUrl);
        }
        router.push(lobbyUrl);
      } catch {
        setErrorMessage('تعذر إنشاء الغرفة. حاول مرة أخرى.');
      } finally {
        inFlightRef.current = false;
        resetSubmissionFlags(setIsCreating, setIsJoining);
      }
    })();
  }, [createPlayerName, isCreating, isJoining, router, scrollToRoomActions]);

  const handleJoinRoom = useCallback(() => {
    if (isCreating || isJoining || inFlightRef.current) {
      return;
    }

    const manager = getRoomSessionManager();
    const trimmedCode = manager.shouldSuppressInvitePrefill() ? '' : joinCode.trim();
    const trimmedName = joinPlayerName.trim();
    const nextFieldErrors: FieldErrors = {};

    if (!trimmedCode) {
      setErrorMessage('يرجى إدخال رمز الغرفة.');
      nextFieldErrors.joinCode = true;
    }

    if (!trimmedName) {
      setErrorMessage('يرجى إدخال اسمك للانضمام.');
      nextFieldErrors.joinPlayerName = true;
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      scrollToRoomActions();
      return;
    }

    if (trimmedName.length < 2) {
      setErrorMessage('يجب أن يكون الاسم حرفين على الأقل.');
      setFieldErrors({ joinPlayerName: true });
      scrollToRoomActions();
      return;
    }

    if (trimmedName.length > 20) {
      setErrorMessage('يجب ألا يزيد الاسم عن 20 حرفاً.');
      setFieldErrors({ joinPlayerName: true });
      scrollToRoomActions();
      return;
    }

    if (playerNameContainsForbiddenChars(trimmedName)) {
      setErrorMessage('الاسم يحتوي على رموز غير مسموحة.');
      setFieldErrors({ joinPlayerName: true });
      scrollToRoomActions();
      return;
    }

    if (!/^\d{6}$/.test(trimmedCode)) {
      setErrorMessage('رمز الغرفة يجب أن يكون 6 أرقام.');
      setFieldErrors({ joinCode: true });
      scrollToRoomActions();
      return;
    }

    setErrorMessage(null);
    setFieldErrors({});
    inFlightRef.current = true;
    setIsJoining(true);

    void (async () => {
      try {
        // Form code is invite data only — clear Leave suppress so Lobby won't bounce Home.
        manager.clearExplicitLeaveHome();

        const result = await manager.enterFromJoinForm(trimmedCode, trimmedName);
        if (!result.success) {
          setErrorMessage(result.error.message);
          notifyResumeDiscovery();
          return;
        }

        notifyResumeDiscovery();
        manager.clearExplicitLeaveHome();
        const lobbyUrl = `/lobby?code=${encodeURIComponent(result.data.roomCode)}`;
        // After Explicit Leave in this runtime, App Router soft-nav can revive the
        // left room's /lobby?code= from client cache (proven in continuity dumps:
        // CREATE_SUCCESS=B then URL settles on A). Full document navigation to the
        // NEW lobby matches what a manual refresh achieves for this handoff only.
        if (
          typeof window !== 'undefined' &&
          manager.hasExplicitlyLeftRoomThisRuntime()
        ) {
          window.location.assign(lobbyUrl);
          return;
        }
        if (typeof window !== 'undefined') {
          window.history.replaceState(window.history.state, '', lobbyUrl);
        }
        router.push(lobbyUrl);
      } catch {
        setErrorMessage('تعذر الانضمام إلى الغرفة. حاول مرة أخرى.');
      } finally {
        inFlightRef.current = false;
        resetSubmissionFlags(setIsCreating, setIsJoining);
      }
    })();
  }, [isCreating, isJoining, joinCode, joinPlayerName, router, scrollToRoomActions]);

  const handleResumeClaim = useCallback((claim: ActiveRoomSession) => {
    if (!claim || isCreating || isJoining || inFlightRef.current) {
      return;
    }

    setErrorMessage(null);
    setFieldErrors({});
    inFlightRef.current = true;
    setIsJoining(true);

    void (async () => {
      const manager = getRoomSessionManager();
      try {
        manager.clearExplicitLeaveHome();
        const result = await manager.enterFromJoinForm(claim.roomCode, claim.playerName);
        if (!result.success) {
          setErrorMessage(result.error.message);
          notifyResumeDiscovery();
          return;
        }

        notifyResumeDiscovery();
        manager.clearExplicitLeaveHome();
        const lobbyUrl = `/lobby?code=${encodeURIComponent(result.data.roomCode)}`;
        if (
          typeof window !== 'undefined' &&
          manager.hasExplicitlyLeftRoomThisRuntime()
        ) {
          window.location.assign(lobbyUrl);
          return;
        }
        if (typeof window !== 'undefined') {
          window.history.replaceState(window.history.state, '', lobbyUrl);
        }
        router.push(lobbyUrl);
      } catch {
        setErrorMessage('تعذر العودة إلى الغرفة. حاول مرة أخرى.');
      } finally {
        inFlightRef.current = false;
        resetSubmissionFlags(setIsCreating, setIsJoining);
      }
    })();
  }, [isCreating, isJoining, router]);

  const handleCreatePlayerNameChange = useCallback(
    (value: string) => {
      setCreatePlayerName(value);
      if (fieldErrors.createPlayerName) {
        setFieldErrors((current) => ({ ...current, createPlayerName: false }));
        setErrorMessage(null);
      }
    },
    [fieldErrors.createPlayerName],
  );

  const handleJoinPlayerNameChange = useCallback(
    (value: string) => {
      setJoinPlayerName(value);
      if (fieldErrors.joinPlayerName) {
        setFieldErrors((current) => ({ ...current, joinPlayerName: false }));
        setErrorMessage(null);
      }
    },
    [fieldErrors.joinPlayerName],
  );

  const handleJoinCodeChange = useCallback(
    (value: string) => {
      setJoinCode(value.replace(/\D/g, '').slice(0, 6));
      if (fieldErrors.joinCode) {
        setFieldErrors((current) => ({ ...current, joinCode: false }));
        setErrorMessage(null);
      }
    },
    [fieldErrors.joinCode],
  );

  const urlInviteCode = readInviteCode(searchParams);
  const suppressInvitePrefill =
    typeof window !== 'undefined' && getRoomSessionManager().shouldSuppressInvitePrefill();
  const visibleJoinCode = suppressInvitePrefill ? '' : joinCode;

  return {
    createPlayerName,
    joinPlayerName,
    joinCode: visibleJoinCode,
    inviteFromLink:
      !suppressInvitePrefill && urlInviteCode !== '' && visibleJoinCode === urlInviteCode,
    errorMessage,
    fieldErrors,
    isCreating,
    isJoining,
    resumeClaims,
    scrollToRoomActions,
    handleCreateRoom,
    handleJoinRoom,
    handleResumeClaim,
    handleCreatePlayerNameChange,
    handleJoinPlayerNameChange,
    handleJoinCodeChange,
  };
}
