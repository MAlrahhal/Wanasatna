export type AdsterraStaticZoneId =
  | 'rectangle-300x250'
  | 'mobile-320x50'
  | 'leaderboard-728x90'
  | 'skyscraper-160x600'
  | 'banner-468x60'
  | 'sidebar-160x300';

export type AdsterraBannerZone = {
  id: AdsterraStaticZoneId;
  key: string;
  format: 'iframe';
  height: number;
  width: number;
  params: Record<string, never>;
  invokeSrc: string;
  minViewportWidth?: number;
  maxViewportWidth?: number;
};

export const ADSTERRA_BANNER_300x250 = {
  id: 'rectangle-300x250',
  key: 'def2570bbac8dbcccbff340a7eff4565',
  format: 'iframe',
  height: 250,
  width: 300,
  params: {},
  invokeSrc: 'https://www.highrevenueformat.com/def2570bbac8dbcccbff340a7eff4565/invoke.js',
} as const satisfies AdsterraBannerZone;

export const ADSTERRA_BANNER_MOBILE_320x50 = {
  id: 'mobile-320x50',
  key: '8ab90065c8e99084fa144b118690d7ef',
  format: 'iframe',
  height: 50,
  width: 320,
  params: {},
  invokeSrc: 'https://www.highrevenueformat.com/8ab90065c8e99084fa144b118690d7ef/invoke.js',
  maxViewportWidth: 799,
} as const satisfies AdsterraBannerZone;

export const ADSTERRA_BANNER_DESKTOP_728x90 = {
  id: 'leaderboard-728x90',
  key: '8c7899da0472ebe9381fa1297c9ea859',
  format: 'iframe',
  height: 90,
  width: 728,
  params: {},
  invokeSrc: 'https://www.highrevenueformat.com/8c7899da0472ebe9381fa1297c9ea859/invoke.js',
  minViewportWidth: 800,
} as const satisfies AdsterraBannerZone;

export const ADSTERRA_BANNER_160x600 = {
  id: 'skyscraper-160x600',
  key: '863737c9637f7fa3bac6344d36097d8b',
  format: 'iframe',
  height: 600,
  width: 160,
  params: {},
  invokeSrc: 'https://www.highrevenueformat.com/863737c9637f7fa3bac6344d36097d8b/invoke.js',
  minViewportWidth: 1536,
} as const satisfies AdsterraBannerZone;

export const ADSTERRA_BANNER_468x60 = {
  id: 'banner-468x60',
  key: 'eb85acaa87873198ac330afab579920e',
  format: 'iframe',
  height: 60,
  width: 468,
  params: {},
  invokeSrc: 'https://www.highrevenueformat.com/eb85acaa87873198ac330afab579920e/invoke.js',
  minViewportWidth: 800,
} as const satisfies AdsterraBannerZone;

export const ADSTERRA_BANNER_160x300 = {
  id: 'sidebar-160x300',
  key: '4614f03613a254f4dbc71d0546e42ccf',
  format: 'iframe',
  height: 300,
  width: 160,
  params: {},
  invokeSrc: 'https://www.highrevenueformat.com/4614f03613a254f4dbc71d0546e42ccf/invoke.js',
  minViewportWidth: 1280,
} as const satisfies AdsterraBannerZone;

export const ADSTERRA_STATIC_ZONES = {
  'rectangle-300x250': ADSTERRA_BANNER_300x250,
  'mobile-320x50': ADSTERRA_BANNER_MOBILE_320x50,
  'leaderboard-728x90': ADSTERRA_BANNER_DESKTOP_728x90,
  'skyscraper-160x600': ADSTERRA_BANNER_160x600,
  'banner-468x60': ADSTERRA_BANNER_468x60,
  'sidebar-160x300': ADSTERRA_BANNER_160x300,
} as const satisfies Record<AdsterraStaticZoneId, AdsterraBannerZone>;

export type StaticAdPlacementId = 'lobby-side-rail' | 'gameplay-primary' | 'gameplay-side-rail';

export const STATIC_AD_PLACEMENTS = {
  'lobby-side-rail': ['skyscraper-160x600'],
  'gameplay-primary': ['leaderboard-728x90', 'banner-468x60', 'mobile-320x50'],
  'gameplay-side-rail': ['sidebar-160x300'],
} as const satisfies Record<StaticAdPlacementId, readonly AdsterraStaticZoneId[]>;

export const ADSTERRA_ADS_ENABLED = process.env.NEXT_PUBLIC_ADSTERRA_ADS_ENABLED !== 'false';

function zoneMatchesViewport(zone: AdsterraBannerZone, viewportWidth: number): boolean {
  return (
    Number.isFinite(viewportWidth) &&
    (zone.minViewportWidth === undefined || viewportWidth >= zone.minViewportWidth) &&
    (zone.maxViewportWidth === undefined || viewportWidth <= zone.maxViewportWidth)
  );
}

export function selectFittingStaticZone(
  placement: StaticAdPlacementId,
  containerWidth: number,
  viewportWidth: number,
): AdsterraBannerZone | null {
  if (!ADSTERRA_ADS_ENABLED || !Number.isFinite(containerWidth) || containerWidth <= 0) {
    return null;
  }

  const zoneId = STATIC_AD_PLACEMENTS[placement].find((candidateId) => {
    const zone = ADSTERRA_STATIC_ZONES[candidateId];
    return containerWidth >= zone.width && zoneMatchesViewport(zone, viewportWidth);
  });

  return zoneId ? ADSTERRA_STATIC_ZONES[zoneId] : null;
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
