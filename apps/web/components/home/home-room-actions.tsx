'use client';

import { HomeField, KeyIcon, UserIcon } from '@/components/home/home-field';
import { HomeSectionHeader } from '@/components/home/home-section-header';
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
  { id: 'join', label: 'الانضمام إلى غرفة' },
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
        description="أدخل اسمك ثم أنشئ غرفة جديدة أو انضم إلى غرفة موجودة برمز من 6 أرقام."
        align="center"
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 3 4 7v6c0 4.4 3.4 8.5 8 9 4.6-.5 8-4.6 8-9V7l-8-4Z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        }
        className="mb-8"
      />

      <div className="mx-auto w-full max-w-3xl rounded-[1.75rem] border border-[#E2E8F0] bg-white p-5 shadow-sm sm:p-8">
        <div
          role="tablist"
          aria-label="اختيار نوع الإجراء"
          className="mb-6 grid grid-cols-1 gap-2 rounded-xl bg-[#F8FAFC] p-1 sm:grid-cols-2"
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
                'inline-flex h-11 items-center justify-center rounded-lg px-3 text-sm font-semibold transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/30 focus-visible:ring-offset-2',
                activeTab === tab.id
                  ? 'bg-white text-[#2563EB] shadow-sm'
                  : 'text-[#64748B] hover:text-[#0F172A]',
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
            placeholder="أدخل اسمك"
            icon={<UserIcon />}
            disabled={isSubmitting}
            hasError={playerNameError}
          />
          <button
            type="button"
            onClick={onCreateRoom}
            disabled={isSubmitting}
            aria-busy={isCreating}
            className={cn(
              'inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#3B82F6] px-5 text-sm font-semibold text-white transition-all duration-200',
              'hover:bg-[#2563EB] hover:shadow-md hover:shadow-[#3B82F6]/20',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/40 focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
          >
            {isCreating ? (
              <>
                <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                جاري الإنشاء...
              </>
            ) : (
              <>
                <span aria-hidden>+</span>
                إنشاء غرفة
              </>
            )}
          </button>
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
            placeholder="أدخل اسمك"
            icon={<UserIcon />}
            disabled={isSubmitting}
            hasError={playerNameError}
          />
          <HomeField
            id="join-code"
            label="رمز الغرفة"
            value={joinCode}
            onChange={(value) => onJoinCodeChange(value.replace(/\D/g, '').slice(0, 6))}
            placeholder="أدخل رمز الغرفة"
            icon={<KeyIcon />}
            disabled={isSubmitting}
            hasError={joinCodeError}
            inputMode="numeric"
            inputClassName="font-mono tracking-[0.3em] placeholder:tracking-normal"
          />
          <button
            type="button"
            onClick={onJoinRoom}
            disabled={isSubmitting}
            aria-busy={isJoining}
            className={cn(
              'inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#3B82F6] px-5 text-sm font-semibold text-white transition-all duration-200',
              'hover:bg-[#2563EB] hover:shadow-md hover:shadow-[#3B82F6]/20',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/40 focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
          >
            {isJoining ? (
              <>
                <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                جاري الانضمام...
              </>
            ) : (
              <>
                انضم الآن
                <span aria-hidden>←</span>
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
