import "dotenv/config";

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:3000",
  databaseUrl: process.env.DATABASE_URL,
  /** When true, phase timers use 1s durations for automated tests only. */
  testMode: process.env.WANASATNA_TEST_MODE === "1",
};
