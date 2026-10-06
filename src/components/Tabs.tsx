import Link from "next/link";

/** The design's tab bar, drawn as links. */
export function Tabs({ items }: { items: { href: string; label: string; on: boolean }[] }) {
  return (
    <div className="tabs" role="tablist" style={{ margin: "24px 0" }}>
      {items.map((item) => (
        <Link key={item.label} href={item.href} role="tab" aria-selected={item.on} className={`tabi${item.on ? " on" : ""}`}>
          {item.label}
        </Link>
      ))}
    </div>
  );
}
