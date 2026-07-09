import { prisma } from '../../lib/prisma.js';

const ROOM_CODE_LENGTH = 6;
const MAX_CODE_GENERATION_ATTEMPTS = 10;

export function generateRoomCode(): string {
  const code = Math.floor(Math.random() * 1_000_000);
  return code.toString().padStart(ROOM_CODE_LENGTH, '0');
}

export async function generateUniqueRoomCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt += 1) {
    const code = generateRoomCode();
    const existingRoom = await prisma.room.findUnique({
      where: { code },
      select: { id: true },
    });

    if (!existingRoom) {
      return code;
    }
  }

  throw new Error('ROOM_CODE_GENERATION_FAILED');
}
