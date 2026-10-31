/** Decorative iron with the shaft entering the heel rather than the face. */
export function GolfIron({ className }: { className: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 140"
      fill="none"
      aria-hidden="true"
    >
      <path d="M73 16L49 109" stroke="#78916b" strokeWidth="2.5" />
      <path
        d="M75 8L67 39"
        stroke="#52734d"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M72 15L75 16M70 23L73 24M68 31L71 32"
        stroke="#a4b59a"
        strokeWidth="1"
      />
      <path
        d="M47 104L52 105L50 116Q49 124 42 125H19Q12 125 11 118L10 111Q9 101 17 101Q22 101 27 104L44 112Z"
        fill="#e8eddf"
        stroke="#78916b"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M16 110L38 116M16 115L39 120M18 120L30 122"
        stroke="#91a583"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
