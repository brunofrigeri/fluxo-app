import Link from "next/link";
import { Icon } from "./Icon";

export function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="t-small muted row" style={{ gap: 6, marginBottom: 14, flexWrap: "wrap" }} aria-label="Você está em">
      {items.map((item, i) => (
        <span key={item.label} className="row" style={{ gap: 6 }}>
          {i > 0 && <Icon name="chevr" size={14} />}
          {item.href ? <Link href={item.href}>{item.label}</Link> : <span style={{ color: "var(--ink)", fontWeight: 600 }}>{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}
