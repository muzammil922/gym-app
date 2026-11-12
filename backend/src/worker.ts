/**
 * Optional standalone worker entry (same AppModule processors).
 * In docker-compose, the `worker` service runs this file.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  process.env.TZ = process.env.TZ || 'Asia/Karachi';
  const app = await NestFactory.createApplicationContext(AppModule);
  Logger.log('BullMQ worker context started', 'Worker');
  // Keep process alive — processors register via module providers
  process.on('SIGINT', async () => {
    await app.close();
    process.exit(0);
  });
}

bootstrap();
