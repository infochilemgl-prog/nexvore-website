import { createQueue, createWorker } from "./queue";
import { prisma } from "../utils/prisma";

export interface KnowledgeAuditJobData {
  organizationId: string;
}

export const knowledgeAuditQueue = createQueue<KnowledgeAuditJobData>("knowledge-audit");

/** Real (if simple) logic: surfaces open KnowledgeGap rows older than 24h as a summary. */
export async function runKnowledgeAudit(organizationId: string) {
  const gaps = await prisma.knowledgeGap.findMany({
    where: { property: { organizationId }, status: "OPEN" },
    orderBy: { createdAt: "asc" },
  });
  return { organizationId, openGaps: gaps.length, gaps };
}

export function startKnowledgeAuditWorker() {
  return createWorker<KnowledgeAuditJobData>("knowledge-audit", async (job) => runKnowledgeAudit(job.data.organizationId));
}
