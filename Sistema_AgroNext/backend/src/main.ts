import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { config } from './common/config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error', 'warn', 'log'] });
  // atrás do proxy reverso (Caddy): confia em um salto para obter o IP real do cliente
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  if (config.apiDocs) {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('FPNexus API')
        .setDescription('API do FPNexus. Autenticação por cookie de sessão HttpOnly; mutações exigem o cabeçalho x-csrf-token.')
        .setVersion('1.0.0-etapa1')
        .addCookieAuth('fpx_session')
        .build(),
    );
    SwaggerModule.setup('api/docs', app, doc);
  }

  await app.listen(config.port, '0.0.0.0');
  Logger.log(`API FPNexus em http://0.0.0.0:${config.port}/api`, 'Bootstrap');
}

bootstrap();
