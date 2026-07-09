import { PrismaClient } from "@prisma/client";

/**
 * Singleton Prisma client. Models will be added to prisma/schema.prisma
 * as the data model is designed.
 */
export const prisma = new PrismaClient();
