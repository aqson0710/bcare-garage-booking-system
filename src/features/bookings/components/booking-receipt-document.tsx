import type { Booking, Profile, RepairJob, Service, Vehicle } from "@/features/bookings";

type BookingReceiptRepairJob = RepairJob & {
  mechanic?: Profile | null;
};

type BookingReceiptData = Booking & {
  customer?: Profile | null;
  repairJob?: BookingReceiptRepairJob | null;
  service: Service | null;
  vehicle: Vehicle | null;
};

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  currency: "THB",
  maximumFractionDigits: 0,
  style: "currency",
});

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatBookingDateTime(booking: BookingReceiptData) {
  return `${booking.booking_date} เวลา ${booking.booking_time.slice(0, 5)} น.`;
}

function formatDuration(minutes: number | null | undefined) {
  if (!minutes) {
    return "-";
  }

  if (minutes < 60) {
    return `${minutes} นาที`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0
    ? `${hours} ชม. ${remainingMinutes} นาที`
    : `${hours} ชม.`;
}

function formatBookingStatus(status: BookingReceiptData["status"]) {
  if (status === "pending") {
    return "รอการยืนยัน";
  }

  if (status === "confirmed") {
    return "ยืนยันแล้ว";
  }

  if (status === "completed") {
    return "เสร็จสิ้น";
  }

  return "ยกเลิกแล้ว";
}

function formatRepairStatus(status: RepairJob["status"] | null | undefined) {
  if (!status) {
    return "ยังไม่มีใบงานซ่อม";
  }

  if (status === "pending") {
    return "รอจัดคิวงาน";
  }

  if (status === "assigned") {
    return "มอบหมายช่างแล้ว";
  }

  if (status === "in_progress") {
    return "กำลังซ่อม";
  }

  if (status === "completed") {
    return "ซ่อมเสร็จแล้ว";
  }

  return "ยกเลิก";
}

function getDocumentTitle(booking: BookingReceiptData) {
  if (booking.status === "completed") {
    return "ใบสรุปงานบริการ";
  }

  if (booking.status === "confirmed") {
    return "ใบยืนยันการจอง";
  }

  return "ใบรับคำขอจอง";
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-semibold text-slate-950">
        {value}
      </dd>
    </div>
  );
}

export function BookingReceiptDocument({
  backHref,
  booking,
}: {
  backHref: string;
  booking: BookingReceiptData;
}) {
  const documentTitle = getDocumentTitle(booking);
  const servicePrice = booking.service?.base_price ?? 0;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-6 text-slate-950 print:max-w-none print:bg-white print:px-0 print:py-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <a
          className="min-h-10 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--muted)]"
          href={backHref}
        >
          กลับไปหน้ารายละเอียด
        </a>
        <button
          className="min-h-10 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white"
          onClick={() => window.print()}
          type="button"
        >
          พิมพ์ / บันทึกเป็น PDF
        </button>
      </div>

      <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase text-[var(--brand)]">
              BCare · BigO-RepairCar
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">
              {documentTitle}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              เอกสารสำหรับยืนยันคิวบริการและข้อมูลรถของลูกค้า
            </p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">
              เลขที่เอกสาร
            </p>
            <p className="mt-1 break-all font-bold text-slate-950">
              {booking.id.slice(0, 8).toUpperCase()}
            </p>
            <p className="mt-3 text-xs font-semibold uppercase text-slate-500">
              วันที่ออกเอกสาร
            </p>
            <p className="mt-1 font-semibold text-slate-950">
              {formatDateTime(new Date().toISOString())}
            </p>
          </div>
        </header>

        <section className="grid gap-5 border-b border-slate-200 py-6 md:grid-cols-3">
          <InfoItem
            label="ลูกค้า"
            value={booking.customer?.full_name ?? `รหัสลูกค้า ${booking.customer_id}`}
          />
          <InfoItem
            label="เบอร์โทร"
            value={booking.customer?.phone_number ?? "-"}
          />
          <InfoItem label="อีเมล" value={booking.customer?.email ?? "-"} />
          <InfoItem label="วันนัดหมาย" value={formatBookingDateTime(booking)} />
          <InfoItem label="สถานะจอง" value={formatBookingStatus(booking.status)} />
          <InfoItem
            label="สถานะงานซ่อม"
            value={formatRepairStatus(booking.repairJob?.status)}
          />
        </section>

        <section className="grid gap-6 py-6 md:grid-cols-2">
          <div>
            <h2 className="text-lg font-bold text-slate-950">บริการ</h2>
            <dl className="mt-4 space-y-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
              <InfoItem
                label="รายการบริการ"
                value={booking.service?.name ?? "ไม่พบบริการ"}
              />
              <InfoItem
                label="รายละเอียด"
                value={booking.service?.description ?? "-"}
              />
              <InfoItem
                label="ระยะเวลาประมาณ"
                value={formatDuration(booking.service?.estimated_duration_minutes)}
              />
            </dl>
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-950">รถที่เข้ารับบริการ</h2>
            <dl className="mt-4 space-y-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
              <InfoItem
                label="ทะเบียนรถ"
                value={booking.vehicle?.license_plate ?? "-"}
              />
              <InfoItem label="ยี่ห้อ" value={booking.vehicle?.brand ?? "-"} />
              <InfoItem label="รุ่น" value={booking.vehicle?.model ?? "-"} />
              <InfoItem
                label="ปี / สี"
                value={
                  booking.vehicle
                    ? `${booking.vehicle.year ?? "-"} / ${booking.vehicle.color ?? "-"}`
                    : "-"
                }
              />
            </dl>
          </div>
        </section>

        <section className="grid gap-5 border-t border-slate-200 pt-6 md:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4 text-sm leading-6 text-slate-600">
            <div>
              <p className="font-semibold text-slate-950">ข้อมูลใบงาน</p>
              <p className="mt-1">
                ช่างผู้รับผิดชอบ: {booking.repairJob?.mechanic?.full_name ?? "-"}
              </p>
              <p className="mt-1">
                เบอร์ช่าง: {booking.repairJob?.mechanic?.phone_number ?? "-"}
              </p>
              <p className="mt-1">
                วินิจฉัย: {booking.repairJob?.diagnosis || "-"}
              </p>
              <p className="mt-1">
                หมายเหตุงานซ่อม: {booking.repairJob?.repair_notes || "-"}
              </p>
            </div>

            {booking.note ? (
              <div>
                <p className="font-semibold text-slate-950">หมายเหตุจากลูกค้า</p>
                <p className="mt-1">{booking.note}</p>
              </div>
            ) : null}
          </div>

          <dl className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">ค่าบริการตั้งต้น</dt>
              <dd className="font-semibold">
                {servicePrice > 0 ? currencyFormatter.format(servicePrice) : "-"}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-slate-200 pt-3">
              <dt className="text-base font-bold text-slate-950">
                ยอดประเมินเบื้องต้น
              </dt>
              <dd className="text-xl font-bold text-slate-950">
                {servicePrice > 0 ? currencyFormatter.format(servicePrice) : "-"}
              </dd>
            </div>
          </dl>
        </section>

        <footer className="mt-8 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
          เอกสารนี้เป็นข้อมูลจากระบบ BCare Garage Booking System
          ยอดจริงอาจเปลี่ยนแปลงตามอะไหล่และงานซ่อมเพิ่มเติมหลังตรวจรถจริง
        </footer>
      </article>
    </main>
  );
}
