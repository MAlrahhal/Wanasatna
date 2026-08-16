import { Prisma } from '@prisma/client';

export const ROOM_TX_RETRY_LIMIT = 3;

export function isRetryableTransactionError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
}

export async function lockRoomRow(
  tx: Prisma.TransactionClient,
  roomId: string,
): Promise<boolean> {
  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Room" WHERE id = ${roomId} FOR UPDATE
  `;
  return locked.length === 1;
}
