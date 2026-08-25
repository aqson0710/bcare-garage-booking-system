"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  getCurrentUserVehicles,
  updateCurrentUserVehicle,
  type Vehicle,
} from "@/features/vehicles";
import { createClient } from "@/lib/supabase/browser";

type LoadState =
  | { status: "loading"; vehicles: null; error: null; userId: null }
  | { status: "signed-out"; vehicles: null; error: null; userId: null }
  | { status: "ready"; vehicles: Vehicle[]; error: null; userId: string }
  | { status: "error"; vehicles: null; error: string; userId: null };

type VehicleFormValues = {
  brand: string;
  color: string;
  licensePlate: string;
  model: string;
  year: string;
};

type VehicleCardState =
  | { status: "view"; message: null; error: null }
  | { status: "edit"; message: null; error: null }
  | { status: "saving"; message: null; error: null }
  | { status: "saved"; message: string; error: null }
  | { status: "error"; message: null; error: string };

function getInitialValues(vehicle: Vehicle): VehicleFormValues {
  return {
    brand: vehicle.brand ?? "",
    color: vehicle.color ?? "",
    licensePlate: vehicle.license_plate,
    model: vehicle.model ?? "",
    year: vehicle.year ? String(vehicle.year) : "",
  };
}

function validateVehicle(values: VehicleFormValues) {
  if (!values.licensePlate.trim()) {
    return "Vehicle plate is required.";
  }

  if (values.year.trim()) {
    const year = Number(values.year);
    const currentYear = new Date().getFullYear() + 1;

    if (!Number.isInteger(year) || year < 1950 || year > currentYear) {
      return `Year must be between 1950 and ${currentYear}.`;
    }
  }

  return null;
}

function VehicleCard({
  customerId,
  onVehicleSaved,
  vehicle,
}: {
  customerId: string;
  onVehicleSaved: (vehicle: Vehicle) => void;
  vehicle: Vehicle;
}) {
  const [values, setValues] = useState<VehicleFormValues>(() =>
    getInitialValues(vehicle),
  );
  const [cardState, setCardState] = useState<VehicleCardState>({
    error: null,
    message: null,
    status: "view",
  });

  function updateValue(field: keyof VehicleFormValues, value: string) {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
    setCardState({
      error: null,
      message: null,
      status: "edit",
    });
  }

  function cancelEdit() {
    setValues(getInitialValues(vehicle));
    setCardState({
      error: null,
      message: null,
      status: "view",
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateVehicle(values);

    if (validationError) {
      setCardState({
        error: validationError,
        message: null,
        status: "error",
      });
      return;
    }

    setCardState({
      error: null,
      message: null,
      status: "saving",
    });

    const supabase = createClient();
    const { data, error } = await updateCurrentUserVehicle(supabase, {
      brand: values.brand,
      color: values.color,
      customerId,
      id: vehicle.id,
      licensePlate: values.licensePlate,
      model: values.model,
      year: values.year,
    });

    if (error) {
      setCardState({
        error: error.message,
        message: null,
        status: "error",
      });
      return;
    }

    onVehicleSaved(data);
    setValues(getInitialValues(data));
    setCardState({
      error: null,
      message: "Vehicle saved successfully.",
      status: "saved",
    });
  }

  const isEditing =
    cardState.status === "edit" ||
    cardState.status === "saving" ||
    cardState.status === "error";

  return (
    <article className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm">
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--brand)]">
              Vehicle
            </p>
            {isEditing ? (
              <input
                className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-xl font-bold text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                onChange={(event) =>
                  updateValue("licensePlate", event.target.value)
                }
                value={values.licensePlate}
              />
            ) : (
              <h2 className="mt-2 text-xl font-bold text-[var(--foreground)]">
                {vehicle.license_plate}
              </h2>
            )}
          </div>

          {isEditing ? (
            <div className="flex gap-2">
              <button
                className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]"
                onClick={cancelEdit}
                type="button"
              >
                Cancel
              </button>
              <button
                className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={cardState.status === "saving"}
                type="submit"
              >
                {cardState.status === "saving" ? "Saving..." : "Save"}
              </button>
            </div>
          ) : (
            <button
              className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]"
              onClick={() =>
                setCardState({
                  error: null,
                  message: null,
                  status: "edit",
                })
              }
              type="button"
            >
              Edit
            </button>
          )}
        </div>

        <div className="mt-5 grid gap-4 border-t border-[var(--line)] pt-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-[var(--foreground)]">
              Brand
              {isEditing ? (
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                  onChange={(event) => updateValue("brand", event.target.value)}
                  value={values.brand}
                />
              ) : (
                <span className="mt-1 block font-semibold">
                  {vehicle.brand ?? "-"}
                </span>
              )}
            </label>
          </div>

          <div>
            <label className="text-sm font-medium text-[var(--foreground)]">
              Model
              {isEditing ? (
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                  onChange={(event) => updateValue("model", event.target.value)}
                  value={values.model}
                />
              ) : (
                <span className="mt-1 block font-semibold">
                  {vehicle.model ?? "-"}
                </span>
              )}
            </label>
          </div>

          <div>
            <label className="text-sm font-medium text-[var(--foreground)]">
              Year
              {isEditing ? (
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                  inputMode="numeric"
                  onChange={(event) => updateValue("year", event.target.value)}
                  value={values.year}
                />
              ) : (
                <span className="mt-1 block font-semibold">
                  {vehicle.year ?? "-"}
                </span>
              )}
            </label>
          </div>

          <div>
            <label className="text-sm font-medium text-[var(--foreground)]">
              Color
              {isEditing ? (
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
                  onChange={(event) => updateValue("color", event.target.value)}
                  value={values.color}
                />
              ) : (
                <span className="mt-1 block font-semibold">
                  {vehicle.color ?? "-"}
                </span>
              )}
            </label>
          </div>
        </div>

        {cardState.status === "saved" ? (
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-[var(--brand-strong)]">
            {cardState.message}
          </div>
        ) : null}

        {cardState.status === "error" ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {cardState.error}
          </div>
        ) : null}
      </form>
    </article>
  );
}

export function MyVehiclesPanel() {
  const [loadState, setLoadState] = useState<LoadState>({
    error: null,
    status: "loading",
    userId: null,
    vehicles: null,
  });

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadVehicles() {
      setLoadState({
        error: null,
        status: "loading",
        userId: null,
        vehicles: null,
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
          status: "error",
          userId: null,
          vehicles: null,
        });
        return;
      }

      if (!session?.user) {
        setLoadState({
          error: null,
          status: "signed-out",
          userId: null,
          vehicles: null,
        });
        return;
      }

      const { data, error } = await getCurrentUserVehicles(
        supabase,
        session.user.id,
      );

      if (!isMounted) {
        return;
      }

      if (error) {
        setLoadState({
          error: error.message,
          status: "error",
          userId: null,
          vehicles: null,
        });
        return;
      }

      setLoadState({
        error: null,
        status: "ready",
        userId: session.user.id,
        vehicles: data ?? [],
      });
    }

    loadVehicles();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadVehicles();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  function handleVehicleSaved(nextVehicle: Vehicle) {
    if (loadState.status !== "ready") {
      return;
    }

    setLoadState({
      ...loadState,
      vehicles: loadState.vehicles.map((vehicle) =>
        vehicle.id === nextVehicle.id ? nextVehicle : vehicle,
      ),
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[var(--foreground)]">
              My Vehicles
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Review and update vehicles linked to your customer profile.
            </p>
          </div>
          <Link
            className="min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
            href="/"
          >
            New booking
          </Link>
        </div>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            Loading vehicles...
          </div>
        </section>
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
            <p className="font-semibold">Login required</p>
            <p className="mt-1">Sign in before viewing your vehicles.</p>
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

      {loadState.status === "ready" ? (
        <section className="py-6">
          {loadState.vehicles.length > 0 ? (
            <div className="space-y-4">
              {loadState.vehicles.map((vehicle) => (
                <VehicleCard
                  customerId={loadState.userId}
                  key={vehicle.id}
                  onVehicleSaved={handleVehicleSaved}
                  vehicle={vehicle}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-sm leading-6 text-[var(--muted)]">
              No vehicles yet. Create a booking first, then the vehicle will
              appear here.
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
