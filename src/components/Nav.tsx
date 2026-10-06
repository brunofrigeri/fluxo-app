"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

const ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/agenda", label: "Agenda", icon: "calendar" },
  { href: "/clientes", label: "Clientes", icon: "users" },
  { href: "/espera", label: "Lista de espera", icon: "clock" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="Principal">
      {ITEMS.map((item) => {
        const on = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} className={`nav-i${on ? " on" : ""}`} aria-current={on ? "page" : undefined} title={item.label}>
            <Icon name={item.icon} size={20} />
            <span className="lab">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
