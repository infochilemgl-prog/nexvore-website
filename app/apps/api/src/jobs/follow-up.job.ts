import { createQueue, createWorker } from "./queue";
import { prisma } from "../utils/prisma";
import { subHours } from "date-fns";

export interface FollowUpJobData {
  organizationId: string;
}

export const followUpQueue = createQueue<FollowUpJobData>("follow-up");

/**
 * Real (if simple) logic: flags open conversations whose last message was
 * from the guest more than 2 hours ago and never got a reply -- these need
 * human follow-up. Marks them PENDING_HUMAN so they surface in the Inbox.
 */
export async function runFollowUpSweep(organizationId: string) {
  const staleThreshold = subHours(new Date(), 2);
  const stale = await prisma.conversation.findMany({
    where: { organizationId, status: "OPEN", lastMessageAt: { lte: staleThreshold } },
  });
  for (const conversation of stale) {
    const lastMessage = await prisma.message.findFirst({ where: { conversationId: conversation.id }, orderBy: { createdAt: "desc" } });
    if (lastMessage?.senderType === "GUEST") {
      await prisma.conversation.update({ where: { id: conversation.id }, data: { status: "PENDING_HUMAN" } });
    }
  }
  return { flagged: stale.length };
}

export function startFollowUpWorker() {
  return createWorker<FollowUpJobData>("follow-up", async (job) => runFollowUpSweep(job.data.organizationId));
}

/**
 * Fans `runFollowUpSweep` out across every organization -- used by the
 * `/api/cron/follow-up` route (Vercel Cron).
 */
export async function runFollowUpSweepForAllOrganizations() {
  const organizations = await prisma.organization.findMany({ select: { id: true } });
  let totalFlagged = 0;
  for (const org of organizations) {
    const { flagged } = await runFollowUpSweep(org.id);
    totalFlagged += flagged;
  }
  return { organizations: organizations.length, flagged: totalFlagged };
}
