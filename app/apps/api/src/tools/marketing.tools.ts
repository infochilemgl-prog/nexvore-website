import { z } from "zod";
import { defineTool } from "./types";
import { prisma } from "../utils/prisma";

export const marketingTools = [
  defineTool({
    name: "list_competitors",
    description: "Lista competidores rastreados para la propiedad, con su ultimo snapshot de precio/rating.",
    actionType: "read_analytics",
    schema: z.object({}),
    handler: async (_input, ctx) => {
      if (!ctx.propertyId) return { competitors: [] };
      const competitors = await prisma.competitor.findMany({
        where: { propertyId: ctx.propertyId, active: true },
        include: { snapshots: { orderBy: { capturedAt: "desc" }, take: 1 } },
      });
      return {
        competitors: competitors.map((c) => ({
          id: c.id,
          name: c.name,
          platform: c.platform,
          threatScore: c.threatScore,
          latestPrice: c.snapshots[0] ? Number(c.snapshots[0].nightlyPrice ?? 0) : null,
          latestRating: c.snapshots[0]?.rating ?? null,
        })),
      };
    },
  }),

  defineTool({
    name: "create_content_idea",
    description: "Crea una idea de contenido de marketing para la propiedad (borrador, requiere revision humana antes de publicar).",
    actionType: "create_draft_message",
    schema: z.object({ title: z.string(), hook: z.string().optional(), format: z.string().optional(), platform: z.string().optional(), script: z.string().optional(), sourceInsight: z.string().optional() }),
    handler: async (input, ctx) => {
      if (!ctx.propertyId) return { ok: false, error: "No hay propiedad resuelta en este contexto." };
      const idea = await prisma.contentIdea.create({
        data: {
          propertyId: ctx.propertyId,
          title: input.title,
          hook: input.hook,
          format: input.format,
          platform: input.platform,
          script: input.script,
          sourceInsight: input.sourceInsight,
          status: "IDEA",
        },
      });
      return { ok: true, contentIdeaId: idea.id };
    },
  }),
];
