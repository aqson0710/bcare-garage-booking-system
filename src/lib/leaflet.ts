// Shared Leaflet loader for every map-pin picker in the app (the checkout
// delivery-location picker, the admin homepage office-location picker).
// Pulled out into one file so there is exactly ONE `declare global` for
// `window.L` in the whole project - two components each declaring their
// own copy of `Window.L` fails to compile with TS2687 ("All declarations
// of 'L' must have identical modifiers"), even if the declarations are
// textually identical, because TypeScript checks the whole program
// together, not file-by-file.
//
// Loaded from a CDN at runtime instead of an npm dependency, so this
// works without anyone needing to run `npm install` on the project.
// Leaflet + OpenStreetMap tiles: free, no API key, no billing account.

const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

// Leaflet has no official types shipped here (no npm install available),
// so it is loaded onto `window` at runtime and accessed through this one
// deliberately loose binding instead of scattering `any` everywhere else.
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    L: any;
  }
}

let leafletLoadPromise: Promise<void> | null = null;

export function loadLeaflet(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("ต้องใช้งานผ่านเบราว์เซอร์"));
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
    script.onerror = () => reject(new Error("โหลดแผนที่ไม่สำเร็จ"));
    script.onload = () => resolve();
    script.src = LEAFLET_JS_URL;
    document.head.appendChild(script);
  });

  return leafletLoadPromise;
}
