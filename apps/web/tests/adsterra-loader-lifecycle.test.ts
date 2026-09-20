import assert from 'node:assert/strict';
import {
  ADSTERRA_BANNER_160x600,
  ADSTERRA_BANNER_468x60,
  ADSTERRA_BANNER_DESKTOP_728x90,
  ADSTERRA_BANNER_MOBILE_320x50,
  type AdsterraAtOptions,
} from '../lib/ads/adsterra';
import { createAdsterraBannerLoader } from '../lib/ads/adsterra-loader';

type ObserverCallback = () => void;

class FakeElement {
  readonly dataset: Record<string, string> = {};
  readonly children: FakeElement[] = [];
  readonly observers = new Set<ObserverCallback>();
  parent: FakeElement | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';
  async = true;
  dir = '';
  readonly style: Record<string, string> = {};

  constructor(readonly tagName: string) {}

  get firstChild(): FakeElement | null {
    return this.children[0] ?? null;
  }

  appendChild(child: FakeElement): FakeElement {
    child.parent = this;
    this.children.push(child);
    this.notifyMutation();
    return child;
  }

  removeChild(child: FakeElement): FakeElement {
    const index = this.children.indexOf(child);
    assert.notEqual(index, -1, 'child must belong to its host');
    this.children.splice(index, 1);
    child.parent = null;
    this.notifyMutation();
    return child;
  }

  querySelector(selector: string): FakeElement | null {
    const expectedTag = selector.toUpperCase();
    for (const child of this.children) {
      if (child.tagName === expectedTag) {
        return child;
      }
      const nested = child.querySelector(selector);
      if (nested) {
        return nested;
      }
    }
    return null;
  }

  observe(callback: ObserverCallback): () => void {
    this.observers.add(callback);
    return () => this.observers.delete(callback);
  }

  private notifyMutation(): void {
    for (const observer of this.observers) {
      observer();
    }
    this.parent?.notifyMutation();
  }
}

type FakeAdWindow = {
  atOptions?: AdsterraAtOptions;
  setTimeout: (callback: () => void, timeout: number) => number;
  clearTimeout: (timerId: number) => void;
};

function createHarness() {
  let nextTimerId = 1;
  const timers = new Map<number, () => void>();
  const adWindow: FakeAdWindow = {
    setTimeout: (callback) => {
      const timerId = nextTimerId++;
      timers.set(timerId, callback);
      return timerId;
    },
    clearTimeout: (timerId) => {
      timers.delete(timerId);
    },
  };
  const document = {
    createElement: (tagName: string) => new FakeElement(tagName.toUpperCase()),
  };
  const loader = createAdsterraBannerLoader({
    environment: {
      getWindow: () => adWindow as unknown as Window & { atOptions?: AdsterraAtOptions },
      getDocument: () => document as unknown as Document,
      observe: (host, callback) => (host as unknown as FakeElement).observe(callback),
    },
    timeoutMs: 100,
  });

  return { adWindow, loader, timers };
}

async function flushQueue(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function scriptIn(host: FakeElement): FakeElement | null {
  return host.querySelector('script');
}

function activeSlotIn(host: FakeElement): FakeElement {
  const slot = host.children.find((child) => child.dataset.adsterraSlot);
  assert.ok(slot, 'the loader must create an isolated slot inside the stable React host');
  return slot;
}

async function verifyMultipleBannerIsolation(): Promise<void> {
  const { adWindow, loader } = createHarness();
  const hostA = new FakeElement('DIV');
  const hostB = new FakeElement('DIV');

  const bannerA = loader.enqueue(
    hostA as unknown as HTMLElement,
    ADSTERRA_BANNER_DESKTOP_728x90,
    'lobby-players',
  );
  const bannerB = loader.enqueue(
    hostB as unknown as HTMLElement,
    ADSTERRA_BANNER_468x60,
    'gameplay-primary',
  );

  await flushQueue();
  const scriptA = scriptIn(hostA);
  assert.ok(scriptA, 'the first placement inserts its script');
  assert.equal(scriptIn(hostB), null, 'the second placement waits for the first iframe');
  assert.equal(adWindow.atOptions?.key, ADSTERRA_BANNER_DESKTOP_728x90.key);

  scriptA.onload?.();
  await flushQueue();
  assert.equal(
    scriptIn(hostB),
    null,
    'script load alone must not release the global atOptions queue',
  );

  const frameA = new FakeElement('IFRAME');
  activeSlotIn(hostA).appendChild(frameA);
  await flushQueue();
  const scriptB = scriptIn(hostB);
  assert.ok(scriptB, 'the second placement starts after the first iframe exists');
  assert.equal(scriptB.dataset.adsterraKey, ADSTERRA_BANNER_468x60.key);
  assert.equal(hostA.querySelector('iframe'), frameA, 'the first ad remains in its own host');

  scriptB.onload?.();
  const frameB = new FakeElement('IFRAME');
  activeSlotIn(hostB).appendChild(frameB);
  assert.deepEqual(await Promise.all([bannerA.completion, bannerB.completion]), [
    'rendered',
    'rendered',
  ]);
  assert.equal(hostA.querySelector('iframe'), frameA);
  assert.equal(hostB.querySelector('iframe'), frameB);

  bannerA.cancel();
  assert.equal(hostA.children.length, 0, 'cleanup A removes only A-owned DOM');
  assert.equal(hostB.querySelector('iframe'), frameB, 'cleanup A cannot erase B');
  bannerB.cancel();
  assert.equal(hostB.children.length, 0, 'cleanup B removes only B-owned DOM');
}

async function verifyReverseCleanupIsolation(): Promise<void> {
  const { loader } = createHarness();
  const hostA = new FakeElement('DIV');
  const hostB = new FakeElement('DIV');
  const bannerA = loader.enqueue(
    hostA as unknown as HTMLElement,
    ADSTERRA_BANNER_DESKTOP_728x90,
    'gameplay-primary',
  );
  const bannerB = loader.enqueue(
    hostB as unknown as HTMLElement,
    ADSTERRA_BANNER_468x60,
    'another-placement',
  );
  await flushQueue();
  const frameA = new FakeElement('IFRAME');
  activeSlotIn(hostA).appendChild(frameA);
  await flushQueue();
  activeSlotIn(hostB).appendChild(new FakeElement('IFRAME'));
  await Promise.all([bannerA.completion, bannerB.completion]);

  bannerB.cancel();
  assert.equal(hostB.children.length, 0);
  assert.equal(hostA.querySelector('iframe'), frameA, 'cleanup B cannot erase A');
  bannerA.cancel();
}

async function verifyFailedVerticalCleanupAndQueueRecovery(): Promise<void> {
  const { loader } = createHarness();
  const failedHost = new FakeElement('DIV');
  const nextHost = new FakeElement('DIV');
  const failed = loader.enqueue(
    failedHost as unknown as HTMLElement,
    ADSTERRA_BANNER_160x600,
    'lobby-side-rail',
  );
  await flushQueue();
  scriptIn(failedHost)?.onerror?.();
  assert.equal(await failed.completion, 'error');
  assert.equal(failedHost.children.length, 0, 'a failed 600px unit leaves no reserved DOM');

  const next = loader.enqueue(
    nextHost as unknown as HTMLElement,
    ADSTERRA_BANNER_468x60,
    'gameplay-primary',
  );
  await flushQueue();
  assert.ok(scriptIn(nextHost), 'a static failure releases the global atOptions queue');
  activeSlotIn(nextHost).appendChild(new FakeElement('IFRAME'));
  assert.equal(await next.completion, 'rendered');
  next.cancel();
}

async function verifyDuplicateUnitRefusalAndReuse(): Promise<void> {
  const { loader } = createHarness();
  const hostA = new FakeElement('DIV');
  const hostB = new FakeElement('DIV');
  const first = loader.enqueue(
    hostA as unknown as HTMLElement,
    ADSTERRA_BANNER_DESKTOP_728x90,
    'gameplay-primary',
  );
  const duplicate = loader.enqueue(
    hostB as unknown as HTMLElement,
    ADSTERRA_BANNER_DESKTOP_728x90,
    'another-placement',
  );

  assert.equal(await duplicate.completion, 'duplicate');
  assert.equal(hostB.children.length, 0, 'a duplicate unit must not insert a second script');
  await flushQueue();
  activeSlotIn(hostA).appendChild(new FakeElement('IFRAME'));
  assert.equal(await first.completion, 'rendered');
  first.cancel();

  const reused = loader.enqueue(
    hostB as unknown as HTMLElement,
    ADSTERRA_BANNER_DESKTOP_728x90,
    'gameplay-primary',
  );
  await flushQueue();
  assert.ok(scriptIn(hostB), 'a fully unmounted unit can be mounted again');
  activeSlotIn(hostB).appendChild(new FakeElement('IFRAME'));
  assert.equal(await reused.completion, 'rendered');
  reused.cancel();
}

async function verifyStrictModeCancellation(): Promise<void> {
  const { loader } = createHarness();
  const host = new FakeElement('DIV');
  const cancelledMount = loader.enqueue(
    host as unknown as HTMLElement,
    ADSTERRA_BANNER_MOBILE_320x50,
    'home-hero',
  );
  cancelledMount.cancel();

  const liveMount = loader.enqueue(
    host as unknown as HTMLElement,
    ADSTERRA_BANNER_MOBILE_320x50,
    'home-hero',
  );
  assert.equal(await cancelledMount.completion, 'cancelled');
  await flushQueue();
  assert.ok(scriptIn(host), 'the valid Strict Mode remount is not permanently cancelled');
  activeSlotIn(host).appendChild(new FakeElement('IFRAME'));

  assert.equal(await liveMount.completion, 'rendered');
  assert.ok(host.querySelector('iframe'));
  liveMount.cancel();
}

async function verifyBreakpointReplacementOwnership(): Promise<void> {
  const { loader } = createHarness();
  const host = new FakeElement('DIV');
  const mobile = loader.enqueue(
    host as unknown as HTMLElement,
    ADSTERRA_BANNER_MOBILE_320x50,
    'game-answer-input',
  );
  await flushQueue();
  const staleMobileSlot = activeSlotIn(host);
  staleMobileSlot.appendChild(new FakeElement('IFRAME'));
  assert.equal(await mobile.completion, 'rendered');

  const desktop = loader.enqueue(
    host as unknown as HTMLElement,
    ADSTERRA_BANNER_DESKTOP_728x90,
    'game-answer-input',
  );
  await flushQueue();
  const desktopScript = scriptIn(host);
  assert.ok(desktopScript);
  assert.equal(desktopScript.dataset.adsterraKey, ADSTERRA_BANNER_DESKTOP_728x90.key);

  staleMobileSlot.appendChild(new FakeElement('IFRAME'));
  assert.equal(
    host.querySelector('iframe'),
    null,
    'late third-party writes stay trapped in the detached stale slot',
  );

  mobile.cancel();
  assert.equal(
    scriptIn(host),
    desktopScript,
    'a stale breakpoint cleanup cannot remove the replacement instance',
  );

  activeSlotIn(host).appendChild(new FakeElement('IFRAME'));
  assert.equal(await desktop.completion, 'rendered');
  desktop.cancel();
}

async function main(): Promise<void> {
  await verifyMultipleBannerIsolation();
  await verifyReverseCleanupIsolation();
  await verifyFailedVerticalCleanupAndQueueRecovery();
  await verifyDuplicateUnitRefusalAndReuse();
  await verifyStrictModeCancellation();
  await verifyBreakpointReplacementOwnership();
  console.log('Adsterra multi-instance lifecycle passed');
}

void main();
