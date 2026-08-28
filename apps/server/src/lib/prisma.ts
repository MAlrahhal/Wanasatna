import { PrismaClient } from '@prisma/client';
import { resolveDatabaseUrl } from '../config/database-url.js';

/**
 * Singleton Prisma client. Models will be added to prisma/schema.prisma
 * as the data model is designed.
 */
const databaseUrl = resolveDatabaseUrl();

export const prisma = databaseUrl
  ? new PrismaClient({ datasources: { db: { url: databaseUrl } } })
  : new PrismaClient();
