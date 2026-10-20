export function isExperimentalGamesCapabilityEnabled(
  nodeEnv: string,
  railwayEnvironmentName: string | undefined,
  nonProductionValue: string | undefined,
  productionPlaytestValue: string | undefined,
): boolean {
  if (nodeEnv !== 'production') return nonProductionValue === '1';

  return (
    railwayEnvironmentName?.trim().toLowerCase() === 'production' && productionPlaytestValue === '1'
  );
}
