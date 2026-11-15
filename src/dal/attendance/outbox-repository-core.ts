import { prisma } from "@/lib/db/prisma";
import type { OutboxRepository } from "@/services/attendance/outbox-dispatcher";

export const prismaOutboxRepository: OutboxRepository = {
  async listPending(limit) {
    return prisma.outboxEvent.findMany({
      where: { deliveredAt: null, eventType: "ATTENDANCE_SESSION_FINALIZED" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limit,
      select: { id: true, eventId: true, eventType: true, payload: true, createdAt: true },
    });
  },
  async markDeliveredIfPending(id, deliveredAt) {
    const update = await prisma.outboxEvent.updateMany({
      where: { id, deliveredAt: null, eventType: "ATTENDANCE_SESSION_FINALIZED" },
      data: { deliveredAt },
    });
    if (update.count === 1) return true;

    // Another worker may have acknowledged the same event after our Mongo write.
    const current = await prisma.outboxEvent.findUnique({ where: { id }, select: { deliveredAt: true } });
    return current?.deliveredAt !== null && current?.deliveredAt !== undefined;
  },
};
