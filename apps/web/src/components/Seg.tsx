import Link from "next/link";

/** The design's segmented control, drawn as links so the choice lives in the URL. */
export function Seg({ label, items, style }: { label: string; items: { href: string; label: string; on: boolean }[]; style?: React.CSSProperties }) {
  return (
    <div className="seg" role="group" aria-label={label} style={style}>
      {items.map((item) => (
        <Link key={item.label} href={item.href} className={item.on ? "on" : ""} aria-current={item.on ? "true" : undefined}>
          {item.label}
        </Link>
      ))}
    </div>
  );
}
