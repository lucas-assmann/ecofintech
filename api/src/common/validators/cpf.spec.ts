import { isValidCpf } from './cpf.js';

describe('isValidCpf', () => {
  it.each(['52998224725', '11144477735', '39053344705'])(
    'aceita CPF válido %s',
    (cpf) => expect(isValidCpf(cpf)).toBe(true),
  );

  it.each([
    ['dígito verificador errado', '52998224724'],
    ['todos os dígitos iguais', '11111111111'],
    ['menos de 11 dígitos', '5299822472'],
    ['com letras', '5299822472a'],
  ])('recusa %s', (_motivo, cpf) => expect(isValidCpf(cpf)).toBe(false));
});
