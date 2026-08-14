'use client';

import { HomeField, KeyIcon, UserIcon } from '@/components/home/home-field';
import { HomeSectionHeader } from '@/components/home/home-section-header';
import { Button } from '@/components/ui/button';
import { HOME_SECTIONS } from '@/lib/home/sections';
import { cn } from '@/lib/utils';

export type RoomActionTab = 'create' | 'join';

type HomeRoomActionsProps = {
  playerName: string;
  joinCode: string;
  activeTab: RoomActionTab;
  onTabChange: (tab: RoomActionTab) => void;
  onPlayerNameChange: (value: string) => void;
  onJoinCodeChange: (value: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
  isCreating: boolean;
  isJoining: boolean;
  isSubmitting: boolean;
  playerNameError?: boolean;
  joinCodeError?: boolean;
};

const tabs: { id: RoomActionTab; label: string }[] = [
  { id: 'create', label: 'إنشاء غرفة' },
  { id: 'join', label: 'دخول الغرفة' },
];

export function HomeRoomActions({
  playerName,
  joinCode,
  activeTab,
  onTabChange,
  onPlayerNameChange,
  onJoinCodeChange,
  onCreateRoom,
  onJoinRoom,
  isCreating,
  isJoining,
  isSubmitting,
  playerNameError = false,
  joinCodeError = false,
}: HomeRoomActionsProps) {
  return (
    <section id={HOME_SECTIONS.startPlay} className="scroll-mt-24">
      <HomeSectionHeader
        title="ابدأ اللعب"
        description="اكتب اسمك ثم أنشئ غرفة جديدة أو ادخل برمز غرفة."
        align="center"
        className="mb-8"
      />

      <div className="wanas-panel mx-auto w-full max-w-3xl p-5 sm:p-8">
        <div
          role="tablist"
          aria-label="اختيار نوع الإجراء"
          className="mb-6 grid grid-cols-1 gap-2 rounded-xl border border-wanas-border bg-wanas-surface-soft p-1 sm:grid-cols-2"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`room-action-panel-${tab.id}`}
              id={`room-action-tab-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'inline-flex h-11 items-center justify-center rounded-[var(--wanas-radius-control)] px-3 text-sm font-semibold transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wanas-accent/30 focus-visible:ring-offset-2',
                activeTab === tab.id
                  ? 'border border-wanas-accent bg-wanas-accent/10 text-wanas-text-primary'
                  : 'border border-transparent text-wanas-text-muted hover:text-wanas-text-primary',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id="room-action-panel-create"
          aria-labelledby="room-action-tab-create"
          hidden={activeTab !== 'create'}
          className="space-y-4"
        >
          <HomeField
            id="create-name"
            label="اسمك"
            value={playerName}
            onChange={onPlayerNameChange}
            placeholder="اكتب اسمك"
            icon={<UserIcon />}
            disabled={isSubmitting}
            hasError={playerNameError}
          />
          <Button type="button" size="lg" className="w-full" onClick={onCreateRoom} disabled={isSubmitting} loading={isCreating}>
            {isCreating ? 'جاري الإنشاء…' : 'إنشاء غرفة'}
          </Button>
        </div>

        <div
          role="tabpanel"
          id="room-action-panel-join"
          aria-labelledby="room-action-tab-join"
          hidden={activeTab !== 'join'}
          className="space-y-4"
        >
          <HomeField
            id="join-name"
            label="اسمك"
            value={playerName}
            onChange={onPlayerNameChange}
            placeholder="اكتب اسمك"
            icon={<UserIcon />}
            disabled={isSubmitting}
            hasError={playerNameError}
          />
          <HomeField
            id="join-code"
            label="رمز الغرفة"
            value={joinCode}
            onChange={(value) => onJoinCodeChange(value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            icon={<KeyIcon />}
            disabled={isSubmitting}
            hasError={joinCodeError}
            inputMode="numeric"
            inputClassName="font-mono tracking-[0.3em] placeholder:tracking-normal"
          />
          <Button type="button" size="lg" className="w-full" onClick={onJoinRoom} disabled={isSubmitting} loading={isJoining}>
            {isJoining ? 'جاري الدخول…' : 'دخول الغرفة'}
          </Button>
        </div>
      </div>
    </section>
  );
}
