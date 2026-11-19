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

export interface StarRule {
  /** 이 조건으로 받는 별 수 */
  stars: number;
  label: string;
  /** 마우스를 올리면 보이는 덧붙임 */
  title?: string;
}

/** 계획 화면에 보여 줄 별 조건. 클리어만 하면 받는 보너스 별은 "맵 모두 통과" 에 합쳐 글자를 줄인다 */
export function starRules(stage: StageInfo, hasChests: boolean): StarRule[] {
  const rules: StarRule[] = [{ stars: 1, label: '맵 모두 통과' }];
  if (hasChests) rules.push({ stars: 1, label: '상자 모두 열기' });
  else rules[0].stars++;
  if (stage.stars?.lines) rules.push({ stars: 1, label: `${stage.stars.lines}줄 이하`, title: '빈 줄과 주석(#)은 세지 않아요' });
  else rules[0].stars++;
  return rules;
}
