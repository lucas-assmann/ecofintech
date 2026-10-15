import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto.js';

// Ficam de fora: a senha (muda só por PATCH /users/:id/password)
// e o CPF (identifica a pessoa, não pode ser alterado)
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password', 'cpf'] as const),
) {}
