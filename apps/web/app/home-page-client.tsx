'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { GameCard } from '@/components/lobby/game-card';
import { mockLobbyGames } from '@/lib/lobby/mock-games';

export function HomePageClient() {
  const router = useRouter();
  const [createName, setCreateName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleCreateRoom() {
    const trimmedName = createName.trim();

    if (!trimmedName) {
      setErrorMessage('يرجى إدخال اسمك لإنشاء غرفة.');
      return;
    }

    setErrorMessage(null);
    router.push(`/lobby?action=create&name=${encodeURIComponent(trimmedName)}`);
  }

  function handleJoinRoom() {
    const trimmedCode = joinCode.trim().toUpperCase();
    const trimmedName = joinName.trim();

    if (!trimmedCode) {
      setErrorMessage('يرجى إدخال رمز الغرفة.');
      return;
    }

    if (!trimmedName) {
      setErrorMessage('يرجى إدخال اسمك للانضمام.');
      return;
    }

    setErrorMessage(null);
    router.push(
      `/lobby?code=${encodeURIComponent(trimmedCode)}&name=${encodeURIComponent(trimmedName)}`,
    );
  }

  return (
    <main className="min-h-full bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-4 md:p-8">
        <header className="space-y-2 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground">
            و
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">ونساتنا</h1>
          <p className="text-sm text-muted-foreground md:text-base">Wanasatna — ألعاب جماعية في المتصفح</p>
        </header>

        {errorMessage ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-base font-semibold text-foreground">إنشاء غرفة</h2>
            <p className="mt-1 text-sm text-muted-foreground">أنشئ غرفة جديدة وادعُ أصدقاءك.</p>

            <div className="mt-4 space-y-3">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-foreground">اسمك</span>
                <input
                  type="text"
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  placeholder="اكتب اسمك..."
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </label>
              <button
                type="button"
                onClick={handleCreateRoom}
                className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                إنشاء غرفة
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-base font-semibold text-foreground">الانضمام إلى غرفة</h2>
            <p className="mt-1 text-sm text-muted-foreground">أدخل رمز الغرفة واسمك للانضمام.</p>

            <div className="mt-4 space-y-3">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-foreground">رمز الغرفة</span>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  placeholder="ABCD12"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 font-mono text-sm uppercase tracking-widest text-foreground outline-none placeholder:text-muted-foreground"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-foreground">اسمك</span>
                <input
                  type="text"
                  value={joinName}
                  onChange={(event) => setJoinName(event.target.value)}
                  placeholder="اكتب اسمك..."
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </label>
              <button
                type="button"
                onClick={handleJoinRoom}
                className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                الانضمام
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-foreground">الألعاب</h2>
            <p className="mt-1 text-sm text-muted-foreground">اختر لعبتك المفضلة بعد الانضمام إلى الغرفة.</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {mockLobbyGames.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                selected={false}
                disabled
                onSelect={() => {}}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
