import assert from 'node:assert/strict';
import { ADSTERRA_NATIVE_UNITS } from '../lib/ads/adsterra-native';
import { createAdsterraNativeLoader } from '../lib/ads/adsterra-native-loader';

type ObserverCallback = () => void;

class FakeElement {
  readonly dataset: Record<string, string> = {};
  readonly children: FakeElement[] = [];
  readonly observers = new Set<ObserverCallback>();
  parent: FakeElement | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  id = '';
  src = '';
  async = false;
  dir = '';
  className = '';

  constructor(readonly tagName: string) {}

  get firstChild(): FakeElement | null {
    return this.children[0] ?? null;
  }

  get childNodes(): readonly FakeElement[] {
    return this.children;
  }

  append(...children: FakeElement[]): void {
    for (const child of children) this.appendChild(child);
  }

  appendChild(child: FakeElement): FakeElement {
    child.parent?.removeChild(child);
    child.parent = this;
    this.children.push(child);
    this.notifyMutation();
    return child;
  }

  removeChild(child: FakeElement): FakeElement {
    const index = this.children.indexOf(child);
    assert.notEqual(index, -1);
    this.children.splice(index, 1);
    child.parent = null;
    this.notifyMutation();
    return child;
  }

  remove(): void {
    this.parent?.removeChild(this);
  }

  find(predicate: (element: FakeElement) => boolean): FakeElement | null {
    for (const child of this.children) {
      if (predicate(child)) return child;
      const nested = child.find(predicate);
      if (nested) return nested;
    }
    return null;
  }

  observe(callback: ObserverCallback): () => void {
    this.observers.add(callback);
    return () => this.observers.delete(callback);
  }

  private notifyMutation(): void {
    for (const observer of this.observers) observer();
    this.parent?.notifyMutation();
  }
}

function createHarness() {
  let nextTimerId = 1;
  const timers = new Map<number, () => void>();
  const adWindow = {
    setTimeout: (callback: () => void) => {
      const id = nextTimerId++;
      timers.set(id, callback);
      return id;
    },
    clearTimeout: (id: number) => timers.delete(id),
  };
  const document = {
    createElement: (tagName: string) => new FakeElement(tagName.toUpperCase()),
    getElementById: () => null,
  };
  const loader = createAdsterraNativeLoader({
    environment: {
      getWindow: () => adWindow as unknown as Window,
      getDocument: () => document as unknown as Document,
      observe: (container, callback) => (container as unknown as FakeElement).observe(callback),
    },
    timeoutMs: 100,
  });

  const runTimers = () => {
    for (const [id, callback] of [...timers]) {
      timers.delete(id);
      callback();
    }
  };

  return { loader, timers, runTimers };
}

function scriptIn(host: FakeElement): FakeElement | null {
  return host.find((element) => element.tagName === 'SCRIPT');
}

function containerIn(host: FakeElement, id: string): FakeElement {
  const container = host.find((element) => element.id === id);
  assert.ok(container);
  return container;
}

async function verifyDuplicateRefusalAndStrictModeAdoption(): Promise<void> {
  const { loader, runTimers } = createHarness();
  const firstHost = new FakeElement('DIV');
  const duplicateHost = new FakeElement('DIV');
  const adoptedHost = new FakeElement('DIV');
  const unit = ADSTERRA_NATIVE_UNITS['results-native'];
  const first = loader.enqueue(firstHost as unknown as HTMLElement, unit);
  const script = scriptIn(firstHost);
  assert.ok(script);
  assert.equal(script.src, unit.invokeSrc);
  assert.equal(script.async, true);
  assert.equal(script.dataset.cfasync, 'false');
  assert.equal(containerIn(firstHost, unit.containerId).id, unit.containerId);

  const duplicate = loader.enqueue(duplicateHost as unknown as HTMLElement, unit);
  assert.equal(await duplicate.completion, 'duplicate');
  assert.equal(duplicateHost.children.length, 0);

  first.cancel();
  const adopted = loader.enqueue(adoptedHost as unknown as HTMLElement, unit);
  assert.equal(firstHost.children.length, 0, 'the pending Native DOM is moved, not cloned');
  assert.equal(scriptIn(adoptedHost), script, 'Strict Mode reuses the exact script instance');
  containerIn(adoptedHost, unit.containerId).appendChild(new FakeElement('DIV'));
  assert.equal(await first.completion, 'rendered');
  assert.equal(await adopted.completion, 'rendered');

  adopted.cancel();
  runTimers();
  assert.equal(adoptedHost.children.length, 0);

  const remounted = loader.enqueue(firstHost as unknown as HTMLElement, unit);
  assert.notEqual(scriptIn(firstHost), script, 'a fully unmounted Native unit can load again');
  containerIn(firstHost, unit.containerId).appendChild(new FakeElement('DIV'));
  assert.equal(await remounted.completion, 'rendered');
  remounted.cancel();
  runTimers();
}

async function verifyIndependentUnitsAndFailureCleanup(): Promise<void> {
  const { loader, runTimers } = createHarness();
  const homeHost = new FakeElement('DIV');
  const lobbyHost = new FakeElement('DIV');
  const home = loader.enqueue(
    homeHost as unknown as HTMLElement,
    ADSTERRA_NATIVE_UNITS['home-native'],
  );
  const lobby = loader.enqueue(
    lobbyHost as unknown as HTMLElement,
    ADSTERRA_NATIVE_UNITS['lobby-native'],
  );
  assert.equal(scriptIn(homeHost)?.src, ADSTERRA_NATIVE_UNITS['home-native'].invokeSrc);
  assert.equal(
    containerIn(homeHost, ADSTERRA_NATIVE_UNITS['home-native'].containerId).id,
    ADSTERRA_NATIVE_UNITS['home-native'].containerId,
  );
  assert.equal(scriptIn(lobbyHost)?.src, ADSTERRA_NATIVE_UNITS['lobby-native'].invokeSrc);
  assert.equal(
    containerIn(lobbyHost, ADSTERRA_NATIVE_UNITS['lobby-native'].containerId).id,
    ADSTERRA_NATIVE_UNITS['lobby-native'].containerId,
  );

  scriptIn(homeHost)?.onerror?.();
  assert.equal(await home.completion, 'error');
  assert.equal(homeHost.children.length, 0);
  assert.ok(scriptIn(lobbyHost), 'failure cleanup for Home cannot remove Lobby Native');

  containerIn(lobbyHost, ADSTERRA_NATIVE_UNITS['lobby-native'].containerId).appendChild(
    new FakeElement('DIV'),
  );
  assert.equal(await lobby.completion, 'rendered');
  lobby.cancel();
  runTimers();
  assert.equal(lobbyHost.children.length, 0);
}

async function main(): Promise<void> {
  await verifyDuplicateRefusalAndStrictModeAdoption();
  await verifyIndependentUnitsAndFailureCleanup();
  console.log('Adsterra Native lifecycle passed');
}

void main();
