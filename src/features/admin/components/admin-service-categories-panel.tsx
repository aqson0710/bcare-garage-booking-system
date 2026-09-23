"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  checkAdminAccess,
  createAdminServiceCategory,
  getAdminServiceCategories,
  updateAdminServiceCategory,
  type AdminAccessResult,
  type AdminServiceCategory,
  type AdminServiceCategoryCreateInput,
  type AdminServiceCategoryUpdateInput,
} from "@/features/admin";
import { createClient } from "@/lib/supabase/browser";

type LoadState =
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
      categories: AdminServiceCategory[];
      error: null;
    }
  | { status: "error"; access: null; categories: null; error: string };

type ActionState =
  | { status: "idle"; categoryId: null; error: null; message: null }
  | { status: "saving"; categoryId: string; error: null; message: null }
  | { status: "error"; categoryId: string; error: string; message: null }
  | { status: "saved"; categoryId: string; error: null; message: string };

type StatusFilter = "all" | AdminServiceCategory["status"];

type CreateState =
  | { status: "idle"; error: null; message: null }
  | { status: "creating"; error: null; message: null }
  | { status: "error"; error: string; message: null }
  | { status: "created"; error: null; message: string };

const statusFilters: StatusFilter[] = ["all", "active", "inactive"];

function getStatusStyle(status: AdminServiceCategory["status"]) {
  if (status === "active") {
    return "bg-emerald-50 text-[var(--brand-strong)]";
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

function validateCategoryInput(input: AdminServiceCategoryUpdateInput) {
  if (!input.name.trim()) {
    return "กรุณากรอกชื่อหมวดบริการ";
  }

  return null;
}

function AddServiceCategoryForm({
  createState,
  onCreate,
}: {
  createState: CreateState;
  onCreate: (input: AdminServiceCategoryCreateInput) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] =
    useState<AdminServiceCategory["status"]>("active");
  const isCreating = createState.status === "creating";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreate({
      description: description.trim() || null,
      name: name.trim(),
      status,
    });
  }

  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="border-b border-[var(--line)] pb-4">
        <p className="text-sm font-semibold text-[var(--brand)]">
          เพิ่มหมวดบริการ
        </p>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
          New categories will appear in the service category dropdown.
        </p>
      </div>

      <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px] md:items-end">
          <label className="text-sm font-semibold text-[var(--foreground)]">
            ชื่อหมวดบริการ
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              onChange={(event) => setName(event.target.value)}
              placeholder="Example: ระบบแอร์"
              value={name}
            />
          </label>

          <label className="text-sm font-semibold text-[var(--foreground)]">
            สถานะ
            <select
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              onChange={(event) =>
                setStatus(event.target.value as AdminServiceCategory["status"])
              }
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
            className="mt-2 min-h-20 w-full resize-y rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Short description shown on the customer booking page"
            value={description}
          />
        </label>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isCreating}
            type="submit"
          >
            {isCreating ? "กำลังเพิ่ม..." : "เพิ่มหมวดบริการ"}
          </button>

          {createState.status === "error" ? (
            <p className="text-sm text-[var(--danger)]">{createState.error}</p>
          ) : null}

          {createState.status === "created" ? (
            <p className="text-sm font-semibold text-emerald-400">
              {createState.message}
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function AdminServiceCategoryRow({
  actionState,
  category,
  onSave,
}: {
  actionState: ActionState;
  category: AdminServiceCategory;
  onSave: (
    category: AdminServiceCategory,
    input: AdminServiceCategoryUpdateInput,
  ) => void;
}) {
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description ?? "");
  const [status, setStatus] =
    useState<AdminServiceCategory["status"]>(category.status);
  const isSaving =
    actionState.status === "saving" && actionState.categoryId === category.id;
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
    <article className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${getStatusStyle(
                category.status,
              )}`}
            >
              {formatCategoryStatus(category.status)}
            </span>
          </div>
          <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
            {category.name}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            {category.description ?? "-"}
          </p>
        </div>
        <p className="text-xs text-[var(--muted)]">
          อัปเดตล่าสุด {new Date(category.updated_at).toLocaleString("th-TH")}
        </p>
      </div>

      <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px] md:items-end">
          <label className="text-sm font-semibold text-[var(--foreground)]">
            ชื่อหมวดบริการ
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </label>

          <label className="text-sm font-semibold text-[var(--foreground)]">
            สถานะ
            <select
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              onChange={(event) =>
                setStatus(event.target.value as AdminServiceCategory["status"])
              }
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

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!hasChanges || isSaving}
            type="submit"
          >
            {isSaving ? "กำลังบันทึก..." : "บันทึกหมวดบริการ"}
          </button>

          {actionState.status === "error" &&
          actionState.categoryId === category.id ? (
            <p className="text-sm text-[var(--danger)]">{actionState.error}</p>
          ) : null}

          {actionState.status === "saved" &&
          actionState.categoryId === category.id ? (
            <p className="text-sm font-semibold text-emerald-400">
              {actionState.message}
            </p>
          ) : null}
        </div>
      </form>
    </article>
  );
}

export function AdminServiceCategoriesPanel() {
  const [loadState, setLoadState] = useState<LoadState>({
    access: null,
    categories: null,
    error: null,
    status: "loading",
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
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

      const { data, error } = await getAdminServiceCategories(supabase);

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
  }, []);

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

  async function handleSaveCategory(
    category: AdminServiceCategory,
    input: AdminServiceCategoryUpdateInput,
  ) {
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

    setActionState({
      categoryId: category.id,
      error: null,
      message: null,
      status: "saving",
    });

    const supabase = createClient();
    const { data, error } = await updateAdminServiceCategory(
      supabase,
      category.id,
      input,
    );

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
      categories: loadState.categories.map((currentCategory) =>
        currentCategory.id === category.id ? data : currentCategory,
      ),
    });
    setActionState({
      categoryId: category.id,
      error: null,
      message: "บันทึกหมวดบริการเรียบร้อยแล้ว",
      status: "saved",
    });
  }

  async function handleCreateCategory(input: AdminServiceCategoryCreateInput) {
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
        error: "This category name already exists.",
        message: null,
        status: "error",
      });
      return;
    }

    setCreateState({
      error: null,
      message: null,
      status: "creating",
    });

    const supabase = createClient();
    const { data, error } = await createAdminServiceCategory(supabase, input);

    if (error) {
      setCreateState({
        error: error.message,
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
      message: "เพิ่มหมวดบริการเรียบร้อยแล้ว",
      status: "created",
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 pb-8 pt-0">
      <header className="border-b border-[var(--line)] pb-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AppNav />
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[var(--foreground)]">
              จัดการหมวดบริการ
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              จัดการชื่อ รายละเอียด และสถานะการแสดงผลของหมวดบริการในหน้าจองลูกค้า
            </p>
          </div>
          <Link
            className="min-h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
            href="/admin"
          >
            หน้าแอดมิน
          </Link>
        </div>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดหมวดบริการ...
          </div>
        </section>
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
            <p className="font-semibold">ต้องเข้าสู่ระบบ</p>
            <p className="mt-1">กรุณาเข้าสู่ระบบด้วยบัญชีแอดมิน</p>
            <Link
              className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
              href="/auth"
            >
              ไปที่บัญชี
            </Link>
          </div>
        </section>
      ) : null}

      {loadState.status === "access-denied" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-700">
            <p className="text-lg font-bold">ไม่มีสิทธิ์เข้าถึง</p>
            <p className="mt-2">{loadState.access.reason}</p>
          </div>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-xl rounded-lg border border-red-200 bg-[var(--surface)] px-5 py-4 text-sm text-[var(--danger)] shadow-sm">
            {loadState.error}
          </div>
        </section>
      ) : null}

      {loadState.status === "ready" ? (
        <section className="py-6">
          <AddServiceCategoryForm
            createState={createState}
            key={loadState.categories.length}
            onCreate={handleCreateCategory}
          />

          <div className="mt-5 flex flex-col gap-4 border-b border-[var(--line)] pb-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {filteredCategories.length} of {loadState.categories.length}{" "}
                  หมวดบริการ
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  หมวดที่ปิดใช้งานจะไม่แสดงในหน้าจองบริการของลูกค้า
                </p>
              </div>

              <input
                className="min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)] lg:w-80"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="ค้นหาหมวดบริการ"
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
            <div className="mt-5 space-y-4">
              {filteredCategories.map((category) => (
                <AdminServiceCategoryRow
                  actionState={actionState}
                  category={category}
                  key={category.id}
                  onSave={handleSaveCategory}
                />
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] p-6 text-sm leading-6 text-[var(--muted)]">
              ไม่พบหมวดบริการที่ตรงกับตัวกรองปัจจุบัน
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
