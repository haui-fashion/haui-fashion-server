import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, {
    bufferLogs: true
  });

  const httpAdapter = app.getHttpAdapter();
  const instance = httpAdapter.getInstance() as {
    set?: (name: string, value: unknown) => void;
    setTrustProxy?: (value: boolean | number | string) => void;
  };

  if (typeof instance.setTrustProxy === 'function') {
    instance.setTrustProxy(true);
  } else if (typeof instance.set === 'function') {
    instance.set('trust proxy', true);
  }

  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  app.use(helmet());

  app.enableCors({
    origin: process.env.FRONTEND_URL?.split(',') || [
      'http://localhost:3000',
      'http://admin.localhost:3000'
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  });

  app.use(compression());

  app.setGlobalPrefix('api', {
    exclude: ['health', 'health/liveness', 'health/readiness', 'metrics']
  });

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1'
  });

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('NestJS API')
      .setDescription('API Documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true
      }
    });
  }

  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  const logger = app.get<{ log: (msg: string) => void }>(
    WINSTON_MODULE_NEST_PROVIDER
  );
  logger.log(`🚀 Application is running on: http://localhost:${port}`);
  logger.log(`📚 Swagger docs: http://localhost:${port}/docs`);
  logger.log(`❤️  Health check: http://localhost:${port}/health`);
}

void bootstrap();
