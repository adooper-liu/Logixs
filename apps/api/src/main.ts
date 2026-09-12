import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { config } from "./config/env";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  await app.listen(config.port);
  console.log(`Logix API listening on http://localhost:${config.port}/api`);
}

void bootstrap();
