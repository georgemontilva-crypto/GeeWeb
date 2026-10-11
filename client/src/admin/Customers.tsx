import { useMemo, useState } from "react";
import { Button, EmptyState, cx } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { useMoney } from "@/lib/shop";
import { LoadError, Loading, PageHeader, SearchInput, fmtDate, tableCell, tableHead } from "./common";

const link = "underline decoration-line underline-offset-4 hover:decoration-ink";

export default function Customers() {
  const q = trpc.admin.customers.useQuery();
  const money = useMoney();
  const [text, setText] = useState("");

  const rows = useMemo(() => {
    const needle = text.trim().toLowerCase();
    const list = q.data ?? [];
    if (!needle) return list;
    return list.filter((c) => [c.name, c.email, c.phone, c.city].some((v) => (v ?? "").toLowerCase().includes(needle)));
  }, [q.data, text]);

  return (
    <>
      <PageHeader title="Clientes" description="Todas las personas que han hecho un pedido, con lo que han comprado." />

      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <LoadError error={q.error} retry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <div className="rounded-[24px] bg-white">
          <EmptyState title="Aún no hay clientes" text="Aparecerán aquí cuando llegue el primer pedido. No tienes que registrarlos a mano." />
        </div>
      ) : (
        <>
          <SearchInput
            className="mb-4 max-w-[420px]"
            label="Buscar clientes"
            placeholder="Buscar por nombre, correo, teléfono o ciudad"
            value={text}
            onChange={setText}
          />
          {rows.length === 0 ? (
            <div className="rounded-[24px] bg-white">
              <EmptyState title="Ningún cliente coincide" text="Revisa lo que escribiste o busca por otro dato.">
                <Button variant="secondary" onClick={() => setText("")}>
                  Borrar búsqueda
                </Button>
              </EmptyState>
            </div>
          ) : (
            <div className="rounded-[24px] bg-white px-5 py-4 sm:px-6 sm:py-5">
              <table className="w-full text-[14px]">
                <thead className="max-md:sr-only">
                  <tr>
                    <th scope="col" className={tableHead}>
                      Nombre
                    </th>
                    <th scope="col" className={cx(tableHead, "hidden md:table-cell")}>
                      Correo
                    </th>
                    <th scope="col" className={cx(tableHead, "hidden xl:table-cell")}>
                      Teléfono
                    </th>
                    <th scope="col" className={cx(tableHead, "hidden lg:table-cell")}>
                      Ciudad
                    </th>
                    <th scope="col" className={cx(tableHead, "hidden text-right sm:table-cell")}>
                      Pedidos
                    </th>
                    <th scope="col" className={cx(tableHead, "pl-4 text-right")}>
                      Total comprado
                    </th>
                    <th scope="col" className={cx(tableHead, "hidden pl-4 text-right md:table-cell")}>
                      Último pedido
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.email} className="[&:first-child>td]:border-t-0 md:[&:first-child>td]:border-t">
                      <td className={cx(tableCell, "pr-3")}>
                        <div className="text-[15px] font-medium break-words">{c.name}</div>
                        <div className="mt-0.5 space-y-0.5 text-ink-2 md:hidden">
                          <div className="break-all">
                            <a href={`mailto:${c.email}`} className={link}>
                              {c.email}
                            </a>
                          </div>
                          <div>{[c.phone, c.city].filter(Boolean).join(" · ")}</div>
                        </div>
                        <div className="hidden text-[13px] text-ink-2 md:block xl:hidden">{c.phone}</div>
                      </td>
                      <td className={cx(tableCell, "hidden max-w-[240px] pr-3 md:table-cell")}>
                        <a href={`mailto:${c.email}`} className={cx(link, "block truncate")}>
                          {c.email}
                        </a>
                      </td>
                      <td className={cx(tableCell, "hidden pr-3 whitespace-nowrap text-ink-2 xl:table-cell")}>{c.phone}</td>
                      <td className={cx(tableCell, "hidden pr-3 text-ink-2 lg:table-cell")}>{c.city}</td>
                      <td className={cx(tableCell, "hidden text-right tabular-nums sm:table-cell")}>{c.orders}</td>
                      <td className={cx(tableCell, "pl-4 text-right")}>
                        <div className="text-[15px] font-medium whitespace-nowrap tabular-nums">{money(c.spent)}</div>
                        <div className="text-ink-2 sm:hidden">{c.orders === 1 ? "1 pedido" : `${c.orders} pedidos`}</div>
                        <div className="whitespace-nowrap text-ink-2 md:hidden">{fmtDate(c.last)}</div>
                      </td>
                      <td className={cx(tableCell, "hidden pl-4 text-right whitespace-nowrap text-ink-2 md:table-cell")}>{fmtDate(c.last)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {q.data.length >= 1000 && (
                <p className="mt-4 border-t border-mist-2 pt-4 text-[13px] text-ink-2">Se muestran los 1.000 clientes con pedidos más recientes.</p>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
