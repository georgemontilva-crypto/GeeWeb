import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Plus } from "lucide-react";
import { Button, ButtonLink, EmptyState, Modal, toast, toastError } from "@/components/ui";
import { trpc, type Out } from "@/lib/trpc";
import { useMoney } from "@/lib/shop";
import { LoadError, Loading, PageHeader, Reorder, Row, SearchInput, Tag, Thumb, move } from "./common";

type Product = Out["admin"]["products"]["list"][number];

export default function Featured() {
  const utils = trpc.useUtils();
  const money = useMoney();
  const q = trpc.admin.products.list.useQuery();
  // La lista del panel no trae el orden de destacados. La portada sí devuelve
  // los destacados activos ya ordenados, así que se usa como punto de partida.
  const home = trpc.store.home.useQuery(undefined, { staleTime: 0 });
  const [order, setOrder] = useState<number[] | null>(null);
  const [adding, setAdding] = useState(false);

  const products = q.data;
  const featured = useMemo(() => {
    const list = (products ?? []).filter((p) => p.isFeatured);
    const base = order ?? (home.data?.featured ?? []).map((p) => p.id);
    const pos = new Map(base.map((id, i) => [id, i]));
    // Los que no están en el orden conocido van al final, como hace la tienda.
    return list
      .map((p, i) => ({ p, at: pos.get(p.id) ?? base.length + i }))
      .sort((a, b) => a.at - b.at)
      .map((x) => x.p);
  }, [products, order, home.data]);

  const refresh = () => {
    void utils.admin.products.list.invalidate();
    void utils.store.home.invalidate();
  };

  const reorder = trpc.admin.products.reorderFeatured.useMutation({ onError: toastError, onSettled: refresh });
  const toggle = trpc.admin.products.toggle.useMutation({ onError: toastError, onSettled: refresh });

  const onMove = (index: number, dir: -1 | 1) => {
    const ids = move(featured, index, dir).map((p) => p.id);
    setOrder(ids);
    reorder.mutate({ ids });
  };

  const removeOne = (p: Product) => {
    setOrder(featured.filter((x) => x.id !== p.id).map((x) => x.id));
    utils.admin.products.list.setData(undefined, (list) => list?.map((x) => (x.id === p.id ? { ...x, isFeatured: false } : x)));
    toggle.mutate({ id: p.id, field: "isFeatured", value: false }, { onSuccess: () => toast(`${p.name} ya no está en destacados`) });
  };

  const addOne = (p: Product) => {
    // El servidor lo deja al final; aquí se refleja igual.
    setOrder([...featured.map((x) => x.id), p.id]);
    utils.admin.products.list.setData(undefined, (list) => list?.map((x) => (x.id === p.id ? { ...x, isFeatured: true } : x)));
    toggle.mutate({ id: p.id, field: "isFeatured", value: true }, { onSuccess: () => toast(`${p.name} agregado a destacados`) });
  };

  const addButton = (
    <Button onClick={() => setAdding(true)}>
      <Plus className="size-4" aria-hidden />
      Agregar producto
    </Button>
  );

  const loading = q.isPending || (home.isPending && order === null);

  return (
    <>
      <PageHeader
        title="Destacados"
        description="Estos productos salen en la portada, en este orden."
        actions={!loading && featured.length > 0 ? addButton : undefined}
      />

      {loading ? (
        <Loading />
      ) : q.isError ? (
        <LoadError error={q.error} retry={() => q.refetch()} />
      ) : featured.length === 0 ? (
        <div className="rounded-[24px] bg-white">
          <EmptyState
            title="Aún no hay productos destacados"
            text="Elige los productos que quieres mostrar primero en la portada de la tienda."
          >
            {(products ?? []).length > 0 ? addButton : <ButtonLink href="/admin/productos/nuevo">Nuevo producto</ButtonLink>}
          </EmptyState>
        </div>
      ) : (
        <div className="rounded-[24px] bg-white p-5 sm:p-6">
          <ol>
            {featured.map((p, i) => (
              <Row key={p.id}>
                <Link href={`/admin/productos/${p.id}`} className="group flex min-w-0 flex-1 basis-56 items-center gap-4 rounded-xl">
                  <Thumb src={p.images[0]?.url} className="h-[60px] w-12" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium group-hover:underline group-hover:underline-offset-4">{p.name}</span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-ink-2">
                      {money(p.price)}
                      {!p.isActive && <Tag>Oculto en la tienda</Tag>}
                    </span>
                  </span>
                </Link>
                <div className="flex items-center gap-1">
                  <Reorder index={i} count={featured.length} label={p.name} onMove={(dir) => onMove(i, dir)} />
                  <Button variant="secondary" size="sm" onClick={() => removeOne(p)}>
                    Quitar
                  </Button>
                </div>
              </Row>
            ))}
          </ol>
        </div>
      )}

      {adding && (
        <AddModal products={(products ?? []).filter((p) => p.isActive && !p.isFeatured)} onPick={addOne} onClose={() => setAdding(false)} />
      )}
    </>
  );
}

function AddModal({ products, onPick, onClose }: { products: Product[]; onPick: (p: Product) => void; onClose: () => void }) {
  const money = useMoney();
  const [text, setText] = useState("");
  const needle = text.trim().toLowerCase();
  const shown = needle ? products.filter((p) => p.name.toLowerCase().includes(needle)) : products;

  return (
    <Modal open onClose={onClose} title="Agregar producto" footer={<Button onClick={onClose}>Listo</Button>}>
      {products.length === 0 ? (
        <p className="py-6 text-center text-[15px] text-ink-2">
          Todos tus productos activos ya están en destacados.
        </p>
      ) : (
        <>
          <SearchInput label="Buscar productos" placeholder="Buscar por nombre" value={text} onChange={setText} />
          {shown.length === 0 ? (
            <p className="py-8 text-center text-[15px] text-ink-2">Ningún producto coincide con “{text.trim()}”.</p>
          ) : (
            <ul className="mt-3">
              {shown.map((p) => (
                <li key={p.id} className="border-t border-mist-2 first:border-t-0">
                  <button
                    type="button"
                    onClick={() => onPick(p)}
                    className="group -mx-2 flex w-[calc(100%+16px)] items-center gap-4 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-mist"
                  >
                    <Thumb src={p.images[0]?.url} className="h-[50px] w-10" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{p.name}</span>
                      <span className="block text-[14px] text-ink-2">{money(p.price)}</span>
                    </span>
                    <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-mist px-3 text-[13px] font-medium transition-colors group-hover:bg-white">
                      <Plus className="size-3.5" aria-hidden />
                      Agregar
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Modal>
  );
}
