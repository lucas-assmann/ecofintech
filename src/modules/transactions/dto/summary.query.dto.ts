import { Type } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';

export const SUMMARY_PERIODS = [7, 30, 90] as const;
export type SummaryPeriod = (typeof SUMMARY_PERIODS)[number];

export class SummaryQueryDto {
  /**
   * Período em dias, contando hoje (7, 30 ou 90)
   * @example 30
   */
  @IsOptional()
  @Type(() => Number)
  @IsIn(SUMMARY_PERIODS)
  days: SummaryPeriod = 30;
}
