'use client';

import { AdPlacement } from './ad-placement';
import { NativeAdPlacement } from './native-ad-placement';

const RESULTS_NATIVE_FALLBACK_MS = 5_000;

export function ResultsAdPlacement() {
  return (
    <NativeAdPlacement
      unit="results-native"
      fallbackAfterMs={RESULTS_NATIVE_FALLBACK_MS}
      fallback={<AdPlacement placement="results-primary" />}
    />
  );
}
