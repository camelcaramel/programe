# programe (가제)

파이썬 코드로 마법을 짓는 웹 2D 횡스크롤 액션 RPG입니다. 중·고등학생이 게임 속에서 `if`문과 변수를 써서 스킬 로직을 직접 만들고, 몬스터의 약점을 공략합니다.

- 기술: Phaser 3 · TypeScript · React · Monaco Editor · Pyodide(Web Worker) · Vite
- 에셋: [Kenney](https://kenney.nl) New Platformer Pack (CC0)

## 실행

```bash
npm install
npm run dev       # http://localhost:5173
```

`npm run dev`/`npm run build` 직전에 `scripts/copy-pyodide.mjs`가 Pyodide 런타임을 `public/pyodide/`로 복사합니다. 인터넷(CDN) 없이도 동작합니다.

## 배포 (정적 호스팅)

```bash
npm run build     # dist/ 생성
npm run preview   # 빌드 결과 미리보기
```

- `dist/` 폴더를 아무 정적 호스팅에 올리면 됩니다. Vite `base: './'` 설정 덕분에 하위 경로(`/programe/`)에서도 동작합니다.
- GitHub Pages: 저장소 Settings → Pages → Source 를 **GitHub Actions** 로 두면 `main` 에 push 할 때 `.github/workflows/deploy.yml` 이 자동 배포합니다.

## 게임 방법

| 키 | 동작 |
|----|------|
| ←/→, A/D | 이동 |
| Space, ↑, W | 점프 (길게 누르면 더 높이) |
| J, Z | 기본 공격 |
| 1, 2, 3 | 코드 스킬 슬롯 실행 |
| Tab | 코드 패널 열기/닫기 |
| Esc | 에디터에서 게임으로 포커스 이동 |

오른쪽 패널에서 슬롯마다 `attack_strategy(enemy)` 함수를 작성합니다. 숫자키를 누르면 가장 가까운 적이 `enemy` 로 전달되고, 함수 안에서 `cast()` 한 스킬이 순서대로 발동합니다.

```python
def attack_strategy(enemy):
    if enemy.type == "golem":
        cast("icebolt")
    elif get_player_hp() < 50:
        cast("heal")
    else:
        cast("fireball")
```

### 학생용 API

| 이름 | 설명 |
|------|------|
| `cast(name)` | `"fireball"`, `"icebolt"`, `"heal"` 발동 (실행 1회당 최대 3번) |
| `get_enemy_hp()`, `get_player_hp()`, `get_player_mp()` | 현재 수치 |
| `print(...)` | 패널 콘솔에 출력 |
| `enemy.hp`, `enemy.max_hp`, `enemy.type`, `enemy.distance`, `enemy.exists` | 대상 적 정보 (`type`: `slime`/`fly`/`golem`/`none`, `distance`: 칸) |

### 안전 장치

- 학생 코드는 Web Worker 안의 Pyodide 에서 실행되므로 게임이 멈추지 않습니다.
- 허용된 내장 함수만 쓸 수 있습니다. `import`, 파일, 네트워크는 쓸 수 없습니다.
- 줄 단위 추적으로 0.5초(또는 20,000단계)를 넘으면 중단합니다. 그래도 2초 안에 응답이 없으면 워커를 강제 종료하고 다시 시작합니다.
- 오류는 한국어 메시지와 함께 에디터의 해당 줄에 빨간 밑줄로 표시됩니다.

## 몬스터와 스킬

| 몬스터 (`type`) | HP | 특징 |
|------|----|------|
| 슬라임 `slime` | 40 | 불 ×1.5 |
| 날벌레 `fly` | 30 | 하늘을 남, 얼음 ×1.5 |
| 블록 골렘 `golem` | 170 | 기본 공격 ×0.25, 불 ×0.5, 얼음 ×2. 출구 문을 지킴 |

| 스킬 | MP | 효과 |
|------|----|------|
| `fireball` | 10 | 불 피해 24 |
| `icebolt` | 14 | 얼음 피해 18 + 감속 |
| `heal` | 18 | HP 35 회복 |

레벨이 오르면 HP/MP 최대치와 스킬 위력(+10%/레벨)이 올라갑니다. 밸런스 값은 `src/game/data.ts` 한 곳에 모여 있습니다.

## 폴더 구조

```
scripts/
  generateMap.mjs     맵 생성 (npm run map) → public/maps/dungeon.json (Tiled 에서 열어 수정 가능)
  copy-pyodide.mjs    Pyodide 런타임 복사
src/
  game/
    data.ts           스킬·몬스터·미션·밸런스 데이터
    scenes/GameScene  맵, 충돌, 전투, 미션, 진행
    entities/         Player, Monster
    systems/          SkillSystem(코드 실행 → 스킬 발동), effects
  python/
    prelude.py        샌드박스, 학생 API, 오류 메시지
    worker.ts         Pyodide Web Worker
    runner.ts         실행 큐, 강제 타임아웃, 워커 재시작
  state/              Phaser ↔ React 공용 상태 저장소, 코드 슬롯 저장(localStorage)
  ui/                 React: HUD, 미니맵, 코드 패널(Monaco), 핫바, 시작/사망/클리어 화면
  bridge/eventBus.ts  React → Phaser 이벤트
```
