# programe (가제) – 프로젝트 진행 계획 (v0.1)

> 기준 문서: SRD.md (v0.2, 구 명칭 CODE ADVENTURE). 프로젝트명은 **programe(가제)** 로 변경한다.
> 목표: 웹 기반 2D 횡스크롤 액션 RPG에서 파이썬 코드를 작성해 스킬을 발동하는 프로토타입.

## 1. 범위와 완료 기준 (SRD §5, §8)

- 이동/점프/기본 공격이 가능한 플레이어
- Tiled 맵 1개 + 충돌
- 몬스터 2~3종 (HP, 피격, 사망)
- Monaco Editor + Pyodide(Web Worker)로 작성한 파이썬 코드가 스킬로 동작
- HUD(HP/MP), 스킬 핫바, 우측 접이식 패널
- Kenney(CC0) 에셋만 사용, `npm run dev`로 즉시 실행

## 2. 전제 / 결정 사항

| 항목 | 결정 | 비고 |
|------|------|------|
| 스택 | Phaser 3 + TypeScript + Vite | SRD 그대로 |
| UI | **React 사용 권장** | Monaco/패널/핫바 UI 관리가 쉬움. Phaser와는 이벤트 버스로 통신 |
| 파이썬 실행 | Pyodide in Web Worker | 타임아웃으로 무한루프 차단 |
| 맵 | Tiled → JSON | |
| 에셋 | Kenney New Platformer Pack + UI Pack | `public/assets/kenney/` |

## 3. 폴더 구조 (제안)

```
programe/
├─ public/assets/kenney/{platformer,ui,audio}/
├─ public/maps/                 # Tiled JSON, tmx 원본
├─ src/
│  ├─ game/
│  │  ├─ scenes/                # Boot, Preload, Game
│  │  ├─ entities/              # Player, Monster
│  │  ├─ systems/               # Combat, SkillExecutor
│  │  └─ config.ts
│  ├─ ui/                       # React: Hud, Hotbar, SidePanel, CodeEditor
│  ├─ python/
│  │  ├─ worker.ts              # Pyodide Worker
│  │  ├─ api.py                 # 허용 API: cast, get_enemy_hp ...
│  │  └─ runner.ts              # 메인스레드 래퍼 (타임아웃, 재시작)
│  ├─ bridge/eventBus.ts        # Phaser ↔ React 통신
│  └─ main.tsx
├─ SRD.md / PLAN.md
└─ package.json
```

## 4. 마일스톤

SRD 우선순위 1~4를 1차 목표, 5~6을 2차 목표로 한다. 일정은 1인 개발 기준 추정치다.

| 단계 | 내용 | 산출물 / 검증 | 예상 |
|------|------|----------------|------|
| M0 | 환경 세팅: Vite+TS+Phaser(+React), 에셋 다운로드·정리, 라이선스 표기 | `npm run dev`로 빈 캔버스 표시 | 0.5일 |
| M1 | 플레이어 이동·점프·기본 공격, 카메라 추적 (우선순위 1) | 임시 바닥에서 조작 가능 | 1~2일 |
| M2 | Tiled 맵 제작·로드, 충돌 타일 (우선순위 2) | 맵 위 이동, 벽/바닥 충돌 | 1~2일 |
| M3 | 몬스터 1종 + AI + 피격/사망, 이후 2~3종으로 확장 (우선순위 3) | 공격으로 처치 가능 | 2일 |
| M4 | 우측 접이식 패널 + Monaco Editor 연동 (우선순위 4) | 패널 접기/펼치기, 코드 편집·저장 | 1~2일 |
| **1차 마감** | M1~M4 완료, 코드 구조 정리 | 데모 가능 | ≈1주 |
| M5 | Pyodide Worker + 제한 API(`cast`, `get_enemy_hp`) + 테스트 실행 + 스킬 발동 (우선순위 5) | 조건문 예시 코드로 fireball/icebolt 분기 | 3~4일 |
| M6 | HUD(HP/MP/레벨/골드), 스킬 핫바, 단축키 (우선순위 6) | 전투 중 단축키로 스킬 사용 | 2일 |
| M7 | 안정화: 시간 제한, 에러 메시지, 사운드, 튜토리얼 문구, DoD 점검 | SRD §8 체크리스트 통과 | 2일 |

총 약 3주 내외.

## 5. 핵심 설계 (M5, 가장 위험한 부분)

1. **실행 흐름**: 플레이어가 스킬 키 입력 → 게임이 `enemy` 상태(hp 등)를 Worker로 전송 → Worker가 `attack_strategy(enemy)` 실행 → `cast("...")` 호출을 **명령 목록**으로 수집 → 메인으로 반환 → 게임이 명령을 실행(발사체/데미지).
2. **API는 부수효과 없이 명령만 기록**: 파이썬이 게임 상태를 직접 바꾸지 못하게 한다.
3. **시간 제한**: 호출당 약 1~2초 타임아웃, 초과 시 Worker를 `terminate()` 후 재생성. 필요하면 명령 개수 상한도 둔다.
4. **샌드박스**: Worker 내부에서 `os`, `sys`, 네트워크 접근 등은 막거나 사용 안내 문구로 제한한다.
5. **지연 시간**: Pyodide 초기 로딩(수 MB)이 크므로 게임 시작 시 미리 로딩하고 로딩 UI를 보여준다. 매 전투 입력마다 실행하기보다, 결과 캐시나 쿨타임으로 체감 지연을 줄인다.
6. **테스트 실행**: 같은 파이프라인에 더미 적 데이터를 넣고 결과 명령 목록을 에디터 하단에 표시한다.

## 6. 위험과 대응

| 위험 | 대응 |
|------|------|
| Pyodide 로딩/실행 지연 | 사전 로딩, 쿨타임, Worker 재사용 |
| 무한 루프 | 타임아웃 + Worker 강제 종료 |
| Phaser ↔ React 입력 포커스 충돌 | 에디터 포커스 중 게임 키 입력 비활성화 |
| Kenney 에셋 프레임 크기/스케일 불일치 | M0에서 아틀라스·타일 크기를 먼저 확정 |
| Tiled 맵 제작 시간 | 작은 맵 1개로 제한, 타일 레이어 2개(배경/충돌)만 사용 |
| 범위 증가 | 인벤토리·계정·영지 등 SRD §9 항목은 제외 |

## 7. 확정된 결정 사항

- **UI**: React 사용 (확정)
- **명칭**: SRD 내 이름도 programe(가제)로 변경 완료
- **몬스터 (3종)**
  | 몬스터 | 특징 | 학습 포인트 |
  |--------|------|-------------|
  | 슬라임 | HP 낮음, 느린 추적 | 첫 `if` 조건문 |
  | 날벌레(fly) | 빠름, 비행 | 속성(`enemy.type`) 분기 |
  | 골렘 | HP 높음, 느림, 얼음에 약함 | 약점 활용, 변수·비교 |
  (Kenney 에셋 중 가장 가까운 스프라이트로 대체. 프로토타입은 1종부터 시작)
- **스킬 (3종)**: `fireball`(MP 낮음, 불 속성), `icebolt`(중간, 얼음 속성), `heal`(회복, 자신에게 사용)
- **학생에게 열어 줄 API 범위 (프로토타입)**
  - 함수: `cast(name)`, `get_enemy_hp()`, `get_player_hp()`, `get_player_mp()`, `print(...)`(에디터 콘솔에 표시)
  - 객체: `enemy.hp`, `enemy.max_hp`, `enemy.type`, `enemy.distance`
  - 문법: 변수, `if/elif/else`, 비교·논리 연산, 간단한 `for`/`while`(실행 시간 제한 안에서)
  - 차단: `import`, 파일/네트워크, `os`/`sys`, `open`, `eval`/`exec`
  - 이후 확장 후보: 리스트(`get_enemies()`), 함수 정의, 반복문 학습용 스킬
- **배포**: 정적 호스팅도 지원. Vite `base: './'`로 설정해 두었고, 빌드 결과(`dist/`)를 GitHub Pages 등에 올릴 수 있다. 로컬 `npm run dev`는 그대로 유지. (Pyodide는 CDN 대신 로컬 번들 여부를 M5에서 결정)

## 8. 진행 상황 (2026-11-12 MVP 완료)

- [x] SRD 명칭 변경
- [x] M0 환경 세팅 (Pyodide·Monaco 모두 로컬 번들, CDN 불필요)
- [x] M1 플레이어: 이동·가변 점프(코요테/입력 버퍼)·기본 공격(베기 이펙트)·피격 무적·넉백·레벨업
- [x] M2 맵: 96x14 Tiled 호환 맵(npm run map), 7개 구역, 타일 이음새 제거(extrude), 시차 배경
- [x] M3 몬스터 3종: 슬라임(순찰/추격), 날벌레(비행), 블록 골렘(점프, 문지기) · 속성 배율 · 머리 위 type 표시
- [x] M4 우측 패널: Monaco(자동완성·호버 도움말·오류 밑줄), 슬롯 3개, 테스트 실행, 콘솔, 미션/도움말 탭
- [x] M5 파이썬 스킬: Web Worker 샌드박스, 0.5초 추적 제한 + 2초 강제 재시작, 한국어 오류 메시지
- [x] M6 HUD(HP/MP/XP/골드/미니맵/엔진 상태), 핫바(마지막 cast 아이콘, 실행 중/오류/MP 부족 표시)
- [x] M7 시작/사망/클리어 화면(별 3개 평가), 미션 7단계, 토스트, 효과음, GitHub Pages 워크플로, README
- 결정 변경: '박쥐'는 팩에 스프라이트가 없어 '날벌레(fly)'로, 골렘은 slime_block 스프라이트 사용

## 9. 다음 단계 후보

1. 실제 학생 플레이테스트로 난이도·문구 조정 (골렘 HP, MP 회복량 등은 src/game/data.ts)
2. Kenney UI Pack 적용 (현재 UI는 CSS로 제작)
3. 2번째 스테이지: 반복문(for)과 리스트(get_enemies())를 배우는 다수 적 구역
4. SRD §9 확장(계정, 교사 대시보드)을 위한 저장 계층 분리
