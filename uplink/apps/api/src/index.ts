import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerRoutes } from "./routes/index.js";

const PORT = parseInt(process.env.PORT ?? "3001", 10);

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  });

  await registerRoutes(app);

  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`UPLINK API listening on http://localhost:${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
