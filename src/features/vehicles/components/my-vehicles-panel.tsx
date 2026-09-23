"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  deleteCurrentUserVehicle,
  getCurrentUserVehicles,
  updateCurrentUserVehicle,
  updateCurrentUserVehicleImage,
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

type UploadState =
  | { status: "idle"; message: null; error: null }
  | { status: "uploading"; message: null; error: null }
  | { status: "uploaded"; message: string; error: null }
  | { status: "error"; message: null; error: string };

type DeleteState =
  | { status: "idle"; error: null }
  | { status: "deleting"; error: null }
  | { status: "error"; error: string };

const vehicleImagesBucket = "vehicle-images";

function getFileExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "jpg" || extension === "jpeg") {
    return "jpg";
  }

  if (extension === "png" || extension === "webp") {
    return extension;
  }

  return "jpg";
}

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
    return "กรุณากรอกทะเบียนรถ";
  }

  if (values.year.trim()) {
    const year = Number(values.year);
    const currentYear = new Date().getFullYear() + 1;

    if (!Number.isInteger(year) || year < 1950 || year > currentYear) {
      return `ปีรถต้องอยู่ระหว่าง 1950 ถึง ${currentYear}`;
    }
  }

  return null;
}

function VehicleCard({
  customerId,
  onVehicleDeleted,
  onVehicleSaved,
  vehicle,
}: {
  customerId: string;
  onVehicleDeleted: (vehicleId: string) => void;
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
  const [uploadState, setUploadState] = useState<UploadState>({
    error: null,
    message: null,
    status: "idle",
  });
  const [deleteState, setDeleteState] = useState<DeleteState>({
    error: null,
    status: "idle",
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
      message: "บันทึกข้อมูลรถเรียบร้อยแล้ว",
      status: "saved",
    });
  }

  async function handleImageUpload(file: File | null) {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setUploadState({
        error: "กรุณาเลือกรูปภาพเท่านั้น",
        message: null,
        status: "error",
      });
      return;
    }

    setUploadState({
      error: null,
      message: null,
      status: "uploading",
    });

    const supabase = createClient();
    const extension = getFileExtension(file);
    const uploadPath = `${customerId}/${vehicle.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const uploadResult = await supabase.storage
      .from(vehicleImagesBucket)
      .upload(uploadPath, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });

    if (uploadResult.error) {
      setUploadState({
        error:
          uploadResult.error.message.includes("Bucket not found") ||
          uploadResult.error.message.includes("bucket")
            ? "ยังไม่มี bucket vehicle-images กรุณารันไฟล์ supabase/vehicle-image-upload.sql ก่อน"
            : uploadResult.error.message,
        message: null,
        status: "error",
      });
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(vehicleImagesBucket).getPublicUrl(uploadPath);

    const { data, error } = await updateCurrentUserVehicleImage(supabase, {
      customerId,
      id: vehicle.id,
      imageUrl: publicUrl,
    });

    if (error) {
      setUploadState({
        error: error.message,
        message: null,
        status: "error",
      });
      return;
    }

    onVehicleSaved(data);
    setUploadState({
      error: null,
      message: "อัปโหลดและบันทึกรูปรถเรียบร้อยแล้ว",
      status: "uploaded",
    });
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `ต้องการลบรถทะเบียน "${vehicle.license_plate}" ออกจากบัญชีของคุณใช่หรือไม่ ทำแล้วกู้คืนไม่ได้`,
    );

    if (!confirmed) {
      return;
    }

    setDeleteState({
      error: null,
      status: "deleting",
    });

    const supabase = createClient();
    const { error } = await deleteCurrentUserVehicle(supabase, {
      customerId,
      id: vehicle.id,
    });

    if (error) {
      setDeleteState({
        error: error.message,
        status: "error",
      });
      return;
    }

    onVehicleDeleted(vehicle.id);
  }

  const isEditing =
    cardState.status === "edit" ||
    cardState.status === "saving" ||
    cardState.status === "error";
  const isDeleting = deleteState.status === "deleting";

  return (
    <article className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
      <form onSubmit={handleSubmit}>
        <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div>
            {vehicle.image_url ? (
              <img
                alt={`รูปรถทะเบียน ${vehicle.license_plate}`}
                className="h-40 w-full rounded-md border border-[var(--line)] bg-[var(--surface-muted)] object-cover"
                src={vehicle.image_url}
              />
            ) : (
              <div className="grid h-40 w-full place-items-center rounded-md border border-dashed border-[var(--line)] bg-[var(--surface-muted)] px-4 text-center text-sm leading-6 text-[var(--muted)]">
                ยังไม่มีรูปรถ
              </div>
            )}

            <label className="mt-3 inline-flex min-h-10 w-full cursor-pointer items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--brand)]">
              {uploadState.status === "uploading"
                ? "กำลังอัปโหลด..."
                : "อัปโหลดรูปรถ"}
              <input
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                disabled={uploadState.status === "uploading"}
                onChange={(event) => {
                  void handleImageUpload(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
                type="file"
              />
            </label>

            {uploadState.status === "uploaded" ? (
              <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-[var(--brand-strong)]">
                {uploadState.message}
              </p>
            ) : null}

            {uploadState.status === "error" ? (
              <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                {uploadState.error}
              </p>
            ) : null}
          </div>

          <div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--brand)]">
                  รถของลูกค้า
                </p>
                {isEditing ? (
                  <input
                    className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-xl font-bold text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
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
                    className="min-h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--muted)]"
                    onClick={cancelEdit}
                    type="button"
                  >
                    ยกเลิก
                  </button>
                  <button
                    className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={cardState.status === "saving"}
                    type="submit"
                  >
                    {cardState.status === "saving"
                      ? "กำลังบันทึก..."
                      : "บันทึก"}
                  </button>
                </div>
              ) : (
              <div className="flex gap-2">
                <button
                  className="min-h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--muted)]"
                  onClick={() =>
                    setCardState({
                      error: null,
                      message: null,
                      status: "edit",
                    })
                  }
                  type="button"
                >
                  แก้ไข
                </button>
                <button
                  className="min-h-10 rounded-md border border-red-200 bg-[var(--surface)] px-4 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isDeleting}
                  onClick={handleDelete}
                  type="button"
                >
                  {isDeleting ? "กำลังลบ..." : "ลบรถ"}
                </button>
              </div>
              )}
            </div>

        <div className="mt-5 grid gap-4 border-t border-[var(--line)] pt-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-[var(--foreground)]">
              ยี่ห้อรถ
              {isEditing ? (
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
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
              รุ่นรถ
              {isEditing ? (
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
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
              ปีรถ
              {isEditing ? (
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
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
              สีรถ
              {isEditing ? (
                <input
                  className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
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

        {deleteState.status === "error" ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {deleteState.error}
          </div>
        ) : null}
          </div>
        </div>
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

  function handleVehicleDeleted(vehicleId: string) {
    if (loadState.status !== "ready") {
      return;
    }

    setLoadState({
      ...loadState,
      vehicles: loadState.vehicles.filter(
        (vehicle) => vehicle.id !== vehicleId,
      ),
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 pb-8 pt-0">
      <header className="border-b border-[var(--line)] pb-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AppNav />
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[var(--foreground)]">
              รถของฉัน
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              ตรวจสอบและแก้ไขข้อมูลรถที่เชื่อมกับโปรไฟล์ลูกค้าของคุณ
            </p>
          </div>
          <Link
            className="min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
            href="/services"
          >
            จองบริการใหม่
          </Link>
        </div>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดข้อมูลรถ...
          </div>
        </section>
      ) : null}

      {loadState.status === "signed-out" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
            <p className="font-semibold">ต้องเข้าสู่ระบบ</p>
            <p className="mt-1">กรุณาเข้าสู่ระบบก่อนดูข้อมูลรถของคุณ</p>
            <Link
              className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
              href="/auth"
            >
              ไปที่บัญชี
            </Link>
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
          {loadState.vehicles.length > 0 ? (
            <div className="space-y-4">
              {loadState.vehicles.map((vehicle) => (
                <VehicleCard
                  customerId={loadState.userId}
                  key={vehicle.id}
                  onVehicleDeleted={handleVehicleDeleted}
                  onVehicleSaved={handleVehicleSaved}
                  vehicle={vehicle}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] p-6 text-sm leading-6 text-[var(--muted)]">
              ยังไม่มีข้อมูลรถ เริ่มจองบริการก่อน แล้วข้อมูลรถจะมาแสดงที่นี่
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
