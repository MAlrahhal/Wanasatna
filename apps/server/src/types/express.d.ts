import type { PublicUser } from '@wanasatna/shared';

declare global {
  namespace Express {
    interface Request {
      authUser: PublicUser | null;
    }
  }
}

export {};
