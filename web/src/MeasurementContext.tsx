import type { Shot } from "./data";

export function MeasurementContext({ shot: s }: { shot: Shot }) {
  return (
    <dl className="context">
      {[
        ["Intent", s.intent],
        ["Normalization", s.normalization],
        ["Settings", s.normalization_settings],
        ["Ball compensation", s.compensation],
        ["Carry basis", s.carry_basis],
        ["Total basis", s.total_basis],
        ["Mode", s.session_mode],
        ["Ball", s.ball_type],
        ["Surface", s.surface],
      ].map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
