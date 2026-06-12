/**
 * Standalone HTTP entry point for exercising db-intelligence locally (`POST /text-to-sql`).
 * Loads `.env` when present; config otherwise comes from `process.env` via `forRoot`.
 *
 * `dotenv/config` must run before `./app.module` is imported — `forRoot()` reads env at load time.
 *
 * Overview: docs/README.md
 */
import 'dotenv/config';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port =
    Number(process.env.PORT ?? process.env.BACKEND_PORT) || 3001;
  await app.listen(port);
  console.log(`db-intelligence listening on http://localhost:${port}`);
}

bootstrap().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
