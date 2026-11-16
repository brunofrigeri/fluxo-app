import { redirect } from "next/navigation";
import { Logo } from "@fluxo/ui-web";
import { Nav } from "@/components/Nav";
import { UserMenu } from "@/components/UserMenu";
import { getAdmin } from "@/lib/admin";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  if (!admin) redirect("/login");

  return (
    <div className="fx" data-theme="light">
      <div className="shell">
        <aside className="side">
          <Logo />
          <Nav isAdmin={admin.role === "admin"} />
          <UserMenu name={admin.name} email={admin.email} initials={admin.initials} role={admin.role} />
        </aside>
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
