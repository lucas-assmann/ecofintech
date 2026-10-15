import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Libera a rota (ou o controller inteiro) do AuthGuard: não exige token. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
