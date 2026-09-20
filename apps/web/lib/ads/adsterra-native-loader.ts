import { type AdsterraNativeUnit, type AdsterraNativeUnitId } from './adsterra-native';

export type AdsterraNativeLoadOutcome =
  'rendered' | 'error' | 'timeout' | 'cancelled' | 'duplicate';

export type AdsterraNativeHandle = {
  cancel: () => void;
  completion: Promise<AdsterraNativeLoadOutcome>;
};

type NativeWindow = Window;

type AdsterraNativeLoaderEnvironment = {
  getWindow: () => NativeWindow | null;
  getDocument: () => Document | null;
  observe: (container: HTMLElement, onChange: () => void) => () => void;
};

type CreateAdsterraNativeLoaderOptions = {
  environment?: AdsterraNativeLoaderEnvironment;
  timeoutMs?: number;
};

type NativeRecord = {
  unit: AdsterraNativeUnit;
  owner: symbol;
  host: HTMLElement;
  slot: HTMLDivElement;
  container: HTMLDivElement;
  script: HTMLScriptElement;
  completion: Promise<AdsterraNativeLoadOutcome>;
  resolveCompletion: (outcome: AdsterraNativeLoadOutcome) => void;
  settled: boolean;
  rendered: boolean;
  stopObserving: () => void;
  timeoutId: number | undefined;
  cleanupId: number | undefined;
  remove: (outcome?: AdsterraNativeLoadOutcome) => void;
};

const NATIVE_SETTLE_TIMEOUT_MS = 12_000;

function createBrowserEnvironment(): AdsterraNativeLoaderEnvironment {
  return {
    getWindow: () => (typeof window === 'undefined' ? null : window),
    getDocument: () => (typeof document === 'undefined' ? null : document),
    observe: (container, onChange) => {
      const observer = new MutationObserver(onChange);
      observer.observe(container, { childList: true, subtree: true });
      return () => observer.disconnect();
    },
  };
}

function clearNode(node: HTMLElement): void {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function setDiagnostic(
  host: HTMLElement,
  unit: AdsterraNativeUnit,
  state: AdsterraNativeLoadOutcome | 'loading' | 'adopted' | 'cleaned',
): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  host.dataset.adsterraNativeUnit = unit.id;
  host.dataset.adsterraNativeState = state;
}

function warnDuplicate(unit: AdsterraNativeUnit): void {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[Adsterra] Refused duplicate live Native unit ${unit.id}.`);
  }
}

export function createAdsterraNativeLoader({
  environment = createBrowserEnvironment(),
  timeoutMs = NATIVE_SETTLE_TIMEOUT_MS,
}: CreateAdsterraNativeLoaderOptions = {}) {
  const records = new Map<AdsterraNativeUnitId, NativeRecord>();

  const createHandle = (
    activeRecord: NativeRecord,
    handleOwner: symbol,
    activeWindow: NativeWindow,
  ): AdsterraNativeHandle => ({
    completion: activeRecord.completion,
    cancel: () => {
      if (
        records.get(activeRecord.unit.id) !== activeRecord ||
        activeRecord.owner !== handleOwner ||
        activeRecord.cleanupId !== undefined
      ) {
        return;
      }

      activeRecord.cleanupId = activeWindow.setTimeout(() => {
        activeRecord.cleanupId = undefined;
        if (
          records.get(activeRecord.unit.id) !== activeRecord ||
          activeRecord.owner !== handleOwner
        ) {
          return;
        }

        activeRecord.remove(activeRecord.rendered ? undefined : 'cancelled');
      }, 0);
    },
  });

  const duplicateHandle = (host: HTMLElement, unit: AdsterraNativeUnit) => {
    setDiagnostic(host, unit, 'duplicate');
    warnDuplicate(unit);
    return {
      cancel: () => undefined,
      completion: Promise.resolve<AdsterraNativeLoadOutcome>('duplicate'),
    };
  };

  return {
    enqueue(host: HTMLElement, unit: AdsterraNativeUnit): AdsterraNativeHandle {
      const adWindow = environment.getWindow();
      const adDocument = environment.getDocument();
      if (!adWindow || !adDocument) {
        return {
          cancel: () => undefined,
          completion: Promise.resolve('cancelled'),
        };
      }

      const existing = records.get(unit.id);
      if (existing) {
        if (existing.cleanupId === undefined) {
          return duplicateHandle(host, unit);
        }

        adWindow.clearTimeout(existing.cleanupId);
        existing.cleanupId = undefined;
        const owner = Symbol(unit.id);
        existing.owner = owner;
        existing.host = host;
        clearNode(host);
        host.appendChild(existing.slot);
        setDiagnostic(host, unit, 'adopted');
        return createHandle(existing, owner, adWindow);
      }

      if (adDocument.getElementById(unit.containerId)) {
        return duplicateHandle(host, unit);
      }

      const owner = Symbol(unit.id);
      let resolveCompletion: (outcome: AdsterraNativeLoadOutcome) => void = () => undefined;
      const completion = new Promise<AdsterraNativeLoadOutcome>((resolve) => {
        resolveCompletion = resolve;
      });
      const slot = adDocument.createElement('div');
      const container = adDocument.createElement('div');
      const script = adDocument.createElement('script');
      const record: NativeRecord = {
        unit,
        owner,
        host,
        slot,
        container,
        script,
        completion,
        resolveCompletion,
        settled: false,
        rendered: false,
        stopObserving: () => undefined,
        timeoutId: undefined,
        cleanupId: undefined,
        remove: () => undefined,
      };

      const settle = (outcome: AdsterraNativeLoadOutcome) => {
        if (record.settled) {
          return;
        }

        record.settled = true;
        record.rendered = outcome === 'rendered';
        record.stopObserving();
        if (record.timeoutId !== undefined) {
          adWindow.clearTimeout(record.timeoutId);
          record.timeoutId = undefined;
        }
        record.script.onload = null;
        record.script.onerror = null;
        setDiagnostic(record.host, unit, outcome);
        record.resolveCompletion(outcome);
      };

      const removeRecord = (outcome?: AdsterraNativeLoadOutcome) => {
        if (records.get(unit.id) !== record) {
          return;
        }

        record.stopObserving();
        if (record.timeoutId !== undefined) {
          adWindow.clearTimeout(record.timeoutId);
          record.timeoutId = undefined;
        }
        record.script.onload = null;
        record.script.onerror = null;
        record.slot.remove();
        records.delete(unit.id);
        setDiagnostic(record.host, unit, 'cleaned');
        if (outcome) {
          settle(outcome);
        }
      };
      record.remove = removeRecord;

      const detectRendered = () => {
        if (container.childNodes.length === 0) {
          return;
        }

        settle('rendered');
      };

      clearNode(host);
      slot.dir = 'ltr';
      slot.dataset.adsterraNativeSlot = unit.id;
      slot.className = 'w-full min-w-0 overflow-hidden';
      container.id = unit.containerId;
      script.src = unit.invokeSrc;
      script.async = true;
      script.dataset.cfasync = 'false';
      script.dataset.adsterraNativeUnit = unit.id;
      script.onload = detectRendered;
      script.onerror = () => removeRecord('error');
      slot.append(script, container);
      host.appendChild(slot);
      records.set(unit.id, record);
      setDiagnostic(host, unit, 'loading');

      record.stopObserving = environment.observe(container, detectRendered);
      record.timeoutId = adWindow.setTimeout(() => removeRecord('timeout'), timeoutMs);
      detectRendered();

      return createHandle(record, owner, adWindow);
    },
  };
}

const adsterraNativeLoader = createAdsterraNativeLoader();

export function enqueueAdsterraNative(
  host: HTMLElement,
  unit: AdsterraNativeUnit,
): AdsterraNativeHandle {
  return adsterraNativeLoader.enqueue(host, unit);
}
