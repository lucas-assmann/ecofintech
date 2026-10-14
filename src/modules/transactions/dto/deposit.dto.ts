import { TransferDto } from './transfer.dto.js';

// Mesmos campos da transferência: para quem (to_email, to_cpf ou to_cnpj), quanto e descrição
export class DepositDto extends TransferDto {}
