/**
 * Bootstraps Nest briefly to write docs/openapi.json without listening.
 * Prefer running the API once — main.ts also writes openapi.json on boot.
 */
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from '../src/app.module';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const config = new DocumentBuilder()
    .setTitle('Gym Management API')
    .setDescription('Multi-gym management backend')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  const dir = join(process.cwd(), 'docs');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'openapi.json'), JSON.stringify(document, null, 2));
  await app.close();
  console.log('Wrote docs/openapi.json');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
