import { z } from "zod";
import { defineTool } from "./types";
import { prisma } from "../utils/prisma";

export const housekeepingTools = [
  defineTool({
    name: "create_housekeeping_task",
    description: "Crea una tarea de limpieza para una unidad.",
    actionType: "create_housekeeping_task",
    schema: z.object({ unitId: z.string(), scheduledAt: z.string(), reservationId: z.string().optional() }),
    handler: async (input, ctx) => {
      const unit = await prisma.unit.findFirst({ where: { id: input.unitId, property: { organizationId: ctx.organizationId } } });
      if (!unit) return { ok: false, error: "Unidad no encontrada." };
      const task = await prisma.housekeepingTask.create({
        data: {
          propertyId: unit.propertyId,
          unitId: unit.id,
          reservationId: input.reservationId ?? null,
          scheduledAt: new Date(input.scheduledAt),
          status: "PENDING",
          checklist: [],
          issues: [],
        },
      });
      return { ok: true, taskId: task.id };
    },
  }),

  defineTool({
    name: "list_housekeeping_tasks",
    description: "Lista tareas de limpieza pendientes de la propiedad.",
    actionType: "read_tickets",
    schema: z.object({ status: z.string().optional() }),
    handler: async (input, ctx) => {
      if (!ctx.propertyId) return { tasks: [] };
      const tasks = await prisma.housekeepingTask.findMany({
        where: { propertyId: ctx.propertyId, ...(input.status ? { status: input.status as any } : {}) },
        orderBy: { scheduledAt: "asc" },
        take: 50,
      });
      return { tasks };
    },
  }),
];
