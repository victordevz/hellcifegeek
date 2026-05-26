import "dotenv/config";
import "reflect-metadata";
import { createRequire } from "node:module";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

const nodeRequire = createRequire(__filename);
const { json, urlencoded } = nodeRequire("express") as {
  json: (options: { limit: string }) => unknown;
  urlencoded: (options: { extended: boolean; limit: string }) => unknown;
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const port = Number(process.env.API_PORT ?? 4000);
  const allowedOrigins = (process.env.WEB_ORIGIN ?? "http://127.0.0.1:3000,http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(json({ limit: process.env.API_BODY_LIMIT ?? "50mb" }));
  app.use(urlencoded({ extended: true, limit: process.env.API_BODY_LIMIT ?? "50mb" }));
  app.setGlobalPrefix("api");
  app.enableCors({
    origin: allowedOrigins,
    credentials: true
  });

  await app.listen(port);
  console.log(`Hellcife Geek API running on http://127.0.0.1:${port}/api`);
}

void bootstrap();
