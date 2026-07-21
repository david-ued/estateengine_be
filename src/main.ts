import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';

const escapeRegExp = (value: string) =>
  value.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // 自行掛 body parser：AI 建檔的截圖 base64 需要較大的上限
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.use(helmet());
  app.use(json({ limit: '8mb' }));
  app.use(urlencoded({ extended: true, limit: '8mb' }));

  // CORS_ORIGINS：逗號分隔，容錯尾斜線，支援萬用子網域（如 https://*.zeabur.app）
  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  const originMatchers: (string | RegExp)[] = corsOrigins.map((entry) =>
    entry.includes('*')
      ? new RegExp(
          `^${entry.split('*').map(escapeRegExp).join('[a-z0-9-]+')}$`,
          'i',
        )
      : entry,
  );

  app.enableCors({
    origin: (origin, callback) => {
      // 無 Origin header（curl / server-to-server / 同源）直接放行
      if (!origin) return callback(null, true);
      const allowed = originMatchers.some((matcher) =>
        typeof matcher === 'string' ? matcher === origin : matcher.test(origin),
      );
      callback(null, allowed);
    },
    credentials: true,
  });

  logger.log(`CORS allowed origins: ${corsOrigins.join(', ')}`);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
