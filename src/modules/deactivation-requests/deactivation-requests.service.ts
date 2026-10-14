import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { Prisma } from '../../database/generated/prisma/client.js';
import { CreateDeactivationRequestDto } from './dto/create-deactivation-request.dto.js';
import { ReviewDeactivationRequestDto } from './dto/review-deactivation-request.dto.js';
import { ListDeactivationRequestsQueryDto } from './dto/list-deactivation-requests.query.dto.js';
import {
  DeactivationRequest,
  DeactivationRequestCreatedResponse,
} from './entities/deactivation-request.entity.js';

export const REQUEST_RECEIVED_MESSAGE =
  'Sua solicitação foi recebida. O suporte avaliará a solicitação.';

const requestSelect = {
  id: true,
  status: true,
  reason: true,
  requested_at: true,
  reviewed_at: true,
  review_note: true,
  // Relação com quem solicitou (nome gerado pelo db pull)
  users_deactivation_requests_user_idTousers: {
    select: { id: true, name: true, email: true },
  },
} satisfies Prisma.deactivation_requestsSelect;

type SelectedRequest = Prisma.deactivation_requestsGetPayload<{
  select: typeof requestSelect;
}>;

@Injectable()
export class DeactivationRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  /** O usuário pede a desativação da própria conta; fica pendente até o suporte avaliar. */
  async create(
    user_id: string,
    dto: CreateDeactivationRequestDto,
  ): Promise<DeactivationRequestCreatedResponse> {
    // Uma empresa precisa sempre de um dono: quem é dono de uma empresa ativa
    // não pode desativar a conta pessoal (transferir a posse fica para depois)
    const owned = await this.prisma.company_members.findFirst({
      where: { user_id, role: 'owner', companies: { status: 'active' } },
      select: { companies: { select: { trade_name: true } } },
    });
    if (owned) {
      throw new UnprocessableEntityException(
        `Você é dono da empresa ${owned.companies.trade_name}. Ela não pode ficar sem dono.`,
      );
    }

    try {
      const request = await this.prisma.deactivation_requests.create({
        data: { user_id, reason: dto.reason },
        select: requestSelect,
      });
      return { message: REQUEST_RECEIVED_MESSAGE, request: toRequest(request) };
    } catch (error) {
      // Índice único parcial: já existe uma pendente para este usuário
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Você já tem uma solicitação em análise pelo suporte',
        );
      }
      throw error;
    }
  }

  /** Última solicitação do usuário (para o front mostrar a situação). */
  async findMine(user_id: string): Promise<DeactivationRequest> {
    const request = await this.prisma.deactivation_requests.findFirst({
      where: { user_id },
      orderBy: { requested_at: 'desc' },
      select: requestSelect,
    });
    if (!request) {
      throw new NotFoundException('Nenhuma solicitação de desativação');
    }
    return toRequest(request);
  }

  /** Lista para o suporte (admin), mais antigas primeiro: fila de atendimento. */
  async findAll(
    query: ListDeactivationRequestsQueryDto,
  ): Promise<DeactivationRequest[]> {
    const requests = await this.prisma.deactivation_requests.findMany({
      where: { status: query.status },
      orderBy: { requested_at: 'asc' },
      select: requestSelect,
    });
    return requests.map(toRequest);
  }

  /**
   * Aprova: desativa a conta (bloqueia login e movimentações, mantém o
   * histórico) e derruba as sessões abertas. Exige saldo zerado.
   */
  async approve(
    admin_id: string,
    id: string,
    dto: ReviewDeactivationRequestDto,
  ): Promise<DeactivationRequest> {
    return this.prisma.$transaction(async (tx) => {
      const pending = await this.findPending(tx, id);

      const account = await tx.accounts.findUnique({
        where: { user_id: pending.user_id },
        select: { balance: true },
      });
      if (account && account.balance.gt(0)) {
        throw new ConflictException(
          `A conta ainda tem saldo de ${formatBRL(account.balance)}. ` +
            'O saldo precisa ser zerado antes da desativação.',
        );
      }

      await tx.users.update({
        where: { id: pending.user_id },
        data: {
          status: 'deactivated',
          deactivated_at: new Date(),
          token_version: { increment: 1 },
          updated_at: new Date(),
        },
      });

      return this.review(tx, id, admin_id, 'approved', dto.note);
    });
  }

  /** Recusa: a conta continua ativa; o usuário pode solicitar de novo depois. */
  async reject(
    admin_id: string,
    id: string,
    dto: ReviewDeactivationRequestDto,
  ): Promise<DeactivationRequest> {
    return this.prisma.$transaction(async (tx) => {
      await this.findPending(tx, id);
      return this.review(tx, id, admin_id, 'rejected', dto.note);
    });
  }

  private async findPending(tx: Prisma.TransactionClient, id: string) {
    const request = await tx.deactivation_requests.findUnique({
      where: { id },
      select: { user_id: true, status: true },
    });
    if (!request) throw new NotFoundException('Solicitação não encontrada');
    if (request.status !== 'pending') {
      throw new ConflictException('Esta solicitação já foi avaliada');
    }
    return request;
  }

  private async review(
    tx: Prisma.TransactionClient,
    id: string,
    admin_id: string,
    status: 'approved' | 'rejected',
    note?: string,
  ): Promise<DeactivationRequest> {
    // where com status: se outro admin avaliou ao mesmo tempo, não sobrescreve
    const request = await tx.deactivation_requests
      .update({
        where: { id, status: 'pending' },
        data: {
          status,
          reviewed_by: admin_id,
          reviewed_at: new Date(),
          review_note: note,
        },
        select: requestSelect,
      })
      .catch((error: unknown) => {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2025'
        ) {
          throw new ConflictException('Esta solicitação já foi avaliada');
        }
        throw error;
      });
    return toRequest(request);
  }
}

function toRequest(request: SelectedRequest): DeactivationRequest {
  const { users_deactivation_requests_user_idTousers: user, ...rest } = request;
  return { ...rest, user };
}

// Valor em reais no padrão brasileiro para mensagens (ex.: "R$ 1.234,56").
// O Intl usa espaço não separável depois de "R$"; trocamos por espaço comum.
function formatBRL(value: Prisma.Decimal): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(value.toNumber())
    .replace(/\s/g, ' ');
}
