import { useId, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button, EmptyState, Field, IconButton, Input, Modal, MoneyInput, Select, Toggle, confirmDialog, toast, toastError } from "@/components/ui";
import { trpc, type Out } from "@/lib/trpc";
import { useMoney } from "@/lib/shop";
import { IntInput, LoadError, Loading, PageHeader, Row, Tag, fmtDate } from "./common";

type Coupon = Out["admin"]["coupons"]["list"][number];
type Kind = "porcentaje" | "fijo";

const kindOf = (c: { type: string }): Kind => (c.type === "fijo" ? "fijo" : "porcentaje");
const pad = (n: number) => String(n).padStart(2, "0");
const toDateInput = (d: Date | null) => (d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : "");
/** El cupón vale hasta el final del día elegido. */
const fromDateInput = (v: string) => {
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 23, 59, 59, 0);
};

const isExpired = (c: Coupon) => c.expiresAt !== null && c.expiresAt.getTime() < Date.now();
const isUsedUp = (c: Coupon) => c.maxUses !== null && c.usedCount >= c.maxUses;

export default function Coupons() {
  const utils = trpc.useUtils();
  const money = useMoney();
  const q = trpc.admin.coupons.list.useQuery();
  const [editing, setEditing] = useState<Coupon | "new" | null>(null);

  const refresh = () => void utils.admin.coupons.list.invalidate();
  const save = trpc.admin.coupons.save.useMutation({ onError: toastError, onSettled: refresh });
  const remove = trpc.admin.coupons.remove.useMutation({
    onSuccess: () => {
      toast("Cupón eliminado");
      refresh();
    },
    onError: toastError,
  });

  const setActive = (c: Coupon, isActive: boolean) => {
    utils.admin.coupons.list.setData(undefined, (list) => list?.map((x) => (x.id === c.id ? { ...x, isActive } : x)));
    save.mutate({
      id: c.id,
      code: c.code,
      type: kindOf(c),
      value: c.value,
      minSubtotal: c.minSubtotal,
      maxUses: c.maxUses,
      expiresAt: c.expiresAt,
      isActive,
    });
  };

  const askRemove = async (c: Coupon) => {
    const ok = await confirmDialog({
      title: `¿Eliminar el cupón ${c.code}?`,
      text: "Nadie más podrá usarlo. Los pedidos que ya lo aplicaron conservan su descuento.",
      action: "Eliminar",
      danger: true,
    });
    if (ok) remove.mutate({ id: c.id });
  };

  const newButton = (
    <Button onClick={() => setEditing("new")}>
      <Plus className="size-4" aria-hidden />
      Nuevo cupón
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Cupones"
        description="Códigos de descuento que el cliente escribe al pagar."
        actions={q.data && q.data.length > 0 ? newButton : undefined}
      />

      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <LoadError error={q.error} retry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <div className="rounded-[24px] bg-white">
          <EmptyState
            title="Aún no hay cupones"
            text="Crea un código con un porcentaje o un valor fijo de descuento. Puedes ponerle compra mínima, límite de usos y fecha de vencimiento."
          >
            {newButton}
          </EmptyState>
        </div>
      ) : (
        <div className="rounded-[24px] bg-white p-5 sm:p-6">
          <ul>
            {q.data.map((c) => (
              <Row key={c.id}>
                <div className="min-w-0 flex-1 basis-64">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium tracking-normal">{c.code}</span>
                    {isExpired(c) && <Tag tone="warn">Vencido</Tag>}
                    {isUsedUp(c) && <Tag tone="warn">Sin usos disponibles</Tag>}
                  </p>
                  <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-[14px] sm:flex sm:flex-wrap sm:gap-x-6">
                    <Fact label="Descuento" value={kindOf(c) === "porcentaje" ? `${c.value} %` : money(c.value)} />
                    <Fact label="Compra mínima" value={c.minSubtotal > 0 ? money(c.minSubtotal) : "Sin mínimo"} />
                    <Fact label="Usos" value={c.maxUses !== null ? `${c.usedCount} de ${c.maxUses}` : String(c.usedCount)} />
                    <Fact label="Vence" value={c.expiresAt ? fmtDate(c.expiresAt) : "No vence"} />
                  </dl>
                </div>
                <div className="flex flex-1 items-center justify-between gap-3 sm:flex-none">
                  <Toggle checked={c.isActive} onChange={(v) => setActive(c, v)} label="Activo" />
                  <div className="flex items-center">
                    <IconButton label={`Editar ${c.code}`} onClick={() => setEditing(c)}>
                      <Pencil className="size-[18px]" aria-hidden />
                    </IconButton>
                    <IconButton label={`Eliminar ${c.code}`} onClick={() => askRemove(c)}>
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
        <CouponForm
          key={editing === "new" ? "new" : editing.id}
          coupon={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-ink-3">{label}</dt>
      <dd className="tabular-nums text-ink">{value}</dd>
    </div>
  );
}

function CouponForm({ coupon, onClose, onSaved }: { coupon: Coupon | null; onClose: () => void; onSaved: () => void }) {
  const formId = useId();
  const initialKind = coupon ? kindOf(coupon) : "porcentaje";
  const [code, setCode] = useState(coupon?.code ?? "");
  const [kind, setKind] = useState<Kind>(initialKind);
  // Cada tipo guarda su propio valor para no confundir 10 % con 10 centavos al cambiar.
  const [percent, setPercent] = useState<number | null>(coupon && initialKind === "porcentaje" ? coupon.value : 10);
  const [fixed, setFixed] = useState<number>(coupon && initialKind === "fijo" ? coupon.value : 0);
  const [minSubtotal, setMinSubtotal] = useState(coupon?.minSubtotal ?? 0);
  const [maxUses, setMaxUses] = useState<number | null>(coupon?.maxUses ?? null);
  const [expires, setExpires] = useState(toDateInput(coupon?.expiresAt ?? null));
  const [isActive, setIsActive] = useState(coupon?.isActive ?? true);
  const [errors, setErrors] = useState<{ code?: string; value?: string; maxUses?: string }>({});

  const save = trpc.admin.coupons.save.useMutation({
    onSuccess: () => {
      toast(coupon ? "Cambios guardados" : "Cupón creado");
      onSaved();
      onClose();
    },
    onError: toastError,
  });

  const submit = () => {
    const next: typeof errors = {};
    const clean = code.trim().toUpperCase();
    if (clean.length < 2) next.code = "El código debe tener al menos 2 caracteres.";
    else if (!/^[A-Z0-9_-]+$/.test(clean)) next.code = "Usa solo letras, números y guiones.";
    if (kind === "porcentaje" && (percent === null || percent < 1 || percent > 100)) next.value = "El porcentaje debe estar entre 1 y 100.";
    if (kind === "fijo" && fixed <= 0) next.value = "Pon un valor mayor que cero.";
    if (maxUses !== null && maxUses < 1) next.maxUses = "Pon al menos 1 uso o deja el campo vacío.";
    setErrors(next);
    if (Object.keys(next).length) return;

    save.mutate({
      id: coupon?.id,
      code: clean,
      type: kind,
      value: kind === "porcentaje" ? (percent ?? 0) : fixed,
      minSubtotal,
      maxUses,
      expiresAt: fromDateInput(expires),
      isActive,
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={coupon ? "Editar cupón" : "Nuevo cupón"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} loading={save.isPending}>
            {coupon ? "Guardar cambios" : "Crear cupón"}
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
          submit();
        }}
      >
        <Field label="Código" error={errors.code} hint="Lo que el cliente escribe al pagar. Solo letras, números y guiones.">
          <Input
            value={code}
            maxLength={40}
            autoFocus
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="Ej: BIENVENIDA10"
            onChange={(e) => {
              setCode(e.target.value.toUpperCase().replace(/\s+/g, ""));
              setErrors((x) => ({ ...x, code: undefined }));
            }}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo">
            <Select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value === "fijo" ? "fijo" : "porcentaje");
                setErrors((x) => ({ ...x, value: undefined }));
              }}
            >
              <option value="porcentaje">Porcentaje</option>
              <option value="fijo">Valor fijo</option>
            </Select>
          </Field>
          {kind === "porcentaje" ? (
            <Field label="Valor (%)" error={errors.value}>
              <IntInput
                value={percent}
                allowEmpty
                max={100}
                placeholder="10"
                onChange={(n) => {
                  setPercent(n);
                  setErrors((x) => ({ ...x, value: undefined }));
                }}
              />
            </Field>
          ) : (
            <Field label="Valor" error={errors.value}>
              <MoneyInput
                value={fixed}
                onChange={(v) => {
                  setFixed(v ?? 0);
                  setErrors((x) => ({ ...x, value: undefined }));
                }}
              />
            </Field>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Compra mínima" hint="Pon 0 si no hay mínimo.">
            <MoneyInput value={minSubtotal} onChange={(v) => setMinSubtotal(v ?? 0)} />
          </Field>
          <Field label="Límite de usos" optional error={errors.maxUses} hint="Vacío: se puede usar sin límite.">
            <IntInput
              value={maxUses}
              allowEmpty
              onChange={(n) => {
                setMaxUses(n);
                setErrors((x) => ({ ...x, maxUses: undefined }));
              }}
            />
          </Field>
        </div>
        <Field label="Vence" optional hint="Vale hasta el final de ese día. Vacío: no vence.">
          <Input type="date" value={expires} max="2037-12-31" onChange={(e) => setExpires(e.target.value)} />
        </Field>
        {expires && (
          <Button variant="secondary" size="sm" onClick={() => setExpires("")}>
            Quitar fecha de vencimiento
          </Button>
        )}
        {coupon && coupon.usedCount > 0 && (
          <p className="text-[13px] text-ink-2">
            Este cupón ya se usó {coupon.usedCount} {coupon.usedCount === 1 ? "vez" : "veces"}.
          </p>
        )}
        <Toggle checked={isActive} onChange={setIsActive} label="Activo" hint="Los clientes lo pueden usar" />
      </form>
    </Modal>
  );
}
