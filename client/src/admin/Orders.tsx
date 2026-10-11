import { useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { keepPreviousData } from "@tanstack/react-query";
import { Paperclip } from "lucide-react";
import { ORDER_STATUSES, ORDER_STATUS_LABEL, type OrderStatus } from "@shared/types";
import { Button, EmptyState, StatusBadge, cx } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import {
  LoadError,
  Loading,
  PageHeader,
  Pill,
  SearchInput,
  Tag,
  fmtDateTime,
  tableCell,
  tableHead,
  useDebounced,
  useMoneyFor,
} from "./common";

type Filters = { status: OrderStatus | null; search: string; page: number };

/** Se recuerdan los filtros para que al volver de un pedido la lista siga igual. */
let remembered: Filters = { status: null, search: "", page: 1 };

const asStatus = (v: string | null): OrderStatus | null =>
  (ORDER_STATUSES as readonly string[]).includes(v ?? "") ? (v as OrderStatus) : null;

export default function Orders() {
  const [, navigate] = useLocation();
  const money = useMoneyFor();
  const fromUrl = new URLSearchParams(useSearch()).get("estado");

  const [filters, setFilters] = useState<Filters>(() => {
    const status = asStatus(fromUrl);
    return status ? { status, search: "", page: 1 } : remembered;
  });
  const [text, setText] = useState(filters.search);
  const search = useDebounced(text.trim(), 350);

  useEffect(() => {
    setFilters((f) => (f.search === search ? f : { ...f, search, page: 1 }));
  }, [search]);
  useEffect(() => {
    remembered = filters;
  }, [filters]);

  const q = trpc.admin.orders.list.useQuery(
    { status: filters.status ?? undefined, search: filters.search || undefined, page: filters.page },
    { placeholderData: keepPreviousData, staleTime: 0, refetchOnWindowFocus: true },
  );

  // Si la página pedida ya no existe (cambió el filtro o hay menos pedidos), se vuelve a la última.
  const pages = q.data?.pages;
  useEffect(() => {
    if (pages !== undefined && filters.page > pages) setFilters((f) => ({ ...f, page: pages }));
  }, [pages, filters.page]);

  const counts = q.data?.counts ?? {};
  const all = Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0);
  const filtering = Boolean(filters.status || filters.search);

  return (
    <>
      <PageHeader title="Pedidos" />

      <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <Pill active={filters.status === null} count={q.data ? all : undefined} onClick={() => setFilters((f) => ({ ...f, status: null, page: 1 }))}>
          Todos
        </Pill>
        {ORDER_STATUSES.map((s) => (
          <Pill
            key={s}
            active={filters.status === s}
            count={q.data ? (counts[s] ?? 0) : undefined}
            onClick={() => setFilters((f) => ({ ...f, status: s, page: 1 }))}
          >
            {ORDER_STATUS_LABEL[s]}
          </Pill>
        ))}
      </div>

      <SearchInput
        className="mb-4 max-w-[420px]"
        label="Buscar pedidos"
        placeholder="Buscar por número, nombre, correo o teléfono"
        value={text}
        onChange={setText}
      />

      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <LoadError error={q.error} retry={() => q.refetch()} />
      ) : q.data.items.length === 0 ? (
        <div className="rounded-[24px] bg-white">
          {filtering ? (
            <EmptyState title="Ningún pedido coincide" text="Prueba con otro estado o revisa lo que escribiste en la búsqueda.">
              <Button
                variant="secondary"
                onClick={() => {
                  setText("");
                  setFilters({ status: null, search: "", page: 1 });
                }}
              >
                Quitar filtros
              </Button>
            </EmptyState>
          ) : (
            <EmptyState
              title="Aún no hay pedidos"
              text="Cuando un cliente termine su compra, el pedido aparecerá aquí para que confirmes el pago y lo despaches."
            />
          )}
        </div>
      ) : (
        <div className={cx("rounded-[24px] bg-white px-5 py-4 transition-opacity sm:px-6 sm:py-5", q.isPlaceholderData && "opacity-60")}>
          <table className="w-full text-[14px]">
            <thead className="max-md:sr-only">
              <tr>
                <th scope="col" className={tableHead}>
                  Número
                </th>
                <th scope="col" className={cx(tableHead, "hidden md:table-cell")}>
                  Fecha
                </th>
                <th scope="col" className={cx(tableHead, "hidden md:table-cell")}>
                  Cliente
                </th>
                <th scope="col" className={cx(tableHead, "hidden lg:table-cell")}>
                  Ciudad
                </th>
                <th scope="col" className={cx(tableHead, "hidden xl:table-cell")}>
                  Pago
                </th>
                <th scope="col" className={cx(tableHead, "text-right")}>
                  Total
                </th>
                <th scope="col" className={cx(tableHead, "hidden pl-4 sm:table-cell")}>
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {q.data.items.map((o) => {
                const proof = o.hasProof && o.status === "pendiente";
                return (
                  <tr
                    key={o.id}
                    onClick={() => navigate(`/admin/pedidos/${o.id}`)}
                    className="cursor-pointer transition-colors hover:bg-mist/60 [&:first-child>td]:border-t-0 md:[&:first-child>td]:border-t"
                  >
                    <td className={cx(tableCell, "pr-3")}>
                      <Link
                        href={`/admin/pedidos/${o.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-md text-[15px] font-medium whitespace-nowrap"
                      >
                        {o.number}
                      </Link>
                      <div className="mt-0.5 text-ink-2 md:hidden">
                        <div className="break-words">{o.customerName}</div>
                        <div>{fmtDateTime(o.createdAt)}</div>
                      </div>
                    </td>
                    <td className={cx(tableCell, "hidden pr-3 whitespace-nowrap text-ink-2 md:table-cell")}>{fmtDateTime(o.createdAt)}</td>
                    <td className={cx(tableCell, "hidden max-w-[220px] pr-3 md:table-cell")}>
                      <div className="truncate">{o.customerName}</div>
                      <div className="truncate text-[13px] text-ink-2">{o.customerEmail}</div>
                    </td>
                    <td className={cx(tableCell, "hidden pr-3 text-ink-2 lg:table-cell")}>{o.city}</td>
                    <td className={cx(tableCell, "hidden pr-3 text-ink-2 xl:table-cell")}>{o.paymentMethod}</td>
                    <td className={cx(tableCell, "text-right")}>
                      <div className="text-[15px] font-medium whitespace-nowrap tabular-nums">{money(o.total, o.currency)}</div>
                      <div className="mt-1.5 flex flex-col items-end gap-1 sm:hidden">
                        <StatusBadge status={o.status} />
                        {proof && <ProofTag />}
                      </div>
                    </td>
                    <td className={cx(tableCell, "hidden pl-4 sm:table-cell")}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={o.status} />
                        {proof && <ProofTag />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {q.data && q.data.pages > 1 && (
            <nav aria-label="Páginas de pedidos" className="mt-4 flex items-center justify-between gap-3 border-t border-mist-2 pt-4">
              <Button
                variant="secondary"
                size="sm"
                disabled={filters.page <= 1}
                onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
              >
                Anterior
              </Button>
              <span className="text-[14px] text-ink-2" aria-live="polite">
                Página {Math.min(filters.page, q.data.pages)} de {q.data.pages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={filters.page >= q.data.pages}
                onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
              >
                Siguiente
              </Button>
            </nav>
          )}
        </div>
      )}

    </>
  );
}

function ProofTag() {
  return (
    <Tag tone="warn">
      <Paperclip className="size-3" aria-hidden />
      Comprobante
    </Tag>
  );
}
