import { Transform } from 'class-transformer';
import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * Confere se o CPF é válido: 11 dígitos, não repetidos (ex.: 111.111.111-11)
 * e com os dois dígitos verificadores corretos.
 */
export function isValidCpf(value: string): boolean {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;

  const digits = value.split('').map(Number);
  // Cada verificador é calculado a partir dos dígitos anteriores
  for (const position of [9, 10]) {
    const sum = digits
      .slice(0, position)
      .reduce((acc, digit, i) => acc + digit * (position + 1 - i), 0);
    const check = ((sum * 10) % 11) % 10;
    if (check !== digits[position]) return false;
  }
  return true;
}

/** Remove tudo que não é dígito (ex.: "123.456.789-09" → "12345678909"). */
export const OnlyDigits = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/\D/g, '') : value,
  );

/** Valida um CPF (use junto com @OnlyDigits() para aceitar com pontuação). */
export function IsCpf(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isCpf',
      target: object.constructor,
      propertyName,
      options: { message: `${propertyName} inválido`, ...options },
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && isValidCpf(value),
      },
    });
}
