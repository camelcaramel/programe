import { describe, expect, it } from 'vitest';
import css from './style.css?raw';
import { COLOR, bare, hex, withAlpha } from './tokens';

// style.css 의 :root 토큰과 tokens.ts 의 COLOR 가 같은 값인지 (한쪽만 고치는 실수 방지)
const root = css.slice(css.indexOf(':root {'), css.indexOf('\n}', css.indexOf(':root {')));
const declared = new Map([...root.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim().toLowerCase()]));
const kebab = (name: string) => name.replace(/([a-z])([A-Z0-9])/g, '$1-$2').toLowerCase();

describe('색 토큰', () => {
  it.each(Object.entries(COLOR))('%s 는 style.css 와 같은 값', (name, value) => {
    expect(declared.get(kebab(name)), `--${kebab(name)}`).toBe(value);
  });

  it('변환 도우미', () => {
    expect(hex(COLOR.gold)).toBe(0xffc533);
    expect(bare(COLOR.gold)).toBe('ffc533');
    expect(withAlpha(COLOR.slateThumb, 0x88)).toBe('#55546b88');
  });
});
