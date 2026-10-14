import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { OnlyDigits } from './cpf.js';
import { IsCnpj, isValidCnpj } from './cnpj.js';

describe('isValidCnpj', () => {
  it.each(['11222333000181', '00000000000191'])(
    'aceita CNPJ válido %s',
    (cnpj) => expect(isValidCnpj(cnpj)).toBe(true),
  );

  it.each([
    ['dígito verificador errado', '11222333000182'],
    ['todos os dígitos iguais', '11111111111111'],
    ['menos de 14 dígitos', '1122233300018'],
    ['com pontuação (o validador recebe só dígitos)', '11.222.333/0001-81'],
  ])('recusa %s', (_motivo, cnpj) => expect(isValidCnpj(cnpj)).toBe(false));
});

describe('@IsCnpj com @OnlyDigits', () => {
  class Dto {
    @OnlyDigits()
    @IsCnpj()
    cnpj: string;
  }

  it('aceita pontuação, espaços e zeros à esquerda, guardando só os dígitos', () => {
    const dto = plainToInstance(Dto, { cnpj: ' 00.000.000/0001-91 ' });

    expect(validateSync(dto)).toEqual([]);
    expect(dto.cnpj).toBe('00000000000191');
  });

  it('recusa CNPJ inválido com mensagem', () => {
    const dto = plainToInstance(Dto, { cnpj: '11.222.333/0001-82' });

    const [error] = validateSync(dto);
    expect(error.constraints).toEqual({ isCnpj: 'cnpj inválido' });
  });
});
