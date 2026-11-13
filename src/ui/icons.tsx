// Kenney 스프라이트와 같은 굵은 외곽선(#353541) 스타일의 작은 SVG 아이콘
const INK = '#353541';

/** 마법서(코드) 아이콘 */
export function BookIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden>
      <g stroke={INK} strokeWidth="2.8" strokeLinejoin="round">
        <path d="M9 39V10a4 4 0 0 1 4-4h26v31H13a4 4 0 0 0-4 4z" fill="#7b5cd6" />
        <path d="M9 41a4 4 0 0 1 4-4h26v7H13a4 4 0 0 1-4-3z" fill="#fff8ea" />
        <path d="M14 6v31" stroke="#5b3fb3" strokeWidth="2" />
      </g>
      <path d="M23 15l-5 5.5 5 5.5M30 15l5 5.5-5 5.5" fill="none" stroke="#ffc533" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 별 (on: 금색, off: 회색) */
export function StarIcon({ on, className }: { on: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={`star-icon ${on ? 'on' : 'off'} ${className ?? ''}`}>
      <path
        d="M24 4.5l5.9 12 13.2 1.9-9.6 9.3 2.3 13.1L24 34.6l-11.8 6.2 2.3-13.1-9.6-9.3 13.2-1.9z"
        fill={on ? '#ffc533' : '#8d8aa6'}
        stroke={INK}
        strokeWidth="3.4"
        strokeLinejoin="round"
      />
      <path d="M17 18.5l4.2-.6 2.3-4.7" fill="none" stroke="#fff" strokeOpacity={on ? 0.75 : 0.35} strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

/** 하트 (HP) */
export function HeartIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={`heart-icon ${on ? 'on' : 'off'}`}>
      <path
        d="M24 41S6 30.5 6 17.5A9.5 9.5 0 0 1 24 13a9.5 9.5 0 0 1 18 4.5C42 30.5 24 41 24 41z"
        fill={on ? '#e54341' : '#55546b'}
        stroke={INK}
        strokeWidth="3.4"
        strokeLinejoin="round"
      />
      <path d="M13 17a4 4 0 0 1 4-4" fill="none" stroke="#fff" strokeOpacity={on ? 0.7 : 0.3} strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

/** 자물쇠 */
export function LockIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden>
      <g stroke={INK} strokeWidth="3.2" strokeLinejoin="round">
        <path d="M15 21v-6a9 9 0 0 1 18 0v6" fill="none" />
        <rect x="9" y="21" width="30" height="21" rx="5" fill="#ffc533" />
      </g>
      <circle cx="24" cy="31" r="3" fill={INK} />
    </svg>
  );
}
