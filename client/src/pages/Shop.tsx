import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams, useSearch } from "wouter";
import { keepPreviousData } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { useShop } from "@/lib/shop";
import { ButtonLink, EmptyState, Spinner, cx } from "@/components/ui";
import { ProductGrid } from "@/components/ProductCard";

const SORTS = [
  { value: "destacados", label: "Recomendados" },
  { value: "nuevos", label: "Más recientes" },
  { value: "precio_asc", label: "Precio: menor a mayor" },
  { value: "precio_desc", label: "Precio: mayor a menor" },
  { value: "nombre", label: "Nombre" },
] as const;
type Sort = (typeof SORTS)[number]["value"];

/** Menú desplegable simple, cerrado por defecto. */
function Dropdown({
  label,
  open,
  setOpen,
  align = "left",
  children,
}: {
  label: React.ReactNode;
  open: boolean;
  setOpen: (v: boolean) => void;
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="text-[14px] hover:opacity-60">
        {label}
      </button>
      {open && (
        <div
          className={cx(
            "absolute top-[calc(100%+14px)] z-30 min-w-[230px] animate-[fade-in_0.15s_ease] border border-line bg-paper py-2",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export default function Shop() {
  const shop = useShop()!;
  const { slug } = useParams<{ slug?: string }>();
  const [path, navigate] = useLocation();
  const params = new URLSearchParams(useSearch());
  const search = params.get("q") ?? "";
  const onlyNew = params.get("nuevo") === "1";
  const sort = (SORTS.find((s) => s.value === params.get("orden"))?.value ?? "destacados") as Sort;
  const [catOpen, setCatOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  useEffect(() => setCatOpen(false), [path, search, onlyNew]);

  const q = trpc.store.products.useQuery(
    { category: slug, search: search || undefined, sort, onlyNew: onlyNew || undefined },
    { placeholderData: keepPreviousData },
  );

  const setSort = (value: Sort) => {
    const next = new URLSearchParams(params);
    if (value === "destacados") next.delete("orden");
    else next.set("orden", value);
    const qs = next.toString();
    navigate(qs ? `${path}?${qs}` : path, { replace: true });
    setSortOpen(false);
  };

  const category = slug ? shop.categories.find((c) => c.slug === slug) : null;
  const current = search ? `“${search}”` : category ? category.name : onlyNew ? "Novedades" : "Todo";
  const items = q.data?.items ?? [];
  const optionClass = (active: boolean) =>
    cx("block w-full px-4 py-2 text-left text-[14px] hover:bg-mist", active ? "text-ink" : "text-ink-2");

  return (
    <div>
      <div className="edge flex h-14 items-center justify-between gap-4 border-b border-line">
        <Dropdown
          open={catOpen}
          setOpen={setCatOpen}
          label={
            <span>
              Tienda <span className="mx-1 text-ink-3">•</span> {current} <span className="ml-0.5">{catOpen ? "−" : "+"}</span>
            </span>
          }
        >
          <Link href="/tienda" className={optionClass(!slug && !onlyNew && !search)}>
            Todo
          </Link>
          <Link href="/tienda?nuevo=1" className={optionClass(!slug && onlyNew)}>
            Novedades
          </Link>
          {shop.categories.map((c) => (
            <Link key={c.id} href={`/categoria/${c.slug}`} className={optionClass(slug === c.slug)}>
              {c.name}
            </Link>
          ))}
        </Dropdown>

        <div className="flex items-center gap-6">
          <span className="hidden text-[14px] text-ink-3 sm:inline">
            {items.length} {items.length === 1 ? "producto" : "productos"}
          </span>
          <Dropdown
            open={sortOpen}
            setOpen={setSortOpen}
            align="right"
            label={
              <span>
                <span className="hidden sm:inline">Ordenar: </span>
                {SORTS.find((s) => s.value === sort)?.label}
              </span>
            }
          >
            {SORTS.map((s) => (
              <button key={s.value} type="button" onClick={() => setSort(s.value)} className={optionClass(s.value === sort)}>
                {s.label}
              </button>
            ))}
          </Dropdown>
        </div>
      </div>

      {category?.description && !search && (
        <p className="edge pt-6 text-[14px] text-ink-2">{category.description}</p>
      )}

      <div className={cx("edge pt-6 transition-opacity duration-200", q.isPlaceholderData && "opacity-50")}>
        {q.isLoading ? (
          <div className="grid place-items-center py-32">
            <Spinner />
          </div>
        ) : slug && !q.data?.category ? (
          <EmptyState title="Esa categoría no existe" text="Puede que haya cambiado de nombre. Mira todo lo que hay en la tienda.">
            <ButtonLink href="/tienda">Ver toda la tienda</ButtonLink>
          </EmptyState>
        ) : items.length === 0 ? (
          <EmptyState
            title={search ? `No encontramos nada con “${search}”` : "Todavía no hay productos aquí"}
            text={search ? "Revisa la ortografía o busca con una palabra más corta." : "Vuelve pronto: estamos preparando lo nuevo."}
          >
            <ButtonLink href="/tienda">Ver toda la tienda</ButtonLink>
          </EmptyState>
        ) : (
          <ProductGrid products={items} />
        )}
      </div>
    </div>
  );
}
