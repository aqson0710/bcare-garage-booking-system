"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  checkAdminAccess,
  createAdminTechnicianSkill,
  getAdminTechnicianSkills,
  updateAdminTechnicianSkill,
  type AdminAccessResult,
  type AdminTechnicianSkill,
  type AdminTechnicianSkillCreateInput,
  type AdminTechnicianSkillUpdateInput,
} from "@/features/admin";
import { createClient } from "@/lib/supabase/browser";

type LoadState =
  | { status: "loading"; access: null; skills: null; error: null }
  | { status: "signed-out"; access: null; skills: null; error: null }
  | {
      status: "access-denied";
      access: Extract<AdminAccessResult, { allowed: false }>;
      skills: null;
      error: null;
    }
  | {
      status: "ready";
      access: AdminAccessResult;
      skills: AdminTechnicianSkill[];
      error: null;
    }
  | { status: "error"; access: null; skills: null; error: string };

type ActionState =
  | { status: "idle"; skillId: null; error: null; message: null }
  | { status: "saving"; skillId: string; error: null; message: null }
  | { status: "error"; skillId: string; error: string; message: null }
  | { status: "saved"; skillId: string; error: null; message: string };

type CreateState =
  | { status: "idle"; error: null; message: null }
  | { status: "creating"; error: null; message: null }
  | { status: "error"; error: string; message: null }
  | { status: "created"; error: null; message: string };

type StatusFilter = "all" | AdminTechnicianSkill["status"];

const statusFilters: StatusFilter[] = ["all", "active", "inactive"];

function getStatusStyle(status: AdminTechnicianSkill["status"]) {
  if (status === "active") {
    return "bg-emerald-50 text-[var(--brand-strong)]";
  }

  return "bg-slate-100 text-slate-700";
}

function formatSkillStatus(status: StatusFilter) {
  if (status === "active") {
    return "เปิดใช้งาน";
  }

  if (status === "inactive") {
    return "ปิดใช้งาน";
  }

  return "ทั้งหมด";
}

function validateSkillInput(input: AdminTechnicianSkillUpdateInput) {
  if (!input.name.trim()) {
    return "กรุณากรอกชื่อทักษะ";
  }

  return null;
}

function AddTechnicianSkillForm({
  createState,
  onCreate,
}: {
  createState: CreateState;
  onCreate: (input: AdminTechnicianSkillCreateInput) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] =
    useState<AdminTechnicianSkill["status"]>("active");
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
    <section className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
      <div className="border-b border-[var(--line)] pb-4">
        <p className="text-sm font-semibold text-[var(--brand)]">เพิ่มทักษะช่าง</p>
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
          ทักษะที่เปิดใช้งานจะแสดงในโปรไฟล์ช่าง และใช้ช่วยเลือกช่างให้เหมาะกับใบงานซ่อม
        </p>
      </div>

      <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px] md:items-end">
          <label className="text-sm font-semibold text-[var(--foreground)]">
            ชื่อทักษะ
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              onChange={(event) => setName(event.target.value)}
              placeholder="เช่น ระบบเกียร์"
              value={name}
            />
          </label>

          <label className="text-sm font-semibold text-[var(--foreground)]">
            สถานะ
            <select
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              onChange={(event) =>
                setStatus(event.target.value as AdminTechnicianSkill["status"])
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
            className="mt-2 min-h-20 w-full resize-y rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            onChange={(event) => setDescription(event.target.value)}
            placeholder="คำอธิบายสั้น ๆ สำหรับ admin และช่าง"
            value={description}
          />
        </label>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isCreating}
            type="submit"
          >
            {isCreating ? "กำลังเพิ่ม..." : "เพิ่มทักษะ"}
          </button>

          {createState.status === "error" ? (
            <p className="text-sm text-red-700">{createState.error}</p>
          ) : null}

          {createState.status === "created" ? (
            <p className="text-sm font-semibold text-[var(--brand-strong)]">
              {createState.message}
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function AdminTechnicianSkillRow({
  actionState,
  onSave,
  skill,
}: {
  actionState: ActionState;
  onSave: (
    skill: AdminTechnicianSkill,
    input: AdminTechnicianSkillUpdateInput,
  ) => void;
  skill: AdminTechnicianSkill;
}) {
  const [name, setName] = useState(skill.name);
  const [description, setDescription] = useState(skill.description ?? "");
  const [status, setStatus] =
    useState<AdminTechnicianSkill["status"]>(skill.status);
  const isSaving =
    actionState.status === "saving" && actionState.skillId === skill.id;
  const hasChanges =
    name.trim() !== skill.name ||
    description.trim() !== (skill.description ?? "") ||
    status !== skill.status;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(skill, {
      description: description.trim() || null,
      name: name.trim(),
      status,
    });
  }

  return (
    <article className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <span
            className={`rounded-md px-2.5 py-1 text-xs font-semibold ${getStatusStyle(
              skill.status,
            )}`}
          >
            {formatSkillStatus(skill.status)}
          </span>
          <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
            {skill.name}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            {skill.description ?? "-"}
          </p>
        </div>
        <p className="text-xs text-[var(--muted)]">
          อัปเดตล่าสุด {new Date(skill.updated_at).toLocaleString("th-TH")}
        </p>
      </div>

      <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px] md:items-end">
          <label className="text-sm font-semibold text-[var(--foreground)]">
            ชื่อทักษะ
            <input
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </label>

          <label className="text-sm font-semibold text-[var(--foreground)]">
            สถานะ
            <select
              className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
              onChange={(event) =>
                setStatus(event.target.value as AdminTechnicianSkill["status"])
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
            className="mt-2 min-h-24 w-full resize-y rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
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
            {isSaving ? "กำลังบันทึก..." : "บันทึกทักษะ"}
          </button>

          {actionState.status === "error" &&
          actionState.skillId === skill.id ? (
            <p className="text-sm text-red-700">{actionState.error}</p>
          ) : null}

          {actionState.status === "saved" &&
          actionState.skillId === skill.id ? (
            <p className="text-sm font-semibold text-[var(--brand-strong)]">
              {actionState.message}
            </p>
          ) : null}
        </div>
      </form>
    </article>
  );
}

export function AdminTechnicianSkillsPanel() {
  const [loadState, setLoadState] = useState<LoadState>({
    access: null,
    error: null,
    skills: null,
    status: "loading",
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [actionState, setActionState] = useState<ActionState>({
    error: null,
    message: null,
    skillId: null,
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

    async function loadSkills() {
      setLoadState({
        access: null,
        error: null,
        skills: null,
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
          error: sessionError.message,
          skills: null,
          status: "error",
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          access: null,
          error: null,
          skills: null,
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
          error: null,
          skills: null,
          status: "access-denied",
        });
        return;
      }

      const { data, error } = await getAdminTechnicianSkills(supabase);

      if (!isMounted) {
        return;
      }

      if (error) {
        setLoadState({
          access: null,
          error: error.message,
          skills: null,
          status: "error",
        });
        return;
      }

      setLoadState({
        access,
        error: null,
        skills: data ?? [],
        status: "ready",
      });
    }

    loadSkills();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadSkills();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const filteredSkills = useMemo(() => {
    if (loadState.status !== "ready") {
      return [];
    }

    const normalizedSearch = searchInput.trim().toLowerCase();

    return loadState.skills.filter((skill) => {
      const matchesStatus =
        statusFilter === "all" || skill.status === statusFilter;
      const matchesSearch =
        !normalizedSearch ||
        skill.name.toLowerCase().includes(normalizedSearch) ||
        (skill.description ?? "").toLowerCase().includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [loadState, searchInput, statusFilter]);

  async function handleSaveSkill(
    skill: AdminTechnicianSkill,
    input: AdminTechnicianSkillUpdateInput,
  ) {
    if (loadState.status !== "ready") {
      return;
    }

    const validationError = validateSkillInput(input);

    if (validationError) {
      setActionState({
        error: validationError,
        message: null,
        skillId: skill.id,
        status: "error",
      });
      return;
    }

    const duplicateSkill = loadState.skills.find(
      (currentSkill) =>
        currentSkill.id !== skill.id &&
        currentSkill.name.toLowerCase() === input.name.toLowerCase(),
    );

    if (duplicateSkill) {
      setActionState({
        error: "มีชื่อทักษะนี้อยู่แล้ว",
        message: null,
        skillId: skill.id,
        status: "error",
      });
      return;
    }

    setActionState({
      error: null,
      message: null,
      skillId: skill.id,
      status: "saving",
    });

    const supabase = createClient();
    const { data, error } = await updateAdminTechnicianSkill(
      supabase,
      skill.id,
      input,
    );

    if (error) {
      setActionState({
        error: error.message,
        message: null,
        skillId: skill.id,
        status: "error",
      });
      return;
    }

    setLoadState({
      ...loadState,
      skills: loadState.skills.map((currentSkill) =>
        currentSkill.id === skill.id ? data : currentSkill,
      ),
    });
    setActionState({
      error: null,
      message: "บันทึกทักษะเรียบร้อยแล้ว",
      skillId: skill.id,
      status: "saved",
    });
  }

  async function handleCreateSkill(input: AdminTechnicianSkillCreateInput) {
    if (loadState.status !== "ready") {
      return;
    }

    const validationError = validateSkillInput(input);

    if (validationError) {
      setCreateState({
        error: validationError,
        message: null,
        status: "error",
      });
      return;
    }

    const duplicateSkill = loadState.skills.find(
      (skill) => skill.name.toLowerCase() === input.name.toLowerCase(),
    );

    if (duplicateSkill) {
      setCreateState({
        error: "มีชื่อทักษะนี้อยู่แล้ว",
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
    const { data, error } = await createAdminTechnicianSkill(supabase, input);

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
      skills: [...loadState.skills, data].sort((a, b) =>
        a.name.localeCompare(b.name, "th"),
      ),
    });
    setCreateState({
      error: null,
      message: "เพิ่มทักษะเรียบร้อยแล้ว",
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
              จัดการทักษะช่าง
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              จัดการรายการทักษะที่ช่างเลือกในโปรไฟล์ และให้ admin ใช้ประกอบการมอบหมายงาน
            </p>
          </div>
          <Link
            className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-center text-sm font-semibold text-[var(--muted)]"
            href="/admin"
          >
            หน้าหลังบ้าน
          </Link>
        </div>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดทักษะช่าง...
          </div>
        </section>
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
            <p className="font-semibold">ต้องเข้าสู่ระบบก่อน</p>
            <p className="mt-1">เข้าสู่ระบบด้วยบัญชี admin</p>
            <Link
              className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
              href="/auth"
            >
              ไปที่หน้าบัญชี
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
          <div className="max-w-xl rounded-lg border border-red-200 bg-white px-5 py-4 text-sm text-red-700 shadow-sm">
            {loadState.error}
          </div>
        </section>
      ) : null}

      {loadState.status === "ready" ? (
        <section className="py-6">
          <AddTechnicianSkillForm
            createState={createState}
            key={loadState.skills.length}
            onCreate={handleCreateSkill}
          />

          <div className="mt-5 flex flex-col gap-4 border-b border-[var(--line)] pb-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                พบ {filteredSkills.length} จาก {loadState.skills.length} ทักษะ
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                ทักษะที่ปิดใช้งานจะยังเก็บในประวัติ แต่จะไม่แสดงให้ช่างเลือกในโปรไฟล์
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-2xl">
              <input
                className="min-h-10 flex-1 rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="ค้นหาทักษะ"
                type="search"
                value={searchInput}
              />
              <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
                {statusFilters.map((status) => (
                  <button
                    className={
                      statusFilter === status
                        ? "min-h-10 shrink-0 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white"
                        : "min-h-10 shrink-0 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]"
                    }
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    type="button"
                  >
                    {formatSkillStatus(status)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filteredSkills.length > 0 ? (
            <div className="mt-5 space-y-4">
              {filteredSkills.map((skill) => (
                <AdminTechnicianSkillRow
                  actionState={actionState}
                  key={skill.id}
                  onSave={handleSaveSkill}
                  skill={skill}
                />
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-sm leading-6 text-[var(--muted)]">
              ไม่พบทักษะที่ตรงกับตัวกรองนี้
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
