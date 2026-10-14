import {
  createParamDecorator,
  ExecutionContext,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../guards/auth.guard.js';
import {
  AccountAccessService,
  type ActiveAccountContext,
} from '../../modules/accounts/account-access.service.js';

interface ActiveAccountInput {
  user_id: string;
  header: string | undefined;
}

/** Converte (usuário + cabeçalho) na conta ativa, conferindo o acesso. */
@Injectable()
export class ResolveActiveAccountPipe implements PipeTransform<
  ActiveAccountInput,
  Promise<ActiveAccountContext>
> {
  constructor(private readonly access: AccountAccessService) {}

  transform({ user_id, header }: ActiveAccountInput) {
    return this.access.resolve(user_id, header);
  }
}

const RawActiveAccount = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ActiveAccountInput => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers['x-account-id'];
    return {
      user_id: request.user.sub,
      header: Array.isArray(header) ? header[0] : header,
    };
  },
);

/**
 * Injeta a conta com que o usuário está operando (cabeçalho X-Account-Id;
 * sem ele, a conta pessoal). Responde 403 se ele não tiver acesso.
 *
 * @example
 * findAll(@ActiveAccount() account: ActiveAccountContext) { ... }
 */
export const ActiveAccount = () => RawActiveAccount(ResolveActiveAccountPipe);

/** Documenta no Swagger o cabeçalho X-Account-Id. */
export const ApiActiveAccount = () =>
  ApiHeader({
    name: 'X-Account-Id',
    required: false,
    description: 'Conta ativa (sem ele: conta pessoal)',
  });
