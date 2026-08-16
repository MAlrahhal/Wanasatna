export function shouldBlockDevRoutes(nodeEnv = process.env.NODE_ENV): boolean {
  return nodeEnv === 'production';
}
