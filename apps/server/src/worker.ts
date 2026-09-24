import { logger } from "@content-os/core";
import { bootstrap } from "./bootstrap.ts";
import { startWorker } from "./jobs.ts";

const app = await bootstrap();
const boss = await startWorker(app);
const shutdown = async () => { logger.info("Worker stoppt"); await boss.stop({ graceful: true, timeout: 30_000 }); await app.close(); process.exit(0); };
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
