export function ViewIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    dispersion: "M4 19V5m0 14h16M8 14h.01M11 10h.01M14 13h.01M17 7h.01",
    overhead:
      "M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2 2m8.8 8.8 2 2M5.6 18.4l2-2m8.8-8.8 2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    distance: "M4 7h16v10H4zM8 7v4m4-4v6m4-6v4",
    trends: "M4 19V5m0 14h16M7 14l4-5 4 3 5-7",
    rankings:
      "M9 4h6v6a3 3 0 0 1-6 0zM9 6H5v2a4 4 0 0 0 4 4m6-6h4v2a4 4 0 0 1-4 4m-3 1v6m-4 1h8",
  };
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.dispersion} />
    </svg>
  );
}
