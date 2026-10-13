import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service.js';

// Global: qualquer módulo pode injetar DatabaseService sem importar este módulo
@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
