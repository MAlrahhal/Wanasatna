'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type {
  DrawGuessTool,
  EyewitnessAnonymousArtwork,
  EyewitnessPlayerView,
} from '@wanasatna/shared';
import { EYEWITNESS_GAME_ID } from '@wanasatna/shared';
import { DeadlineProgress } from '@/components/game/deadline-progress';
import { GameScreen } from '@/components/game/game-card';
import {
  GameSystemError,
  GameSystemLoading,
  SpectatorNotice,
} from '@/components/room/room-system-state';
import { useSetGameExperienceMeta } from '@/contexts/game-experience-context';
import { useGameShell } from '@/contexts/game-shell-context';
import { eyewitnessExperienceMeta } from '@/lib/game/experimental-game-experience';
import { cn } from '@/lib/utils';
import { DrawingCanvas } from '@/plugins/draw-guess/drawing-canvas';
import { DrawingToolbar } from '@/plugins/draw-guess/drawing-toolbar';
import { useEyewitnessPlayerView } from './use-player-view';

export function EyewitnessGameScreen() {
  const { state: shell } = useGameShell();
  const setExperienceMeta = useSetGameExperienceMeta();
  const enabled = shell?.gameId === EYEWITNESS_GAME_ID && shell.phase === 'PLAYING';
  const actions = useEyewitnessPlayerView(enabled);
  const { view, error, loading, submitting } = actions;
  const [draft, setDraft] = useState({ roundId: '', value: '' });
  const [voteSelection, setVoteSelection] = useState<{
    roundId: string;
    artworkId: string | null;
  }>({ roundId: '', artworkId: null });
  const [preview, setPreview] = useState<EyewitnessAnonymousArtwork | null>(null);
  const saveDescriptionRef = useRef(actions.saveDescription);
  const currentDraft = view
    ? draft.roundId === view.roundId
      ? draft.value
      : (view.ownDescriptionDraft ?? '')
    : '';
  const selectedArtworkId = view
    ? voteSelection.roundId === view.roundId
      ? voteSelection.artworkId
      : view.confirmedArtworkId
    : null;

  useEffect(() => {
    if (!enabled) {
      setExperienceMeta(null);
      return;
    }
    setExperienceMeta(
      view
        ? eyewitnessExperienceMeta(view)
        : { gameName: 'شاهد عيان', gameIcon: '👁️', phaseLabel: 'جارٍ التحميل…' },
    );
  }, [enabled, setExperienceMeta, view]);

  useEffect(() => () => setExperienceMeta(null), [setExperienceMeta]);

  useEffect(() => {
    saveDescriptionRef.current = actions.saveDescription;
  }, [actions.saveDescription]);

  useEffect(() => {
    if (!view?.isWitness || view.phase !== 'witness' || draft.roundId !== view.roundId) return;
    const timeout = window.setTimeout(() => {
      void saveDescriptionRef.current(currentDraft);
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [currentDraft, draft.roundId, view?.isWitness, view?.phase, view?.roundId]);

  if (!enabled) return null;
  if (loading && !view) return <GameSystemLoading />;
  if (error && !view) return <GameSystemError message={error} />;
  if (!view) return null;

  const showProgress = view.phase === 'round-results';
  return (
    <GameScreen ariaLabel="شاهد عيان" maxWidth="6xl" className="min-w-0 gap-3">
      {showProgress ? (
        <DeadlineProgress
          deadlineAtMs={view.deadlineAtMs}
          totalDurationSeconds={10}
          className="h-2"
        />
      ) : null}
      <section className="border-wanas-border bg-wanas-surface flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3">
        <div>
          <p className="text-wanas-text-muted text-xs font-bold">مهمتك الآن</p>
          <p className="text-wanas-text-primary mt-0.5 font-black">
            {view.isSpectator
              ? 'شاهد الجولة دون إجراء'
              : view.phase === 'witness' && view.isWitness
                ? 'شاهد الصورة ثم صفها للمجموعة'
                : view.phase === 'drawing' && view.isArtist
                  ? 'ارسم اعتمادًا على وصف الشاهد'
                  : view.phase === 'voting' && view.canVote
                    ? 'قارن الرسومات ثم اختر الأفضل'
                    : 'انتظر اكتمال إجراء اللاعبين'}
          </p>
        </div>
        <span className="bg-wanas-primary-surface text-wanas-text-primary rounded-xl px-3 py-2 text-sm font-bold">
          👁️ الشاهد: {view.witnessName}
        </span>
      </section>

      {view.phase === 'witness' ? (
        <WitnessPhase
          view={view}
          draft={currentDraft}
          setDraft={(value) => setDraft({ roundId: view.roundId, value })}
          disabled={submitting}
          saveDraft={() => void actions.saveDescription(currentDraft)}
          submit={() => void actions.submitDescription(currentDraft)}
        />
      ) : null}
      {view.phase === 'drawing' ? (
        <DrawingPhase view={view} actions={actions} disabled={submitting} />
      ) : null}
      {view.phase === 'voting' ? (
        <VotingPhase
          view={view}
          selected={selectedArtworkId}
          setSelected={(artworkId) => setVoteSelection({ roundId: view.roundId, artworkId })}
          preview={preview}
          setPreview={setPreview}
          disabled={submitting}
          confirm={() => selectedArtworkId && void actions.confirmVote(selectedArtworkId)}
        />
      ) : null}
      {view.phase === 'round-results' ? (
        <RoundResults view={view} disabled={submitting} advance={() => void actions.advance()} />
      ) : null}
      {view.phase === 'completed' ? <FinalSummary view={view} /> : null}

      {view.isSpectator ? (
        <SpectatorNotice
          title="أنت متفرج في هذه الجولة"
          description="تشاهد المعلومات المسموحة في كل مرحلة، وستدخل ضمن المشاركين في الجولة التالية إن استمرت المباراة."
        />
      ) : null}
      {error ? (
        <p
          role="alert"
          className="border-wanas-error/40 text-wanas-error rounded-xl border p-3 text-sm"
        >
          {error}
        </p>
      ) : null}
      {preview ? <ArtworkModal artwork={preview} close={() => setPreview(null)} /> : null}
    </GameScreen>
  );
}

function WitnessPhase(props: {
  view: EyewitnessPlayerView;
  draft: string;
  setDraft: (value: string) => void;
  saveDraft: () => void;
  submit: () => void;
  disabled: boolean;
}) {
  const [zoom, setZoom] = useState(1);
  if (!props.view.isWitness) {
    return (
      <section className="border-wanas-border bg-wanas-surface rounded-2xl border p-6 text-center">
        <p className="text-wanas-text-primary text-xl font-black">الشاهد يشاهد الصورة الآن</p>
        <p className="text-wanas-text-muted mt-2">الصورة والوصف غير مرسلين لك في هذه المرحلة.</p>
        {props.view.waitingForWitness ? (
          <p className="mt-3 text-sm text-amber-200">المؤقت متوقف مؤقتًا حتى يعود الشاهد.</p>
        ) : null}
      </section>
    );
  }
  return (
    <section className="border-wanas-border bg-wanas-surface grid gap-4 rounded-2xl border p-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)] lg:p-5">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-wanas-text-primary font-black">الصورة السرية — صفها دون إظهارها</p>
          <div
            className="border-wanas-border bg-wanas-surface-soft flex items-center gap-1 rounded-xl border p-1"
            aria-label="أدوات تكبير الصورة"
          >
            <button
              type="button"
              onClick={() => setZoom((value) => Math.max(1, value - 0.25))}
              className="text-wanas-text-primary size-10 rounded-lg font-black hover:bg-white/5"
              aria-label="تصغير الصورة"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="text-wanas-text-muted min-h-10 rounded-lg px-2 text-xs font-bold hover:bg-white/5"
            >
              {Math.round(zoom * 100)}٪ · إعادة
            </button>
            <button
              type="button"
              onClick={() => setZoom((value) => Math.min(2.5, value + 0.25))}
              className="text-wanas-text-primary size-10 rounded-lg font-black hover:bg-white/5"
              aria-label="تكبير الصورة"
            >
              +
            </button>
          </div>
        </div>
        <div className="border-wanas-border h-[min(52dvh,34rem)] touch-pan-x touch-pan-y overflow-auto overscroll-contain rounded-xl border bg-white">
          {props.view.privateReferenceImageDataUrl ? (
            <Image
              src={props.view.privateReferenceImageDataUrl}
              alt="الصورة السرية الخاصة بشاهد العيان"
              width={768}
              height={768}
              unoptimized
              priority
              draggable={false}
              className="max-w-none select-none"
              style={{ width: `${zoom * 100}%`, height: 'auto', transformOrigin: 'top right' }}
            />
          ) : null}
        </div>
      </div>
      <form
        className="flex min-w-0 flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          props.submit();
        }}
      >
        <label htmlFor="eyewitness-description" className="text-wanas-text-primary font-bold">
          الوصف المكتوب (اختياري)
        </label>
        <textarea
          id="eyewitness-description"
          value={props.draft}
          onChange={(event) => props.setDraft(event.target.value)}
          onBlur={props.saveDraft}
          maxLength={600}
          rows={9}
          className="border-wanas-border bg-wanas-surface-soft text-wanas-text-primary min-h-32 flex-1 rounded-xl border p-3 text-base lg:min-h-48"
          placeholder="اكتب تفاصيل المخلوق، ألوانه، ملابسه، وما يحمله… أو اتركه فارغًا واشرح بصوتك."
        />
        <p className="text-wanas-text-muted text-xs">
          {props.draft.length} / 600 · بعد الإرسال يُقفل الوصف وتُخفى الصورة.
        </p>
        <button
          type="submit"
          disabled={props.disabled}
          className="bg-wanas-accent min-h-12 rounded-xl px-4 font-bold text-white disabled:opacity-50"
        >
          إرسال الوصف
        </button>
      </form>
    </section>
  );
}

type EyewitnessActions = ReturnType<typeof useEyewitnessPlayerView>;

function DrawingPhase({
  view,
  actions,
  disabled,
}: {
  view: EyewitnessPlayerView;
  actions: EyewitnessActions;
  disabled: boolean;
}) {
  const [tool, setTool] = useState<DrawGuessTool>('draw');
  const [color, setColor] = useState('#111827');
  const [size, setSize] = useState(8);
  return (
    <section className="space-y-3">
      <div className="border-wanas-border bg-wanas-surface rounded-2xl border p-4 text-center">
        <p className="text-wanas-text-muted text-xs">وصف الشاهد</p>
        <p className="text-wanas-text-primary mt-1 whitespace-pre-wrap text-lg font-bold">
          {view.lockedDescription || 'لا يوجد وصف مكتوب — استمع إلى شرح الشاهد.'}
        </p>
        <p className="text-wanas-text-muted mt-2 text-xs">
          سُلّمت {view.submittedArtworkCount} من {view.eligibleArtistCount} رسومات
        </p>
      </div>
      {view.isArtist ? (
        view.ownArtworkSubmitted ? (
          <div className="rounded-2xl border border-emerald-300/40 bg-emerald-300/10 p-6 text-center text-emerald-100">
            تم تثبيت رسمتك. انتظر بدء التصويت.
          </div>
        ) : (
          <div className="space-y-3" data-eyewitness-drawing-workspace="">
            <DrawingCanvas
              strokes={view.ownStrokes}
              readOnly={!view.canDraw}
              turnId={view.roundId}
              tool={tool}
              color={color}
              size={size}
              onStrokeStart={(payload) => void actions.strokeStart(payload)}
              onStrokePoints={(payload) => void actions.strokePoints(payload)}
              onStrokeEnd={({ strokeId }) => void actions.strokeEnd(strokeId)}
              className="[&>canvas]:h-[min(58dvh,34rem)] [&>canvas]:min-h-64"
            />
            <DrawingToolbar
              tool={tool}
              color={color}
              size={size}
              disabled={!view.canDraw || disabled}
              onToolChange={setTool}
              onColorChange={setColor}
              onSizeChange={setSize}
              onUndo={() => void actions.undo()}
              onClear={() => {
                if (window.confirm('هل تريد مسح اللوحة كاملة؟')) void actions.clearCanvas();
              }}
            />
            <button
              type="button"
              disabled={!view.canSubmitArtwork || disabled}
              onClick={() => void actions.submitArtwork()}
              className="bg-wanas-accent min-h-12 w-full rounded-xl px-4 font-bold text-white disabled:opacity-50"
            >
              تسليم الرسمة
            </button>
          </div>
        )
      ) : (
        <div className="border-wanas-border bg-wanas-surface rounded-2xl border p-6 text-center">
          <p className="text-wanas-text-primary font-bold">الرسامون يعملون الآن</p>
          <p className="text-wanas-text-muted mt-2 text-sm">لن تظهر الرسومات قبل مرحلة التصويت.</p>
        </div>
      )}
    </section>
  );
}

function ReferenceImage({ src }: { src: string }) {
  return (
    <Image
      src={src}
      alt="الصورة الأصلية بعد كشفها"
      width={768}
      height={768}
      unoptimized
      className="h-auto w-full rounded-xl"
    />
  );
}

function VotingPhase(props: {
  view: EyewitnessPlayerView;
  selected: string | null;
  setSelected: (id: string) => void;
  preview: EyewitnessAnonymousArtwork | null;
  setPreview: (artwork: EyewitnessAnonymousArtwork | null) => void;
  disabled: boolean;
  confirm: () => void;
}) {
  return (
    <section className="space-y-4">
      <div className="border-wanas-border bg-wanas-surface mx-auto max-w-md rounded-2xl border p-3">
        <p className="text-wanas-text-primary mb-2 text-center font-black">الصورة الأصلية</p>
        {props.view.revealedReferenceImageDataUrl ? (
          <ReferenceImage src={props.view.revealedReferenceImageDataUrl} />
        ) : null}
      </div>
      <div>
        <h2 className="text-wanas-text-primary text-center text-xl font-black">اختر أفضل رسمة</h2>
        <p className="text-wanas-text-muted mt-1 text-center text-sm">
          الأسماء والنتائج مخفية حتى ينتهي كامل وقت التصويت.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {props.view.anonymousArtworks.map((artwork, index) => {
          const own = artwork.artworkId === props.view.ownArtworkId;
          const selected = artwork.artworkId === props.selected;
          return (
            <article
              key={artwork.artworkId}
              className={cn(
                'border-wanas-border bg-wanas-surface rounded-2xl border-2 p-2',
                selected && 'border-wanas-accent',
              )}
            >
              <button
                type="button"
                onClick={() => props.setPreview(artwork)}
                className="w-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--wanas-game-accent)]"
                aria-label={`تكبير الرسمة ${index + 1}`}
              >
                <DrawingCanvas strokes={artwork.strokes} readOnly className="pointer-events-none" />
              </button>
              <button
                type="button"
                disabled={!props.view.canVote || own || props.disabled}
                aria-pressed={selected}
                onClick={() => props.setSelected(artwork.artworkId)}
                className="border-wanas-border text-wanas-text-primary mt-2 min-h-11 w-full rounded-xl border px-3 font-bold disabled:opacity-50"
              >
                {own
                  ? 'رسمتك — لا يمكنك التصويت لها'
                  : selected
                    ? 'تم اختيارها'
                    : `اختيار الرسمة ${index + 1}`}
              </button>
            </article>
          );
        })}
      </div>
      {props.view.canVote ? (
        <button
          type="button"
          disabled={!props.selected || props.disabled}
          onClick={props.confirm}
          className="bg-wanas-accent min-h-12 w-full rounded-xl px-4 font-bold text-white disabled:opacity-50"
        >
          تأكيد التصويت
        </button>
      ) : (
        <p className="text-wanas-text-muted text-center text-sm">
          المتفرجون يشاهدون الرسومات ولا يصوّتون.
        </p>
      )}
      {props.view.confirmedArtworkId ? (
        <p className="text-center text-sm text-emerald-200">
          تم اعتماد تصويتك ويمكنك تغييره قبل انتهاء الوقت.
        </p>
      ) : null}
    </section>
  );
}

function ArtworkModal({
  artwork,
  close,
}: {
  artwork: EyewitnessAnonymousArtwork;
  close: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="معاينة الرسمة"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-[max(0.75rem,env(safe-area-inset-top))]"
      onClick={close}
    >
      <div className="w-full max-w-4xl" onClick={(event) => event.stopPropagation()}>
        <DrawingCanvas strokes={artwork.strokes} readOnly />
        <button
          type="button"
          onClick={close}
          className="bg-wanas-surface text-wanas-text-primary mt-3 min-h-12 w-full rounded-xl font-bold"
        >
          إغلاق المعاينة
        </button>
      </div>
    </div>
  );
}

function RoundResults({
  view,
  disabled,
  advance,
}: {
  view: EyewitnessPlayerView;
  disabled: boolean;
  advance: () => void;
}) {
  return (
    <section className="space-y-4">
      <div className="border-wanas-border bg-wanas-surface mx-auto max-w-md rounded-2xl border p-3">
        <p className="text-wanas-text-primary mb-2 text-center font-black">الصورة الأصلية</p>
        {view.revealedReferenceImageDataUrl ? (
          <ReferenceImage src={view.revealedReferenceImageDataUrl} />
        ) : null}
      </div>
      {view.resultReason === 'witness-left' ? (
        <p className="rounded-xl bg-amber-300/10 p-4 text-center text-amber-100">
          انتهت الجولة لأن الشاهد غادر قبل تثبيت الوصف. لا توجد رسومات أو فائز مصطنع.
        </p>
      ) : null}
      {view.resultArtworks.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {view.resultArtworks.map((artwork) => (
            <article
              key={artwork.artworkId}
              className={cn(
                'border-wanas-border bg-wanas-surface rounded-2xl border-2 p-2',
                artwork.isRoundWinner && 'border-amber-300 bg-amber-300/10',
              )}
            >
              <DrawingCanvas strokes={artwork.strokes} readOnly />
              <div className="mt-2 flex items-center justify-between gap-2 px-2">
                <strong className="text-wanas-text-primary">{artwork.artistName}</strong>
                <span className="text-wanas-text-muted">{artwork.voteCount} أصوات</span>
              </div>
              {artwork.isRoundWinner ? (
                <p className="mt-1 text-center font-black text-amber-200">أفضل رسمة</p>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
      {view.resultArtworks.length > 0 && view.roundWinnerArtworkIds.length === 0 ? (
        <p className="text-wanas-text-muted text-center">
          لم تُسجّل أصوات صالحة؛ لا فائز في هذه الجولة.
        </p>
      ) : null}
      {view.canAdvance ? (
        <button
          type="button"
          disabled={disabled}
          onClick={advance}
          className="bg-wanas-accent min-h-12 w-full rounded-xl px-4 font-bold text-white disabled:opacity-50"
        >
          التالي
        </button>
      ) : null}
    </section>
  );
}

function FinalSummary({ view }: { view: EyewitnessPlayerView }) {
  const sorted = [...view.leaderboard].sort(
    (left, right) =>
      right.wins - left.wins || left.playerName.localeCompare(right.playerName, 'ar'),
  );
  return (
    <section className="border-wanas-accent/50 bg-wanas-primary-surface rounded-2xl border p-5">
      <h2 className="text-wanas-text-primary text-center text-2xl font-black">نتائج المباراة</h2>
      <div className="mt-4 space-y-2">
        {sorted.map((entry) => (
          <div
            key={entry.playerId}
            className={cn(
              'border-wanas-border bg-wanas-surface flex items-center justify-between rounded-xl border p-3',
              entry.isMatchWinner && 'border-amber-300',
            )}
          >
            <span className="text-wanas-text-primary font-bold">
              {entry.playerName}
              {entry.isMatchWinner ? ' — فائز مشترك' : ''}
            </span>
            <span className="font-black text-amber-200">{entry.wins} فوز</span>
          </div>
        ))}
      </div>
    </section>
  );
}
