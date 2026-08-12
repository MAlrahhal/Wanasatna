'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BaraAlSalafaFullFlowPreview } from '@/components/dev/bara-al-salafa-full-flow-preview';
import { PlaygroundSection, PlaygroundSubsection } from '@/components/dev/playground-section';
import { EmptyState } from '@/components/lobby/empty-state';
import { GameCard } from '@/components/lobby/game-card';
import { PlayerCard } from '@/components/lobby/player-card';
import { getPlayerAvatarColors } from '@/components/lobby/lobby-ui';
import { FeatureCard } from '@/components/public/feature-card';
import { KeyIcon, PublicField, UserIcon } from '@/components/public/public-field';
import { StatusBadge } from '@/components/public/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UiDialog, type DialogVariant } from '@/components/ui/dialog';
import { RoomCard } from '@/components/ui/room-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { designTokenGroups } from '@/lib/dev/design-tokens';
import { SearchIcon, projectIcons } from '@/lib/dev/icons';
import { demoCatalogEntry, demoComingSoonGame, demoGame, demoPlayers } from '@/lib/dev/playground-data';
import { resetRoomSessionForDevelopment } from '@/lib/room/reset-session';
import { cn } from '@/lib/utils';
import { CountdownScreen } from '@/plugins/bara-al-salafa/countdown-screen';
import { DirectedQuestionsScreen } from '@/plugins/bara-al-salafa/directed-questions-screen';
import { FreeQuestionsScreen } from '@/plugins/bara-al-salafa/free-questions-screen';
import { ImpostorGuessScreen } from '@/plugins/bara-al-salafa/impostor-guess-screen';
import { MatchResultsScreen } from '@/plugins/bara-al-salafa/match-results-screen';
import { RevealImpostorScreen } from '@/plugins/bara-al-salafa/reveal-impostor-screen';
import { RoleRevealScreen } from '@/plugins/bara-al-salafa/role-reveal-screen';
import { RoundResultsScreen } from '@/plugins/bara-al-salafa/round-results-screen';
import { VotingScreen } from '@/plugins/bara-al-salafa/voting-screen';
import {
  countdownDemoDefaults,
  directedQuestionsDemoDefaults,
  freeQuestionsDemoDefaults,
  freeQuestionsMostCompletedDemoDefaults,
  freeQuestionsWaitingDemoDefaults,
  revealImpostorDemoDefaults,
  revealImpostorLowTimeDemoDefaults,
  impostorGuessDemoDefaults,
  impostorGuessSubmittedDemoDefaults,
  impostorGuessWaitingDemoDefaults,
  matchResultsCurrentPlayerFirstDemoDefaults,
  matchResultsCurrentPlayerOutsideTop3DemoDefaults,
  matchResultsSingleWinnerDemoDefaults,
  matchResultsTiedWinnersDemoDefaults,
  roundResultsCorrectDemoDefaults,
  roundResultsFinalRoundDemoDefaults,
  roundResultsTieDemoDefaults,
  roundResultsWrongDemoDefaults,
  roleRevealDemoDefaults,
  roleRevealDemoPlayers,
  votingConfirmedDemoDefaults,
  votingDemoDefaults,
  votingErrorDemoDefaults,
  votingLowTimeDemoDefaults,
} from '@/plugins/bara-al-salafa/role-reveal-demo-data';

const navItems = [
  { href: '#buttons', label: 'Buttons' },
  { href: '#inputs', label: 'Inputs' },
  { href: '#cards', label: 'Cards' },
  { href: '#badges', label: 'Badges' },
  { href: '#dialogs', label: 'Dialogs' },
  { href: '#loading', label: 'Loading' },
  { href: '#colors', label: 'Colors' },
  { href: '#typography', label: 'Typography' },
  { href: '#icons', label: 'Icons' },
  { href: '#responsive', label: 'Responsive' },
  { href: '#game-components', label: 'Game Components' },
] as const;

function FreeQuestionsActivePreview() {
  const [selectedTargetPlayerId, setSelectedTargetPlayerId] = useState<string | null>(
    freeQuestionsDemoDefaults.selectedTargetPlayerId,
  );

  return (
    <FreeQuestionsScreen
      {...freeQuestionsDemoDefaults}
      selectedTargetPlayerId={selectedTargetPlayerId}
      onSelectPlayer={setSelectedTargetPlayerId}
    />
  );
}

function VotingNotVotedPreview() {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(
    votingDemoDefaults.selectedPlayerId,
  );

  return (
    <VotingScreen
      {...votingDemoDefaults}
      selectedPlayerId={selectedPlayerId}
      onSelectPlayer={setSelectedPlayerId}
    />
  );
}

function ImpostorGuessActivePreview() {
  const [selectedWord, setSelectedWord] = useState<string | null>(
    impostorGuessDemoDefaults.selectedWord,
  );

  return (
    <ImpostorGuessScreen
      {...impostorGuessDemoDefaults}
      selectedWord={selectedWord}
      onSelectWord={setSelectedWord}
    />
  );
}

export function UiPlaygroundClient() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState('لاعب تجريبي');
  const [roomCode, setRoomCode] = useState('123456');
  const [search, setSearch] = useState('');
  const [selectedGameId, setSelectedGameId] = useState(demoGame.id);
  const [dialogVariant, setDialogVariant] = useState<DialogVariant | null>(null);

  return (
    <div className="min-h-full bg-wanas-background text-wanas-text-primary">
      <header className="sticky top-0 z-40 border-b border-wanas-border bg-wanas-navbar px-4 py-4 shadow-sm sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-wanas-text-muted">Internal · Developers only</p>
            <h1 className="text-2xl font-bold text-wanas-text-primary">UI Playground</h1>
          </div>
          <nav aria-label="أقسام المعاينة" className="flex flex-wrap gap-2">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-xl border border-wanas-border bg-wanas-surface px-3 py-1.5 text-xs font-semibold text-wanas-text-secondary hover:bg-wanas-surface-soft"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
        <PlaygroundSection
          id="room-session"
          title="Room Session"
          description="أدوات التطوير المحلية فقط — لا تظهر في الإنتاج."
        >
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetRoomSessionForDevelopment();
                router.push('/');
              }}
            >
              إعادة ضبط جلسة الغرفة
            </Button>
            <p className="text-sm text-wanas-text-muted">
              يمسح جلسة وanasatna في هذا التبويب فقط، ويفصل socket الغرفة، ثم يعود للصفحة الرئيسية.
            </p>
          </div>
        </PlaygroundSection>

        <PlaygroundSection id="buttons" title="Buttons" description="كل أنماط الأزرار القابلة لإعادة الاستخدام.">
          <div className="grid gap-8">
            <PlaygroundSubsection title="Variants">
              <div className="flex flex-wrap gap-3">
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="danger">Danger</Button>
                <Button variant="success">Success</Button>
                <Button disabled>Disabled</Button>
                <Button loading>Loading</Button>
              </div>
            </PlaygroundSubsection>
            <PlaygroundSubsection title="Sizes">
              <div className="flex flex-wrap items-end gap-3">
                <Button size="sm">Small</Button>
                <Button size="md">Medium</Button>
                <Button size="lg">Large</Button>
              </div>
            </PlaygroundSubsection>
          </div>
        </PlaygroundSection>

        <PlaygroundSection id="inputs" title="Inputs" description="حقول الإدخال المستخدمة في الواجهة العامة.">
          <div className="grid max-w-md gap-6">
            <PublicField
              id="playground-default"
              label="Default"
              value={playerName}
              onChange={setPlayerName}
              placeholder="أدخل النص"
              icon={<UserIcon />}
            />
            <div className="space-y-2">
              <span className="text-sm font-semibold text-wanas-text-primary">Focus</span>
              <div className="flex h-12 items-center rounded-2xl border border-wanas-accent bg-wanas-surface px-4 text-sm ring-2 ring-wanas-accent/20">
                مثال على حالة التركيز
              </div>
            </div>
            <PublicField
              id="playground-disabled"
              label="Disabled"
              value="غير قابل للتعديل"
              onChange={() => undefined}
              placeholder="معطّل"
              disabled
            />
            <PublicField
              id="playground-error"
              label="Error"
              value=""
              onChange={() => undefined}
              placeholder="حقل خاطئ"
              hasError
            />
            <PublicField
              id="playground-search"
              label="Search"
              value={search}
              onChange={setSearch}
              placeholder="ابحث…"
              icon={<SearchIcon />}
            />
            <PublicField
              id="playground-room-code"
              label="Room Code"
              value={roomCode}
              onChange={setRoomCode}
              placeholder="٠٠٠٠٠٠"
              icon={<KeyIcon />}
              inputMode="numeric"
              inputClassName="font-mono tracking-[0.35em] placeholder:tracking-normal"
            />
            <PublicField
              id="playground-player-name"
              label="Player Name"
              value={playerName}
              onChange={setPlayerName}
              placeholder="اسم اللاعب"
              icon={<UserIcon />}
            />
          </div>
        </PlaygroundSection>

        <PlaygroundSection id="cards" title="Cards">
          <div className="grid gap-6 lg:grid-cols-2">
            <PlaygroundSubsection title="Game Card">
              <GameCard
                game={demoGame}
                selected={selectedGameId === demoGame.id}
                onSelect={setSelectedGameId}
                iconBg={demoCatalogEntry.iconBg}
                iconText={demoCatalogEntry.iconText}
                playerRange={demoCatalogEntry.playerRange}
              />
            </PlaygroundSubsection>
            <PlaygroundSubsection title="Game Card (Coming Soon)">
              <GameCard game={demoComingSoonGame} selected={false} onSelect={() => undefined} disabled />
            </PlaygroundSubsection>
            <PlaygroundSubsection title="Player Card">
              <PlayerCard
                player={demoPlayers[0]!}
                isCurrentPlayer
                avatarColors={getPlayerAvatarColors(demoPlayers[0]!.id)}
              />
            </PlaygroundSubsection>
            <PlaygroundSubsection title="Room Card">
              <RoomCard title="إنشاء غرفة" description="ابدأ غرفة جديدة وشارك الرمز" icon="+">
                <p className="text-sm text-wanas-text-muted">معاينة بطاقة الغرفة — بدون منطق أعمال.</p>
              </RoomCard>
            </PlaygroundSubsection>
            <PlaygroundSubsection title="Premium Card">
              <FeatureCard
                accent="purple"
                title="وناستنا بريميوم"
                description="مزايا إضافية اختيارية للراغبين في تجربة أوسع."
                icon={<span className="text-lg">★</span>}
              />
            </PlaygroundSubsection>
            <PlaygroundSubsection title="Feature Card">
              <FeatureCard
                accent="blue"
                title="ميزة تجريبية"
                description="بطاقة ميزة عامة من الواجهة العامة."
                icon={<span className="text-lg font-bold">1</span>}
              />
            </PlaygroundSubsection>
          </div>
        </PlaygroundSection>

        <PlaygroundSection id="badges" title="Badges">
          <div className="flex flex-wrap gap-3">
            <Badge variant="host" />
            <Badge variant="premium" />
            <Badge variant="online" />
            <Badge variant="offline" />
            <Badge variant="coming-soon" />
            <Badge variant="selected" />
            <StatusBadge variant="available" />
            <StatusBadge variant="coming-soon" />
            <StatusBadge variant="premium" />
          </div>
        </PlaygroundSection>

        <PlaygroundSection id="dialogs" title="Dialog Examples" description="معاينة فقط — بدون منطق أعمال.">
          <div className="flex flex-wrap gap-3">
            {(['confirmation', 'error', 'success', 'warning', 'loading'] as DialogVariant[]).map((variant) => (
              <Button key={variant} variant="outline" onClick={() => setDialogVariant(variant)}>
                {variant}
              </Button>
            ))}
          </div>
          <UiDialog
            open={dialogVariant !== null}
            variant={dialogVariant ?? 'confirmation'}
            title={
              dialogVariant === 'error'
                ? 'حدث خطأ'
                : dialogVariant === 'success'
                  ? 'تم بنجاح'
                  : dialogVariant === 'warning'
                    ? 'تنبيه'
                    : dialogVariant === 'loading'
                      ? 'جاري المعالجة'
                      : 'تأكيد الإجراء'
            }
            description="هذا مثال تجريبي للحوار — لا يؤثر على أي منطق في المنتج."
            onClose={() => setDialogVariant(null)}
          />
        </PlaygroundSection>

        <PlaygroundSection id="loading" title="Loading">
          <div className="grid gap-6 md:grid-cols-3">
            <PlaygroundSubsection title="Spinner">
              <div className="flex items-center gap-4">
                <Spinner size="sm" />
                <Spinner size="md" />
                <Spinner size="lg" />
              </div>
            </PlaygroundSubsection>
            <PlaygroundSubsection title="Skeleton">
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </PlaygroundSubsection>
            <PlaygroundSubsection title="Empty State">
              <EmptyState title="لا يوجد محتوى بعد." description="استخدم هذا المكوّن للحالات الفارغة." />
            </PlaygroundSubsection>
          </div>
        </PlaygroundSection>

        <PlaygroundSection id="colors" title="Colors" description="معاينة رموز الألوان المركزية — بدون hex مباشر.">
          <div className="grid gap-6">
            {designTokenGroups.map((group) => (
              <PlaygroundSubsection key={group.title} title={group.title}>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {group.tokens.map((token) => (
                    <div
                      key={token.name}
                      className="overflow-hidden rounded-2xl border border-wanas-border bg-wanas-surface-soft"
                    >
                      <div className={cn('h-14 border-b border-wanas-border', token.tailwindClass)} />
                      <div className="p-3">
                        <p className="text-xs font-bold text-wanas-text-primary">{token.name}</p>
                        <p className="mt-1 font-mono text-[10px] text-wanas-text-muted">{token.cssVar}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </PlaygroundSubsection>
            ))}
          </div>
        </PlaygroundSection>

        <PlaygroundSection id="typography" title="Typography">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold text-wanas-text-primary">H1 — العنوان الرئيسي</h1>
            <h2 className="text-2xl font-bold text-wanas-text-primary">H2 — عنوان القسم</h2>
            <h3 className="text-lg font-bold text-wanas-text-primary">H3 — عنوان فرعي</h3>
            <p className="text-base leading-8 text-wanas-text-secondary">Body — نص أساسي للفقرات والمحتوى الطويل في واجهة وناستنا.</p>
            <p className="text-xs text-wanas-text-muted">Caption — نص توضيحي صغير أو تسمية ثانوية.</p>
            <Button size="md">Button — نص الزر</Button>
          </div>
        </PlaygroundSection>

        <PlaygroundSection id="icons" title="Icons" description="الأيقونات المستخدمة حالياً في المشروع.">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            {projectIcons.map(({ name, Icon }) => (
              <div
                key={name}
                className="flex flex-col items-center gap-2 rounded-2xl border border-wanas-border bg-wanas-surface-soft p-4 text-center"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-wanas-surface text-wanas-primary-dark">
                  <Icon />
                </span>
                <span className="text-xs font-semibold text-wanas-text-muted">{name}</span>
              </div>
            ))}
          </div>
        </PlaygroundSection>

        <PlaygroundSection
          id="responsive"
          title="Responsive"
          description="نفس المكوّنات على شبكة متجاوبة — mobile / tablet / desktop."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((index) => (
              <div key={index} className="rounded-[20px] border border-wanas-border bg-wanas-surface-soft p-4">
                <p className="mb-3 text-xs font-bold text-wanas-text-muted">Card {index}</p>
                <Button className="mb-3 w-full">Primary</Button>
                <GameCard
                  game={demoGame}
                  selected={index === 1}
                  onSelect={() => undefined}
                  iconBg={demoCatalogEntry.iconBg}
                  iconText={demoCatalogEntry.iconText}
                  playerRange={demoCatalogEntry.playerRange}
                />
              </div>
            ))}
          </div>
        </PlaygroundSection>

        <PlaygroundSection
          id="game-components"
          title="Game Components"
          description="مكوّنات اللعب المعزولة — معاينة فقط بدون منطق أعمال."
        >
          <PlaygroundSubsection title="Countdown — برا السالفة">
            <div className="grid gap-6 lg:grid-cols-3">
              {([3, 2, 1] as const).map((currentNumber) => (
                <div
                  key={currentNumber}
                  className="overflow-hidden rounded-[24px] border border-wanas-border bg-wanas-background"
                >
                  <p className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2 text-xs font-bold text-wanas-text-muted">
                    Countdown — {currentNumber}
                  </p>
                  <CountdownScreen {...countdownDemoDefaults} currentNumber={currentNumber} />
                </div>
              ))}
            </div>
          </PlaygroundSubsection>

          <PlaygroundSubsection title="Directed Questions — برا السالفة">
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="overflow-hidden rounded-[24px] border border-wanas-border bg-wanas-background">
                <p className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2 text-xs font-bold text-wanas-text-muted">
                  Active Asker View
                </p>
                <DirectedQuestionsScreen
                  {...directedQuestionsDemoDefaults}
                  currentPlayerId={directedQuestionsDemoDefaults.askerPlayerId}
                />
              </div>
              <div className="overflow-hidden rounded-[24px] border border-wanas-border bg-wanas-background">
                <p className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2 text-xs font-bold text-wanas-text-muted">
                  Other Player View
                </p>
                <DirectedQuestionsScreen
                  {...directedQuestionsDemoDefaults}
                  currentPlayerId="p3"
                />
              </div>
            </div>
            <div className="mt-6 overflow-hidden rounded-[24px] border border-wanas-border bg-wanas-background">
              <p className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2 text-xs font-bold text-wanas-text-muted">
                Mobile Width Preview — Other Player View
              </p>
              <div className="mx-auto max-w-[390px] border-x border-wanas-border">
                <DirectedQuestionsScreen
                  {...directedQuestionsDemoDefaults}
                  currentPlayerId="p3"
                />
              </div>
            </div>
          </PlaygroundSubsection>

          <PlaygroundSubsection title="Free Questions — برا السالفة">
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="overflow-hidden rounded-[24px] border border-wanas-border bg-wanas-background">
                <p className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2 text-xs font-bold text-wanas-text-muted">
                  Active Player — Selected Target
                </p>
                <FreeQuestionsActivePreview />
              </div>
              <div className="overflow-hidden rounded-[24px] border border-wanas-border bg-wanas-background">
                <p className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2 text-xs font-bold text-wanas-text-muted">
                  Other Player — Waiting View
                </p>
                <FreeQuestionsScreen {...freeQuestionsWaitingDemoDefaults} />
              </div>
            </div>
            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <div className="overflow-hidden rounded-[24px] border border-wanas-border bg-wanas-background">
                <p className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2 text-xs font-bold text-wanas-text-muted">
                  Most Players Completed
                </p>
                <FreeQuestionsScreen {...freeQuestionsMostCompletedDemoDefaults} />
              </div>
              <div className="overflow-hidden rounded-[24px] border border-wanas-border bg-wanas-background">
                <p className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2 text-xs font-bold text-wanas-text-muted">
                  Mobile Width — Waiting View
                </p>
                <div className="mx-auto max-w-[390px] border-x border-wanas-border">
                  <FreeQuestionsScreen {...freeQuestionsWaitingDemoDefaults} />
                </div>
              </div>
            </div>
          </PlaygroundSubsection>

          <PlaygroundSubsection title="Voting — برا السالفة">
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="overflow-hidden rounded-[24px] border border-wanas-border bg-wanas-background">
                <p className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2 text-xs font-bold text-wanas-text-muted">
                  Not Voted — Candidate Selected
                </p>
                <VotingNotVotedPreview />
              </div>
              <div className="overflow-hidden rounded-[24px] border border-wanas-border bg-wanas-background">
                <p className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2 text-xs font-bold text-wanas-text-muted">
                  Voted — Confirmed State
                </p>
                <VotingScreen {...votingConfirmedDemoDefaults} />
              </div>
            </div>
            <div className="mt-6 grid gap-6 xl:grid-cols-3">
              <div className="overflow-hidden rounded-[24px] border border-wanas-border bg-wanas-background">
                <p className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2 text-xs font-bold text-wanas-text-muted">
                  Low Time — 5 Seconds Remaining
                </p>
                <VotingScreen {...votingLowTimeDemoDefaults} />
              </div>
              <div className="overflow-hidden rounded-[24px] border border-wanas-border bg-wanas-background">
                <p className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2 text-xs font-bold text-wanas-text-muted">
                  Validation / Error State
                </p>
                <VotingScreen {...votingErrorDemoDefaults} />
              </div>
              <div className="overflow-hidden rounded-[24px] border border-wanas-border bg-wanas-background">
                <p className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2 text-xs font-bold text-wanas-text-muted">
                  Mobile Width — Not Voted
                </p>
                <div className="mx-auto max-w-[390px] border-x border-wanas-border">
                  <VotingNotVotedPreview />
                </div>
              </div>
            </div>
          </PlaygroundSubsection>

          <PlaygroundSubsection title="Reveal Impostor — برا السالفة">
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="overflow-hidden rounded-[24px] border border-wanas-border bg-wanas-background">
                <p className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2 text-xs font-bold text-wanas-text-muted">
                  Standard Desktop Preview
                </p>
                <RevealImpostorScreen {...revealImpostorDemoDefaults} />
              </div>
              <div className="overflow-hidden rounded-[24px] border border-wanas-border bg-wanas-background">
                <p className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2 text-xs font-bold text-wanas-text-muted">
                  Low Time — 1 Second Remaining
                </p>
                <RevealImpostorScreen {...revealImpostorLowTimeDemoDefaults} />
              </div>
            </div>
            <div className="mt-6 overflow-hidden rounded-[24px] border border-wanas-border bg-wanas-background">
              <p className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2 text-xs font-bold text-wanas-text-muted">
                Mobile Width Preview
              </p>
              <div className="mx-auto max-w-[390px] border-x border-wanas-border">
                <RevealImpostorScreen {...revealImpostorDemoDefaults} />
              </div>
            </div>
          </PlaygroundSubsection>

          <PlaygroundSubsection title="Impostor Guess — برا السالفة">
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="overflow-hidden rounded-[24px] border border-wanas-border bg-wanas-background">
                <p className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2 text-xs font-bold text-wanas-text-muted">
                  Impostor View — Selecting
                </p>
                <ImpostorGuessActivePreview />
              </div>
              <div className="overflow-hidden rounded-[24px] border border-wanas-border bg-wanas-background">
                <p className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2 text-xs font-bold text-wanas-text-muted">
                  Impostor View — After Submit
                </p>
                <ImpostorGuessScreen {...impostorGuessSubmittedDemoDefaults} />
              </div>
            </div>
            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <div className="overflow-hidden rounded-[24px] border border-wanas-border bg-wanas-background">
                <p className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2 text-xs font-bold text-wanas-text-muted">
                  Normal Player — Waiting View
                </p>
                <ImpostorGuessScreen {...impostorGuessWaitingDemoDefaults} />
              </div>
              <div className="overflow-hidden rounded-[24px] border border-wanas-border bg-wanas-background">
                <p className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2 text-xs font-bold text-wanas-text-muted">
                  Mobile Width — Impostor View
                </p>
                <div className="mx-auto max-w-[390px] border-x border-wanas-border">
                  <ImpostorGuessActivePreview />
                </div>
              </div>
            </div>
          </PlaygroundSubsection>

          <PlaygroundSubsection title="Round Results — برا السالفة">
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="overflow-hidden rounded-[24px] border border-wanas-border bg-wanas-background">
                <p className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2 text-xs font-bold text-wanas-text-muted">
                  Impostor Guessed Correctly
                </p>
                <RoundResultsScreen {...roundResultsCorrectDemoDefaults} />
              </div>
              <div className="overflow-hidden rounded-[24px] border border-wanas-border bg-wanas-background">
                <p className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2 text-xs font-bold text-wanas-text-muted">
                  Impostor Guessed Incorrectly
                </p>
                <RoundResultsScreen {...roundResultsWrongDemoDefaults} />
              </div>
            </div>
            <div className="mt-6 grid gap-6 xl:grid-cols-3">
              <div className="overflow-hidden rounded-[24px] border border-wanas-border bg-wanas-background">
                <p className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2 text-xs font-bold text-wanas-text-muted">
                  Final Round
                </p>
                <RoundResultsScreen {...roundResultsFinalRoundDemoDefaults} />
              </div>
              <div className="overflow-hidden rounded-[24px] border border-wanas-border bg-wanas-background">
                <p className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2 text-xs font-bold text-wanas-text-muted">
                  Leaderboard Tie
                </p>
                <RoundResultsScreen {...roundResultsTieDemoDefaults} />
              </div>
              <div className="overflow-hidden rounded-[24px] border border-wanas-border bg-wanas-background">
                <p className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2 text-xs font-bold text-wanas-text-muted">
                  Mobile Width
                </p>
                <div className="mx-auto max-w-[390px] border-x border-wanas-border">
                  <RoundResultsScreen {...roundResultsCorrectDemoDefaults} />
                </div>
              </div>
            </div>
          </PlaygroundSubsection>

          <PlaygroundSubsection title="Match Results — برا السالفة">
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="overflow-hidden rounded-[24px] border border-wanas-border bg-wanas-background">
                <p className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2 text-xs font-bold text-wanas-text-muted">
                  Single Winner
                </p>
                <MatchResultsScreen {...matchResultsSingleWinnerDemoDefaults} />
              </div>
              <div className="overflow-hidden rounded-[24px] border border-wanas-border bg-wanas-background">
                <p className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2 text-xs font-bold text-wanas-text-muted">
                  Tied Winners
                </p>
                <MatchResultsScreen {...matchResultsTiedWinnersDemoDefaults} />
              </div>
            </div>
            <div className="mt-6 grid gap-6 xl:grid-cols-3">
              <div className="overflow-hidden rounded-[24px] border border-wanas-border bg-wanas-background">
                <p className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2 text-xs font-bold text-wanas-text-muted">
                  Current Player — First Place
                </p>
                <MatchResultsScreen {...matchResultsCurrentPlayerFirstDemoDefaults} />
              </div>
              <div className="overflow-hidden rounded-[24px] border border-wanas-border bg-wanas-background">
                <p className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2 text-xs font-bold text-wanas-text-muted">
                  Current Player — Outside Top 3
                </p>
                <MatchResultsScreen {...matchResultsCurrentPlayerOutsideTop3DemoDefaults} />
              </div>
              <div className="overflow-hidden rounded-[24px] border border-wanas-border bg-wanas-background">
                <p className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2 text-xs font-bold text-wanas-text-muted">
                  Mobile Width
                </p>
                <div className="mx-auto max-w-[390px] border-x border-wanas-border">
                  <MatchResultsScreen {...matchResultsSingleWinnerDemoDefaults} />
                </div>
              </div>
            </div>
          </PlaygroundSubsection>

          <PlaygroundSubsection title="Bara AlSalafa Full Flow">
            <BaraAlSalafaFullFlowPreview />
          </PlaygroundSubsection>

          <PlaygroundSubsection title="Role Reveal — برا السالفة">
            <div className="grid gap-8 xl:grid-cols-2">
              <div className="overflow-hidden rounded-[24px] border border-wanas-border bg-wanas-background">
                <p className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2 text-xs font-bold text-wanas-text-muted">
                  STATE A — Normal Player
                </p>
                <RoleRevealScreen
                  {...roleRevealDemoDefaults}
                  role="normal"
                  players={roleRevealDemoPlayers}
                />
              </div>
              <div className="overflow-hidden rounded-[24px] border border-wanas-border bg-wanas-background">
                <p className="border-b border-wanas-border bg-wanas-surface-soft px-4 py-2 text-xs font-bold text-wanas-text-muted">
                  STATE B — Impostor
                </p>
                <RoleRevealScreen
                  {...roleRevealDemoDefaults}
                  role="impostor"
                  players={roleRevealDemoPlayers}
                />
              </div>
            </div>
          </PlaygroundSubsection>
        </PlaygroundSection>
      </main>
    </div>
  );
}
