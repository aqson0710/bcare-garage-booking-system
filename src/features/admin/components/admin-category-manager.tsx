"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppNav } from "@/components/app-nav";
import { PageSkeleton } from "@/components/page-skeleton";
import { AdminDeleteButton } from "@/features/admin/components/admin-delete-button";
import { checkAdminAccess, type AdminAccessResult } from "@/features/admin";
import { createClient } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/database.types";

// Shared page for "product categories" and "service categories", so both
// admin pages look and behave the same: add (dashed + button), filter
// tabs, search, collapsible edit rows, and a red delete button with a
// confirmation in the edit form. Each page passes its labels and data
// functions. The UI is the original product-category page.

type CategoryStatus = "active" | "inactive";

export type AdminCategoryRecord = {
  description: string | null;
  id: string;
  name: string;
  status: CategoryStatus;
  updated_at: string;
};

export type AdminCategoryInput = {
  description: string | null;
  name: string;
  status: CategoryStatus;
};

type BCareSupabaseClient = SupabaseClient<Database>;

type QueryResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

export type AdminCategoryApi<T extends AdminCategoryRecord> = {
  create: (
    supabase: BCareSupabaseClient,
    input: AdminCategoryInput,
  ) => PromiseLike<QueryResult<T>>;
  list: (supabase: BCareSupabaseClient) => PromiseLike<QueryResult<T[]>>;
  remove: (
    supabase: BCareSupabaseClient,
    categoryId: string,
  ) => PromiseLike<QueryResult<{ id: string }>>;
  update: (
    supabase: BCareSupabaseClient,
    categoryId: string,
    input: AdminCategoryInput,
  ) => PromiseLike<QueryResult<T>>;
};

export type AdminCategoryLabels = {
  /** e.g. "หมวดสินค้า" / "หมวดบริการ" */
  entity: string;
  /** e.g. "สินค้า" / "บริการ" - what belongs to a category */
  childEntity: string;
  childPageHref: string;
  addDescription: string;
  namePlaceholder: string;
  pageDescription: string;
  /** Optional extra line under the result count. */
  listNote?: string;
};

type LoadState<T extends AdminCategoryRecord> =
  | { status: "loading"; access: null; categories: null; error: null }
  | { status: "signed-out"; access: null; categories: null; error: null }
  | {
      status: "access-denied";
      access: Extract<AdminAccessResult, { allowed: false }>;
      categories: null;
      error: null;
    }
  | {
      status: "ready";
      access: AdminAccessResult;
      categories: T[];
      error: null;
    }
  | { status: "error"; access: null; categories: null; error: string };

type ActionState =
  | { status: "idle"; categoryId: null; error: null; message: null }
  | { status: "saving"; categoryId: string; error: null; message: null }
  | { status: "deleting"; categoryId: string; error: null; message: null }
  | { status: "error"; categoryId: string; error: string; message: null }
  | { status: "saved"; categoryId: string; error: null; message: string };

type CreateState =
  | { status: "idle"; error: null; message: null }
  | { status: "creating"; error: null; message: null }
  | { status: "error"; error: string; message: null }
  | { status: "created"; error: null; message: string };

type StatusFilter = "all" | CategoryStatus;

const statusFilters: StatusFilter[] = ["all", "active", "inactive"];

const inputClassName =
  "mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]";

function getStatusStyle(status: CategoryStatus) {
  if (status === "active") {
    return "bg-emerald-400/15 text-emerald-200";
  }

  return "bg-[var(--surface-muted)] text-[var(--foreground)]";
}

function formatCategoryStatus(status: StatusFilter) {
  if (status === "active") {
    return "เปิดใช้งาน";
  }

  if (status === "inactive") {
    return "ปิดใช้งาน";
  }

  return "ทั้งหมด";
}

function CategoryFormFields({
  description,
  labels,
  name,
  setDescription,
  setName,
  setStatus,
  status,
}: {
  description: string;
  labels: AdminCategoryLabels;
  name: string;
  setDescription: (value: string) => void;
  setName: (value: string) => void;
  setStatus: (value: CategoryStatus) => void;
  status: CategoryStatus;
}) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px] md:items-end">
        <label className="text-sm font-semibold text-[var(--foreground)]">
          ชื่อ{labels.entity}
          <input
            className={inputClassName}
            onChange={(event) => setName(event.target.value)}
            placeholder={labels.namePlaceholder}
            value={name}
          />
        </label>

        <label className="text-sm font-semibold text-[var(--foreground)]">
          สถานะ
          <select
            className={inputClassName}
            onChange={(event) => setStatus(event.target.value as CategoryStatus)}
            value={status}
          >
            <option value="active">เปิดใช้งาน</option>
            <option value="inactive">ปิดใช้งาน</option>
          </select>
        </label>
      </div>

      <label className="text-sm font-semibold text-[var(--foreground)]">
        รายละเอียด
        <textarea
          className="mt-2 min-h-24 w-full resize-y rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
          onChange={(event) => setDescription(event.target.value)}
          value={description}
        />
      </label>
    </>
  );
}

function AddCategoryForm({
  createState,
  labels,
  onCreate,
}: {
  createState: CreateState;
  labels: AdminCategoryLabels;
  onCreate: (input: AdminCategoryInput) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<CategoryStatus>("active");
  const isCreating = createState.status === "creating";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreate({
      description: description.trim() || null,
      name: name.trim(),
      status,
    });
  }

  if (!isOpen) {
    return (
      <button
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--line)] bg-[var(--surface)] text-sm font-semibold text-[var(--muted)] hover:border-[var(--brand)] hover:text-[var(--foreground)]"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        + เพิ่ม{labels.entity}
      </button>
    );
  }

  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex items-start justify-between border-b border-[var(--line)] pb-4">
        <div>
          <p className="text-sm font-semibold text-[var(--brand)]">
            เพิ่ม{labels.entity}
          </p>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            {labels.addDescription}
          </p>
        </div>
        <button
          className="text-sm font-semibold text-[var(--muted)]"
          onClick={() => setIsOpen(false)}
          type="button"
        >
          ปิด
        </button>
      </div>

      <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
        <CategoryFormFields
          description={description}
          labels={labels}
          name={name}
          setDescription={setDescription}
          setName={setName}
          setStatus={setStatus}
          status={status}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-[var(--on-brand)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isCreating}
            type="submit"
          >
            {isCreating ? "กำลังเพิ่ม..." : `เพิ่ม${labels.entity}`}
          </button>

          {createState.status === "error" ? (
            <p className="text-sm text-[var(--danger)]">{createState.error}</p>
          ) : null}

          {createState.status === "created" ? (
            <p className="text-sm font-semibold text-[var(--brand)]">
              {createState.message}
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function CategoryRow<T extends AdminCategoryRecord>({
  actionState,
  category,
  isExpanded,
  labels,
  onDelete,
  onSave,
  onToggle,
}: {
  actionState: ActionState;
  category: T;
  isExpanded: boolean;
  labels: AdminCategoryLabels;
  onDelete: (category: T) => void;
  onSave: (category: T, input: AdminCategoryInput) => void;
  onToggle: () => void;
}) {
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description ?? "");
  const [status, setStatus] = useState<CategoryStatus>(category.status);
  const isSaving =
    actionState.status === "saving" && actionState.categoryId === category.id;
  const isDeleting =
    actionState.status === "deleting" && actionState.categoryId === category.id;
  const hasChanges =
    name.trim() !== category.name ||
    description.trim() !== (category.description ?? "") ||
    status !== category.status;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(category, {
      description: description.trim() || null,
      name: name.trim(),
      status,
    });
  }

  return (
    <article className="rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-sm">
      <button
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
        onClick={onToggle}
        type="button"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-bold text-[var(--foreground)]">
              {category.name}
            </h2>
            <span
              className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${getStatusStyle(category.status)}`}
            >
              {formatCategoryStatus(category.status)}
            </span>
          </div>
          <p className="mt-1 truncate text-sm text-[var(--muted)]">
            {category.description || "ไม่มีรายละเอียด"}
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-[var(--muted)]">
          {isExpanded ? "ย่อ" : "แก้ไข"}
        </span>
      </button>

      {isExpanded ? (
        <form
          className="grid gap-3 border-t border-[var(--line)] p-4"
          onSubmit={handleSubmit}
        >
          <CategoryFormFields
            description={description}
            labels={labels}
            name={name}
            setDescription={setDescription}
            setName={setName}
            setStatus={setStatus}
            status={status}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <button
                className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-[var(--on-brand)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!hasChanges || isSaving || isDeleting}
                type="submit"
              >
                {isSaving ? "กำลังบันทึก..." : `บันทึก${labels.entity}`}
              </button>
              <AdminDeleteButton
                confirmMessage={`ต้องการลบ${labels.entity} "${category.name}" ใช่หรือไม่?\n\nลบแล้วกู้คืนไม่ได้ (ลบได้เฉพาะหมวดที่ไม่มี${labels.childEntity}อยู่ ถ้ายังมี${labels.childEntity}ให้ย้ายออกก่อน หรือใช้ "ปิดใช้งาน" แทน)`}
                disabled={isSaving}
                isDeleting={isDeleting}
                label={`ลบ${labels.entity}`}
                onConfirm={() => onDelete(category)}
              />
            </div>

            <p className="text-xs text-[var(--muted)]">
              อัปเดตล่าสุด {new Date(category.updated_at).toLocaleString("th-TH")}
            </p>
          </div>

          {actionState.status === "error" &&
          actionState.categoryId === category.id ? (
            <p className="rounded-md bg-red-500/15 p-3 text-sm text-red-200">
              {actionState.error}
            </p>
          ) : null}

          {actionState.status === "saved" &&
          actionState.categoryId === category.id ? (
            <p className="rounded-md bg-emerald-400/15 p-3 text-sm font-semibold text-emerald-200">
              {actionState.message}
            </p>
          ) : null}
        </form>
      ) : null}
    </article>
  );
}

export function AdminCategoryManager<T extends AdminCategoryRecord>({
  api,
  labels,
}: {
  api: AdminCategoryApi<T>;
  labels: AdminCategoryLabels;
}) {
  const [loadState, setLoadState] = useState<LoadState<T>>({
    access: null,
    categories: null,
    error: null,
    status: "loading",
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(
    null,
  );
  const [actionState, setActionState] = useState<ActionState>({
    categoryId: null,
    error: null,
    message: null,
    status: "idle",
  });
  const [createState, setCreateState] = useState<CreateState>({
    error: null,
    message: null,
    status: "idle",
  });
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);
  const listCategories = api.list;

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadCategories() {
      setLoadState({
        access: null,
        categories: null,
        error: null,
        status: "loading",
      });

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (sessionError) {
        setLoadState({
          access: null,
          categories: null,
          error: sessionError.message,
          status: "error",
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          access: null,
          categories: null,
          error: null,
          status: "signed-out",
        });
        return;
      }

      const access = await checkAdminAccess(supabase, session.user.id);

      if (!isMounted) {
        return;
      }

      if (!access.allowed) {
        setLoadState({
          access,
          categories: null,
          error: null,
          status: "access-denied",
        });
        return;
      }

      const { data, error } = await listCategories(supabase);

      if (!isMounted) {
        return;
      }

      if (error) {
        setLoadState({
          access: null,
          categories: null,
          error: error.message,
          status: "error",
        });
        return;
      }

      setLoadState({
        access,
        categories: data ?? [],
        error: null,
        status: "ready",
      });
    }

    loadCategories();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadCategories();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [listCategories]);

  const filteredCategories = useMemo(() => {
    if (loadState.status !== "ready") {
      return [];
    }

    const normalizedSearch = searchInput.trim().toLowerCase();

    return loadState.categories.filter((category) => {
      const matchesStatus =
        statusFilter === "all" || category.status === statusFilter;
      const matchesSearch =
        !normalizedSearch ||
        category.name.toLowerCase().includes(normalizedSearch) ||
        (category.description ?? "").toLowerCase().includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [loadState, searchInput, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts = new Map<StatusFilter, number>(
      statusFilters.map((status) => [status, 0]),
    );

    if (loadState.status !== "ready") {
      return counts;
    }

    const normalizedSearch = searchInput.trim().toLowerCase();

    for (const category of loadState.categories) {
      const matchesSearch =
        !normalizedSearch ||
        category.name.toLowerCase().includes(normalizedSearch) ||
        (category.description ?? "").toLowerCase().includes(normalizedSearch);

      if (!matchesSearch) {
        continue;
      }

      counts.set("all", (counts.get("all") ?? 0) + 1);
      counts.set(category.status, (counts.get(category.status) ?? 0) + 1);
    }

    return counts;
  }, [loadState, searchInput]);

  function validateCategoryInput(input: AdminCategoryInput) {
    if (!input.name.trim()) {
      return `กรุณากรอกชื่อ${labels.entity}`;
    }

    return null;
  }

  async function handleCreateCategory(input: AdminCategoryInput) {
    if (loadState.status !== "ready") {
      return;
    }

    const validationError = validateCategoryInput(input);

    if (validationError) {
      setCreateState({
        error: validationError,
        message: null,
        status: "error",
      });
      return;
    }

    const duplicateCategory = loadState.categories.find(
      (category) => category.name.toLowerCase() === input.name.toLowerCase(),
    );

    if (duplicateCategory) {
      setCreateState({
        error: `${labels.entity}ชื่อนี้มีอยู่แล้ว`,
        message: null,
        status: "error",
      });
      return;
    }

    setDeleteNotice(null);
    setCreateState({
      error: null,
      message: null,
      status: "creating",
    });

    const supabase = createClient();
    const { data, error } = await api.create(supabase, input);

    if (error || !data) {
      setCreateState({
        error: error?.message ?? `เพิ่ม${labels.entity}ไม่สำเร็จ`,
        message: null,
        status: "error",
      });
      return;
    }

    setLoadState({
      ...loadState,
      categories: [...loadState.categories, data].sort((a, b) =>
        a.name.localeCompare(b.name, "th"),
      ),
    });
    setCreateState({
      error: null,
      message: `เพิ่ม${labels.entity}เรียบร้อยแล้ว`,
      status: "created",
    });
  }

  async function handleSaveCategory(category: T, input: AdminCategoryInput) {
    if (loadState.status !== "ready") {
      return;
    }

    const validationError = validateCategoryInput(input);

    if (validationError) {
      setActionState({
        categoryId: category.id,
        error: validationError,
        message: null,
        status: "error",
      });
      return;
    }

    const duplicateCategory = loadState.categories.find(
      (currentCategory) =>
        currentCategory.id !== category.id &&
        currentCategory.name.toLowerCase() === input.name.toLowerCase(),
    );

    if (duplicateCategory) {
      setActionState({
        categoryId: category.id,
        error: `ชื่อ${labels.entity}นี้มีอยู่แล้ว`,
        message: null,
        status: "error",
      });
      return;
    }

    setActionState({
      categoryId: category.id,
      error: null,
      message: null,
      status: "saving",
    });

    const supabase = createClient();
    const { data, error } = await api.update(supabase, category.id, input);

    if (error || !data) {
      setActionState({
        categoryId: category.id,
        error: error?.message ?? `บันทึก${labels.entity}ไม่สำเร็จ`,
        message: null,
        status: "error",
      });
      return;
    }

    setLoadState({
      ...loadState,
      categories: loadState.categories.map((currentCategory) =>
        currentCategory.id === category.id ? data : currentCategory,
      ),
    });
    setActionState({
      categoryId: category.id,
      error: null,
      message: `บันทึก${labels.entity}เรียบร้อยแล้ว`,
      status: "saved",
    });
  }

  async function handleDeleteCategory(category: T) {
    if (loadState.status !== "ready") {
      return;
    }

    setDeleteNotice(null);
    setActionState({
      categoryId: category.id,
      error: null,
      message: null,
      status: "deleting",
    });

    const supabase = createClient();
    const { error } = await api.remove(supabase, category.id);

    if (error) {
      setActionState({
        categoryId: category.id,
        error: error.message,
        message: null,
        status: "error",
      });
      return;
    }

    setLoadState({
      ...loadState,
      categories: loadState.categories.filter(
        (currentCategory) => currentCategory.id !== category.id,
      ),
    });
    setExpandedCategoryId(null);
    setActionState({
      categoryId: null,
      error: null,
      message: null,
      status: "idle",
    });
    setDeleteNotice(`ลบ${labels.entity} "${category.name}" เรียบร้อยแล้ว`);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col pb-8 pt-0 px-4 sm:px-6 lg:px-8">
      <header className="border-b border-[var(--line)] pb-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AppNav />
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)] leading-tight">
              จัดการ{labels.entity}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              {labels.pageDescription}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              className="min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-[var(--on-brand)]"
              href={labels.childPageHref}
            >
              จัดการ{labels.childEntity}
            </Link>
            <Link
              className="min-h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
              href="/admin"
            >
              หน้าแอดมิน
            </Link>
          </div>
        </div>
      </header>

      {loadState.status === "loading" ? (
        <PageSkeleton label={`กำลังโหลด${labels.entity}...`} variant="list" />
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-amber-300/40 bg-amber-400/15 p-5 text-sm leading-6 text-amber-200">
            <p className="font-semibold">ต้องเข้าสู่ระบบ</p>
            <p className="mt-1">กรุณาเข้าสู่ระบบด้วยบัญชีแอดมิน</p>
            <Link
              className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-[var(--on-brand)]"
              href="/auth"
            >
              ไปที่บัญชี
            </Link>
          </div>
        </section>
      ) : null}

      {loadState.status === "access-denied" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-red-400/40 bg-red-500/15 p-5 text-sm leading-6 text-red-200">
            <p className="text-lg font-bold">ไม่มีสิทธิ์เข้าถึง</p>
            <p className="mt-2">{loadState.access.reason}</p>
          </div>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-xl rounded-lg border border-red-400/40 bg-[var(--surface)] px-5 py-4 text-sm text-[var(--danger)] shadow-sm">
            {loadState.error}
          </div>
        </section>
      ) : null}

      {loadState.status === "ready" ? (
        <section className="py-6">
          <AddCategoryForm
            createState={createState}
            key={loadState.categories.length}
            labels={labels}
            onCreate={handleCreateCategory}
          />

          {deleteNotice ? (
            <p className="mt-3 rounded-md bg-emerald-400/15 p-3 text-sm font-semibold text-emerald-200">
              {deleteNotice}
            </p>
          ) : null}

          <div className="mt-5 flex flex-col gap-4 border-b border-[var(--line)] pb-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {filteredCategories.length} จาก {loadState.categories.length}{" "}
                  {labels.entity}
                </p>
                {labels.listNote ? (
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {labels.listNote}
                  </p>
                ) : null}
              </div>

              <input
                className="min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)] lg:w-80"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={`ค้นหา${labels.entity}`}
                type="search"
                value={searchInput}
              />
            </div>

            <div className="flex divide-x divide-[var(--line)] overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-sm">
              {statusFilters.map((status) => (
                <button
                  className={`min-w-[7rem] flex-1 px-4 py-3 text-left transition ${
                    statusFilter === status
                      ? "bg-[var(--accent-soft)]"
                      : "hover:bg-[var(--accent-soft)]"
                  }`}
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  type="button"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    {formatCategoryStatus(status)}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">
                    {statusCounts.get(status) ?? 0}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {filteredCategories.length > 0 ? (
            <div className="mt-5 space-y-3">
              {filteredCategories.map((category) => (
                <CategoryRow
                  actionState={actionState}
                  category={category}
                  isExpanded={expandedCategoryId === category.id}
                  key={category.id}
                  labels={labels}
                  onDelete={handleDeleteCategory}
                  onSave={handleSaveCategory}
                  onToggle={() =>
                    setExpandedCategoryId((current) =>
                      current === category.id ? null : category.id,
                    )
                  }
                />
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] p-6 text-sm leading-6 text-[var(--muted)]">
              ไม่พบ{labels.entity}ที่ตรงกับตัวกรองปัจจุบัน
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
