import { toAdsterraAtOptions, type AdsterraAtOptions, type AdsterraBannerZone } from './adsterra';

type AdsterraWindow = Window & {
  atOptions?: AdsterraAtOptions;
};

type SerialTask = () => Promise<void>;

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

const adsterraScriptQueue = createSerialTaskQueue();
const SCRIPT_SETTLE_TIMEOUT_MS = 12_000;

function clearNode(node: HTMLElement): void {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

export function enqueueAdsterraBanner(host: HTMLElement, zone: AdsterraBannerZone): () => void {
  let cancelled = false;
  let cancelActiveTask: (() => void) | undefined;

  void adsterraScriptQueue.enqueue(
    () =>
      new Promise<void>((resolve) => {
        if (cancelled || typeof window === 'undefined') {
          resolve();
          return;
        }

        clearNode(host);
        const adWindow = window as AdsterraWindow;
        const options = toAdsterraAtOptions(zone);
        adWindow.atOptions = options;

        const script = document.createElement('script');
        let settled = false;

        const settle = () => {
          if (settled) {
            return;
          }
          settled = true;
          if (timeoutId !== undefined) {
            window.clearTimeout(timeoutId);
          }
          if (adWindow.atOptions === options) {
            delete adWindow.atOptions;
          }
          cancelActiveTask = undefined;
          resolve();
        };
        const timeoutId = window.setTimeout(settle, SCRIPT_SETTLE_TIMEOUT_MS);
        cancelActiveTask = () => {
          clearNode(host);
          settle();
        };

        script.src = zone.invokeSrc;
        script.async = false;
        script.dataset.adsterraKey = zone.key;
        script.onload = settle;
        script.onerror = () => {
          if (!cancelled) {
            clearNode(host);
          }
          settle();
        };
        host.appendChild(script);
      }),
  );

  return () => {
    cancelled = true;
    cancelActiveTask?.();
  };
}
