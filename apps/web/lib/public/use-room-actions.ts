'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { HOME_ROOM_ACTIONS_ID } from '@/lib/public/routes';
import { getRoomSessionManager } from '@/lib/room-v2';

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

/**
 * Home Create/Join — V2: network completes HERE, then navigate to canonical lobby URL.
 * Lobby never executes create/join commands.
 */
export function useRoomActions() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const inFlightRef = useRef(false);

  const scrollToRoomActions = useCallback(() => {
    document.getElementById(HOME_ROOM_ACTIONS_ID)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  // Deep-link: /?code=B prefill join code (declarative invite data, not a command).
  useEffect(() => {
    const code = searchParams.get('code')?.trim() ?? '';
    if (/^\d{6}$/.test(code)) {
      setJoinCode(code);
    }
  }, [searchParams]);

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
      try {
        const result = await getRoomSessionManager().create(trimmedName);
        if (!result.success) {
          setErrorMessage(result.error.message);
          return;
        }

        router.replace(`/lobby?code=${encodeURIComponent(result.data.roomCode)}`);
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
      try {
        const result = await getRoomSessionManager().join(trimmedCode, trimmedName);
        if (!result.success) {
          setErrorMessage(result.error.message);
          return;
        }

        router.replace(`/lobby?code=${encodeURIComponent(result.data.roomCode)}`);
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

  return {
    playerName,
    joinCode,
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
