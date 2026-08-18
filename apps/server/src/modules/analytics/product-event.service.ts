import { ProductEventType } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { opsLogger, sanitizeErrorName } from '../../lib/ops-logger.js';

export type RecordProductEventInput = {
  type: ProductEventType;
  roomId?: string;
  roomCap?: number;
  playerCount?: number;
};

type ProductEventWriter = (data: {
  type: ProductEventType;
  roomId?: string;
  roomCap?: number;
  playerCount?: number;
}) => Promise<unknown>;

const PRODUCT_EVENT_TYPES = new Set<string>(Object.values(ProductEventType));

let writer: ProductEventWriter = (data) => prisma.productEvent.create({ data });

export function setProductEventWriterForTests(next: ProductEventWriter | null): void {
  writer = next ?? ((data) => prisma.productEvent.create({ data }));
}

function sanitizeRoomId(value: string | undefined): string | undefined {
  if (!value || value.length > 64 || !/^[a-z0-9-]+$/i.test(value)) {
    return undefined;
  }
  return value;
}

function sanitizeCount(value: number | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 20) {
    return undefined;
  }
  return value;
}

function sanitizeInput(input: RecordProductEventInput): RecordProductEventInput | null {
  if (!PRODUCT_EVENT_TYPES.has(input.type)) {
    return null;
  }

  return {
    type: input.type,
    roomId: sanitizeRoomId(input.roomId),
    roomCap: sanitizeCount(input.roomCap),
    playerCount: sanitizeCount(input.playerCount),
  };
}

export async function recordProductEvent(input: RecordProductEventInput): Promise<void> {
  const data = sanitizeInput(input);
  if (!data) {
    return;
  }

  try {
    await writer(data);
  } catch (error) {
    opsLogger.error('product-analytics-write-failed', 'تعذر حفظ حدث الاستخدام.', {
      type: data.type,
      errorName: sanitizeErrorName(error),
    });
  }
}
