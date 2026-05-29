import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import cookieParser = require('cookie-parser');
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const publicUploadsDir = join(process.cwd(), 'uploads', 'public');
  if (!existsSync(publicUploadsDir)) mkdirSync(publicUploadsDir, { recursive: true });

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());
  app.useStaticAssets(publicUploadsDir, { prefix: '/uploads/' });

  app.enableCors({
    origin: config.get<string>('FRONTEND_URL') || 'http://localhost:9980',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-organization-id']
  });

  app.setGlobalPrefix(config.get<string>('API_PREFIX') || 'api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  );

  await app.listen(Number(config.get('PORT') || 3333));
}

bootstrap();
