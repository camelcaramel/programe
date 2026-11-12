// Tiled 호환 맵(JSON) 생성 스크립트: npm run map
// 생성된 public/maps/dungeon.json 은 Tiled 에서 그대로 열어 수정할 수 있다.
//
// 구역 구성 (왼쪽 → 오른쪽)
//  [시작 마을] → [슬라임 들판] → [언덕] → [날벌레 숲(공중 발판)] → [계단 고원] → [골렘 투기장] → [문] → [깃발]
import fs from 'node:fs';

const XML = 'public/assets/kenney/platformer/Spritesheets/spritesheet-tiles-default.xml';
const W = 96, H = 14, TILE = 64, SPACING = 1, COLS = 18;

// 아틀라스 XML 에서 타일 이름 -> gid 계산 (타일 64px + 간격 1px 격자)
const gid = {};
for (const m of fs.readFileSync(XML, 'utf8').matchAll(/name="([^"]+)" x="(\d+)" y="(\d+)"/g)) {
  gid[m[1]] = (Number(m[3]) / 65) * COLS + Number(m[2]) / 65 + 1;
}
const G = (n) => {
  if (!gid[n]) throw new Error('unknown tile ' + n);
  return gid[n];
};

// ---- 지형: 열별 지면 높이(윗면 행 번호) ----
const top = Array(W).fill(12);
const set = (a, b, v) => { for (let x = a; x <= b; x++) top[x] = v; };
set(0, 1, 1);                       // 왼쪽 끝 벽
set(24, 26, 11); set(27, 30, 9); set(31, 33, 11); // 언덕
set(52, 53, 11); set(54, 55, 10); set(56, 63, 9); set(64, 65, 10); set(66, 67, 11); // 계단 고원
set(94, 95, 1);                     // 오른쪽 끝 벽

const ground = Array(W * H).fill(0);
const decor = Array(W * H).fill(0);
const put = (layer, x, y, t) => { layer[y * W + x] = t; };

for (let x = 0; x < W; x++) {
  put(ground, x, top[x], G('terrain_grass_block_top'));
  for (let y = top[x] + 1; y < H; y++) put(ground, x, y, G('terrain_grass_block_center'));
}

// 떠 있는 발판
const platforms = [];
const platform = (x0, x1, row) => {
  platforms.push({ x0, x1, row });
  for (let x = x0; x <= x1; x++) {
    const n = x === x0 ? 'terrain_grass_horizontal_left' : x === x1 ? 'terrain_grass_horizontal_right' : 'terrain_grass_horizontal_middle';
    put(ground, x, row, G(n));
  }
};
platform(8, 11, 9);
platform(37, 40, 9);
platform(43, 46, 7);
platform(48, 50, 9);
platform(84, 86, 9);

// 장식 (충돌 없음)
const deco = (x, name, rowOffset = 1) => put(decor, x, top[x] - rowOffset, G(name));
deco(4, 'sign');
deco(6, 'bush'); deco(13, 'grass'); deco(17, 'mushroom_red'); deco(22, 'grass');
deco(28, 'bush'); deco(35, 'grass'); deco(42, 'mushroom_brown'); deco(51, 'grass');
deco(58, 'bush'); deco(62, 'grass');
deco(70, 'torch_on_a'); deco(82, 'torch_on_a');
deco(77, 'sign');
deco(89, 'grass'); deco(92, 'bush');

// ---- 오브젝트 ----
const px = (c) => c * TILE;
let nextId = 1;
const obj = (name, type, col, row, props = {}) => ({
  id: nextId++, name, type,
  x: px(col) + TILE / 2, y: px(row + 1), // 바닥 중앙 기준
  width: 0, height: 0, point: true, rotation: 0, visible: true,
  properties: Object.entries(props).map(([k, v]) => ({ name: k, type: typeof v === 'number' ? 'int' : 'string', value: v })),
});
const onGround = (name, type, col, props) => obj(name, type, col, top[col] - 1, props);
const monster = (col, kind) => onGround(kind, 'monster', col, { kind });
const flyer = (col, row) => obj('fly', 'monster', col, row, { kind: 'fly' });
const coin = (col, row) => obj('coin', 'coin', col, row);

const objects = [
  onGround('player', 'player', 3),
  // 슬라임 들판
  monster(16, 'slime'), monster(21, 'slime'), monster(29, 'slime'),
  // 날벌레 숲
  flyer(39, 6), flyer(45, 4), flyer(50, 6),
  // 고원
  monster(60, 'slime'),
  // 골렘 투기장
  monster(80, 'golem'),
  // 문 (골렘을 쓰러뜨리면 열림)
  onGround('gate', 'gate', 88),
  // 목표 깃발
  onGround('goal', 'goal', 92),
  // 보상
  coin(9, 8), coin(10, 8), coin(28, 8), coin(29, 8),
  coin(38, 8), coin(44, 6), coin(45, 6), coin(49, 8),
  coin(58, 8), coin(59, 8), coin(85, 8),
  obj('heart', 'heart', 61, top[61] - 1),
  obj('heart', 'heart', 72, top[72] - 1),
];

const layerBase = { opacity: 1, visible: true, x: 0, y: 0 };
const map = {
  compressionlevel: -1, type: 'map', version: '1.10', tiledversion: '1.10.2',
  orientation: 'orthogonal', renderorder: 'right-down', infinite: false,
  width: W, height: H, tilewidth: TILE, tileheight: TILE, nextlayerid: 4, nextobjectid: nextId,
  tilesets: [{
    firstgid: 1, name: 'tiles', image: '../assets/kenney/platformer/Spritesheets/spritesheet-tiles-default.png',
    imagewidth: 1169, imageheight: 1169, tilewidth: TILE, tileheight: TILE, spacing: SPACING, margin: 0,
    columns: COLS, tilecount: COLS * COLS,
  }],
  layers: [
    { ...layerBase, id: 1, name: 'decor', type: 'tilelayer', width: W, height: H, data: decor },
    { ...layerBase, id: 2, name: 'ground', type: 'tilelayer', width: W, height: H, data: ground,
      properties: [{ name: 'collides', type: 'bool', value: true }] },
    { ...layerBase, id: 3, name: 'spawns', type: 'objectgroup', draworder: 'topdown', objects },
  ],
};
fs.mkdirSync('public/maps', { recursive: true });
fs.writeFileSync('public/maps/dungeon.json', JSON.stringify(map));
console.log('wrote public/maps/dungeon.json', W + 'x' + H, objects.length, 'objects');
