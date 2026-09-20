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
    invokeSrc:
      'https://pl31429875.profitableratecpmnetwork.com/3dd3ec9a400fe77f9d05bdaef34d52f4/invoke.js',
    containerId: 'container-3dd3ec9a400fe77f9d05bdaef34d52f4',
  },
  'lobby-native': {
    id: 'lobby-native',
    invokeSrc:
      'https://pl31429877.profitableratecpmnetwork.com/73dd4ecebe7efa0f366b1fc9060c7f22/invoke.js',
    containerId: 'container-73dd4ecebe7efa0f366b1fc9060c7f22',
  },
  'results-native': {
    id: 'results-native',
    invokeSrc:
      'https://pl31429876.profitableratecpmnetwork.com/b2785198615471bba4ff6b7b78337072/invoke.js',
    containerId: 'container-b2785198615471bba4ff6b7b78337072',
  },
} as const satisfies Record<AdsterraNativeUnitId, AdsterraNativeUnit>;

export const ADSTERRA_NATIVE_ADS_ENABLED = ADSTERRA_ADS_ENABLED;
