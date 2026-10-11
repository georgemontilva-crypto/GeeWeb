import { useId, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button, EmptyState, Field, IconButton, Input, Modal, Textarea, Toggle, confirmDialog, toast, toastError } from "@/components/ui";
import { trpc, type Out } from "@/lib/trpc";
import { LoadError, Loading, PageHeader, Row, Tag } from "./common";

type Method = Out["admin"]["payments"]["list"][number];

export default function Payments() {
  const utils = trpc.useUtils();
  const q = trpc.admin.payments.list.useQuery();
  const [editing, setEditing] = useState<Method | "new" | null>(null);

  const refresh = () => void utils.admin.payments.list.invalidate();
  const save = trpc.admin.payments.save.useMutation({ onError: toastError, onSettled: refresh });
  const remove = trpc.admin.payments.remove.useMutation({
    onSuccess: () => {
      toast("Método de pago eliminado");
      refresh();
    },
    onError: toastError,
  });

  const setActive = (m: Method, isActive: boolean) => {
    utils.admin.payments.list.setData(undefined, (list) => list?.map((x) => (x.id === m.id ? { ...x, isActive } : x)));
    save.mutate({
      id: m.id,
      name: m.name,
      description: m.description,
      instructions: m.instructions,
      requiresProof: m.requiresProof,
      isActive,
    });
  };

  const askRemove = async (m: Method) => {
    const ok = await confirmDialog({
      title: `¿Eliminar ${m.name}?`,
      text: "Deja de aparecer al pagar. Los pedidos que ya lo usaron conservan sus instrucciones.",
      action: "Eliminar",
      danger: true,
    });
    if (ok) remove.mutate({ id: m.id });
  };

  const newButton = (
    <Button onClick={() => setEditing("new")}>
      <Plus className="size-4" aria-hidden />
      Nuevo método de pago
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Pagos"
        description="Los pagos son manuales: el cliente paga por fuera y tú confirmas el pago en el pedido."
        actions={q.data && q.data.length > 0 ? newButton : undefined}
      />

      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <LoadError error={q.error} retry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <div className="rounded-[24px] bg-white">
          <EmptyState
            title="Aún no hay métodos de pago"
            text="Sin al menos uno activo, tus clientes no pueden terminar la compra. Agrega tu transferencia, billetera o pago contra entrega con sus instrucciones."
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
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
                    {m.name}
                    {m.requiresProof && <Tag>Pide comprobante</Tag>}
                  </p>
                  {m.description && <p className="text-[14px] text-ink-2">{m.description}</p>}
                  {!m.instructions.trim() && <p className="text-[14px] text-warn">Sin instrucciones: el cliente no sabrá cómo pagar.</p>}
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
        <PaymentForm
          key={editing === "new" ? "new" : editing.id}
          method={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
    </>
  );
}

function PaymentForm({ method, onClose, onSaved }: { method: Method | null; onClose: () => void; onSaved: () => void }) {
  const formId = useId();
  const [name, setName] = useState(method?.name ?? "");
  const [description, setDescription] = useState(method?.description ?? "");
  const [instructions, setInstructions] = useState(method?.instructions ?? "");
  const [requiresProof, setRequiresProof] = useState(method?.requiresProof ?? true);
  const [isActive, setIsActive] = useState(method?.isActive ?? true);
  const [error, setError] = useState("");

  const save = trpc.admin.payments.save.useMutation({
    onSuccess: () => {
      toast(method ? "Cambios guardados" : "Método de pago creado");
      onSaved();
      onClose();
    },
    onError: toastError,
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={method ? "Editar método de pago" : "Nuevo método de pago"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} loading={save.isPending}>
            {method ? "Guardar cambios" : "Crear método de pago"}
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
            setError("Escribe el nombre del método de pago.");
            return;
          }
          save.mutate({ id: method?.id, name: name.trim(), description: description.trim(), instructions, requiresProof, isActive });
        }}
      >
        <Field label="Nombre" error={error}>
          <Input
            value={name}
            maxLength={120}
            autoFocus
            placeholder="Ej: Transferencia bancaria"
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
          />
        </Field>
        <Field label="Descripción" optional>
          <Input value={description} maxLength={300} placeholder="Ej: Paga desde tu banco o billetera" onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Instrucciones" hint="El cliente las ve al terminar su pedido: número de cuenta, titular, etc.">
          <Textarea value={instructions} rows={5} maxLength={5000} onChange={(e) => setInstructions(e.target.value)} />
        </Field>
        <Toggle
          checked={requiresProof}
          onChange={setRequiresProof}
          label="Pedir comprobante de pago"
          hint="El cliente sube una foto o PDF del pago desde su pedido"
        />
        <Toggle checked={isActive} onChange={setIsActive} label="Activo" hint="El cliente lo puede elegir al pagar" />
      </form>
    </Modal>
  );
}
