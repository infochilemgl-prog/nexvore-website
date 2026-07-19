import path from "node:path";
import fs from "node:fs";
import { env } from "../../config/env";

const ALLOWED_MIME_PREFIXES = ["image/", "video/", "audio/", "application/pdf", "text/plain"];
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15MB

export function validateUpload(file: { mimetype: string; size: number; originalname: string }): string | null {
  if (file.size > MAX_UPLOAD_BYTES) return "Archivo demasiado grande (maximo 15MB).";
  if (!ALLOWED_MIME_PREFIXES.some((p) => file.mimetype.startsWith(p))) return `Tipo de archivo no permitido: ${file.mimetype}.`;
  const base = path.basename(file.originalname);
  if (base !== file.originalname || file.originalname.includes("..")) return "Nombre de archivo invalido.";
  return null;
}

export function resolveUploadPath(filename: string): string {
  const base = path.basename(filename); // guards against path traversal
  const dir = path.resolve(process.cwd(), env.UPLOAD_DIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, base);
}

export function storageConnectionState(): { provider: string; configured: boolean } {
  return { provider: env.STORAGE_PROVIDER, configured: true };
}
