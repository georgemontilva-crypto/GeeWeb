import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  CreditCard,
  ExternalLink,
  FileText,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Menu,
  Settings,
  Shirt,
  ShoppingBag,
  Star,
  Tags,
  TicketPercent,
  Truck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { IconButton, Spinner, cx, toastError } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { useShop } from "@/lib/shop";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin", label: "Inicio", icon: LayoutDashboard },
  { href: "/admin/pedidos", label: "Pedidos", icon: ShoppingBag },
  { href: "/admin/productos", label: "Productos", icon: Shirt },
  { href: "/admin/categorias", label: "Categorías", icon: Tags },
  { href: "/admin/destacados", label: "Destacados", icon: Star },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/envios", label: "Envíos", icon: Truck },
  { href: "/admin/pagos", label: "Pagos", icon: CreditCard },
  { href: "/admin/cupones", label: "Cupones", icon: TicketPercent },
  { href: "/admin/paginas", label: "Páginas", icon: FileText },
  { href: "/admin/portada", label: "Portada", icon: LayoutTemplate },
  { href: "/admin/ajustes", label: "Ajustes", icon: Settings },
];

const isActive = (path: string, href: string) => {
  const clean = path.replace(/\/+$/, "") || "/admin";
  return href === "/admin" ? clean === "/admin" : clean === href || clean.startsWith(`${href}/`);
};

const rowClass =
  "flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[15px] text-ink transition-colors hover:bg-mist";

function SidebarContent({ email, name }: { email: string; name: string }) {
  const [path] = useLocation();
  const shop = useShop();
  const utils = trpc.useUtils();
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
      return utils.auth.me.invalidate();
    },
    onError: toastError,
  });

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 pb-4 pt-6">
        <Link href="/admin" className="inline-block rounded-md text-[19px] font-semibold tracking-[-0.03em]">
          {shop?.settings.storeName ?? "Panel"}
        </Link>
      </div>

      <nav aria-label="Secciones del panel" className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <ul className="space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(path, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cx(rowClass, active && "bg-mist font-medium")}
                >
                  <Icon className={cx("size-[18px] shrink-0", active ? "text-ink" : "text-ink-2")} aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-mist-2 px-3 py-3">
        <div className="px-3 pb-2 pt-1">
          {name && <p className="truncate text-[14px] font-medium">{name}</p>}
          <p className="truncate text-[13px] text-ink-2" title={email}>
            {email}
          </p>
        </div>
        <a href="/" target="_blank" rel="noreferrer" className={rowClass}>
          <ExternalLink className="size-[18px] shrink-0 text-ink-2" aria-hidden />
          Ver tienda
        </a>
        <button type="button" className={rowClass} disabled={logout.isPending} onClick={() => logout.mutate()}>
          {logout.isPending ? (
            <Spinner className="size-[18px]!" />
          ) : (
            <LogOut className="size-[18px] shrink-0 text-ink-2" aria-hidden />
          )}
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

export default function Shell({ user, children }: { user: { email: string; name: string }; children: ReactNode }) {
  const [path] = useLocation();
  const shop = useShop();
  const [open, setOpen] = useState(false);

  // Cada pantalla empieza arriba y con el menú móvil cerrado.
  useEffect(() => {
    setOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [path]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="min-h-dvh bg-mist text-[15px]">
      {/* Barra lateral fija en pantallas grandes */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] border-r border-mist-2 bg-white lg:block">
        <SidebarContent email={user.email} name={user.name} />
      </aside>

      {/* Barra superior en móvil y tableta */}
      <header className="glass sticky top-0 z-40 flex h-14 items-center gap-1 border-b border-mist-2 px-2 lg:hidden">
        <IconButton label="Abrir menú" aria-expanded={open} aria-controls="admin-drawer" onClick={() => setOpen(true)}>
          <Menu className="size-5" aria-hidden />
        </IconButton>
        <Link href="/admin" className="rounded-md px-1 text-[17px] font-semibold tracking-[-0.03em]">
          {shop?.settings.storeName ?? "Panel"}
        </Link>
      </header>

      {/* Menú deslizante */}
      <div className={cx("fixed inset-0 z-50 lg:hidden", !open && "pointer-events-none")} inert={!open}>
        <div
          className={cx("absolute inset-0 bg-black/35 transition-opacity duration-300", open ? "opacity-100" : "opacity-0")}
          onClick={() => setOpen(false)}
          aria-hidden
        />
        <div
          id="admin-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Menú del panel"
          className={cx(
            "absolute inset-y-0 left-0 w-[min(288px,86vw)] bg-white shadow-sheet transition-transform duration-300 ease-apple",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <IconButton label="Cerrar menú" onClick={() => setOpen(false)} className="absolute right-2 top-4">
            <X className="size-5" aria-hidden />
          </IconButton>
          <SidebarContent email={user.email} name={user.name} />
        </div>
      </div>

      <main className="lg:pl-[248px]">
        <div className="mx-auto w-full max-w-[1180px] px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-10">{children}</div>
      </main>
    </div>
  );
}
