'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { HOME_ROOM_ACTIONS_ID } from '@/lib/public/routes';

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

export function useRoomActions() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const navigationRef = useRef<'create' | 'join' | null>(null);

  const scrollToRoomActions = useCallback(() => {
    document.getElementById(HOME_ROOM_ACTIONS_ID)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  useEffect(() => {
    resetSubmissionFlags(setIsCreating, setIsJoining);
    navigationRef.current = null;

    function handleRestore() {
      resetSubmissionFlags(setIsCreating, setIsJoining);
      navigationRef.current = null;
    }

    window.addEventListener('pageshow', handleRestore);
    return () => window.removeEventListener('pageshow', handleRestore);
  }, []);

  const navigateToLobby = useCallback(
    async (url: string, mode: 'create' | 'join') => {
      if (navigationRef.current) {
        return;
      }

      navigationRef.current = mode;
      if (mode === 'create') {
        setIsCreating(true);
      } else {
        setIsJoining(true);
      }

      try {
        await router.push(url);
      } catch {
        setErrorMessage('تعذر الانتقال إلى الغرفة. يرجى المحاولة مرة أخرى.');
        resetSubmissionFlags(setIsCreating, setIsJoining);
        navigationRef.current = null;
      }
    },
    [router],
  );

  const handleCreateRoom = useCallback(() => {
    if (isCreating || isJoining || navigationRef.current) {
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
    void navigateToLobby(`/lobby?action=create&name=${encodeURIComponent(trimmedName)}`, 'create');
  }, [isCreating, isJoining, navigateToLobby, playerName, scrollToRoomActions]);

  const handleJoinRoom = useCallback(() => {
    if (isCreating || isJoining || navigationRef.current) {
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
    void navigateToLobby(
      `/lobby?code=${encodeURIComponent(trimmedCode)}&name=${encodeURIComponent(trimmedName)}`,
      'join',
    );
  }, [isCreating, isJoining, joinCode, navigateToLobby, playerName, scrollToRoomActions]);

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
