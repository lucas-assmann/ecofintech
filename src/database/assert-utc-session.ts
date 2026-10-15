interface RawQueryable {
  $queryRaw<T = unknown>(
    query: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T>;
}

/**
 * Garante que a sessão do banco está em UTC. O adaptador do Prisma
 * (@prisma/adapter-pg) ignora o fuso das colunas TIMESTAMPTZ: com o banco
 * em outro fuso (ex.: America/Sao_Paulo), toda data lida ou enviada fica
 * deslocada (3h no caso de Brasília) e filtros como "mais antigo que 24h"
 * erram em silêncio. A API não sobe nesse caso, como faz com o .env inválido.
 * O fuso de exibição (horário de Brasília) é responsabilidade do front.
 */
export async function assertUtcSession(db: RawQueryable): Promise<void> {
  const [{ tz, offset_seconds }] = await db.$queryRaw<
    { tz: string; offset_seconds: number }[]
  >`SELECT current_setting('TimeZone') AS tz,
           EXTRACT(TIMEZONE FROM now())::int AS offset_seconds`;
  if (Number(offset_seconds) !== 0) {
    throw new Error(
      `O banco está no fuso "${tz}", mas a API precisa dele em UTC ` +
        '(senão as datas ficam deslocadas). Rode no banco, uma vez:\n' +
        "  ALTER DATABASE <nome_do_banco> SET timezone TO 'UTC';\n" +
        'e reinicie a API.',
    );
  }
}
