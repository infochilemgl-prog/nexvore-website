import { Queue, Worker, type Job } from "bullmq";
import { env } from "../config/env";
import { logger } from "../config/logger";

const connection = { url: env.REDIS_URL } as any; // ioredis-style connection string, accepted by BullMQ

export function createQueue<T>(name: string) {
  return new Queue<T>(name, { connection });
}

export function createWorker<T>(name: string, processor: (job: Job<T>) => Promise<unknown>) {
  const worker = new Worker<T>(name, processor, { connection });
  worker.on("failed", (job, err) => logger.error({ job: job?.id, queue: name, err }, "Job fallido"));
  worker.on("completed", (job) => logger.debug({ job: job.id, queue: name }, "Job completado"));
  return worker;
}
