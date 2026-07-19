import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import { requireAuth } from "../middleware/auth";
import { tenantContext, currentOrgId } from "../middleware/tenant-context";
import { prisma } from "../utils/prisma";
import { validateUpload, resolveUploadPath } from "../integrations/storage";
import { HttpError } from "../middleware/error-handler";
import fs from "node:fs";

export const knowledgeRouter = Router();
knowledgeRouter.use(requireAuth, tenantContext);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

knowledgeRouter.get("/documents", async (req, res, next) => {
  try {
    const { propertyId, category } = req.query as Record<string, string | undefined>;
    const documents = await prisma.knowledgeDocument.findMany({
      where: { organizationId: currentOrgId(req), ...(propertyId ? { propertyId } : {}), ...(category ? { category } : {}) },
      include: { resources: true },
      orderBy: { updatedAt: "desc" },
    });
    res.json(documents);
  } catch (err) {
    next(err);
  }
});

const createDocSchema = z.object({
  title: z.string().min(2),
  category: z.string().min(1),
  content: z.string().min(1),
  propertyId: z.string().optional(),
  unitId: z.string().optional(),
});

knowledgeRouter.post("/documents", async (req, res, next) => {
  try {
    const data = createDocSchema.parse(req.body);
    const doc = await prisma.knowledgeDocument.create({ data: { ...data, organizationId: currentOrgId(req), sourceType: "MANUAL_ENTRY" } });
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
});

const updateDocSchema = createDocSchema.partial();
knowledgeRouter.patch("/documents/:id", async (req, res, next) => {
  try {
    const existing = await prisma.knowledgeDocument.findFirst({ where: { id: req.params.id, organizationId: currentOrgId(req) } });
    if (!existing) throw new HttpError(404, "Documento no encontrado.");
    const data = updateDocSchema.parse(req.body);
    const updated = await prisma.knowledgeDocument.update({ where: { id: existing.id }, data: { ...data, version: existing.version + 1 } });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

knowledgeRouter.post("/documents/:id/resources/upload", upload.single("file"), async (req, res, next) => {
  try {
    const doc = await prisma.knowledgeDocument.findFirst({ where: { id: req.params.id, organizationId: currentOrgId(req) } });
    if (!doc) throw new HttpError(404, "Documento no encontrado.");
    if (!req.file) throw new HttpError(400, "Falta el archivo.");
    const validationError = validateUpload({ mimetype: req.file.mimetype, size: req.file.size, originalname: req.file.originalname });
    if (validationError) throw new HttpError(400, validationError);

    const filename = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const destPath = resolveUploadPath(filename);
    fs.writeFileSync(destPath, req.file.buffer);

    const resourceType = req.file.mimetype.startsWith("image/") ? "IMAGE" : req.file.mimetype.startsWith("video/") ? "VIDEO" : req.file.mimetype.startsWith("audio/") ? "AUDIO" : req.file.mimetype === "application/pdf" ? "PDF" : "TEXT";

    const resource = await prisma.knowledgeResource.create({
      data: { documentId: doc.id, resourceType: resourceType as any, title: req.file.originalname, localPath: filename },
    });
    res.status(201).json(resource);
  } catch (err) {
    next(err);
  }
});

knowledgeRouter.get("/gaps", async (req, res, next) => {
  try {
    const { propertyId, status } = req.query as Record<string, string | undefined>;
    const gaps = await prisma.knowledgeGap.findMany({
      where: { property: { organizationId: currentOrgId(req) }, ...(propertyId ? { propertyId } : {}), ...(status ? { status: status as any } : {}) },
      orderBy: { createdAt: "desc" },
    });
    res.json(gaps);
  } catch (err) {
    next(err);
  }
});

const gapApprovalSchema = z.object({ proposedAnswer: z.string().min(1), category: z.string().default("General") });
knowledgeRouter.post("/gaps/:id/approve", async (req, res, next) => {
  try {
    const gap = await prisma.knowledgeGap.findFirst({ where: { id: req.params.id, property: { organizationId: currentOrgId(req) } } });
    if (!gap) throw new HttpError(404, "Brecha no encontrada.");
    const { proposedAnswer, category } = gapApprovalSchema.parse(req.body);
    const doc = await prisma.knowledgeDocument.create({
      data: { organizationId: currentOrgId(req), propertyId: gap.propertyId, title: gap.question.slice(0, 80), category, content: proposedAnswer, sourceType: "AI_SUGGESTED" },
    });
    const updatedGap = await prisma.knowledgeGap.update({ where: { id: gap.id }, data: { status: "APPROVED", approvedBy: req.user!.id, approvedAt: new Date(), proposedAnswer } });
    res.json({ gap: updatedGap, document: doc });
  } catch (err) {
    next(err);
  }
});

knowledgeRouter.post("/gaps/:id/reject", async (req, res, next) => {
  try {
    const gap = await prisma.knowledgeGap.findFirst({ where: { id: req.params.id, property: { organizationId: currentOrgId(req) } } });
    if (!gap) throw new HttpError(404, "Brecha no encontrada.");
    const updated = await prisma.knowledgeGap.update({ where: { id: gap.id }, data: { status: "REJECTED" } });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});
