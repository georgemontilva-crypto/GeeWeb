import { Link, useLocation, useParams, useSearch } from "wouter";
import { keepPreviousData } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { useShop } from "@/lib/shop";
import { ButtonLink, EmptyState, Select, Spinner, cx } from "@/components/ui";
import { ProductGrid } from "@/components/ProductCard";

const SORTS = [
  { value: "destacados", label: "Destacados" },
  { value: "nuevos", label: "Más recientes" },
  { value: "precio_asc", label: "Precio: menor a mayor" },
  { value: "precio_desc", label: "Precio: mayor a menor" },
  { value: "nombre", label: "Nombre" },
] as const;
type Sort = (typeof SORTS)[number]["value"];

export default function Shop() {
  const shop = useShop()!;
  const { slug } = useParams<{ slug?: string }>();
  const [path, navigate] = useLocation();
  const params = new URLSearchParams(useSearch());
  const search = params.get("q") ?? "";
  const onlyNew = params.get("nuevo") === "1";
  const sort = (SORTS.find((s) => s.value === params.get("orden"))?.value ?? "destacados") as Sort;

  const q = trpc.store.products.useQuery(
    { category: slug, search: search || undefined, sort, onlyNew: onlyNew || undefined },
    { placeholderData: keepPreviousData },
  );

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    navigate(qs ? `${path}?${qs}` : path, { replace: true });
  };

  const category = slug ? shop.categories.find((c) => c.slug === slug) : null;
  const title = search
    ? `“${search}”`
    : category
      ? category.name
      : onlyNew
        ? "Novedades"
        : "Toda la tienda";
  const subtitle = search
    ? "Resultados de tu búsqueda."
    : category
      ? category.description
      : onlyNew
        ? "Lo último que llegó."
        : shop.settings.tagline;

  const chip = (active: boolean) =>
    cx(
      "inline-flex h-10 shrink-0 items-center rounded-full px-[18px] text-[15px] transition-colors",
      active ? "bg-ink text-white" : "bg-mist text-ink hover:bg-mist-2",
    );
  const items = q.data?.items ?? [];

  return (
    <div className="wrap pt-[124px]">
      <header className="max-w-[900px]">
        <h1 className="display text-[clamp(2.8rem,8vw,6.5rem)]">{title}</h1>
        {subtitle && <p className="mt-4 max-w-[52ch] text-[19px] text-ink-2">{subtitle}</p>}
      </header>

      <div className="mt-10">
        <nav aria-label="Categorías" className="no-scrollbar -mx-4 flex min-w-0 gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Link href="/tienda" className={chip(!slug && !onlyNew && !search)}>
            Todo
          </Link>
          <Link href="/tienda?nuevo=1" className={chip(!slug && onlyNew)}>
            Novedades
          </Link>
          {shop.categories.map((c) => (
            <Link key={c.id} href={`/categoria/${c.slug}`} className={chip(slug === c.slug)}>
              {c.name}
            </Link>
          ))}
        </nav>
      </div>

      <div className={cx("mt-8 transition-opacity duration-200", q.isPlaceholderData && "opacity-50")}>
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
          <>
            <div className="mb-6 flex items-center justify-between gap-4">
              <p className="text-[15px] text-ink-2">
                {items.length} {items.length === 1 ? "producto" : "productos"}
              </p>
              <label className="flex items-center gap-3 text-[15px] text-ink-2">
                <span className="sr-only sm:not-sr-only">Ordenar</span>
                <Select
                  value={sort}
                  onChange={(e) => setParam("orden", e.target.value === "destacados" ? null : e.target.value)}
                  className="w-[220px] [&_select]:h-10 [&_select]:rounded-full [&_select]:border-transparent [&_select]:bg-mist [&_select]:text-[15px]"
                >
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
            <ProductGrid products={items} />
          </>
        )}
      </div>
    </div>
  );
}
