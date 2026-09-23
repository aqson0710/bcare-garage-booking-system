"use client";

// Click-to-drop-pin map picker, used by the admin homepage editor's
// "ตำแหน่งร้าน" tab to set the shop's office_latitude/office_longitude
// (see homepage-office-coordinates.sql) without typing raw numbers.
//
// Built on Leaflet + OpenStreetMap tiles loaded from a CDN at runtime,
// NOT the npm "leaflet" package - this project has no shell access to the
// user's machine to run `npm install`, and no Google Maps API key is
// configured anywhere in the project, so a CDN script/style tag is the
// only option that needs zero setup on the user's end. `window.L` is
// typed as `any` on purpose: since the "leaflet" package isn't installed,
// there's no local type declaration file to import types from.
import { useEffect, useRef, useState } from "react";

const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

// Bangkok - just a reasonable default center for a first-time pin, not
// tied to any real BCare location.
const DEFAULT_CENTER: [number, number] = [13.7563, 100.5018];

declare global {
  interface Window {
    L?: any;
  }
}

let leafletLoadPromise: Promise<void> | null = null;

function loadLeaflet(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("แผนที่โหลดได้เฉพาะในเบราว์เซอร์เท่านั้น"));
  }

  if (window.L) {
    return Promise.resolve();
  }

  if (leafletLoadPromise) {
    return leafletLoadPromise;
  }

  leafletLoadPromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS_URL}"]`)) {
      const link = document.createElement("link");
      link.href = LEAFLET_CSS_URL;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${LEAFLET_JS_URL}"]`,
    );

    if (existingScript) {
      if (window.L) {
        resolve();
        return;
      }
      existingScript.addEventListener("load", () => resolve());
      existingScript.addEventListener("error", () =>
        reject(new Error("โหลดแผนที่ไม่สำเร็จ")),
      );
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.src = LEAFLET_JS_URL;
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () =>
      reject(new Error("โหลดแผนที่ไม่สำเร็จ")),
    );
    document.head.appendChild(script);
  });

  return leafletLoadPromise;
}

export function MapPinPicker({
  latitude,
  longitude,
  onPick,
}: {
  latitude: number | null;
  longitude: number | null;
  onPick: (latitude: number, longitude: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const onPickRef = useRef(onPick);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  // Creates the map once on mount. Deliberately does not depend on
  // latitude/longitude - a re-render while the admin is dragging the map
  // around shouldn't reset their view. Syncing an externally-changed
  // lat/lng (e.g. the admin typing into the manual fields below) is
  // handled by the second effect further down instead.
  useEffect(() => {
    let cancelled = false;

    function placeMarker(L: any, map: any, lat: number, lng: number) {
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
        return;
      }

      markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(
        map,
      );
      markerRef.current.on("dragend", () => {
        const position = markerRef.current.getLatLng();
        onPickRef.current(position.lat, position.lng);
      });
    }

    loadLeaflet()
      .then(() => {
        if (cancelled || !containerRef.current || mapRef.current) {
          return;
        }

        const L = window.L;
        const hasInitialPin = latitude != null && longitude != null;
        const startCenter: [number, number] = hasInitialPin
          ? [latitude as number, longitude as number]
          : DEFAULT_CENTER;

        const map = L.map(containerRef.current).setView(
          startCenter,
          hasInitialPin ? 16 : 11,
        );
        mapRef.current = map;

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" rel="noreferrer" target="_blank">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        if (hasInitialPin) {
          placeMarker(L, map, latitude as number, longitude as number);
        }

        map.on("click", (event: { latlng: { lat: number; lng: number } }) => {
          const { lat, lng } = event.latlng;
          placeMarker(L, map, lat, lng);
          onPickRef.current(lat, lng);
        });

        setLoadState("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setLoadState("error");
        }
      });

    return () => {
      cancelled = true;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keeps the marker in sync if lat/lng changes from OUTSIDE a map
  // click/drag - e.g. the admin typing into the manual override inputs,
  // or the form reloading after save. Re-centers the view on that pin so
  // it's clear the map reflects the typed value.
  useEffect(() => {
    const map = mapRef.current;
    const L = window.L;

    if (!map || !L || latitude == null || longitude == null) {
      return;
    }

    if (markerRef.current) {
      markerRef.current.setLatLng([latitude, longitude]);
    } else {
      markerRef.current = L.marker([latitude, longitude], {
        draggable: true,
      }).addTo(map);
      markerRef.current.on("dragend", () => {
        const position = markerRef.current.getLatLng();
        onPickRef.current(position.lat, position.lng);
      });
    }

    map.setView([latitude, longitude], Math.max(map.getZoom(), 15));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude]);

  if (loadState === "error") {
    return (
      <div className="flex h-72 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] p-4 text-center text-sm leading-6 text-[var(--muted)] sm:h-96">
        โหลดแผนที่ไม่สำเร็จ (ต้องต่ออินเทอร์เน็ต) ลองรีเฟรชหน้านี้อีกครั้ง
      </div>
    );
  }

  return (
    <div className="relative h-72 w-full overflow-hidden rounded-md border border-[var(--line)] sm:h-96">
      {loadState === "loading" ? (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-[var(--surface)] text-sm text-[var(--muted)]">
          กำลังโหลดแผนที่...
        </div>
      ) : null}
      <div className="h-full w-full" ref={containerRef} />
    </div>
  );
}
