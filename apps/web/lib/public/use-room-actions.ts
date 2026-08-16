'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { replaceHomeClean } from '@/lib/public/home-url';
import { HOME_ROOM_ACTIONS_ID } from '@/lib/public/routes';
import { getRuntimeId, recordContinuity } from '@/lib/room-v2/continuity';
import { getRoomSessionManager } from '@/lib/room-v2';
import { getRoomSocket } from '@/lib/room/socket';

type FieldErrors = {
  playerName?: boolean;
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
  const [playerName, setPlayerName] = useState('');
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

    const trimmedName = playerName.trim();

    if (!trimmedName) {
      setErrorMessage('يرجى إدخال اسمك لإنشاء غرفة.');
      setFieldErrors({ playerName: true });
      scrollToRoomActions();
      return;
    }

    if (trimmedName.length < 2) {
      setErrorMessage('يجب أن يكون الاسم حرفين على الأقل.');
      setFieldErrors({ playerName: true });
      scrollToRoomActions();
      return;
    }

    if (trimmedName.length > 20) {
      setErrorMessage('يجب ألا يزيد الاسم عن 20 حرفاً.');
      setFieldErrors({ playerName: true });
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
  }, [isCreating, isJoining, playerName, router, scrollToRoomActions]);

  const handleJoinRoom = useCallback(() => {
    if (isCreating || isJoining || inFlightRef.current) {
      return;
    }

    const trimmedCode = joinCode.trim();
    const trimmedName = playerName.trim();
    const nextFieldErrors: FieldErrors = {};

    if (!trimmedCode) {
      setErrorMessage('يرجى إدخال رمز الغرفة.');
      nextFieldErrors.joinCode = true;
    }

    if (!trimmedName) {
      setErrorMessage('يرجى إدخال اسمك للانضمام.');
      nextFieldErrors.playerName = true;
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      scrollToRoomActions();
      return;
    }

    if (trimmedName.length < 2) {
      setErrorMessage('يجب أن يكون الاسم حرفين على الأقل.');
      setFieldErrors({ playerName: true });
      scrollToRoomActions();
      return;
    }

    if (trimmedName.length > 20) {
      setErrorMessage('يجب ألا يزيد الاسم عن 20 حرفاً.');
      setFieldErrors({ playerName: true });
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
      const manager = getRoomSessionManager();
      try {
        // Form code is invite data only — clear Leave suppress so Lobby won't bounce Home.
        manager.clearExplicitLeaveHome();

        const result = await manager.enterFromJoinForm(trimmedCode, trimmedName);
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
        setErrorMessage('تعذر الانضمام إلى الغرفة. حاول مرة أخرى.');
      } finally {
        inFlightRef.current = false;
        resetSubmissionFlags(setIsCreating, setIsJoining);
      }
    })();
  }, [isCreating, isJoining, joinCode, playerName, router, scrollToRoomActions]);

  const handlePlayerNameChange = useCallback(
    (value: string) => {
      setPlayerName(value);
      if (fieldErrors.playerName) {
        setFieldErrors((current) => ({ ...current, playerName: false }));
        setErrorMessage(null);
      }
    },
    [fieldErrors.playerName],
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

  return {
    playerName,
    joinCode,
    inviteFromLink: urlInviteCode !== '' && joinCode === urlInviteCode,
    errorMessage,
    fieldErrors,
    isCreating,
    isJoining,
    scrollToRoomActions,
    handleCreateRoom,
    handleJoinRoom,
    handlePlayerNameChange,
    handleJoinCodeChange,
  };
}
