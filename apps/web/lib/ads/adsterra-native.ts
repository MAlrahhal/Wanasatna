import { ADSTERRA_ADS_ENABLED } from './adsterra';

export type AdsterraNativeUnitId = 'home-native' | 'lobby-native' | 'results-native';

export type AdsterraNativeUnit = {
  id: AdsterraNativeUnitId;
  invokeSrc: string;
  containerId: string;
};

export const ADSTERRA_NATIVE_UNITS = {
  'home-native': {
    id: 'home-native',
    invokeSrc: 'https://bauval.org/21/3dd3ec9a400fe77f9d05bdaef34d52f4',
    containerId: 'container-3dd3ec9a400fe77f9d05bdaef34d52f4',
  },
  'lobby-native': {
    id: 'lobby-native',
    invokeSrc: 'https://bauval.org/21/73dd4ecebe7efa0f366b1fc9060c7f22',
    containerId: 'container-73dd4ecebe7efa0f366b1fc9060c7f22',
  },
  'results-native': {
    id: 'results-native',
    invokeSrc: 'https://bauval.org/21/b2785198615471bba4ff6b7b78337072',
    containerId: 'container-b2785198615471bba4ff6b7b78337072',
  },
} as const satisfies Record<AdsterraNativeUnitId, AdsterraNativeUnit>;

export const ADSTERRA_NATIVE_ADS_ENABLED = ADSTERRA_ADS_ENABLED;
