import { assertUtcSession } from './assert-utc-session.js';

const dbWith = (tz: string, offset_seconds: number) => ({
  $queryRaw: vi.fn().mockResolvedValue([{ tz, offset_seconds }]),
});

describe('assertUtcSession', () => {
  it('aceita sessão em UTC', async () => {
    await expect(assertUtcSession(dbWith('UTC', 0))).resolves.toBeUndefined();
  });

  it('aceita outros nomes do fuso zero (ex.: GMT)', async () => {
    await expect(assertUtcSession(dbWith('GMT', 0))).resolves.toBeUndefined();
  });

  it('recusa fuso diferente de UTC e explica como corrigir', async () => {
    await expect(
      assertUtcSession(dbWith('America/Sao_Paulo', -10800)),
    ).rejects.toThrow(/America\/Sao_Paulo[\s\S]*SET timezone TO 'UTC'/);
  });
});
