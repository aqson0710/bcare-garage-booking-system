"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import type { SyntheticEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AppNav } from "@/components/app-nav";
import { getCurrentProfile, type Profile } from "@/features/auth";
import {
  createAuthenticatedBooking,
  getBookingOperatingStatus,
  getBookingSlotAvailabilities,
  type Booking,
  type BookingOperatingStatus,
  type BookingSlotAvailability,
} from "@/features/bookings";
import { createClient } from "@/lib/supabase/browser";
import {
  getServicesWithCategories,
  type Service,
  type ServiceCategoryWithServices,
} from "@/features/services";

type LoadState =
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: ServiceCategoryWithServices[]; error: null }
  | { status: "error"; data: null; error: string };

type BookingFormValues = {
  customerName: string;
  phoneNumber: string;
  vehiclePlate: string;
  preferredDate: string;
  preferredTime: string;
  note: string;
};

type BookingFormErrors = Partial<
  Record<keyof Omit<BookingFormValues, "note">, string>
>;

type BookingSubmitState =
  | { status: "idle"; booking: null; error: null }
  | { status: "submitting"; booking: null; error: null }
  | {
      status: "success";
      booking: Booking;
      error: null;
      vehicleWasReused: boolean;
    }
  | { status: "error"; booking: null; error: string };

type AuthBookingState =
  | { status: "loading"; user: null; profile: null; error: null }
  | { status: "signed-out"; user: null; profile: null; error: null }
  | { status: "missing-profile"; user: User; profile: null; error: null }
  | { status: "ready"; user: User; profile: Profile; error: null }
  | { status: "error"; user: null; profile: null; error: string };

type AvailabilityState =
  | { status: "idle"; slots: null; operatingStatus: null; error: null }
  | { status: "loading"; slots: null; operatingStatus: null; error: null }
  | {
      status: "ready";
      slots: BookingSlotAvailability[];
      operatingStatus: BookingOperatingStatus | null;
      error: null;
    }
  | { status: "error"; slots: null; operatingStatus: null; error: string };

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});
const serviceImagePlaceholder = "/service-placeholder.svg";
const bookingStartTime = "09:00";
const bookingEndTime = "18:00";
const bookingSlotIntervalMinutes = 30;

function formatDuration(minutes: number) {
  if (minutes < 60) {
    return `${minutes} นาที`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0
    ? `${hours} ชม. ${remainingMinutes} นาที`
    : `${hours} ชม.`;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toTimeValue(date: Date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
}

function minutesToTime(minutes: number) {
  const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
  const remainingMinutes = String(minutes % 60).padStart(2, "0");

  return `${hours}:${remainingMinutes}`;
}

function getBookingTimeOptions(selectedDate: string, today: string, now: Date) {
  const startMinutes = timeToMinutes(bookingStartTime);
  const endMinutes = timeToMinutes(bookingEndTime);
  const currentMinutes = timeToMinutes(toTimeValue(now));

  return Array.from(
    {
      length:
        Math.floor((endMinutes - startMinutes) / bookingSlotIntervalMinutes) +
        1,
    },
    (_, index) => startMinutes + index * bookingSlotIntervalMinutes,
  )
    .map(minutesToTime)
    .filter((time) => {
      if (selectedDate !== today) {
        return true;
      }

      return timeToMinutes(time) > currentMinutes;
    });
}

function isBookingTimeWithinBusinessHours(time: string) {
  const minutes = timeToMinutes(time);

  return (
    minutes >= timeToMinutes(bookingStartTime) &&
    minutes <= timeToMinutes(bookingEndTime)
  );
}

function isBookingDateTimeInPast(date: string, time: string) {
  const bookingDateTime = new Date(`${date}T${time}`);

  if (Number.isNaN(bookingDateTime.getTime())) {
    return false;
  }

  return bookingDateTime.getTime() < Date.now();
}

function getBookingErrorMessage(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("bcare booking slot is full")) {
    return "เวลานี้คิวเต็มแล้ว กรุณาเลือกเวลาอื่น";
  }

  if (normalizedMessage.includes("bcare booking slot is closed")) {
    return "เวลานี้ปิดรับจองแล้ว กรุณาเลือกเวลาอื่น";
  }

  if (normalizedMessage.includes("shop is closed")) {
    return "ร้านปิดในวันที่เลือก กรุณาเลือกวันอื่น";
  }

  if (normalizedMessage.includes("outside operating hours")) {
    return "เวลานี้อยู่นอกเวลาทำการ กรุณาเลือกเวลาอื่น";
  }

  if (normalizedMessage.includes("outside business hours")) {
    return "เวลาจองต้องอยู่ระหว่าง 09:00 ถึง 18:00";
  }

  if (normalizedMessage.includes("09:00 to 18:00")) {
    return "เวลาจองต้องอยู่ระหว่าง 09:00 ถึง 18:00";
  }

  if (normalizedMessage.includes("row-level security")) {
    return "ระบบฐานข้อมูลไม่อนุญาตให้บันทึกการจองนี้ กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง";
  }

  if (normalizedMessage.includes("get_garage_slot_availability")) {
    return "ระบบตรวจเวลาว่างยังไม่พร้อมใช้งาน กรุณาให้ผู้ดูแลรัน SQL ของ Step 10 Part 1 ก่อน";
  }

  if (normalizedMessage.includes("get_garage_operating_status")) {
    return "ระบบตรวจวันเปิดร้านยังไม่พร้อมใช้งาน กรุณาให้ผู้ดูแลรัน SQL ของ Step 10 Part 5.1 ก่อน";
  }

  if (normalizedMessage.includes("not-null constraint")) {
    return "ข้อมูลที่จำเป็นบางส่วนยังไม่ครบ กรุณาตรวจฟอร์มแล้วลองอีกครั้ง";
  }

  return message;
}

function getClosedDayMessage(operatingStatus: BookingOperatingStatus | null) {
  if (!operatingStatus) {
    return "ร้านปิดในวันที่เลือก กรุณาเลือกวันอื่น";
  }

  if (operatingStatus.isSpecialClosed) {
    return `ร้านปิดในวันที่เลือก: ${operatingStatus.closedReason ?? "วันหยุดพิเศษ"}`;
  }

  return operatingStatus.note
    ? `ร้านปิดในวันที่เลือก: ${operatingStatus.note}`
    : "ร้านปิดในวันที่เลือก กรุณาเลือกวันอื่น";
}

function handleServiceImageError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;

  if (image.src.endsWith(serviceImagePlaceholder)) {
    return;
  }

  image.src = serviceImagePlaceholder;
  image.alt = "Service image placeholder";
}

function ServiceImage({
  className,
  imageUrl,
  label,
}: {
  className: string;
  imageUrl: string | null;
  label: string;
}) {
  return (
    <img
      alt={label}
      className={className}
      onError={handleServiceImageError}
      src={imageUrl || serviceImagePlaceholder}
    />
  );
}

function getServicesCount(categories: ServiceCategoryWithServices[]) {
  return categories.reduce(
    (total, category) => total + category.services.length,
    0,
  );
}

function findSelectedService(
  categories: ServiceCategoryWithServices[],
  selectedServiceId: string | null,
) {
  if (!selectedServiceId) {
    return null;
  }

  return (
    categories
      .flatMap((category) => category.services)
      .find((service) => service.id === selectedServiceId) ?? null
  );
}

function ServiceCard({
  isSelected,
  onSelect,
  service,
}: {
  isSelected: boolean;
  onSelect: () => void;
  service: Service;
}) {
  return (
    <article
      className={
        isSelected
          ? "flex min-h-80 flex-col justify-between overflow-hidden rounded-lg border-2 border-[var(--brand)] bg-white shadow-sm"
          : "flex min-h-80 flex-col justify-between overflow-hidden rounded-lg border border-[var(--line)] bg-white shadow-sm"
      }
    >
      <ServiceImage
        className="h-40 w-full bg-slate-50 object-cover"
        imageUrl={service.image_url}
        label={`${service.name} image`}
      />

      <div className="p-5 pb-0">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-lg font-semibold leading-6 text-[var(--foreground)]">
            {service.name}
          </h3>
          <span className="shrink-0 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-[var(--brand-strong)]">
            {service.status === "active" ? "เปิดให้บริการ" : "ปิดให้บริการ"}
          </span>
        </div>
        {service.description ? (
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            {service.description}
          </p>
        ) : null}
      </div>

      <dl className="mx-5 mt-5 grid grid-cols-2 gap-3 border-t border-[var(--line)] pt-4 text-sm">
        <div>
          <dt className="text-[var(--muted)]">ราคาเริ่มต้น</dt>
          <dd className="mt-1 font-semibold text-[var(--foreground)]">
            {currencyFormatter.format(service.base_price)}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--muted)]">เวลาโดยประมาณ</dt>
          <dd className="mt-1 font-semibold text-[var(--foreground)]">
            {formatDuration(service.estimated_duration_minutes)}
          </dd>
        </div>
      </dl>

      <button
        className={
          isSelected
            ? "mx-5 mb-5 mt-5 min-h-10 rounded-md border border-[var(--brand)] bg-emerald-50 px-3 text-sm font-semibold text-[var(--brand-strong)]"
            : "mx-5 mb-5 mt-5 min-h-10 rounded-md bg-[var(--brand)] px-3 text-sm font-semibold text-white"
        }
        onClick={onSelect}
        type="button"
      >
        {isSelected ? "เลือกแล้ว" : "เลือกบริการนี้"}
      </button>
    </article>
  );
}

function getInitialBookingValues(profile: Profile | null): BookingFormValues {
  return {
    customerName: profile?.full_name ?? "",
    note: "",
    phoneNumber: profile?.phone_number ?? "",
    preferredDate: "",
    preferredTime: "",
    vehiclePlate: "",
  };
}

function BookingForm({
  authState,
  service,
}: {
  authState: AuthBookingState;
  service: Service;
}) {
  const [values, setValues] = useState<BookingFormValues>(() =>
    authState.status === "ready"
      ? getInitialBookingValues(authState.profile)
      : getInitialBookingValues(null),
  );
  const [errors, setErrors] = useState<BookingFormErrors>({});
  const [submitState, setSubmitState] = useState<BookingSubmitState>({
    booking: null,
    error: null,
    status: "idle",
  });
  const [availabilityState, setAvailabilityState] =
    useState<AvailabilityState>({
      error: null,
      operatingStatus: null,
      slots: null,
      status: "idle",
    });
  const now = new Date();
  const todayInputValue = toDateInputValue(now);
  const baseBookingTimeOptions = getBookingTimeOptions(
    values.preferredDate,
    todayInputValue,
    now,
  );
  const availableSlotsByTime = useMemo(() => {
    if (availabilityState.status !== "ready") {
      return new Map<string, BookingSlotAvailability>();
    }

    return new Map(
      availabilityState.slots.map((slot) => [slot.bookingTime, slot]),
    );
  }, [availabilityState]);
  const bookingTimeOptions =
    availabilityState.status === "ready"
      ? baseBookingTimeOptions.filter(
          (time) => availableSlotsByTime.get(time)?.isOpen,
        )
      : [];

  useEffect(() => {
    let isMounted = true;

    async function loadAvailability() {
      if (authState.status !== "ready" || !values.preferredDate) {
        setAvailabilityState({
          error: null,
          operatingStatus: null,
          slots: null,
          status: "idle",
        });
        return;
      }

      const currentNow = new Date();
      const nextTimeOptions = getBookingTimeOptions(
        values.preferredDate,
        toDateInputValue(currentNow),
        currentNow,
      );

      if (nextTimeOptions.length === 0) {
        setAvailabilityState({
          error: null,
          operatingStatus: null,
          slots: [],
          status: "ready",
        });
        return;
      }

      setAvailabilityState({
        error: null,
        operatingStatus: null,
        slots: null,
        status: "loading",
      });

      const supabase = createClient();
      const operatingStatusResult = await getBookingOperatingStatus(
        supabase,
        values.preferredDate,
      );

      if (!isMounted) {
        return;
      }

      if (operatingStatusResult.error) {
        setAvailabilityState({
          error: getBookingErrorMessage(operatingStatusResult.error.message),
          operatingStatus: null,
          slots: null,
          status: "error",
        });
        return;
      }

      if (
        operatingStatusResult.data &&
        !operatingStatusResult.data.isOpen
      ) {
        setAvailabilityState({
          error: null,
          operatingStatus: operatingStatusResult.data,
          slots: [],
          status: "ready",
        });
        return;
      }

      const { data, error } = await getBookingSlotAvailabilities(
        supabase,
        values.preferredDate,
        nextTimeOptions,
      );

      if (!isMounted) {
        return;
      }

      if (error) {
        setAvailabilityState({
          error: getBookingErrorMessage(error.message),
          operatingStatus: null,
          slots: null,
          status: "error",
        });
        return;
      }

      setAvailabilityState({
        error: null,
        operatingStatus: operatingStatusResult.data,
        slots: data ?? [],
        status: "ready",
      });
    }

    loadAvailability();

    return () => {
      isMounted = false;
    };
  }, [authState.status, values.preferredDate]);

  if (authState.status === "loading") {
    return (
      <div className="mt-5 rounded-lg border border-[var(--line)] bg-slate-50 p-4 text-sm text-[var(--muted)]">
        กำลังตรวจสอบสถานะเข้าสู่ระบบ...
      </div>
    );
  }

  if (authState.status === "signed-out") {
    return (
      <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
        <p className="font-semibold">ต้องเข้าสู่ระบบก่อน</p>
        <p className="mt-1">กรุณาเข้าสู่ระบบหรือสมัครสมาชิกก่อนสร้างการจอง</p>
        <Link
          className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
          href="/auth"
        >
          ไปหน้าเข้าสู่ระบบ
        </Link>
      </div>
    );
  }

  if (authState.status === "missing-profile") {
    return (
      <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
        <p className="font-semibold">ต้องมีโปรไฟล์ลูกค้าก่อน</p>
        <p className="mt-1">
          กรุณาบันทึกโปรไฟล์ลูกค้าก่อนสร้างการจอง
        </p>
        <Link
          className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
          href="/auth"
        >
          กรอกโปรไฟล์
        </Link>
      </div>
    );
  }

  if (authState.status === "error") {
    return (
      <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
        {authState.error}
      </div>
    );
  }

  function updateValue(field: keyof BookingFormValues, value: string) {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
    setSubmitState({
      booking: null,
      error: null,
      status: "idle",
    });
  }

  function validateForm() {
    const nextErrors: BookingFormErrors = {};

    if (!values.customerName.trim()) {
      nextErrors.customerName = "กรุณากรอกชื่อลูกค้า";
    }

    if (!values.phoneNumber.trim()) {
      nextErrors.phoneNumber = "กรุณากรอกเบอร์โทร";
    }

    if (!values.vehiclePlate.trim()) {
      nextErrors.vehiclePlate = "กรุณากรอกทะเบียนรถ";
    }

    if (!values.preferredDate) {
      nextErrors.preferredDate = "กรุณาเลือกวันที่ต้องการจอง";
    }

    if (
      values.preferredDate &&
      availabilityState.status === "ready" &&
      availabilityState.operatingStatus &&
      !availabilityState.operatingStatus.isOpen
    ) {
      nextErrors.preferredTime = getClosedDayMessage(
        availabilityState.operatingStatus,
      );
    }

    if (!values.preferredTime && !nextErrors.preferredTime) {
      nextErrors.preferredTime = "กรุณาเลือกเวลาที่ต้องการจอง";
    }

    if (values.preferredDate && availabilityState.status === "loading") {
      nextErrors.preferredTime = "กำลังตรวจสอบเวลาว่าง";
    }

    if (values.preferredDate && availabilityState.status === "error") {
      nextErrors.preferredTime = availabilityState.error;
    }

    if (
      values.preferredTime &&
      !isBookingTimeWithinBusinessHours(values.preferredTime)
    ) {
      nextErrors.preferredTime = "กรุณาเลือกเวลาระหว่าง 09:00 ถึง 18:00";
    }

    if (
      values.preferredDate &&
      values.preferredTime &&
      isBookingDateTimeInPast(values.preferredDate, values.preferredTime)
    ) {
      nextErrors.preferredTime = "วันและเวลาจองต้องเป็นเวลาในอนาคต";
    }

    if (
      values.preferredTime &&
      availabilityState.status === "ready" &&
      !bookingTimeOptions.includes(values.preferredTime)
    ) {
      nextErrors.preferredTime =
        "เวลานี้ไม่ว่างแล้ว กรุณาเลือกเวลาอื่น";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validateForm()) {
      setSubmitState({
        booking: null,
        error: null,
        status: "idle",
      });
      return;
    }

    if (authState.status !== "ready") {
      setSubmitState({
        booking: null,
        error: "กรุณาเข้าสู่ระบบและบันทึกโปรไฟล์ก่อนส่งคำขอจอง",
        status: "error",
      });
      return;
    }

    setSubmitState({
      booking: null,
      error: null,
      status: "submitting",
    });

    const supabase = createClient();
    const { data, error } = await createAuthenticatedBooking(supabase, {
      customerId: authState.profile.id,
      note: values.note.trim(),
      preferredDate: values.preferredDate,
      preferredTime: values.preferredTime,
      serviceId: service.id,
      vehiclePlate: values.vehiclePlate.trim(),
    });

    if (error) {
      setSubmitState({
        booking: null,
        error: getBookingErrorMessage(error.message),
        status: "error",
      });
      return;
    }

    setSubmitState({
      booking: data.booking,
      error: null,
      status: "success",
      vehicleWasReused: data.vehicleWasReused,
    });
  }

  const isSubmitDisabled =
    submitState.status === "submitting" || submitState.status === "success";
  const submitLabel =
    submitState.status === "success"
      ? "บันทึกการจองแล้ว"
      : submitState.status === "submitting"
        ? "กำลังบันทึกการจอง..."
        : "ส่งคำขอจอง";

  return (
    <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
      <button
        className="min-h-11 w-full rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitDisabled}
        type="submit"
      >
        {submitLabel}
      </button>
      <p className="text-xs leading-5 text-[var(--muted)]">
        กรอกข้อมูลการจองด้านล่างให้ครบ แล้วกดส่งคำขอจองได้จากปุ่มนี้
      </p>

      <div>
        <label
          className="text-sm font-medium text-[var(--foreground)]"
          htmlFor="customerName"
        >
          ชื่อลูกค้า
        </label>
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-slate-50 px-3 text-sm text-[var(--foreground)] outline-none"
          id="customerName"
          readOnly
          value={values.customerName}
        />
        {errors.customerName ? (
          <p className="mt-1 text-xs text-red-700">{errors.customerName}</p>
        ) : null}
      </div>

      <div>
        <label
          className="text-sm font-medium text-[var(--foreground)]"
          htmlFor="phoneNumber"
        >
          เบอร์โทร
        </label>
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-slate-50 px-3 text-sm text-[var(--foreground)] outline-none"
          id="phoneNumber"
          inputMode="tel"
          readOnly
          value={values.phoneNumber}
        />
        {errors.phoneNumber ? (
          <p className="mt-1 text-xs text-red-700">{errors.phoneNumber}</p>
        ) : null}
      </div>

      <div>
        <label
          className="text-sm font-medium text-[var(--foreground)]"
          htmlFor="vehiclePlate"
        >
          ทะเบียนรถ
        </label>
        <input
          className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
          id="vehiclePlate"
          onChange={(event) => updateValue("vehiclePlate", event.target.value)}
          value={values.vehiclePlate}
        />
        {errors.vehiclePlate ? (
          <p className="mt-1 text-xs text-red-700">{errors.vehiclePlate}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            className="text-sm font-medium text-[var(--foreground)]"
            htmlFor="preferredDate"
          >
            วันที่
          </label>
          <input
            className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            id="preferredDate"
            min={todayInputValue}
            onChange={(event) => {
              updateValue("preferredDate", event.target.value);

              if (values.preferredTime) {
                updateValue("preferredTime", "");
              }
            }}
            type="date"
            value={values.preferredDate}
          />
          {errors.preferredDate ? (
            <p className="mt-1 text-xs text-red-700">{errors.preferredDate}</p>
          ) : null}
        </div>

        <div>
          <label
            className="text-sm font-medium text-[var(--foreground)]"
            htmlFor="preferredTime"
          >
            เวลา
          </label>
          <select
            className="mt-2 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
            id="preferredTime"
            disabled={
              !values.preferredDate ||
              availabilityState.status === "loading" ||
              availabilityState.status === "error" ||
              bookingTimeOptions.length === 0
            }
            onChange={(event) =>
              updateValue("preferredTime", event.target.value)
            }
            value={values.preferredTime}
          >
            <option value="">
              {!values.preferredDate
                ? "เลือกวันที่ก่อน"
                : availabilityState.status === "loading"
                  ? "กำลังตรวจสอบเวลาว่าง"
                  : availabilityState.status === "ready" &&
                      availabilityState.operatingStatus &&
                      !availabilityState.operatingStatus.isOpen
                    ? "ร้านปิดวันนี้"
                  : "เลือกเวลา"}
            </option>
            {bookingTimeOptions.map((time) => (
              <option key={time} value={time}>
                {time}
                {availableSlotsByTime.has(time)
                  ? ` (เหลือ ${availableSlotsByTime.get(time)?.availableBookingCount} คิว)`
                  : ""}
              </option>
            ))}
          </select>
          {values.preferredDate && availabilityState.status === "loading" ? (
            <p className="mt-1 text-xs text-[var(--muted)]">
              กำลังตรวจสอบเวลาที่จองได้
            </p>
          ) : null}
          {values.preferredDate && availabilityState.status === "error" ? (
            <p className="mt-1 text-xs text-red-700">
              {availabilityState.error}
            </p>
          ) : null}
          {values.preferredDate &&
          availabilityState.status === "ready" &&
          bookingTimeOptions.length === 0 ? (
            <p className="mt-1 text-xs text-amber-700">
              {availabilityState.operatingStatus &&
              !availabilityState.operatingStatus.isOpen
                ? getClosedDayMessage(availabilityState.operatingStatus)
                : "วันนี้ไม่มีเวลาว่างให้จองแล้ว"}
            </p>
          ) : null}
          {!values.preferredDate || availabilityState.status === "idle" ? (
            <p className="mt-1 text-xs text-[var(--muted)]">
              เลือกวันที่เพื่อดูเวลาที่จองได้ระหว่าง 09:00 ถึง 18:00
            </p>
          ) : null}
          {availabilityState.status === "ready" &&
          bookingTimeOptions.length > 0 ? (
            <p className="mt-1 text-xs text-[var(--muted)]">
              แสดงเฉพาะเวลาที่ยังเปิดรับและยังมีคิวว่าง
            </p>
          ) : null}
          {errors.preferredTime ? (
            <p className="mt-1 text-xs text-red-700">{errors.preferredTime}</p>
          ) : null}
        </div>
      </div>

      <div>
        <label
          className="text-sm font-medium text-[var(--foreground)]"
          htmlFor="note"
        >
          หมายเหตุ
        </label>
        <textarea
          className="mt-2 min-h-24 w-full resize-y rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--brand)]"
          id="note"
          onChange={(event) => updateValue("note", event.target.value)}
          value={values.note}
        />
      </div>

      <button
        className="min-h-11 w-full rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitDisabled}
        type="submit"
      >
        {submitLabel}
      </button>

      <p className="text-xs leading-5 text-[var(--muted)]">
        ชื่อและเบอร์โทรมาจากโปรไฟล์ที่บันทึกไว้ หากต้องการแก้ไขให้ไปที่หน้าบัญชี
      </p>

      {submitState.status === "success" ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-[var(--brand-strong)]">
          <p className="font-semibold">บันทึกคำขอจองแล้ว</p>
          <p className="mt-2">
            {values.customerName} เลือกบริการ {service.name} วันที่{" "}
            {values.preferredDate} เวลา {values.preferredTime}
          </p>
          <p className="mt-2 break-all text-xs">
            รหัสการจอง: {submitState.booking.id}
          </p>
          <p className="mt-2 text-xs">
            รถ:{" "}
            {submitState.vehicleWasReused
              ? "ใช้ข้อมูลรถที่มีอยู่แล้ว"
              : "สร้างข้อมูลรถใหม่"}
          </p>
          <Link
            className="mt-4 block min-h-10 rounded-md bg-[var(--brand)] px-4 py-2 text-center text-sm font-semibold text-white"
            href="/my-bookings"
          >
            ดูการจองของฉัน
          </Link>
        </div>
      ) : null}

      {submitState.status === "error" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
          <p className="font-semibold">ส่งคำขอจองไม่สำเร็จ</p>
          <p className="mt-2">{submitState.error}</p>
        </div>
      ) : null}
    </form>
  );
}

export function ServicesListing() {
  const [loadState, setLoadState] = useState<LoadState>({
    data: null,
    error: null,
    status: "loading",
  });
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    null,
  );
  const [authState, setAuthState] = useState<AuthBookingState>({
    error: null,
    profile: null,
    status: "loading",
    user: null,
  });

  useEffect(() => {
    let isMounted = true;

    async function loadServices() {
      const supabase = createClient();
      const { data, error } = await getServicesWithCategories(supabase);

      if (!isMounted) {
        return;
      }

      if (error) {
        setLoadState({
          data: null,
          error: error.message,
          status: "error",
        });
        return;
      }

      setLoadState({
        data: data ?? [],
        error: null,
        status: "ready",
      });
    }

    loadServices();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function loadAuthState() {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (error) {
        setAuthState({
          error: error.message,
          profile: null,
          status: "error",
          user: null,
        });
        return;
      }

      if (!session?.user) {
        setAuthState({
          error: null,
          profile: null,
          status: "signed-out",
          user: null,
        });
        return;
      }

      const profileResult = await getCurrentProfile(supabase, session.user.id);

      if (!isMounted) {
        return;
      }

      if (profileResult.error) {
        setAuthState({
          error: profileResult.error.message,
          profile: null,
          status: "error",
          user: null,
        });
        return;
      }

      if (!profileResult.data) {
        setAuthState({
          error: null,
          profile: null,
          status: "missing-profile",
          user: session.user,
        });
        return;
      }

      setAuthState({
        error: null,
        profile: profileResult.data,
        status: "ready",
        user: session.user,
      });
    }

    loadAuthState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadAuthState();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const categories = useMemo(() => loadState.data ?? [], [loadState.data]);
  const serviceCount = getServicesCount(categories);
  const selectedService = useMemo(
    () => findSelectedService(categories, selectedServiceId),
    [categories, selectedServiceId],
  );
  const visibleCategories = useMemo(() => {
    if (selectedCategoryId === "all") {
      return categories;
    }

    return categories.filter((category) => category.id === selectedCategoryId);
  }, [categories, selectedCategoryId]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 pb-6 pt-0 sm:px-8">
      <header className="border-b border-[var(--line)] pb-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AppNav />
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="mt-2 text-3xl font-bold leading-tight text-[var(--foreground)]">
              บริการของ BigO-RepairCar
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              เลือกบริการซ่อมและบำรุงรักษารถ จากนั้นส่งคำขอจองด้วยโปรไฟล์ลูกค้าของคุณ
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:w-80">
            <div className="rounded-lg border border-[var(--line)] bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                หมวดหมู่
              </p>
              <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">
                {loadState.status === "ready" ? categories.length : "-"}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                บริการ
              </p>
              <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">
                {loadState.status === "ready" ? serviceCount : "-"}
              </p>
            </div>
          </div>
        </div>
      </header>

      {loadState.status === "loading" ? (
        <section className="grid flex-1 place-items-center py-16">
          <div className="rounded-lg border border-[var(--line)] bg-white px-5 py-4 text-sm text-[var(--muted)] shadow-sm">
            กำลังโหลดบริการ...
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
        <section className="grid gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              <button
                className={
                  selectedCategoryId === "all"
                    ? "min-h-10 shrink-0 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white"
                    : "min-h-10 shrink-0 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]"
                }
                onClick={() => setSelectedCategoryId("all")}
                type="button"
              >
                บริการทั้งหมด
              </button>
              {categories.map((category) => (
                <button
                  className={
                    selectedCategoryId === category.id
                      ? "min-h-10 shrink-0 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white"
                      : "min-h-10 shrink-0 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]"
                  }
                  key={category.id}
                  onClick={() => setSelectedCategoryId(category.id)}
                  type="button"
                >
                  {category.name}
                </button>
              ))}
            </div>

            <div className="mt-6 space-y-8">
              {visibleCategories.map((category) => (
                <section key={category.id}>
                  <div className="flex flex-col gap-2 border-b border-[var(--line)] pb-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-[var(--foreground)]">
                        {category.name}
                      </h2>
                      {category.description ? (
                        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                          {category.description}
                        </p>
                      ) : null}
                    </div>
                    <p className="text-sm font-medium text-[var(--muted)]">
                      {category.services.length} บริการ
                    </p>
                  </div>

                  {category.services.length > 0 ? (
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      {category.services.map((service) => (
                        <ServiceCard
                          isSelected={selectedServiceId === service.id}
                          key={service.id}
                          onSelect={() =>
                            setSelectedServiceId((currentServiceId) =>
                              currentServiceId === service.id ? null : service.id,
                            )
                          }
                          service={service}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-lg border border-dashed border-[var(--line)] bg-white p-5 text-sm text-[var(--muted)]">
                      ยังไม่มีบริการที่เปิดใช้งานในหมวดหมู่นี้
                    </div>
                  )}
                </section>
              ))}
            </div>
          </div>

          <aside className="h-fit rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm lg:sticky lg:top-6">
            <p className="text-sm font-semibold text-[var(--brand)]">
              บริการที่เลือก
            </p>
            {selectedService ? (
              <div className="mt-4">
                <ServiceImage
                  className="mb-4 h-40 w-full rounded-md border border-[var(--line)] bg-slate-50 object-cover"
                  imageUrl={selectedService.image_url}
                  label={`${selectedService.name} image`}
                />
                <h2 className="text-xl font-bold leading-7 text-[var(--foreground)]">
                  {selectedService.name}
                </h2>
                {selectedService.description ? (
                  <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                    {selectedService.description}
                  </p>
                ) : null}
                <dl className="mt-5 space-y-3 border-t border-[var(--line)] pt-4 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-[var(--muted)]">ราคาเริ่มต้น</dt>
                    <dd className="font-semibold text-[var(--foreground)]">
                      {currencyFormatter.format(selectedService.base_price)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-[var(--muted)]">เวลาโดยประมาณ</dt>
                    <dd className="font-semibold text-[var(--foreground)]">
                      {formatDuration(
                        selectedService.estimated_duration_minutes,
                      )}
                    </dd>
                  </div>
                </dl>
                <BookingForm
                  authState={authState}
                  key={`${selectedService.id}-${authState.status === "ready" ? authState.profile.id : authState.status}`}
                  service={selectedService}
                />
                <button
                  className="mt-3 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)]"
                  onClick={() => setSelectedServiceId(null)}
                  type="button"
                >
                  ล้างการเลือก
                </button>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-[var(--line)] bg-slate-50 p-4 text-sm leading-6 text-[var(--muted)]">
                เลือกบริการหนึ่งรายการเพื่อเริ่มกรอกคำขอจอง
              </div>
            )}
          </aside>
        </section>
      ) : null}
    </main>
  );
}
