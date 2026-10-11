import { useId, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { slugify } from "@shared/types";
import { Button, EmptyState, Field, IconButton, Input, Modal, Textarea, Toggle, confirmDialog, toast, toastError } from "@/components/ui";
import { trpc, type Out } from "@/lib/trpc";
import { ImageInput, LoadError, Loading, PageHeader, Reorder, Row, Thumb, move } from "./common";

type Category = Out["admin"]["categories"]["list"][number];

export default function Categories() {
  const utils = trpc.useUtils();
  const q = trpc.admin.categories.list.useQuery();
  const [editing, setEditing] = useState<Category | "new" | null>(null);

  const refresh = () => {
    void utils.admin.categories.list.invalidate();
    void utils.store.bootstrap.invalidate();
  };

  const save = trpc.admin.categories.save.useMutation({ onError: toastError, onSettled: refresh });
  const reorder = trpc.admin.categories.reorder.useMutation({ onError: toastError, onSettled: refresh });
  const remove = trpc.admin.categories.remove.useMutation({
    onSuccess: () => {
      toast("Categoría eliminada");
      refresh();
      void utils.admin.products.invalidate();
    },
    onError: toastError,
  });

  const onMove = (index: number, dir: -1 | 1) => {
    const next = move(q.data ?? [], index, dir);
    utils.admin.categories.list.setData(undefined, next);
    reorder.mutate({ ids: next.map((c) => c.id) });
  };

  const setActive = (c: Category, isActive: boolean) => {
    utils.admin.categories.list.setData(undefined, (list) => list?.map((x) => (x.id === c.id ? { ...x, isActive } : x)));
    save.mutate({ id: c.id, name: c.name, slug: c.slug, description: c.description, imageUrl: c.imageUrl, isActive });
  };

  const askRemove = async (c: Category) => {
    const ok = await confirmDialog({
      title: `¿Eliminar la categoría ${c.name}?`,
      text:
        c.productCount > 0
          ? `Los productos quedan sin categoría. Hay ${c.productCount} en esta.`
          : "Los productos quedan sin categoría.",
      action: "Eliminar",
      danger: true,
    });
    if (ok) remove.mutate({ id: c.id });
  };

  const newButton = (
    <Button onClick={() => setEditing("new")}>
      <Plus className="size-4" aria-hidden />
      Nueva categoría
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Categorías"
        description="Agrupan los productos en el menú de la tienda, en este orden."
        actions={q.data && q.data.length > 0 ? newButton : undefined}
      />

      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <LoadError error={q.error} retry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <div className="rounded-[24px] bg-white">
          <EmptyState
            title="Aún no hay categorías"
            text="Crea categorías como Camisetas o Pantalones para que tus clientes encuentren más rápido lo que buscan."
          >
            {newButton}
          </EmptyState>
        </div>
      ) : (
        <div className="rounded-[24px] bg-white p-5 sm:p-6">
          <ul>
            {q.data.map((c, i) => (
              <Row key={c.id}>
                <div className="flex min-w-0 flex-1 basis-56 items-center gap-4">
                  <Thumb src={c.imageUrl} className="size-14" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="truncate text-[14px] text-ink-2">
                      /categoria/{c.slug} · {c.productCount === 1 ? "1 producto" : `${c.productCount} productos`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-1 items-center justify-between gap-3 sm:flex-none">
                  <Toggle checked={c.isActive} onChange={(v) => setActive(c, v)} label="Activa" />
                  <div className="flex items-center">
                    <Reorder index={i} count={q.data.length} label={c.name} disabled={reorder.isPending} onMove={(dir) => onMove(i, dir)} />
                    <IconButton label={`Editar ${c.name}`} onClick={() => setEditing(c)}>
                      <Pencil className="size-[18px]" aria-hidden />
                    </IconButton>
                    <IconButton label={`Eliminar ${c.name}`} onClick={() => askRemove(c)}>
                      <Trash2 className="size-[18px]" aria-hidden />
                    </IconButton>
                  </div>
                </div>
              </Row>
            ))}
          </ul>
        </div>
      )}

      {editing && (
        <CategoryForm
          key={editing === "new" ? "new" : editing.id}
          category={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
    </>
  );
}

function CategoryForm({ category, onClose, onSaved }: { category: Category | null; onClose: () => void; onSaved: () => void }) {
  const formId = useId();
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [imageUrl, setImageUrl] = useState(category?.imageUrl ?? "");
  const [isActive, setIsActive] = useState(category?.isActive ?? true);
  const [error, setError] = useState("");

  const save = trpc.admin.categories.save.useMutation({
    onSuccess: () => {
      toast(category ? "Cambios guardados" : "Categoría creada");
      onSaved();
      onClose();
    },
    onError: toastError,
  });

  const auto = slugify(slug || name);

  return (
    <Modal
      open
      onClose={onClose}
      title={category ? "Editar categoría" : "Nueva categoría"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} loading={save.isPending}>
            {category ? "Guardar cambios" : "Crear categoría"}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) {
            setError("Escribe el nombre de la categoría.");
            return;
          }
          save.mutate({ id: category?.id, name: name.trim(), slug: slug.trim(), description: description.trim(), imageUrl, isActive });
        }}
      >
        <Field label="Nombre" error={error}>
          <Input
            value={name}
            maxLength={120}
            autoFocus
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
          />
        </Field>
        <Field
          label="Dirección"
          hint={slug.trim() || !auto ? "Se genera sola si la dejas vacía." : `Se genera sola si la dejas vacía. Quedará en /categoria/${auto}`}
        >
          <Input
            value={slug}
            maxLength={140}
            placeholder={auto || "nombre-de-la-categoria"}
            autoCapitalize="none"
            spellCheck={false}
            onChange={(e) => setSlug(e.target.value)}
            onBlur={() => setSlug(slugify(slug))}
          />
        </Field>
        <Field label="Descripción" optional>
          <Textarea value={description} rows={3} maxLength={400} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <ImageInput label="Imagen" hint="Opcional. Si no subes una, se usa la foto de un producto." value={imageUrl} onChange={setImageUrl} />
        <Toggle checked={isActive} onChange={setIsActive} label="Activa" hint="Visible en el menú y en la tienda" />
      </form>
    </Modal>
  );
}
