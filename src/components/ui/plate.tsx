const STARS = Array.from({ length: 12 }, (_, i) => {
  const a = (i * Math.PI) / 6;
  return [Number((12 + 9 * Math.cos(a)).toFixed(2)), Number((12 + 9 * Math.sin(a)).toFixed(2))];
});

// Romanian plate; electric cars get green characters and border.
export function Plate({ plateNumber, electric = false, big = false }: { plateNumber: string; electric?: boolean; big?: boolean }) {
  return (
    <span className={`plate${big ? " big" : ""}${electric ? " ev" : ""}`} title={electric ? "Mașină electrică" : undefined}>
      <span className="eu">
        <svg viewBox="0 0 24 24">
          {STARS.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.9" fill="#fde047" />)}
        </svg>
        RO
      </span>
      <span className="num">{plateNumber}</span>
    </span>
  );
}
