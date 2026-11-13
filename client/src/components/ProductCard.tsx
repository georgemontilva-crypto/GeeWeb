import { Link } from "wouter";
import { useMoney, type ProductCard as Card } from "@/lib/shop";
import { cx } from "./ui";

export function Price({
  price,
  compareAt,
  className,
}: {
  price: number;
  compareAt?: number | null;
  className?: string;
}) {
  const money = useMoney();
  return (
    <span className={cx("inline-flex items-baseline gap-2 tabular-nums", className)}>
      <span>{money(price)}</span>
      {compareAt && compareAt > price ? (
        <span className="text-ink-3 line-through decoration-1">
          <span className="sr-only">Antes </span>
          {money(compareAt)}
        </span>
      ) : null}
    </span>
  );
}

/** Muestra de color cuadrada. */
export function Swatch({
  hex,
  name,
  selected,
  size = 14,
  onSelect,
}: {
  hex: string;
  name: string;
  selected?: boolean;
  size?: number;
  onSelect?: () => void;
}) {
  const dot = (
    <span
      className="block shadow-[inset_0_0_0_1px_rgba(128,128,128,0.35)]"
      style={{ background: hex, width: size, height: size }}
    />
  );
  const ring = cx(
    "inline-flex p-[3px] transition-shadow duration-200",
    selected ? "shadow-[0_0_0_1px_var(--c-ink)]" : "shadow-[0_0_0_1px_transparent]",
  );
  if (!onSelect) return <span className={ring}>{dot}</span>;
  return (
    <button
      type="button"
      aria-label={name}
      aria-pressed={selected}
      title={name}
      onClick={onSelect}
      className={cx(ring, !selected && "hover:shadow-[0_0_0_1px_var(--c-line)]")}
    >
      {dot}
    </button>
  );
}

/** Tarjeta del catálogo: foto completa y, al pasar el cursor, la segunda foto. */
export function ProductCard({ product, eager }: { product: Card; eager?: boolean }) {
  const first = product.colors[0]?.name;
  const own = product.images.filter((i) => !first || i.color === first || i.color === "");
  const list = own.length ? own : product.images;
  const main = list[0]?.url;
  const alt = list[1]?.url;
  const soldOut = product.stock <= 0;

  return (
    <article className="group relative">
      <Link href={`/producto/${product.slug}`} className="block" aria-label={product.name}>
        <div className="relative aspect-[4/5] overflow-hidden bg-tile">
          {main && (
            <img
              src={main}
              alt={product.name}
              loading={eager ? "eager" : "lazy"}
              decoding="async"
              className={cx(
                "absolute inset-0 size-full object-cover transition-opacity duration-500",
                alt && "group-hover:opacity-0",
                soldOut && "opacity-60",
              )}
            />
          )}
          {alt && (
            <img
              src={alt}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
            />
          )}
          {(product.isNew || soldOut) && (
            <span className="caps absolute left-3 top-3 !text-[10px] sm:left-4 sm:top-4">
              {soldOut ? "Agotado" : "Nuevo"}
            </span>
          )}
        </div>
        <div className="flex items-start justify-between gap-3 pt-3">
          <h3 className="caps min-w-0 !text-[11px] sm:!text-[12px]">{product.name}</h3>
          <Price price={product.price} compareAt={product.compareAtPrice} className="shrink-0 text-[12px] sm:text-[13px]" />
        </div>
        {product.colors.length > 1 && (
          <p className="mt-1 text-[12px] text-ink-3">{product.colors.length} colores</p>
        )}
      </Link>
    </article>
  );
}

export function ProductGrid({ products }: { products: Card[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-2 gap-y-10 sm:gap-x-3 lg:grid-cols-4">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} eager={i < 4} />
      ))}
    </div>
  );
}
