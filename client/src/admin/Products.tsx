import { useMemo, useState } from "react";
import { Link } from "wouter";
import { keepPreviousData } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { Button, ButtonLink, EmptyState, Select, cx, toastError } from "@/components/ui";
import { trpc, type Out } from "@/lib/trpc";
import { useMoney } from "@/lib/shop";
import { LoadError, Loading, PageHeader, SearchInput, SwitchChip, Thumb, useDebounced } from "./common";

type Product = Out["admin"]["products"]["list"][number];
type Flag = "isActive" | "isFeatured" | "isNew";

const FLAGS: { field: Flag; label: string }[] = [
  { field: "isActive", label: "Activo" },
  { field: "isFeatured", label: "Destacado" },
  { field: "isNew", label: "Nuevo" },
];

export default function Products() {
  const utils = trpc.useUtils();
  const money = useMoney();
  const [text, setText] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const search = useDebounced(text.trim(), 350);

  const input = { search: search || undefined, categoryId: categoryId ?? undefined };
  const q = trpc.admin.products.list.useQuery(input, { placeholderData: keepPreviousData });
  const cats = trpc.admin.categories.list.useQuery();
  const catName = useMemo(() => new Map((cats.data ?? []).map((c) => [c.id, c.name])), [cats.data]);

  const toggle = trpc.admin.products.toggle.useMutation({
    // El interruptor responde al instante; si el servidor falla, se recarga la lista.
    onMutate: ({ id, field, value }) => {
      utils.admin.products.list.setData(input, (list) => list?.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
    },
    onError: toastError,
    onSettled: () => utils.admin.products.list.invalidate(),
  });

  const filtering = Boolean(search || categoryId);

  return (
    <>
      <PageHeader
        title="Productos"
        actions={
          <ButtonLink href="/admin/productos/nuevo">
            <Plus className="size-4" aria-hidden />
            Nuevo producto
          </ButtonLink>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <SearchInput
          className="min-w-[220px] flex-1 sm:max-w-[420px]"
          label="Buscar productos"
          placeholder="Buscar por nombre"
          value={text}
          onChange={setText}
        />
        <Select
          aria-label="Filtrar por categoría"
          className="min-w-[200px] flex-1 sm:max-w-[260px]"
          value={categoryId ?? ""}
          onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Todas las categorías</option>
          {(cats.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <LoadError error={q.error} retry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <div className="rounded-[24px] bg-white">
          {filtering ? (
            <EmptyState title="Ningún producto coincide" text="Prueba con otro nombre o cambia la categoría.">
              <Button
                variant="secondary"
                onClick={() => {
                  setText("");
                  setCategoryId(null);
                }}
              >
                Quitar filtros
              </Button>
            </EmptyState>
          ) : (
            <EmptyState
              title="Aún no hay productos"
              text="Crea el primero con sus fotos, colores, tallas e inventario. Podrás dejarlo oculto hasta que esté listo."
            >
              <ButtonLink href="/admin/productos/nuevo">Nuevo producto</ButtonLink>
            </EmptyState>
          )}
        </div>
      ) : (
        <div className={cx("rounded-[24px] bg-white px-5 py-2 transition-opacity sm:px-6", q.isPlaceholderData && "opacity-60")}>
          <ul>
            {q.data.map((p) => (
              <ProductRow
                key={p.id}
                product={p}
                category={p.categoryId ? catName.get(p.categoryId) : undefined}
                price={money(p.price)}
                onToggle={(field, value) => toggle.mutate({ id: p.id, field, value })}
              />
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function ProductRow({
  product: p,
  category,
  price,
  onToggle,
}: {
  product: Product;
  category?: string;
  price: string;
  onToggle: (field: Flag, value: boolean) => void;
}) {
  const href = `/admin/productos/${p.id}`;
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-mist-2 py-4 first:border-t-0 lg:flex-nowrap">
      <Link href={href} className="group flex min-w-0 flex-1 basis-full items-center gap-4 rounded-xl sm:basis-64">
        <Thumb src={p.images[0]?.url} className="h-[60px] w-12" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium group-hover:underline group-hover:underline-offset-4">{p.name}</span>
          <span className="block truncate text-[14px] text-ink-2">{category ?? "Sin categoría"}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[15px] font-medium tabular-nums">{price}</span>
          <span className={cx("block text-[14px] tabular-nums", p.stock === 0 ? "text-bad" : "text-ink-2")}>
            {p.stock === 0 ? "Agotado" : p.stock === 1 ? "1 unidad" : `${p.stock} unidades`}
          </span>
        </span>
      </Link>
      <div className="flex flex-1 flex-wrap items-center gap-1.5 lg:flex-none">
        {FLAGS.map((f) => (
          <SwitchChip key={f.field} label={f.label} checked={p[f.field]} onChange={(v) => onToggle(f.field, v)} />
        ))}
      </div>
      <ButtonLink href={href} variant="secondary" size="sm" className="max-lg:hidden">
        <Pencil className="size-3.5" aria-hidden />
        Editar
      </ButtonLink>
    </li>
  );
}
