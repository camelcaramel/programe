// 실행 결과 → 별 계산
import type { StageRunResult } from '../python/stageBridge';
import { countCodeLines, type StageInfo } from './index';

export interface StarCheck {
  id: 'clear' | 'chests' | 'lines';
  label: string;
  ok: boolean;
}

export interface Score {
  cleared: boolean;
  stars: number;
  checks: StarCheck[];
  lines: number;
}

/** 이 스테이지에 상자가 있는지 (시드 중 하나라도) */
export const stageHasChests = (result: StageRunResult) => result.runs.some((r) => r.summary.chestsTotal > 0);

export function scoreRun(stage: StageInfo, result: StageRunResult, code: string): Score {
  const lines = countCodeLines(code);
  const cleared = result.ok;
  const checks: StarCheck[] = [{ id: 'clear', label: '맵 모두 통과', ok: cleared }];
  checks.push(
    stageHasChests(result)
      ? { id: 'chests', label: '보물상자 모두 열기', ok: cleared && result.runs.every((r) => r.summary.coins === r.summary.chestsTotal) }
      : { id: 'chests', label: '보물상자 없음 (보너스 별)', ok: cleared },
  );
  checks.push(
    stage.stars?.lines
      ? { id: 'lines', label: `코드 ${stage.stars.lines}줄 이하`, ok: cleared && lines <= stage.stars.lines }
      : { id: 'lines', label: '줄 수 제한 없음 (보너스 별)', ok: cleared },
  );
  return { cleared, stars: checks.filter((c) => c.ok).length, checks, lines };
}

/** 계획 화면에 보여 줄 별 조건 */
export function starRules(stage: StageInfo, hasChests: boolean): string[] {
  return [
    '맵 모두 통과',
    hasChests ? '보물상자 모두 열기' : '보물상자 없음 (클리어하면 받아요)',
    stage.stars?.lines ? `코드 ${stage.stars.lines}줄 이하 (빈 줄·주석 제외)` : '줄 수 제한 없음 (클리어하면 받아요)',
  ];
}
