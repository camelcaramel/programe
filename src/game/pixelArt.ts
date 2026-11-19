// 코드로 그린 16×16 픽셀 그림 (Kenney 팩에 없는 것). Phaser 텍스처와 React <img> 가 같은 그림을 쓴다.

export interface PixelArt {
  /** 글자 한 개 = 픽셀 한 개, '.' 은 빈칸 */
  rows: string[];
  colors: Record<string, number>;
}

/**
 * 출구 마법진: 빛나는 초록 동심원 (가운데가 가장 밝다). 십자 모양은 회복 아이템처럼 보여서 피했다.
 * (팩의 회색 돌 분수 그림은 회색 돌문과 헷갈려서 바꿨다)
 */
export const PORTAL: PixelArt = {
  rows: [
    '.....######.....',
    '...##gggggg##...',
    '..#gggggggggg#..',
    '.#ggddddddddgg#.',
    '.#gddwwwwwwddg#.',
    '#ggdwwddddwwdgg#',
    '#gddwddyyddwddg#',
    '#gddwdyyyydwddg#',
    '#gddwdyyyydwddg#',
    '#gddwddyyddwddg#',
    '#ggdwwddddwwdgg#',
    '.#gddwwwwwwddg#.',
    '.#ggddddddddgg#.',
    '..#gggggggggg#..',
    '...##gggggg##...',
    '.....######.....',
  ],
  colors: { '#': 0x353541, g: 0x7ee2a0, d: 0x2d5f5a, w: 0xb6f5cf, y: 0xfff3c4 },
};

const urls = new Map<PixelArt, string>();

/** React 화면용: 픽셀 그림을 PNG 데이터 주소로 (한 번 만들면 재사용) */
export function pixelArtUrl(art: PixelArt): string {
  const cached = urls.get(art);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = art.rows[0].length;
  c.height = art.rows.length;
  const g = c.getContext('2d');
  if (!g) return '';
  art.rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      g.fillStyle = '#' + art.colors[ch].toString(16).padStart(6, '0');
      g.fillRect(x, y, 1, 1);
    }),
  );
  const url = c.toDataURL();
  urls.set(art, url);
  return url;
}
