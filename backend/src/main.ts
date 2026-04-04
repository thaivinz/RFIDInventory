import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from '@/app.module';
import { GlobalExceptionFilter } from '@common/filters/http-exception.filter';
import { ResponseInterceptor } from '@common/interceptors/response.interceptor';
import { SwaggerConfig } from '@common/config/swagger.config';

class ApplicationBootstrap {
  static async run() {
    const app = await NestFactory.create(AppModule, { bufferLogs: true });
    app.useLogger(app.get(Logger));

    const config = app.get(ConfigService);
    const corsOrigins = config.get('CORS_ORIGINS', '*');

    app.enableCors({
      origin: corsOrigins === '*' 
        ? true 
        : corsOrigins.split(',').map((o: string) => o.trim()),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    app.useGlobalFilters(new GlobalExceptionFilter());

    // Auto-wrap response and apply ClassSerializer
    const reflector = app.get(Reflector);
    app.useGlobalInterceptors(
      new ClassSerializerInterceptor(reflector, { excludeExtraneousValues: false }),
      new ResponseInterceptor(reflector),
    );

    SwaggerConfig.setup(app);

    app.enableShutdownHooks();

    const port = config.get('PORT', 3000);
    await app.listen(port, '0.0.0.0');
    const logger = app.get(Logger);
    logger.log(`Server running on http://localhost:${port}`);
    logger.log(`Swagger docs at http://localhost:${port}/api/docs`);
  }
}

ApplicationBootstrap.run();
