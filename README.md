# programe (가제)

파이썬 코드 한 편으로 던전을 탈출하는 웹 2D 탑다운 퍼즐입니다. 중·고등학생이 맵을 살펴보고 계획을 세운 뒤, **캐릭터를 오직 자기 코드로만** 움직여 스테이지를 풉니다. 1부(스테이지 1~10)에서 순차 실행 → `for` → `if` → `while` → `def` → 변수 → 이중 `for` 를, 2부(11~18)에서 변수 저장 → 자료형·형변환 → 카운터 → 리스트 → 인덱스·`len()` → `append`·`max` → `return` 함수를, 3부(19~27, 고등 수준)에서 객체·속성 → `None` → 객체 비교 → 딕셔너리 → 클래스·`self` → 인스턴스 여러 개 → 상태 → 2차원 리스트 → 너비 우선 탐색(BFS)을 스테이지마다 하나씩 배웁니다.

- **모든 스테이지가 처음부터 열려 있습니다.** 번호 순서가 추천 순서이고, 선택 화면에서 아직 깨지 않은 첫 스테이지에 "다음 추천" 표시가 붙습니다. 교사는 수업 순서대로 원하는 스테이지를 바로 열면 됩니다.

- 처음 들어오면 스테이지 1에서 화면 안내 튜토리얼이 뜹니다(처음 화면·명령 사전에서 다시 보기). 새 개념이 나오는 스테이지는 처음 열 때 "새 개념" 카드로 설명합니다.

- 기술: Phaser 3 · TypeScript · React · Monaco Editor · Pyodide(Web Worker) · Vite · Vitest
- 에셋: [Kenney](https://kenney.nl) Tiny Dungeon (CC0), 효과음은 Kenney 팩

## 실행

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # 시뮬레이터·파이썬 연결·스테이지 테스트
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

1. **계획**: 맵 전체를 보고 오른쪽 마법서에 파이썬 코드를 씁니다. `?` 칸은 실행할 때마다 바뀝니다.
2. **실행**: 같은 코드를 맵 여러 개(시드)에 한꺼번에 돌립니다. 모두 통과해야 클리어입니다.
3. **재생**: 실행 기록을 애니메이션으로 보여 주고, 지금 실행 중인 코드 줄을 노랗게 표시합니다. 실패한 맵부터 재생합니다.
4. **결과**: 별 3개 = 맵 모두 통과 · 보물상자 모두 열기 · 코드 N줄 이하.

2부에서는 표지판·석판의 내용과 비밀 문 암호가 실행마다 바뀌고 계획 화면에서는 가려져 있어, **코드로 읽어서** 써야 합니다. 3부에서는 몬스터의 HP·약점이 실행마다 **변이**해서 `scan()` 이 돌려주는 객체의 속성을 읽어야 하고, 내가 만든 **클래스**로 조수 로봇 여러 대를 함께 움직이며, `get_map()` 의 2차원 리스트로 가장 짧은 길을 찾습니다. 설계는 [PART2.md](PART2.md)·[PART3.md](PART3.md).

```python
for i in range(6):
    if look("right") == "slime":
        cast("fireball", "right")
    move_right()
```

| 키 | 동작 |
|----|------|
| Ctrl + Enter | 실행 |
| Space | 재생 멈춤/계속 (에디터 밖에서) |
| ← / → | 재생 한 턴 뒤로/앞으로 (에디터 밖에서) |
| Tab | 마법서 접기/펴기 (에디터 밖에서) |
| 위쪽 `#` 버튼 | 맵의 체스판 무늬와 칸 좌표(x, y) 보이기/숨기기 |
| Esc | 에디터에서 빠져나오기 |

### 학생용 명령

| 명령 | 설명 | 턴 |
|------|------|----|
| `move_up()` `move_down()` `move_left()` `move_right()` | 한 칸 이동. 벽이면 제자리("쿵") | 1 |
| `look(방향)` | 옆 칸: `"empty"` `"wall"` `"exit"` `"chest"` `"key"` `"door"` `"slime"` `"bat"` `"giant"` (2부: `"sign"` `"tablet"` `"gate"` · 3부: `"ghost"` `"spider"` `"crab"` `"bars"` `"bot"`, 미믹은 `"chest"`) | 0 |
| `cast(마법, 방향)` | 옆 칸 몬스터에게 `"fireball"`(불) / `"icebolt"`(얼음) / `"lightning"`(번개, 3부) | 1 |
| `get_hp()` `get_pos()` `get_coins()` `get_keys()` | 내 상태 | 0 |
| `print(...)` | 주문 기록 창에 출력 | 0 |
| `read(방향)` (11~) | 옆 칸 표지판은 문자열(`"42"`), 석판은 리스트(`["right", "down"]`) | 0 |
| `open_gate(방향, 암호)` (11~) | 옆 칸 비밀 문에 암호. **자료형까지 같아야** 열림(`"42"` ≠ `42`). 틀리면 경보, HP −1 | 1 |
| `move(방향)` (14~) | `move("right")` = `move_right()`. 리스트의 방향을 그대로 따라갈 때 | 1 |
| `scan(방향)` (19~) | 옆 칸 몬스터 **객체**: `m.kind` `m.hp`(지금 HP) `m.max_hp` `m.weak`(약점 마법). 없으면 `None` | 0 |
| `wait()` (23~) | 한 턴 쉬기 (조수들은 움직임) | 1 |
| `get_bots()` (23~) | 조수 로봇 리스트. `bot.move/cast/look/read/scan(…)` | 0 |
| `hire(조수)` (23~) | `act()` 메서드가 있는 객체를 고용. 내가 1턴을 쓸 때마다 고용한 조수 모두의 `act()` 가 한 번씩 불림 | 0 |
| `get_map()` (26~) | 맵 전체 2차원 리스트, `grid[y][x]` 는 `look()` 과 같은 낱말 | 0 |

방향은 `"up"` `"down"` `"left"` `"right"`. 스테이지마다 쓸 수 있는 명령이 정해져 있고, 아직 안 배운 명령은 "아직 배우지 않은 명령" 오류가 납니다.

### 몬스터

| 몬스터 | HP | 부딪히면 | 처치 |
|--------|----|----------|------|
| 슬라임 `slime` | 2 | HP −1 | 불 1번 (얼음은 효과 없음) |
| 박쥐 `bat` | 2 | HP −1 | 얼음 1번 (불은 효과 없음) |
| 외눈 거인 `giant` | 4 | HP −2 | 얼음 2번 (불은 효과 없음) |
| 유령 `ghost` · 거미 `spider` (3부) | 시드마다 | HP −1 | 약점 마법(시드마다 변이) 1번에 2 피해. 다른 마법은 0 피해 + **반격** HP −1 |
| 게 `crab` (3부) | 시드마다 | HP −2 | 〃 |
| 미믹 `mimic` (3부) | 시드마다 | HP −3 | 〃. 화면과 `look()` 에는 상자로 보임, `scan()` 만 정체를 앎 |

플레이어 HP 는 3. 수치는 `src/sim/rules.ts` 한 곳에 있습니다. 3부의 조수 로봇은 약점이 아닌 마법을 쓰면 반격을 받아 고장(멈춤)납니다. 창살(`=`)은 모든 발판(`P`)에 로봇이 서 있고 몬스터가 하나도 없을 때만 열립니다.

### 안전 장치

- 학생 코드는 Web Worker 안의 Pyodide 에서 실행되므로 게임이 멈추지 않습니다. 게임 규칙(시뮬레이터)도 워커 안에서 끝까지 돌고, 화면은 실행 기록만 재생합니다.
- 허용된 내장 함수만 쓸 수 있습니다. `import`, 파일, 네트워크는 쓸 수 없습니다.
- 맵당 0.5초(또는 10만 추적 단계) / 턴 제한을 넘으면 중단합니다. 그래도 응답이 없으면 워커를 강제 종료하고 다시 시작합니다.
- 학생이 `except:` 나 `except Exception:` 을 써도 게임 종료·시간 초과는 막을 수 없습니다.
- 오류는 한국어 메시지와 함께 에디터의 해당 줄에 빨간 밑줄로 표시됩니다.
- 코드와 별 기록은 브라우저(localStorage)에 자동 저장됩니다.

## 스테이지 만들기

스테이지는 ASCII 맵으로 정의합니다. 1부는 `src/stages/index.ts`, 2부는 `src/stages/part2.ts`, 3부는 `src/stages/part3.ts` (공용 타입은 `types.ts`, 미로 생성·길 찾기는 `maze.ts`).

```
.  바닥     #  벽       S  시작     E  출구
c  보물상자  k  열쇠     D  문
s  슬라임   b  박쥐     g  외눈 거인
?  랜덤 칸 (random 에 후보를 적음, 예: { '?': ['.', 's'] })
T  표지판   M  석판     G  비밀 문   (내용·암호는 content(rng, 자리) 가 시드로 만듦)
o  유령     x  거미     q  게        m  미믹   (3부 변이 몬스터. HP·약점은 content 의 monsters 로)
R  조수 로봇 P  발판     =  창살
```

각 스테이지에는 정답 예시(`solution`)와 하드코딩 풀이(`hardcoded`)·우회 풀이(`bypasses`)를 함께 적습니다. `npm test` 가 실제 Pyodide 로 "정답은 모든 시드 클리어 + 별 3개, 하드코딩·우회 풀이는 실패, 시드마다 맵·내용이 다름"을 확인합니다. 새 개념 설명 카드는 스테이지 정의의 `concepts` 필드에 둡니다.

## 폴더 구조

```
src/
  sim/                게임 규칙 (순수 TS): 시드 난수, ASCII → 맵, World(move·look·cast), 실행 기록, 되감기 계산
  stages/             1부(index.ts)·2부(part2.ts)·3부(part3.ts) 스테이지와 개념 카드, 미로(maze.ts), 별 계산, 스테이지 테스트
  python/
    prelude.py        샌드박스, 학생 명령, 오류 메시지
    stageBridge.ts    파이썬 ↔ 시뮬레이터 연결 (워커·테스트 공용)
    worker.ts         Pyodide Web Worker
    runner.ts         실행 큐, 강제 타임아웃, 워커 재시작
  game/
    play.ts           스테이지 열기 → 실행 → 재생 → 결과
    scenes/GridScene  타일 그리기, 실행 기록 애니메이션, 효과음
  state/              Phaser ↔ React 공용 상태, 코드·별 저장(localStorage), 개념 카드·튜토리얼(guide.ts)
  ui/                 React: HUD, 재생 막대, 결과 카드, 마법서(Monaco), 타이틀·스테이지 선택, 개념 카드·튜토리얼(Guide.tsx)
scripts/copy-pyodide.mjs   Pyodide 런타임 복사
```
