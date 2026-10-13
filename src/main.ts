import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS: só os endereços do front listados em CORS_ORIGINS podem chamar a API
  // pelo navegador. O token vai no header Authorization (sem cookies).
  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: corsOrigins });

  // Valida os DTOs de entrada; campos desconhecidos geram erro 400.
  // transform: converte query params (texto) para os tipos do DTO (ex.: limit → number)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Ecofintech API')
    .setDescription('Documentação das rotas do backend da Ecofintech')
    .setVersion('0.0.1')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  // UI em /docs e especificação OpenAPI em /docs-json (importável no Postman)
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
    // Mantém o token informado em "Authorize" ao recarregar a página
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
