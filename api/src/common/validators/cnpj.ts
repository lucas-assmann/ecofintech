import { registerDecorator, ValidationOptions } from 'class-validator';

// Pesos oficiais dos dois dígitos verificadores do CNPJ
const WEIGHTS = [
  [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
];

/**
 * Confere se o CNPJ é válido: 14 dígitos, não repetidos (ex.: 11.111.111/1111-11)
 * e com os dois dígitos verificadores corretos.
 */
export function isValidCnpj(value: string): boolean {
  if (!/^\d{14}$/.test(value) || /^(\d)\1{13}$/.test(value)) return false;

  const digits = value.split('').map(Number);
  // Cada verificador é calculado a partir dos dígitos anteriores
  return WEIGHTS.every((weights) => {
    const sum = weights.reduce((acc, weight, i) => acc + digits[i] * weight, 0);
    const rest = sum % 11;
    const check = rest < 2 ? 0 : 11 - rest;
    return check === digits[weights.length];
  });
}

/** Valida um CNPJ (use junto com @OnlyDigits() para aceitar com pontuação). */
export function IsCnpj(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isCnpj',
      target: object.constructor,
      propertyName,
      options: { message: `${propertyName} inválido`, ...options },
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && isValidCnpj(value),
      },
    });
}
