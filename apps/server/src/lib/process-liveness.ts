import type { Request, Response } from 'express';

export type ProcessLivenessBody = {
  status: 'ok';
};

export function processLivenessHandler(_req: Request, res: Response): void {
  const body: ProcessLivenessBody = { status: 'ok' };
  res.status(200).json(body);
}
