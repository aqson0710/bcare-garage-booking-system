"use client";

import { useEffect, useRef, useState } from "react";
import { loadLeaflet } from "@/lib/leaflet";

// Leaflet loader (CDN script/style tags + the one `declare global` for
// `window.L`) now lives in @/lib/leaflet, shared with the admin
// homepage editor's MapPinPicker - see that file's comment for why this
// moved out of here (two separate `declare global` blocks for the same
// `Window.L` property fail the build with TS2687).

// Default map center: Bangkok, so the pin starts somewhere reasonable
// before the customer moves it or shares their location.
const DEFAULT_CENTER: [number, number] = [13.7563, 100.5018];
const DEFAULT_ZOOM = 12;
const PINNED_ZOOM = 16;

type LoadStatus = "loading" | "ready" | "error";

// Interactive OpenStreetMap picker for the checkout page: the customer taps
// the map or drags the pin to mark exactly where to deliver, on top of the
// free-text address field. Entirely optional - checkout still works with
// just the text address if the customer skips this.
export function DeliveryLocationPicker({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (latitude: number, longitude: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [locateError, setLocateError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  onChangeRef.current = onChange;

  useEffect(() => {
    let isMounted = true;

    loadLeaflet()
      .then(() => {
        if (!isMounted || !containerRef.current || mapRef.current) {
          return;
        }

        const L = window.L;
        const startCenter: [number, number] =
          latitude != null && longitude != null
            ? [latitude, longitude]
            : DEFAULT_CENTER;
        const startZoom =
          latitude != null && longitude != null ? PINNED_ZOOM : DEFAULT_ZOOM;

        const map = L.map(containerRef.current).setView(startCenter, startZoom);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap",
          maxZoom: 19,
        }).addTo(map);

        const marker = L.marker(startCenter, { draggable: true }).addTo(map);

        marker.on("dragend", () => {
          const position = marker.getLatLng();
          onChangeRef.current(position.lat, position.lng);
        });

        map.on("click", (event: { latlng: { lat: number; lng: number } }) => {
          marker.setLatLng(event.latlng);
          onChangeRef.current(event.latlng.lat, event.latlng.lng);
        });

        mapRef.current = map;
        markerRef.current = marker;
        setStatus("ready");
      })
      .catch(() => {
        if (isMounted) {
          setStatus("error");
        }
      });

    return () => {
      isMounted = false;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Only initialize once - latitude/longitude changes after that are
    // handled by moving the existing marker (see handleUseCurrentLocation),
    // not by tearing down and rebuilding the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setLocateError("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง");
      return;
    }

    setLocateError(null);
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const nextLatitude = position.coords.latitude;
        const nextLongitude = position.coords.longitude;

        if (mapRef.current && markerRef.current) {
          markerRef.current.setLatLng([nextLatitude, nextLongitude]);
          mapRef.current.setView([nextLatitude, nextLongitude], PINNED_ZOOM);
        }

        onChangeRef.current(nextLatitude, nextLongitude);
      },
      () => {
        setIsLocating(false);
        setLocateError(
          "ไม่สามารถระบุตำแหน่งได้ กรุณาอนุญาตการเข้าถึงตำแหน่ง หรือปักหมุดเอง",
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-[var(--foreground)]">
          ปักหมุดตำแหน่งจัดส่ง (ไม่บังคับ)
        </p>
        <button
          className="min-h-9 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--muted)] hover:border-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isLocating || status !== "ready"}
          onClick={handleUseCurrentLocation}
          type="button"
        >
          {isLocating ? "กำลังค้นหาตำแหน่ง..." : "ใช้ตำแหน่งปัจจุบัน"}
        </button>
      </div>

      <div className="relative mt-2 h-64 w-full overflow-hidden rounded-md border border-[var(--line)]">
        {status === "loading" ? (
          <div className="absolute inset-0 z-[1] grid place-items-center bg-[var(--surface-muted)] text-sm text-[var(--muted)]">
            กำลังโหลดแผนที่...
          </div>
        ) : null}
        {status === "error" ? (
          <div className="absolute inset-0 z-[1] grid place-items-center bg-[var(--surface-muted)] px-4 text-center text-sm text-[var(--danger)]">
            โหลดแผนที่ไม่สำเร็จ กรุณาลองรีเฟรชหน้าใหม่ (ยังกรอกที่อยู่แบบข้อความได้ตามปกติ)
          </div>
        ) : null}
        <div className="h-full w-full" ref={containerRef} />
      </div>

      <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
        แตะบนแผนที่หรือลากหมุดเพื่อระบุตำแหน่งที่แม่นยำ ใช้ประกอบที่อยู่ที่กรอกด้านบน
      </p>
      {latitude != null && longitude != null ? (
        <p className="mt-1 text-xs text-[var(--muted)]">
          พิกัดที่เลือก: {latitude.toFixed(5)}, {longitude.toFixed(5)}
        </p>
      ) : null}
      {locateError ? (
        <p className="mt-1 text-xs text-[var(--danger)]">{locateError}</p>
      ) : null}
    </div>
  );
}
