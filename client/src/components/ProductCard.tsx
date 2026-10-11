import { useState } from "react";
import { Link } from "wouter";
import { imageFor, useMoney, type ProductCard as Card } from "@/lib/shop";
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
    <span className={cx("inline-flex items-baseline gap-2", className)}>
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
      className="block rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.14)]"
      style={{ background: hex, width: size, height: size }}
    />
  );
  const ring = cx(
    "inline-flex rounded-full p-[3px] transition-shadow duration-200",
    selected ? "shadow-[0_0_0_1.5px_var(--color-ink)]" : "shadow-[0_0_0_1.5px_transparent]",
  );
  if (!onSelect) return <span className={ring}>{dot}</span>;
  return (
    <button
      type="button"
      aria-label={name}
      aria-pressed={selected}
      title={name}
      onClick={onSelect}
      onMouseEnter={onSelect}
      className={cx(ring, !selected && "hover:shadow-[0_0_0_1.5px_var(--color-line)]")}
    >
      {dot}
    </button>
  );
}

/** Tarjeta de producto del catálogo. Pasar el cursor por un color cambia la foto. */
export function ProductCard({ product, eager }: { product: Card; eager?: boolean }) {
  const [color, setColor] = useState(product.colors[0]?.name);
  const href = `/producto/${product.slug}${color && color !== product.colors[0]?.name ? `?color=${encodeURIComponent(color)}` : ""}`;
  const soldOut = product.stock <= 0;
  const urls = product.colors.length
    ? product.colors.map((c) => ({ key: c.name, url: imageFor(product.images, c.name) }))
    : [{ key: "", url: imageFor(product.images) }];
  const active = color ?? "";

  return (
    <article className="group relative">
      <Link href={href} className="block rounded-card" aria-label={product.name}>
        <div className="relative aspect-[4/5] overflow-hidden rounded-card bg-mist">
          {urls.map(
            (u) =>
              u.url && (
                <img
                  key={u.key}
                  src={u.url}
                  alt={u.key === active ? product.name : ""}
                  loading={eager ? "eager" : "lazy"}
                  decoding="async"
                  className={cx(
                    "absolute inset-0 size-full object-cover transition-[opacity,transform] duration-500 ease-apple group-hover:scale-[1.045]",
                    u.key === active ? "opacity-100" : "opacity-0",
                    soldOut && "grayscale-[0.4]",
                  )}
                />
              ),
          )}
          {(product.isNew || soldOut) && (
            <span
              className={cx(
                "absolute left-5 top-5 text-[13px] font-medium",
                soldOut ? "text-ink-2" : "text-[#b4530a]",
              )}
            >
              {soldOut ? "Agotado" : "Nuevo"}
            </span>
          )}
        </div>
      </Link>
      <div className="flex flex-col gap-2 px-1.5 pt-4 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[17px] font-semibold tracking-[-0.02em]">
            <Link href={href}>{product.name}</Link>
          </h3>
          <Price price={product.price} compareAt={product.compareAtPrice} className="mt-0.5 text-[15px] text-ink-2" />
        </div>
        {product.colors.length > 1 && (
          <div className="-ml-[3px] flex shrink-0 items-center gap-0.5 sm:ml-0 sm:pt-1">
            {product.colors.slice(0, 5).map((c) => (
              <Swatch key={c.name} hex={c.hex} name={c.name} selected={c.name === color} onSelect={() => setColor(c.name)} />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

export function ProductGrid({ products }: { products: Card[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-9 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} eager={i < 4} />
      ))}
    </div>
  );
}
