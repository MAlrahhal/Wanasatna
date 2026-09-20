import {
  toAdsterraAtOptions,
  type AdsterraAtOptions,
  type AdsterraBannerZone,
  type AdsterraStaticZoneId,
} from './adsterra';

type AdsterraWindow = Window & {
  atOptions?: AdsterraAtOptions;
};

type SerialTask = () => Promise<void>;

export type AdsterraLoadOutcome = 'rendered' | 'error' | 'timeout' | 'cancelled' | 'duplicate';

export type AdsterraBannerHandle = {
  cancel: () => void;
  completion: Promise<AdsterraLoadOutcome>;
};

type AdsterraLoaderEnvironment = {
  getWindow: () => AdsterraWindow | null;
  getDocument: () => Document | null;
  observe: (host: HTMLElement, onChange: () => void) => () => void;
};

type CreateAdsterraBannerLoaderOptions = {
  environment?: AdsterraLoaderEnvironment;
  timeoutMs?: number;
};

type AdsterraDiagnosticState =
  | 'queued'
  | 'script-inserted'
  | 'script-loaded'
  | 'rendered'
  | 'error'
  | 'timeout'
  | 'cancelled'
  | 'duplicate'
  | 'cleaned';

const SCRIPT_SETTLE_TIMEOUT_MS = 12_000;

export function createSerialTaskQueue() {
  let tail = Promise.resolve();

  return {
    enqueue(task: SerialTask): Promise<void> {
      const next = tail.then(task, task);
      tail = next.catch(() => undefined);
      return next;
    },
  };
}

function createBrowserEnvironment(): AdsterraLoaderEnvironment {
  return {
    getWindow: () => (typeof window === 'undefined' ? null : (window as AdsterraWindow)),
    getDocument: () => (typeof document === 'undefined' ? null : document),
    observe: (host, onChange) => {
      const observer = new MutationObserver(onChange);
      observer.observe(host, { childList: true, subtree: true });
      return () => observer.disconnect();
    },
  };
}

function clearNode(node: HTMLElement): void {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function hasRenderedAd(host: HTMLElement): boolean {
  return host.querySelector('iframe') !== null;
}

function setDevelopmentDiagnostic(
  host: HTMLElement,
  placement: string,
  zone: AdsterraBannerZone,
  state: AdsterraDiagnosticState,
): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  host.dataset.adsterraPlacement = placement;
  host.dataset.adsterraZone = `${zone.width}x${zone.height}`;
  host.dataset.adsterraState = state;
}

function setDevelopmentResult(host: HTMLElement, outcome: AdsterraLoadOutcome): void {
  if (process.env.NODE_ENV !== 'production') {
    host.dataset.adsterraResult = outcome;
  }
}

export function createAdsterraBannerLoader({
  environment = createBrowserEnvironment(),
  timeoutMs = SCRIPT_SETTLE_TIMEOUT_MS,
}: CreateAdsterraBannerLoaderOptions = {}) {
  const queue = createSerialTaskQueue();
  const hostOwners = new WeakMap<HTMLElement, symbol>();
  const zoneOwners = new Map<AdsterraStaticZoneId, symbol>();

  return {
    enqueue(host: HTMLElement, zone: AdsterraBannerZone, placement: string): AdsterraBannerHandle {
      const owner = Symbol(placement);
      let cancelled = false;
      let finishActiveTask: ((outcome: AdsterraLoadOutcome) => void) | undefined;
      let resolveOutcome: (outcome: AdsterraLoadOutcome) => void = () => undefined;
      const completion = new Promise<AdsterraLoadOutcome>((resolve) => {
        resolveOutcome = resolve;
      });

      setDevelopmentDiagnostic(host, placement, zone, 'queued');

      if (zoneOwners.has(zone.id)) {
        setDevelopmentDiagnostic(host, placement, zone, 'duplicate');
        setDevelopmentResult(host, 'duplicate');
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[Adsterra] Refused duplicate live static unit ${zone.id} at ${placement}.`);
        }
        resolveOutcome('duplicate');
        return { cancel: () => undefined, completion };
      }

      zoneOwners.set(zone.id, owner);

      const releaseZone = () => {
        if (zoneOwners.get(zone.id) === owner) {
          zoneOwners.delete(zone.id);
        }
      };

      const clearOwnedHost = () => {
        if (hostOwners.get(host) !== owner) {
          return;
        }

        clearNode(host);
        hostOwners.delete(host);
        setDevelopmentDiagnostic(host, placement, zone, 'cleaned');
      };

      void queue.enqueue(
        () =>
          new Promise<void>((resolveTask) => {
            const adWindow = environment.getWindow();
            const adDocument = environment.getDocument();
            if (cancelled || !adWindow || !adDocument) {
              setDevelopmentResult(host, 'cancelled');
              releaseZone();
              resolveOutcome('cancelled');
              resolveTask();
              return;
            }

            clearNode(host);
            hostOwners.set(host, owner);

            const slot = adDocument.createElement('div');
            slot.dir = 'ltr';
            slot.dataset.adsterraSlot = placement;
            slot.style.width = '100%';
            slot.style.height = '100%';
            host.appendChild(slot);

            const options = toAdsterraAtOptions(zone);
            adWindow.atOptions = options;

            const script = adDocument.createElement('script');
            let settled = false;
            let stopObserving: () => void = () => undefined;

            const settle = (outcome: AdsterraLoadOutcome) => {
              if (settled) {
                return;
              }

              settled = true;
              stopObserving();
              adWindow.clearTimeout(timeoutId);
              if (adWindow.atOptions === options) {
                delete adWindow.atOptions;
              }
              script.onload = null;
              script.onerror = null;
              finishActiveTask = undefined;
              setDevelopmentResult(host, outcome);
              if (outcome !== 'rendered') {
                releaseZone();
              }
              resolveOutcome(outcome);
              resolveTask();
            };

            const detectRenderedAd = () => {
              if (!hasRenderedAd(slot)) {
                return;
              }

              setDevelopmentDiagnostic(host, placement, zone, 'rendered');
              settle('rendered');
            };

            stopObserving = environment.observe(slot, detectRenderedAd);
            finishActiveTask = (outcome) => {
              clearOwnedHost();
              settle(outcome);
            };
            const timeoutId = adWindow.setTimeout(() => {
              setDevelopmentDiagnostic(host, placement, zone, 'timeout');
              finishActiveTask?.('timeout');
            }, timeoutMs);

            script.src = zone.invokeSrc;
            script.async = false;
            script.dataset.adsterraKey = zone.key;
            script.dataset.adsterraPlacement = placement;
            script.onload = () => {
              setDevelopmentDiagnostic(host, placement, zone, 'script-loaded');
              detectRenderedAd();
            };
            script.onerror = () => {
              setDevelopmentDiagnostic(host, placement, zone, 'error');
              finishActiveTask?.('error');
            };
            slot.appendChild(script);
            setDevelopmentDiagnostic(host, placement, zone, 'script-inserted');
            detectRenderedAd();
          }),
      );

      return {
        cancel: () => {
          if (cancelled) {
            return;
          }

          cancelled = true;
          setDevelopmentDiagnostic(host, placement, zone, 'cancelled');
          if (finishActiveTask) {
            finishActiveTask('cancelled');
          } else {
            clearOwnedHost();
            releaseZone();
          }
        },
        completion,
      };
    },
  };
}

const adsterraBannerLoader = createAdsterraBannerLoader();

export function enqueueAdsterraBanner(
  host: HTMLElement,
  zone: AdsterraBannerZone,
  placement: string,
): AdsterraBannerHandle {
  return adsterraBannerLoader.enqueue(host, zone, placement);
}
