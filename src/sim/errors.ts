import type { EndReason } from './types';

/** 게임이 끝나서(클리어·사망·턴 제한) 학생 코드를 멈춰야 할 때 던진다. 오류가 아니다. */
export class SimStop extends Error {
  constructor(readonly reason: EndReason) {
    super(`game over: ${reason}`);
    this.name = 'SimStop';
  }
}

/** 학생이 API 를 잘못 불렀을 때 (방향·마법 이름 오타 등). 메시지는 학생에게 그대로 보여준다. */
export class SimInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SimInputError';
  }
}

/** 스테이지 정의가 잘못됐을 때 (개발자용) */
export class StageError extends Error {
  constructor(stageId: string, message: string) {
    super(`[${stageId}] ${message}`);
    this.name = 'StageError';
  }
}
