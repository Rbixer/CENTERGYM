"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatGtq, parseQuetzalesToCents } from "@/lib/money";
import { parseResponseJson } from "@/lib/parse-response-json";
import { useToast } from "@/components/ToastProvider";

type Product = {
  id: string;
  name: string;
  priceCents: number;
  imageUrl: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
};

type OrderLine = {
  id: string;
  quantity: number;
  product: Product;
};

type SalesOrder = {
  id: string;
  studentName: string | null;
  studentNote: string | null;
  submittedAt: string;
  verified: boolean;
  verifiedAt: string | null;
  lines: OrderLine[];
};

type Sub = "productos" | "pedidos";

export function AdminVentasTab() {
  const { toast } = useToast();
  const router = useRouter();
  const [sub, setSub] = useState<Sub>("productos");
  const [storeUrl, setStoreUrl] = useState("/tienda");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newImageUrl, setNewImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [productMsg, setProductMsg] = useState<string | null>(null);
  const newProductFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setStoreUrl(`${window.location.origin}/tienda`);
  }, []);

  const refreshProducts = useCallback(async (): Promise<string | null> => {
    const res = await fetch("/api/admin/products", { credentials: "include" });
    if (res.status === 401) {
      router.replace("/admin/login");
      return null;
    }
    const parsed = await parseResponseJson<{ products?: Product[]; error?: string }>(
      res,
    );
    if (parsed.parseError) {
      setProducts([]);
      return parsed.parseError;
    }
    const j = parsed.body;
    if (!j) {
      setProducts([]);
      return "Respuesta inválida del servidor.";
    }
    if (!parsed.ok) {
      setProducts([]);
      return j.error ?? `Error HTTP ${parsed.status}`;
    }
    setProducts(j.products ?? []);
    return null;
  }, [router]);

  const refreshOrders = useCallback(async () => {
    setOrdersError(null);
    const res = await fetch("/api/admin/sales-orders", { credentials: "include" });
    if (res.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const parsed = await parseResponseJson<{ orders?: SalesOrder[]; error?: string }>(
      res,
    );
    if (parsed.parseError) {
      setOrdersError(parsed.parseError);
      return;
    }
    if (!parsed.body || !parsed.ok) {
      setOrdersError(
        parsed.body?.error ?? "No se pudieron cargar los pedidos.",
      );
      return;
    }
    setOrders(parsed.body.orders ?? []);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadError(null);
      const err = await refreshProducts();
      if (!cancelled && err) setLoadError(err);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshProducts]);

  useEffect(() => {
    if (sub !== "pedidos") return;
    void refreshOrders();
  }, [sub, refreshOrders]);

  async function onPickImage(file: File | null) {
    setProductMsg(null);
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/admin/products/upload", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const parsed = await parseResponseJson<{ imageUrl?: string; error?: string }>(
        res,
      );
      if (parsed.parseError) {
        setProductMsg(parsed.parseError);
        return;
      }
      if (!parsed.ok) {
        setProductMsg(parsed.body?.error ?? "Error al subir imagen");
        return;
      }
      if (parsed.body?.imageUrl) setNewImageUrl(parsed.body.imageUrl);
    } catch {
      setProductMsg("Error de red al subir la imagen.");
    } finally {
      setUploading(false);
    }
  }

  async function createProduct() {
    setProductMsg(null);
    const cents = parseQuetzalesToCents(newPrice);
    if (!newName.trim()) {
      setProductMsg("Indica el nombre.");
      return;
    }
    if (cents == null) {
      setProductMsg("Indica un precio válido en Q (ej. 25,50).");
      return;
    }
    if (!newImageUrl) {
      setProductMsg("Sube una foto del producto.");
      return;
    }
    setSavingProduct(true);
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          priceCents: cents,
          imageUrl: newImageUrl,
        }),
      });
      const parsed = await parseResponseJson<{ error?: string }>(res);
      if (parsed.parseError) {
        setProductMsg(parsed.parseError);
        return;
      }
      if (!parsed.ok) {
        setProductMsg(parsed.body?.error ?? "Error al crear");
        return;
      }
      setNewName("");
      setNewPrice("");
      setNewImageUrl(null);
      if (newProductFileInputRef.current) newProductFileInputRef.current.value = "";
      const loadErr = await refreshProducts();
      if (loadErr) setProductMsg(loadErr);
      else toast("Producto añadido al catálogo.", "success");
    } catch {
      setProductMsg("Error de red al crear el producto.");
    } finally {
      setSavingProduct(false);
    }
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(storeUrl);
      toast("Enlace copiado al portapapeles.", "success");
    } catch {
      toast("No se pudo copiar. Selecciona el enlace y cópialo a mano.", "error");
    }
  }

  return (
    <div className="min-w-0 space-y-8">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
        <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
          Enlace para alumnos (catálogo y pedido)
        </p>
        <p className="mt-1 break-all font-mono text-xs text-zinc-700 dark:text-zinc-300">
          {storeUrl}
        </p>
        <button
          type="button"
          onClick={() => void copyUrl()}
          className="mt-3 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Copiar enlace
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-zinc-200 pb-2 dark:border-zinc-800">
        {(
          [
            ["productos", "Productos"],
            ["pedidos", "Pedidos y verificación"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setSub(k);
              if (k === "pedidos") setOrdersError(null);
            }}
            className={
              sub === k
                ? "rounded-lg bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {loadError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
      ) : null}

      {sub === "productos" ? (
        <div className="space-y-8">
          <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/40">
            <h2 className="text-base font-semibold">Nuevo producto</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Foto, nombre y precio. Los alumnos solo ven productos activos en /tienda.
            </p>
            {productMsg ? (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{productMsg}</p>
            ) : null}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="block">
                <span className="text-sm font-medium">Foto</span>
                <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    ref={newProductFileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    tabIndex={-1}
                    aria-label="Elegir archivo de imagen del producto"
                    disabled={uploading}
                    onChange={(e) => void onPickImage(e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => newProductFileInputRef.current?.click()}
                    className="inline-flex w-full min-h-[2.5rem] items-center justify-center rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-100 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 sm:w-auto"
                  >
                    Seleccionar archivo
                  </button>
                </div>
                {uploading ? (
                  <span className="mt-1 text-xs text-zinc-500">Subiendo…</span>
                ) : null}
                {newImageUrl ? (
                  <div className="relative mt-2 h-32 w-32 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-600">
                    <Image
                      src={newImageUrl}
                      alt="Vista previa"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : null}
              </div>
              <div className="space-y-3">
                <label className="block text-sm font-medium">
                  Nombre
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                  />
                </label>
                <label className="block text-sm font-medium">
                  Precio (Q / GTQ)
                  <input
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="ej. 25,00"
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                  />
                </label>
                <button
                  type="button"
                  disabled={savingProduct || uploading}
                  onClick={() => void createProduct()}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {savingProduct ? "Guardando…" : "Añadir producto"}
                </button>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold">Catálogo</h2>
            <ul className="mt-4 space-y-4">
              {products.map((p) => (
                <ProductAdminRow
                  key={p.id}
                  product={p}
                  onChange={async () => {
                    await refreshProducts();
                  }}
                  onUnauthorized={() => router.replace("/admin/login")}
                />
              ))}
            </ul>
            {products.length === 0 ? (
              <p className="mt-4 text-sm text-zinc-500">No hay productos todavía.</p>
            ) : null}
          </section>
        </div>
      ) : (
        <PedidosSection
          orders={orders}
          error={ordersError}
          onRefresh={refreshOrders}
          onUnauthorized={() => router.replace("/admin/login")}
        />
      )}
    </div>
  );
}

function ProductAdminRow({
  product,
  onChange,
  onUnauthorized,
}: {
  product: Product;
  onChange: () => Promise<void>;
  onUnauthorized: () => void;
}) {
  const { confirm, toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState((product.priceCents / 100).toFixed(2).replace(".", ","));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null);
    const cents = parseQuetzalesToCents(price);
    if (!name.trim()) {
      setErr("Nombre vacío");
      return;
    }
    if (cents == null) {
      setErr("Precio inválido");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), priceCents: cents }),
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      const parsed = await parseResponseJson<{ error?: string }>(res);
      if (parsed.parseError) {
        setErr(parsed.parseError);
        return;
      }
      if (!parsed.ok) {
        setErr(parsed.body?.error ?? "Error");
        return;
      }
      setEditing(false);
      await onChange();
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !product.active }),
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      const parsed = await parseResponseJson<{ error?: string }>(res);
      if (parsed.parseError) {
        setErr(parsed.parseError);
        return;
      }
      if (!parsed.ok) {
        setErr(parsed.body?.error ?? "Error");
        return;
      }
      await onChange();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const ok = await confirm(
      "¿Borrar este producto? Dejará de mostrarse en el catálogo; en los pedidos, las líneas con este artículo se quitarán y los pedidos que queden sin ninguna línea se eliminarán.",
    );
    if (!ok) return;
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      const parsed = await parseResponseJson<{ error?: string }>(res);
      if (parsed.parseError) {
        setErr(parsed.parseError);
        return;
      }
      if (!parsed.ok) {
        setErr(parsed.body?.error ?? "No se pudo borrar");
        return;
      }
      await onChange();
      toast("Producto eliminado.", "success");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-start dark:border-zinc-700 dark:bg-zinc-900/50">
      <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          className="object-cover"
          unoptimized
        />
      </div>
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="space-y-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            />
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-32 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void save()}
                className="rounded bg-emerald-600 px-3 py-1 text-xs text-white"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setName(product.name);
                  setPrice((product.priceCents / 100).toFixed(2).replace(".", ","));
                  setErr(null);
                }}
                className="rounded border px-3 py-1 text-xs"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="font-medium">{product.name}</p>
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              {formatGtq(product.priceCents)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {product.active ? (
                <span className="text-emerald-600">Visible en tienda</span>
              ) : (
                <span className="text-amber-700">Oculto (no aparece en /tienda)</span>
              )}
            </p>
          </>
        )}
        {err ? <p className="mt-2 text-xs text-red-600">{err}</p> : null}
        {!editing ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(true)}
              className="text-xs text-emerald-700 underline dark:text-emerald-400"
            >
              Editar nombre/precio
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void toggleActive()}
              className="text-xs underline"
            >
              {product.active ? "Ocultar" : "Publicar"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void remove()}
              className="text-xs text-red-600 underline"
            >
              Borrar
            </button>
          </div>
        ) : null}
      </div>
    </li>
  );
}

function PedidosSection({
  orders,
  error,
  onRefresh,
  onUnauthorized,
}: {
  orders: SalesOrder[];
  error: string | null;
  onRefresh: () => Promise<void>;
  onUnauthorized: () => void;
}) {
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Marca los pedidos como verificados cuando hayas comprobado pago o entrega.
        </p>
        <button
          type="button"
          disabled={refreshing}
          onClick={() => void handleRefresh()}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
        >
          {refreshing ? "Actualizando…" : "Actualizar"}
        </button>
      </div>
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      <ul className="space-y-4">
        {orders.length === 0 ? (
          <li className="rounded-xl border border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
            Sin pedidos todavía.
          </li>
        ) : (
          orders.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              onChange={() => void onRefresh()}
              onUnauthorized={onUnauthorized}
            />
          ))
        )}
      </ul>
    </div>
  );
}

function OrderCard({
  order,
  onChange,
  onUnauthorized,
}: {
  order: SalesOrder;
  onChange: () => void;
  onUnauthorized: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function setVerified(verified: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/sales-orders/${order.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verified }),
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      if (res.ok) onChange();
    } finally {
      setBusy(false);
    }
  }

  const total = order.lines.reduce(
    (acc, l) => acc + l.quantity * l.product.priceCents,
    0,
  );

  return (
    <li className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs text-zinc-500">{order.id}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {new Date(order.submittedAt).toLocaleString("es-GT")}
          </p>
          {order.studentName ? (
            <p className="mt-1 text-sm font-medium">{order.studentName}</p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          {order.verified ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
              Verificado
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
              Pendiente
            </span>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void setVerified(!order.verified)}
            className="rounded-lg border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600"
          >
            {order.verified ? "Desmarcar" : "Marcar verificado"}
          </button>
        </div>
      </div>
      {order.studentNote ? (
        <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
          {order.studentNote}
        </p>
      ) : null}
      <ul className="mt-3 divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
        {order.lines.map((l) => (
          <li
            key={l.id}
            className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800">
                <Image
                  src={l.product.imageUrl}
                  alt={l.product.name}
                  fill
                  className="object-cover"
                  sizes="48px"
                  unoptimized
                />
              </div>
              <span className="min-w-0 leading-snug">
                <span className="font-medium tabular-nums">{l.quantity}×</span>{" "}
                {l.product.name}
              </span>
            </div>
            <span className="shrink-0 tabular-nums text-zinc-600 dark:text-zinc-400">
              {formatGtq(l.quantity * l.product.priceCents)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-right text-sm font-semibold">
        Total: {formatGtq(total)}
      </p>
    </li>
  );
}
