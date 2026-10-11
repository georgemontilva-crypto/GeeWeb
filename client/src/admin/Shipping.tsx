import { useId, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button, EmptyState, Field, IconButton, Input, Modal, MoneyInput, Toggle, confirmDialog, toast, toastError } from "@/components/ui";
import { trpc, type Out } from "@/lib/trpc";
import { useMoney } from "@/lib/shop";
import { LoadError, Loading, PageHeader, Row } from "./common";

type Method = Out["admin"]["shipping"]["list"][number];

export default function Shipping() {
  const utils = trpc.useUtils();
  const money = useMoney();
  const q = trpc.admin.shipping.list.useQuery();
  const [editing, setEditing] = useState<Method | "new" | null>(null);

  const refresh = () => void utils.admin.shipping.list.invalidate();
  const save = trpc.admin.shipping.save.useMutation({ onError: toastError, onSettled: refresh });
  const remove = trpc.admin.shipping.remove.useMutation({
    onSuccess: () => {
      toast("Envío eliminado");
      refresh();
    },
    onError: toastError,
  });

  const setActive = (m: Method, isActive: boolean) => {
    utils.admin.shipping.list.setData(undefined, (list) => list?.map((x) => (x.id === m.id ? { ...x, isActive } : x)));
    save.mutate({ id: m.id, name: m.name, description: m.description, eta: m.eta, price: m.price, freeOver: m.freeOver, isActive });
  };

  const askRemove = async (m: Method) => {
    const ok = await confirmDialog({
      title: `¿Eliminar el envío ${m.name}?`,
      text: "Deja de aparecer al pagar. Los pedidos que ya lo usaron no cambian.",
      action: "Eliminar",
      danger: true,
    });
    if (ok) remove.mutate({ id: m.id });
  };

  const newButton = (
    <Button onClick={() => setEditing("new")}>
      <Plus className="size-4" aria-hidden />
      Nuevo envío
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Envíos"
        description="Las opciones de entrega que el cliente puede elegir al pagar."
        actions={q.data && q.data.length > 0 ? newButton : undefined}
      />

      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <LoadError error={q.error} retry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <div className="rounded-[24px] bg-white">
          <EmptyState
            title="Aún no hay métodos de envío"
            text="Sin al menos uno activo, tus clientes no pueden terminar la compra. Crea el primero con su costo y tiempo de entrega."
          >
            {newButton}
          </EmptyState>
        </div>
      ) : (
        <div className="rounded-[24px] bg-white p-5 sm:p-6">
          <ul>
            {q.data.map((m) => (
              <Row key={m.id}>
                <div className="min-w-0 flex-1 basis-56">
                  <p className="font-medium">{m.name}</p>
                  <p className="text-[14px] text-ink-2">
                    {[
                      m.price === 0 ? "Gratis" : money(m.price),
                      m.freeOver !== null && m.price > 0 ? `gratis desde ${money(m.freeOver)}` : "",
                      m.eta,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {m.description && <p className="text-[14px] text-ink-2">{m.description}</p>}
                </div>
                <div className="flex flex-1 items-center justify-between gap-3 sm:flex-none">
                  <Toggle checked={m.isActive} onChange={(v) => setActive(m, v)} label="Activo" />
                  <div className="flex items-center">
                    <IconButton label={`Editar ${m.name}`} onClick={() => setEditing(m)}>
                      <Pencil className="size-[18px]" aria-hidden />
                    </IconButton>
                    <IconButton label={`Eliminar ${m.name}`} onClick={() => askRemove(m)}>
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
        <ShippingForm
          key={editing === "new" ? "new" : editing.id}
          method={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
    </>
  );
}

function ShippingForm({ method, onClose, onSaved }: { method: Method | null; onClose: () => void; onSaved: () => void }) {
  const formId = useId();
  const [name, setName] = useState(method?.name ?? "");
  const [description, setDescription] = useState(method?.description ?? "");
  const [eta, setEta] = useState(method?.eta ?? "");
  const [price, setPrice] = useState(method?.price ?? 0);
  const [freeOver, setFreeOver] = useState<number | null>(method?.freeOver ?? null);
  const [isActive, setIsActive] = useState(method?.isActive ?? true);
  const [error, setError] = useState("");

  const save = trpc.admin.shipping.save.useMutation({
    onSuccess: () => {
      toast(method ? "Cambios guardados" : "Envío creado");
      onSaved();
      onClose();
    },
    onError: toastError,
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={method ? "Editar envío" : "Nuevo envío"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} loading={save.isPending}>
            {method ? "Guardar cambios" : "Crear envío"}
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
            setError("Escribe el nombre del envío.");
            return;
          }
          save.mutate({ id: method?.id, name: name.trim(), description: description.trim(), eta: eta.trim(), price, freeOver, isActive });
        }}
      >
        <Field label="Nombre" error={error}>
          <Input
            value={name}
            maxLength={120}
            autoFocus
            placeholder="Ej: Envío nacional"
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
          />
        </Field>
        <Field label="Descripción" optional>
          <Input value={description} maxLength={300} placeholder="Ej: Entrega a domicilio con transportadora" onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Tiempo de entrega" optional>
          <Input value={eta} maxLength={80} placeholder="Ej: 2 a 4 días hábiles" onChange={(e) => setEta(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Costo" hint="Pon 0 si siempre es gratis.">
            <MoneyInput value={price} onChange={(v) => setPrice(v ?? 0)} />
          </Field>
          <Field label="Gratis desde" optional hint="Déjalo vacío si nunca es gratis.">
            <MoneyInput value={freeOver} allowEmpty placeholder="" onChange={setFreeOver} />
          </Field>
        </div>
        <Toggle checked={isActive} onChange={setIsActive} label="Activo" hint="El cliente lo puede elegir al pagar" />
      </form>
    </Modal>
  );
}
