import type { Request, Response } from 'express';
import { prisma } from './prisma.js';

export type PublicHealthBody = {
  status: 'ok' | 'unavailable';
};

const defaultDatabaseProbe = async (): Promise<void> => {
  await prisma.$queryRaw`SELECT 1`;
};

let databaseProbe: () => Promise<void> = defaultDatabaseProbe;

export function setDatabaseProbeForTests(probe: (() => Promise<void>) | null): void {
  databaseProbe = probe ?? defaultDatabaseProbe;
}

export async function sendPublicHealth(res: Response): Promise<void> {
  try {
    await databaseProbe();
    const body: PublicHealthBody = { status: 'ok' };
    res.status(200).json(body);
  } catch {
    const body: PublicHealthBody = { status: 'unavailable' };
    res.status(503).json(body);
  }
}

export function publicHealthHandler(_req: Request, res: Response): void {
  void sendPublicHealth(res);
}
