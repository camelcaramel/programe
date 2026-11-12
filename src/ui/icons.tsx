// Kenney 스프라이트와 같은 굵은 외곽선(#353541) 스타일의 작은 SVG 아이콘
const INK = '#353541';

export function SwordIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden>
      <g transform="rotate(45 24 24)" stroke={INK} strokeWidth="2.6" strokeLinejoin="round">
        <path d="M20.5 30V9L24 3.5 27.5 9v21z" fill="#eef4f9" />
        <path d="M24 8v20" stroke="#b8c7d6" strokeWidth="1.6" strokeLinecap="round" />
        <rect x="14.5" y="29" width="19" height="5.5" rx="2.75" fill="#ffc533" />
        <rect x="21.3" y="34.5" width="5.4" height="7.5" rx="1.6" fill="#a3582c" />
        <circle cx="24" cy="44.2" r="2.9" fill="#ffc533" />
      </g>
    </svg>
  );
}

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
