import { Module } from '@nestjs/common';
import { DeactivationRequestsService } from './deactivation-requests.service.js';
import { DeactivationRequestsController } from './deactivation-requests.controller.js';

@Module({
  controllers: [DeactivationRequestsController],
  providers: [DeactivationRequestsService],
})
export class DeactivationRequestsModule {}
