import { validateEnv } from './env.validation.js';

const valid = {
  DATABASE_URL: 'postgresql://postgres:senha@localhost:5432/ecofintech',
  JWT_SECRET: 'x'.repeat(48),
  JWT_EXPIRES_IN: '3600',
  PORT: '3000',
};

describe('validateEnv', () => {
  it('aceita uma configuração válida e converte números', () => {
    const env = validateEnv(valid);
    expect(env.JWT_EXPIRES_IN).toBe(3600);
    expect(env.PORT).toBe(3000);
  });

  it('recusa quando falta JWT_SECRET', () => {
    const { JWT_SECRET: _omit, ...rest } = valid;
    expect(() => validateEnv(rest)).toThrow('JWT_SECRET');
  });

  it('recusa JWT_SECRET curto', () => {
    expect(() => validateEnv({ ...valid, JWT_SECRET: 'curto' })).toThrow(
      'pelo menos 32 caracteres',
    );
  });

  it('recusa DATABASE_URL que não é PostgreSQL', () => {
    expect(() =>
      validateEnv({ ...valid, DATABASE_URL: 'mysql://localhost/db' }),
    ).toThrow('DATABASE_URL');
  });

  it('lista todos os problemas de uma vez', () => {
    expect(() => validateEnv({ JWT_EXPIRES_IN: 'abc' })).toThrow(
      /DATABASE_URL[\s\S]*JWT_SECRET[\s\S]*JWT_EXPIRES_IN/,
    );
  });
});
