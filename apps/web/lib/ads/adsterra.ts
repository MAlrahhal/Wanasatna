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
