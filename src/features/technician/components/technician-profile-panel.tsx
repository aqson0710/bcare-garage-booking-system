"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  getTechnicianProfile,
  updateTechnicianProfile,
  type TechnicianProfile,
} from "@/features/technician";
import { createClient } from "@/lib/supabase/browser";

type LoadState =
  | { status: "loading"; profile: null; error: null; userId: null }
  | { status: "signed-out"; profile: null; error: null; userId: null }
  | { status: "ready"; profile: TechnicianProfile; error: null; userId: string }
  | { status: "error"; profile: null; error: string; userId: null };

type SaveState =
  | { status: "idle"; error: null; message: null }
  | { status: "saving"; error: null; message: null }
  | { status: "success"; error: null; message: string }
  | { status: "error"; error: string; message: null };

function getSelectedSkillNames(profile: TechnicianProfile) {
  const selectedSkillIds = new Set(profile.selectedSkillIds);
  return profile.skills
    .filter((skill) => selectedSkillIds.has(skill.id))
    .map((skill) => skill.name);
}

export function TechnicianProfilePanel() {
  const [loadState, setLoadState] = useState<LoadState>({
    error: null,
    profile: null,
    status: "loading",
    userId: null,
  });
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [technicianSpecialty, setTechnicianSpecialty] = useState("");
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [saveState, setSaveState] = useState<SaveState>({
    error: null,
    message: null,
    status: "idle",
  });

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadProfile() {
      setLoadState({
        error: null,
        profile: null,
        status: "loading",
        userId: null,
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
          error: sessionError.message,
          profile: null,
          status: "error",
          userId: null,
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          error: null,
          profile: null,
          status: "signed-out",
          userId: null,
        });
        return;
      }

      const { data, error } = await getTechnicianProfile(
        supabase,
        session.user.id,
      );

      if (!isMounted) {
        return;
      }

      if (error) {
        setLoadState({
          error: error.message,
          profile: null,
          status: "error",
          userId: null,
        });
        return;
      }

      if (data?.profile) {
        setFullName(data.profile.full_name);
        setPhoneNumber(data.profile.phone_number);
        setTechnicianSpecialty(data.profile.technician_specialty ?? "");
      }

      setSelectedSkillIds(data?.selectedSkillIds ?? []);
      setLoadState({
        error: null,
        profile: data,
        status: "ready",
        userId: session.user.id,
      });
    }

    loadProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadProfile();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const selectedSkillNames = useMemo(() => {
    if (loadState.status !== "ready") {
      return [];
    }

    return getSelectedSkillNames({
      ...loadState.profile,
      selectedSkillIds,
    });
  }, [loadState, selectedSkillIds]);

  function toggleSkill(skillId: string) {
    setSelectedSkillIds((currentSkillIds) =>
      currentSkillIds.includes(skillId)
        ? currentSkillIds.filter((currentSkillId) => currentSkillId !== skillId)
        : [...currentSkillIds, skillId],
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loadState.status !== "ready" || !loadState.profile.allowed) {
      return;
    }

    if (!fullName.trim()) {
      setSaveState({
        error: "Full name is required.",
        message: null,
        status: "error",
      });
      return;
    }

    if (!phoneNumber.trim()) {
      setSaveState({
        error: "Phone number is required.",
        message: null,
        status: "error",
      });
      return;
    }

    setSaveState({
      error: null,
      message: null,
      status: "saving",
    });

    const supabase = createClient();
    const { data, error } = await updateTechnicianProfile(supabase, {
      fullName: fullName.trim(),
      phoneNumber: phoneNumber.trim(),
      selectedSkillIds,
      technicianSpecialty: technicianSpecialty.trim() || null,
      userId: loadState.userId,
    });

    if (error) {
      setSaveState({
        error: error.message,
        message: null,
        status: "error",
      });
      return;
    }

    if (data?.profile) {
      setFullName(data.profile.full_name);
      setPhoneNumber(data.profile.phone_number);
      setTechnicianSpecialty(data.profile.technician_specialty ?? "");
    }

    setSelectedSkillIds(data?.selectedSkillIds ?? []);
    setLoadState({
      ...loadState,
      profile: data,
    });
    setSaveState({
      error: null,
      message: "Technician profile saved.",
      status: "success",
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-8">
      <header className="border-b border-[var(--line)] pb-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--brand)]">
            BCare
          </p>
          <AppNav />
        </div>
        <h1 className="text-3xl font-bold text-[var(--foreground)]">
          Technician Profile
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          Keep mechanic contact details and repair skills ready for admin
          assignment.
        </p>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            Loading technician profile...
          </div>
        </section>
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
            <p className="font-semibold">Login required</p>
            <p className="mt-1">Sign in with a technician account.</p>
            <Link
              className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
              href="/auth"
            >
              Go to account
            </Link>
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

      {loadState.status === "ready" && !loadState.profile.allowed ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-700">
            <p className="text-lg font-bold">Access denied</p>
            <p className="mt-2">{loadState.profile.reason}</p>
          </div>
        </section>
      ) : null}

      {loadState.status === "ready" && loadState.profile.allowed ? (
        <form
          className="grid gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_320px]"
          onSubmit={handleSubmit}
        >
          <section className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-[var(--brand)]">
              Profile
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-[var(--foreground)]">
                Full name
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                  onChange={(event) => setFullName(event.target.value)}
                  value={fullName}
                />
              </label>
              <label className="text-sm font-medium text-[var(--foreground)]">
                Phone number
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                  inputMode="tel"
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  value={phoneNumber}
                />
              </label>
              <label className="text-sm font-medium text-[var(--foreground)] sm:col-span-2">
                Short specialty label
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                  onChange={(event) =>
                    setTechnicianSpecialty(event.target.value)
                  }
                  placeholder="Example: Electrical and diagnostics"
                  value={technicianSpecialty}
                />
              </label>
            </div>

            <div className="mt-5 rounded-md bg-slate-50 p-3 text-sm leading-6 text-[var(--muted)]">
              <p>
                Email:{" "}
                <span className="font-semibold text-[var(--foreground)]">
                  {loadState.profile.profile.email ?? "-"}
                </span>
              </p>
              <p>
                Role:{" "}
                <span className="font-semibold text-[var(--foreground)]">
                  {loadState.profile.profile.role}
                </span>
              </p>
            </div>

            <section className="mt-6 border-t border-[var(--line)] pt-5">
              <p className="text-sm font-semibold text-[var(--brand)]">
                Skills
              </p>
              {loadState.profile.skills.length > 0 ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {loadState.profile.skills.map((skill) => (
                    <label
                      className="flex min-h-12 items-start gap-3 rounded-md border border-[var(--line)] bg-white p-3 text-sm text-[var(--foreground)]"
                      key={skill.id}
                    >
                      <input
                        checked={selectedSkillIds.includes(skill.id)}
                        className="mt-1 h-4 w-4 accent-[var(--brand)]"
                        onChange={() => toggleSkill(skill.id)}
                        type="checkbox"
                      />
                      <span>
                        <span className="font-semibold">{skill.name}</span>
                        {skill.description ? (
                          <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                            {skill.description}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  No active technician skills found.
                </div>
              )}
            </section>

            <button
              className="mt-6 min-h-11 w-full rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saveState.status === "saving"}
              type="submit"
            >
              {saveState.status === "saving" ? "Saving..." : "Save profile"}
            </button>

            {saveState.status === "success" ? (
              <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-[var(--brand-strong)]">
                {saveState.message}
              </div>
            ) : null}

            {saveState.status === "error" ? (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {saveState.error}
              </div>
            ) : null}
          </section>

          <aside className="h-fit rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-[var(--brand)]">
              Selected skills
            </p>
            {selectedSkillNames.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedSkillNames.map((skillName) => (
                  <span
                    className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-[var(--brand-strong)]"
                    key={skillName}
                  >
                    {skillName}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
                No skills selected yet.
              </p>
            )}
          </aside>
        </form>
      ) : null}
    </main>
  );
}
