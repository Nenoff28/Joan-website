import { useEffect, useRef } from "react";

// Coordinates come from the store's own Google Maps link (maps.app.goo.gl/fJW7QuQC9hL4jtqQ8).
const STORE: [number, number] = [27.2430025, 44.1090147];
const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

/** A single-marker map of the Silistra store. MapLibre loads only in the browser, when this block mounts. */
export function StoreMap({ label }: { label: string }) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let map: import("maplibre-gl").Map | null = null;
    let cancelled = false;
    (async () => {
      const maplibre = (await import("maplibre-gl")) as typeof import("maplibre-gl");
      await import("maplibre-gl/dist/maplibre-gl.css");
      const { default: workerUrl } = await import("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url");
      maplibre.setWorkerUrl(workerUrl);
      if (cancelled || !element.current) return;
      map = new maplibre.Map({ container: element.current, style: MAP_STYLE, center: STORE, zoom: 15.2, attributionControl: { compact: true }, cooperativeGestures: true });
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      new maplibre.Marker({ color: "#D71920" }).setLngLat(STORE).addTo(map);
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, []);
  return <div ref={element} className="store-map" role="application" aria-label={label} />;
}
