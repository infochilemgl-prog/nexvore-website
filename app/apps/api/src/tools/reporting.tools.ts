import { z } from "zod";
import { defineTool } from "./types";
import { buildDailyReport } from "../services/reporting/daily-report";

export const reportingTools = [
  defineTool({
    name: "generate_daily_report",
    description: "Genera el reporte diario COO (operaciones, mantenimiento, huespedes, upselling, finanzas, aprobaciones) para una propiedad y fecha.",
    actionType: "read_analytics",
    schema: z.object({ date: z.string().optional() }),
    handler: async (input, ctx) => {
      if (!ctx.propertyId) return { error: "No hay propiedad resuelta en este contexto." };
      const date = input.date ? new Date(input.date) : new Date();
      return buildDailyReport(ctx.organizationId, ctx.propertyId, date);
    },
  }),
];
