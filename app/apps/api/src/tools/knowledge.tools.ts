import { z } from "zod";
import { defineTool } from "./types";
import { prisma } from "../utils/prisma";

export const knowledgeTools = [
  defineTool({
    name: "search_knowledge_base",
    description: "Busca en la base de conocimiento de la propiedad/organizacion (manuales, politicas, FAQs). Siempre usar antes de responder preguntas sobre la propiedad.",
    actionType: "read_manual",
    schema: z.object({ query: z.string().min(1) }),
    handler: async (input, ctx) => {
      const documents = await prisma.knowledgeDocument.findMany({
        where: {
          organizationId: ctx.organizationId,
          active: true,
          OR: [{ propertyId: ctx.propertyId ?? undefined }, { propertyId: null }],
        },
      });

      const terms = input.query
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 2);

      const scored = documents
        .map((doc) => {
          const haystack = `${doc.title} ${doc.content}`.toLowerCase();
          const score = terms.reduce((acc, term) => acc + (haystack.includes(term) ? 1 : 0), 0);
          return { doc, score };
        })
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score);

      if (scored.length === 0) {
        // Record the gap so a human can review and the knowledge base can improve.
        if (ctx.propertyId && ctx.conversationId) {
          await prisma.knowledgeGap.create({
            data: {
              propertyId: ctx.propertyId,
              conversationId: ctx.conversationId,
              question: input.query,
              missingInformation: input.query,
              status: "OPEN",
            },
          });
        }
        return { results: [] };
      }

      return {
        results: scored.slice(0, 3).map((s) => ({ id: s.doc.id, title: s.doc.title, content: s.doc.content, category: s.doc.category })),
      };
    },
  }),
];
