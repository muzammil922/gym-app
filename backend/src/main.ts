import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { json, raw, urlencoded } from 'express';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  process.env.TZ = process.env.TZ || 'Asia/Karachi';

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  // Raw body for ZKTeco ATTLOG posts; JSON elsewhere
  app.use('/iclock/cdata', raw({ type: '*/*', limit: '5mb' }));
  app.use(json({ limit: '2mb' }));
  app.use(urlencoded({ extended: true }));

  app.use(helmet({ contentSecurityPolicy: false }));
  app.enableCors({ origin: true, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'iclock/(.*)', method: RequestMethod.ALL },
      { path: 'docs', method: RequestMethod.ALL },
      { path: 'docs-json', method: RequestMethod.ALL },
      { path: 'docs/(.*)', method: RequestMethod.ALL },
      { path: 'uploads/(.*)', method: RequestMethod.ALL },
    ],
  });

  const uploadsPath = process.env.STORAGE_LOCAL_PATH || './uploads';
  app.useStaticAssets(join(process.cwd(), uploadsPath), { prefix: '/uploads/' });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Gym Management API')
    .setDescription(
      'Multi-gym management backend — PKR / Asia/Karachi. JWT auth. ZKTeco ADMS at /iclock/*',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  // Persist openapi for export without running server twice
  try {
    const fs = await import('fs');
    fs.mkdirSync(join(process.cwd(), 'docs'), { recursive: true });
    fs.writeFileSync(
      join(process.cwd(), 'docs', 'openapi.json'),
      JSON.stringify(document, null, 2),
    );
  } catch {
    // non-fatal
  }

  const config = app.get(ConfigService);
  const port = Number(config.get('PORT') || 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API listening on :${port} — Swagger /docs — TZ=${process.env.TZ}`);
}

bootstrap();
