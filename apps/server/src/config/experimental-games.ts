export function isExperimentalGamesCapabilityEnabled(
  nodeEnv: string,
  railwayEnvironmentName: string | undefined,
  configuredValue: string | undefined,
): boolean {
  if (configuredValue !== '1') return false;
  if (nodeEnv !== 'production') return true;
  return railwayEnvironmentName?.trim().toLowerCase() === 'staging';
}
