import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { AnimatePresence, motion } from "motion/react";
import { Moon, Search, Sun, X } from "lucide-react";
import { imageFor, useMoney, useShop } from "@/lib/shop";
import { cart, useCart } from "@/lib/cart";
import { toggleTheme, useTheme } from "@/lib/theme";
import { trpc } from "@/lib/trpc";
import { CartDrawer } from "./CartDrawer";
import { Spinner, cx } from "./ui";

const EASE = [0.28, 0.11, 0.32, 1] as const;

/** Logo de la tienda. Sin imagen, se muestra el nombre como logotipo en texto. */
export function Brand({ className, size = "md" }: { className?: string; size?: "md" | "sm" }) {
  const shop = useShop()!;
  const theme = useTheme();
  const { logoUrl, logoDarkUrl, storeName } = shop.settings;
  const src = theme === "dark" ? logoDarkUrl || logoUrl : logoUrl;
  return (
    <Link href="/" aria-label={`${storeName}, ir al inicio`} className={cx("inline-flex items-center", className)}>
      {src ? (
        <img
          src={src}
          alt={storeName}
          className={cx(
            "w-auto object-contain",
            size === "md" ? "h-6 max-w-[220px] sm:h-7" : "h-5 max-w-[180px]",
            theme === "dark" && !logoDarkUrl && "invert",
          )}
        />
      ) : (
        <span
          className={cx(
            "wordmark",
            size === "md" ? "text-[15px] tracking-[3.5px] sm:text-[22px] sm:tracking-[5.5px]" : "text-[15px] tracking-[3.5px]",
          )}
        >
          {storeName}
        </span>
      )}
    </Link>
  );
}

function useNavLinks() {
  const shop = useShop()!;
  return {
    main: [
      { label: "Novedades", href: "/tienda?nuevo=1" },
      { label: "Tienda", href: "/tienda" },
      ...shop.categories.slice(0, 2).map((c) => ({ label: c.name, href: `/categoria/${c.slug}` })),
    ],
    all: [
      { label: "Novedades", href: "/tienda?nuevo=1" },
      { label: "Toda la tienda", href: "/tienda" },
      ...shop.categories.map((c) => ({ label: c.name, href: `/categoria/${c.slug}` })),
    ],
    pages: shop.pages.filter((p) => p.showInNav).map((p) => ({ label: p.title, href: `/${p.slug}` })),
  };
}

/** Icono de tres líneas finas, como el de las tiendas de referencia. */
function Burger({ open }: { open: boolean }) {
  return (
    <span className="relative block h-[14px] w-[22px]" aria-hidden>
      <span
        className={cx(
          "absolute left-0 h-px w-full bg-current transition-transform duration-300",
          open ? "top-[7px] rotate-45" : "top-0",
        )}
      />
      <span className={cx("absolute left-0 top-[7px] h-px w-full bg-current transition-opacity", open && "opacity-0")} />
      <span
        className={cx(
          "absolute left-0 h-px w-full bg-current transition-transform duration-300",
          open ? "top-[7px] -rotate-45" : "top-[14px]",
        )}
      />
    </span>
  );
}

function BagIcon({ count }: { count: number }) {
  return (
    <span className="relative inline-flex" aria-hidden>
      <svg width="20" height="22" viewBox="0 0 20 22" fill="none" stroke="currentColor" strokeWidth="1.2">
        <path d="M2.6 6.5h14.8l-1 14H3.6l-1-14Z" />
        <path d="M6.5 6.5V5a3.5 3.5 0 0 1 7 0v1.5" />
      </svg>
      {count > 0 && (
        <span className="absolute inset-x-0 top-[9px] text-center text-[9px] font-medium leading-none tabular-nums">
          {count}
        </span>
      )}
    </span>
  );
}

function ThemeButton({ className }: { className?: string }) {
  const theme = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={dark ? "Modo claro" : "Modo oscuro"}
      className={cx("grid size-10 place-items-center transition-opacity hover:opacity-60", className)}
    >
      {dark ? <Sun className="size-[19px]" strokeWidth={1.2} /> : <Moon className="size-[18px]" strokeWidth={1.2} />}
    </button>
  );
}

function SearchSheet({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const [term, setTerm] = useState("");
  const money = useMoney();
  const [, navigate] = useLocation();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setTerm(text.trim()), 220);
    return () => clearTimeout(t);
  }, [text]);
  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const q = trpc.store.products.useQuery({ search: term, sort: "destacados" }, { enabled: term.length >= 2 });
  const results = (q.data?.items ?? []).slice(0, 4);

  return (
    <div className="fixed inset-0 z-[70]">
      <motion.div
        className="absolute inset-0 bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Buscar productos"
        className="absolute inset-x-0 top-0 border-b border-line bg-paper"
        initial={{ y: "-100%" }}
        animate={{ y: 0 }}
        exit={{ y: "-100%" }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <form
          className="edge flex h-[72px] items-center gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) {
              navigate(`/tienda?q=${encodeURIComponent(text.trim())}`);
              onClose();
            }
          }}
        >
          <Search className="size-[18px] shrink-0" strokeWidth={1.2} aria-hidden />
          <input
            ref={input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Buscar"
            aria-label="Buscar productos"
            className="h-full min-w-0 flex-1 bg-transparent text-[18px] placeholder:text-ink-3 focus:outline-none"
          />
          <button type="button" onClick={onClose} aria-label="Cerrar la búsqueda" className="grid size-10 place-items-center hover:opacity-60">
            <X className="size-5" strokeWidth={1.2} />
          </button>
        </form>
        {term.length >= 2 && (
          <div className="edge border-t border-line pb-8 pt-6">
            {q.isLoading ? (
              <div className="grid place-items-center py-10">
                <Spinner />
              </div>
            ) : results.length === 0 ? (
              <p className="py-6 text-[15px] text-ink-2">No encontramos nada con “{term}”.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-4">
                {results.map((p) => (
                  <li key={p.id}>
                    <Link href={`/producto/${p.slug}`} onClick={onClose} className="group block">
                      <span className="block aspect-[4/5] overflow-hidden bg-tile">
                        {imageFor(p.images, p.colors[0]?.name) && (
                          <img
                            src={imageFor(p.images, p.colors[0]?.name)}
                            alt=""
                            className="size-full object-cover transition-opacity group-hover:opacity-80"
                          />
                        )}
                      </span>
                      <span className="caps mt-3 block truncate">{p.name}</span>
                      <span className="mt-0.5 block text-[13px] text-ink-2 tabular-nums">{money(p.price)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function MenuDrawer({ onClose }: { onClose: () => void }) {
  const links = useNavLinks();
  const theme = useTheme();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60]">
      <motion.div
        className="absolute inset-0 bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden
      />
      <motion.nav
        role="dialog"
        aria-modal="true"
        aria-label="Menú"
        className="absolute inset-y-0 left-0 flex w-full max-w-[420px] flex-col overflow-y-auto border-r border-line bg-paper"
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        exit={{ x: "-100%" }}
        transition={{ duration: 0.45, ease: EASE }}
      >
        <div className="flex h-16 shrink-0 items-center border-b border-line px-5">
          <button type="button" onClick={onClose} aria-label="Cerrar el menú" className="-ml-1 grid size-10 place-items-center">
            <Burger open />
          </button>
        </div>
        <ul className="px-6 pt-8">
          {links.all.map((l) => (
            <li key={l.href}>
              <Link href={l.href} onClick={onClose} className="block py-2.5 text-[20px] tracking-[-0.01em] hover:opacity-60">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <ul className="mt-8 border-t border-line px-6 pt-6">
          {links.pages.map((l) => (
            <li key={l.href}>
              <Link href={l.href} onClick={onClose} className="caps block py-2 text-ink-2 hover:text-ink">
                {l.label}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/seguimiento" onClick={onClose} className="caps block py-2 text-ink-2 hover:text-ink">
              Seguir mi pedido
            </Link>
          </li>
        </ul>
        <div className="mt-auto border-t border-line px-6 py-5">
          <button type="button" onClick={toggleTheme} className="caps flex items-center gap-3 text-ink-2 hover:text-ink">
            {theme === "dark" ? <Sun className="size-4" strokeWidth={1.2} /> : <Moon className="size-4" strokeWidth={1.2} />}
            {theme === "dark" ? "Modo claro" : "Modo oscuro"}
          </button>
        </div>
      </motion.nav>
    </div>
  );
}

function Header() {
  const { count } = useCart();
  const links = useNavLinks();
  const [path] = useLocation();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);

  useEffect(() => setMenu(false), [path]);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-line bg-paper/95 backdrop-blur-md">
        <div className="edge grid h-16 grid-cols-[1fr_auto_1fr] items-center sm:h-[76px]">
          <div className="flex items-center gap-7">
            <button
              type="button"
              onClick={() => setMenu(true)}
              aria-label="Abrir el menú"
              className="-ml-2 grid size-10 place-items-center hover:opacity-60"
            >
              <Burger open={false} />
            </button>
            <ul className="hidden items-center gap-7 lg:flex">
              {links.main.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="caps transition-opacity hover:opacity-50">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <Brand />

          <div className="-mr-2 flex items-center justify-end">
            <button
              type="button"
              onClick={() => setSearch(true)}
              aria-label="Buscar"
              className="grid size-10 place-items-center hover:opacity-60"
            >
              <Search className="size-[19px]" strokeWidth={1.2} />
            </button>
            <ThemeButton className="hidden sm:grid" />
            <button
              type="button"
              onClick={() => cart.open()}
              aria-label={count > 0 ? `Abrir la bolsa, ${count} artículos` : "Abrir la bolsa"}
              className="grid size-10 place-items-center hover:opacity-60"
            >
              <BagIcon count={count} />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>{menu && <MenuDrawer onClose={() => setMenu(false)} />}</AnimatePresence>
      <AnimatePresence>{search && <SearchSheet onClose={() => setSearch(false)} />}</AnimatePresence>
    </>
  );
}

function Footer() {
  const shop = useShop()!;
  const s = shop.settings;
  const footerPages = shop.pages.filter((p) => p.showInFooter);
  const social = [
    { label: "Instagram", href: s.instagram },
    { label: "TikTok", href: s.tiktok },
    { label: "Facebook", href: s.facebook },
  ].filter((x) => x.href);
  const wa = s.whatsapp.replace(/\D/g, "");

  const linkClass = "text-[14px] text-ink-2 transition-colors hover:text-ink";
  const head = "caps text-ink";
  return (
    <footer className="mt-32 border-t border-line">
      <div className="edge grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-4">
        <nav aria-label="Tienda">
          <h2 className={head}>Tienda</h2>
          <ul className="mt-5 space-y-2.5">
            <li>
              <Link href="/tienda" className={linkClass}>
                Todos los productos
              </Link>
            </li>
            {shop.categories.map((c) => (
              <li key={c.id}>
                <Link href={`/categoria/${c.slug}`} className={linkClass}>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Ayuda">
          <h2 className={head}>Ayuda</h2>
          <ul className="mt-5 space-y-2.5">
            <li>
              <Link href="/seguimiento" className={linkClass}>
                Seguir mi pedido
              </Link>
            </li>
            {footerPages.map((p) => (
              <li key={p.slug}>
                <Link href={`/${p.slug}`} className={linkClass}>
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <h2 className={head}>Contacto</h2>
          <ul className="mt-5 space-y-2.5">
            {s.email && (
              <li>
                <a href={`mailto:${s.email}`} className={linkClass}>
                  {s.email}
                </a>
              </li>
            )}
            {wa && (
              <li>
                <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className={linkClass}>
                  WhatsApp
                </a>
              </li>
            )}
            {s.phone && <li className="text-[14px] text-ink-2">{s.phone}</li>}
            {s.address && <li className="text-[14px] text-ink-2">{s.address}</li>}
            {!s.email && !wa && !s.phone && (
              <li>
                <Link href="/contacto" className={linkClass}>
                  Escríbenos
                </Link>
              </li>
            )}
          </ul>
        </div>
        <div>
          <h2 className={head}>Síguenos</h2>
          <ul className="mt-5 space-y-2.5">
            {social.map((x) => (
              <li key={x.label}>
                <a href={x.href} target="_blank" rel="noreferrer" className={linkClass}>
                  {x.label}
                </a>
              </li>
            ))}
            {social.length === 0 && <li className="text-[14px] text-ink-3">Pronto</li>}
          </ul>
        </div>
      </div>
      <div className="edge flex flex-col items-center gap-6 border-t border-line py-10">
        <Brand />
        <p className="text-[12px] text-ink-3">
          © {new Date().getFullYear()} {s.storeName}
        </p>
      </div>
    </footer>
  );
}

export function StoreLayout({ children }: { children: ReactNode }) {
  const shop = useShop()!;
  const { announcement, announcementHref } = shop.settings;
  return (
    <div className="store flex min-h-dvh flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[90] focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        Saltar al contenido
      </a>
      {announcement && (
        <div className="bg-ink text-center text-paper">
          {announcementHref ? (
            <Link href={announcementHref} className="caps block px-4 py-2.5 !text-[11px]">
              {announcement}
            </Link>
          ) : (
            <p className="caps px-4 py-2.5 !text-[11px]">{announcement}</p>
          )}
        </div>
      )}
      <Header />
      <main id="contenido" className="flex-1">
        {children}
      </main>
      <Footer />
      <CartDrawer />
    </div>
  );
}
