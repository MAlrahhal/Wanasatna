export type AdsterraBannerZone = {
  key: string;
  format: 'iframe';
  height: number;
  width: number;
  params: Record<string, never>;
  invokeSrc: string;
};

export const ADSTERRA_BANNER_300x250 = {
  key: 'def2570bbac8dbcccbff340a7eff4565',
  format: 'iframe',
  height: 250,
  width: 300,
  params: {},
  invokeSrc: 'https://www.highrevenueformat.com/def2570bbac8dbcccbff340a7eff4565/invoke.js',
} as const satisfies AdsterraBannerZone;

export const ADSTERRA_BANNER_DESKTOP_728x90 = {
  key: '8c7899da0472ebe9381fa1297c9ea859',
  format: 'iframe',
  height: 90,
  width: 728,
  params: {},
  invokeSrc: 'https://www.highrevenueformat.com/8c7899da0472ebe9381fa1297c9ea859/invoke.js',
} as const satisfies AdsterraBannerZone;

export const ADSTERRA_BANNER_MOBILE_320x50 = {
  key: '8ab90065c8e99084fa144b118690d7ef',
  format: 'iframe',
  height: 50,
  width: 320,
  params: {},
  invokeSrc: 'https://www.highrevenueformat.com/8ab90065c8e99084fa144b118690d7ef/invoke.js',
} as const satisfies AdsterraBannerZone;

export const ADSTERRA_MIN_RENDERABLE_WIDTH = ADSTERRA_BANNER_MOBILE_320x50.width;
export const ADSTERRA_DESKTOP_MIN_WIDTH = 800;

export const ADSTERRA_ADS_ENABLED = process.env.NEXT_PUBLIC_ADSTERRA_ADS_ENABLED !== 'false';

export const AD_PLACEMENTS = {
  'home-hero': { enabled: true },
  'home-room-actions': { enabled: true },
  'lobby-players': { enabled: true },
  'lobby-chat': { enabled: true },
  'game-chat': { enabled: true },
  'game-player-list': { enabled: true },
  'game-leaderboard': { enabled: true },
  'game-answer-input': { enabled: true },
  'game-interaction': { enabled: true },
  'game-round-results': { enabled: true },
  'game-final-results': { enabled: true },
  'home-featured-games-near-end': { enabled: true },
} as const;

export type AdPlacementId = keyof typeof AD_PLACEMENTS;
export type AdPlacementViewport = 'any' | 'compact' | 'wide';

export function isAdPlacementEnabled(placement: AdPlacementId): boolean {
  return ADSTERRA_ADS_ENABLED && AD_PLACEMENTS[placement].enabled;
}

export function selectResponsiveAdsterraZone(viewportWidth: number): AdsterraBannerZone | null {
  if (!Number.isFinite(viewportWidth) || viewportWidth < ADSTERRA_MIN_RENDERABLE_WIDTH) {
    return null;
  }

  return viewportWidth >= ADSTERRA_DESKTOP_MIN_WIDTH
    ? ADSTERRA_BANNER_DESKTOP_728x90
    : ADSTERRA_BANNER_MOBILE_320x50;
}

export function isAdPlacementVisibleAtViewport(
  viewportWidth: number,
  viewport: AdPlacementViewport,
): boolean {
  if (viewportWidth < ADSTERRA_MIN_RENDERABLE_WIDTH) {
    return false;
  }

  if (viewport === 'compact') {
    return viewportWidth < 1280;
  }

  if (viewport === 'wide') {
    return viewportWidth >= 1280;
  }

  return true;
}

export type AdsterraAtOptions = {
  key: string;
  format: string;
  height: number;
  width: number;
  params: Record<string, never>;
};

export function toAdsterraAtOptions(zone: AdsterraBannerZone): AdsterraAtOptions {
  return {
    key: zone.key,
    format: zone.format,
    height: zone.height,
    width: zone.width,
    params: zone.params,
  };
}
