import { Link } from "wouter";
import { Pencil, Plus } from "lucide-react";
import { ButtonLink, EmptyState, toastError } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { LoadError, Loading, PageHeader, Reorder, Row, Tag, move } from "./common";

export default function Pages() {
  const utils = trpc.useUtils();
  const q = trpc.admin.pages.list.useQuery();

  const reorder = trpc.admin.pages.reorder.useMutation({
    onError: toastError,
    onSettled: () => {
      void utils.admin.pages.list.invalidate();
      void utils.store.bootstrap.invalidate();
    },
  });

  const onMove = (index: number, dir: -1 | 1) => {
    const next = move(q.data ?? [], index, dir);
    utils.admin.pages.list.setData(undefined, next);
    reorder.mutate({ ids: next.map((p) => p.id) });
  };

  const newButton = (
    <ButtonLink href="/admin/paginas/nueva">
      <Plus className="size-4" aria-hidden />
      Nueva página
    </ButtonLink>
  );

  return (
    <>
      <PageHeader
        title="Páginas"
        description="Crea las subpáginas que quieras. Cada una tiene su propia dirección y puede salir en el menú o en el pie de página."
        actions={q.data && q.data.length > 0 ? newButton : undefined}
      />

      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <LoadError error={q.error} retry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <div className="rounded-[24px] bg-white">
          <EmptyState
            title="Aún no hay páginas"
            text="Úsalas para contar tu historia, explicar los cambios y devoluciones o responder preguntas frecuentes."
          >
            {newButton}
          </EmptyState>
        </div>
      ) : (
        <div className="rounded-[24px] bg-white p-5 sm:p-6">
          <ul>
            {q.data.map((p, i) => (
              <Row key={p.id}>
                <Link href={`/admin/paginas/${p.id}`} className="group min-w-0 flex-1 basis-56 rounded-xl">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium group-hover:underline group-hover:underline-offset-4">{p.title}</span>
                    {p.showInNav && <Tag>Menú</Tag>}
                    {p.showInFooter && <Tag>Pie</Tag>}
                    {!p.isPublished && <Tag tone="warn">Borrador</Tag>}
                  </span>
                  <span className="block truncate text-[14px] text-ink-2">/{p.slug}</span>
                </Link>
                <div className="flex items-center">
                  <Reorder index={i} count={q.data.length} label={p.title} disabled={reorder.isPending} onMove={(dir) => onMove(i, dir)} />
                  <ButtonLink href={`/admin/paginas/${p.id}`} variant="secondary" size="sm" className="ml-1">
                    <Pencil className="size-3.5" aria-hidden />
                    Editar
                  </ButtonLink>
                </div>
              </Row>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
