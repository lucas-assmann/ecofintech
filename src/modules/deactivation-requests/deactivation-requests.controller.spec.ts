import { Test, TestingModule } from '@nestjs/testing';
import { DeactivationRequestsController } from './deactivation-requests.controller.js';
import { DeactivationRequestsService } from './deactivation-requests.service.js';

describe('DeactivationRequestsController', () => {
  let controller: DeactivationRequestsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeactivationRequestsController],
      providers: [{ provide: DeactivationRequestsService, useValue: {} }],
    }).compile();

    controller = module.get<DeactivationRequestsController>(
      DeactivationRequestsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
