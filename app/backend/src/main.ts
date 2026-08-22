import 'reflect-metadata';
import './common/validation/zod-config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  app.use(cookieParser());

  const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:4000';
  app.enableCors({ origin: corsOrigin, credentials: true });

  app.enableShutdownHooks();

  const port = parseInt(process.env.PORT ?? '3001', 10);
  await app.listen(port);
  app.get(Logger).log(`Backend rodando na porta ${port}`, 'Bootstrap');
}

bootstrap().catch((err) => {
  console.error('Falha ao iniciar a aplicação:', err);
  process.exit(1);
});
