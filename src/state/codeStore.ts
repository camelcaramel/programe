// 코드 슬롯(학생이 작성한 파이썬 스킬) 저장소. 브라우저 localStorage 에 자동 저장한다.
import { createStore } from './store';

export interface CodeSlot { name: string; code: string }

export const DEFAULT_SLOTS: CodeSlot[] = [
  {
    name: '기본 마법',
    code: `# 키 1 을 누르면 이 함수가 실행돼요.
# enemy 는 가장 가까운 적이에요. (hp, max_hp, type, distance)

def attack_strategy(enemy):
    if enemy.hp < 30:
        cast("fireball")
    else:
        cast("icebolt")
`,
  },
  {
    name: '약점 공략',
    code: `# 적의 종류(enemy.type)에 따라 약점 속성을 골라 보세요!
# 종류: "slime", "fly", "golem"  (적이 없으면 "none")

def attack_strategy(enemy):
    print("상대:", enemy.type, "HP", enemy.hp)
    if enemy.type == "slime":
        cast("fireball")
    # TODO: 날벌레와 골렘은 무엇에 약할까요? 도움말 탭을 확인!
    else:
        cast("fireball")
`,
  },
  {
    name: '응급 처치',
    code: `# HP 가 적을 때는 회복, 아니면 공격!

def attack_strategy(enemy):
    if get_player_hp() < 50:
        cast("heal")
    elif get_player_mp() >= 24:
        cast("fireball")
        cast("fireball")
    else:
        print("MP 가 부족해요...")
`,
  },
];

const KEY = 'programe.slots.v1';

function load(): CodeSlot[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CodeSlot[];
      if (Array.isArray(parsed) && parsed.length === 3) return parsed;
    }
  } catch {
    /* 저장소를 쓸 수 없으면 기본값 */
  }
  return DEFAULT_SLOTS.map((s) => ({ ...s }));
}

export const codeStore = createStore<{ slots: CodeSlot[] }>({ slots: load() });

let saveTimer: ReturnType<typeof setTimeout> | undefined;
codeStore.subscribe(() => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(codeStore.get().slots));
    } catch {
      /* 무시 */
    }
  }, 300);
});

export function setSlotCode(i: number, code: string) {
  codeStore.set((s) => ({ slots: s.slots.map((slot, j) => (j === i ? { ...slot, code } : slot)) }));
}
export function resetSlot(i: number) {
  codeStore.set((s) => ({ slots: s.slots.map((slot, j) => (j === i ? { ...DEFAULT_SLOTS[i] } : slot)) }));
}
