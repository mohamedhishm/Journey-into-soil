import maplibregl, { GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { fmt } from "../../lib/msg";
import { useStore } from "../../state/store";

type Lookup = Awaited<ReturnType<typeof api.lookup>>;

function getParcelPolygon(lat: number, lon: number, feddan: number): GeoJSON.Feature<GeoJSON.Polygon> {
  const areaM2 = Math.max(0.25, feddan) * 4200.833;
  const halfSideM = Math.sqrt(areaM2) / 2;
  const dLat = halfSideM / 111320;
  const dLon = halfSideM / (111320 * Math.cos((lat * Math.PI) / 180));
  return {
    type: "Feature",
    properties: { feddan },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [lon - dLon, lat - dLat],
          [lon + dLon, lat - dLat],
          [lon + dLon, lat + dLat],
          [lon - dLon, lat + dLat],
          [lon - dLon, lat - dLat],
        ],
      ],
    },
  };
}

export function FieldMap() {
  const { t } = useTranslation();
  const { request, setRequest, lang } = useStore();
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const [info, setInfo] = useState<Lookup | null>(null);

  useEffect(() => {
    if (!el.current) return;
    const feddan = request.area_feddan ?? 5;
    const initialParcel = getParcelPolygon(request.lat, request.lon, feddan);
    const m = new maplibregl.Map({
      container: el.current,
      center: [request.lon, request.lat],
      zoom: 14,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
          parcel: {
            type: "geojson",
            data: {
              type: "FeatureCollection",
              features: [initialParcel],
            },
          },
        },
        layers: [
          { id: "osm", type: "raster", source: "osm" },
          {
            id: "parcel-fill",
            type: "fill",
            source: "parcel",
            paint: {
              "fill-color": "#57a24b",
              "fill-opacity": 0.28,
            },
          },
          {
            id: "parcel-stroke",
            type: "line",
            source: "parcel",
            paint: {
              "line-color": "#3f7a3a",
              "line-width": 2.5,
              "line-dasharray": [2, 1],
            },
          },
        ],
      },
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.on("click", (e) => setRequest({ lat: +e.lngLat.lat.toFixed(4), lon: +e.lngLat.lng.toFixed(4) }));
    marker.current = new maplibregl.Marker({ color: "#3f7a3a" }).setLngLat([request.lon, request.lat]).addTo(m);
    map.current = m;
    return () => m.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    marker.current?.setLngLat([request.lon, request.lat]);
    map.current?.easeTo({ center: [request.lon, request.lat], duration: 400 });

    const feddan = request.area_feddan ?? 5;
    const m = map.current;
    if (m && m.isStyleLoaded()) {
      const src = m.getSource("parcel") as GeoJSONSource | undefined;
      if (src) {
        src.setData({
          type: "FeatureCollection",
          features: [getParcelPolygon(request.lat, request.lon, feddan)],
        });
      }
    }

    let live = true;
    api
      .lookup(request.lat, request.lon)
      .then((r) => live && setInfo(r))
      .catch(() => live && setInfo(null));
    return () => {
      live = false;
    };
  }, [request.lat, request.lon, request.area_feddan]);

  const feddan = request.area_feddan ?? 5;
  const ha = (feddan * 0.42).toFixed(1);

  return (
    <div className="map-wrap">
      <div ref={el} className="map" aria-label={t("ui.map_label")} />
      <p className="hint">{t("ui.map_hint")}</p>
      <p className="coords">
        <bdi dir="ltr">{request.lat.toFixed(3)}°N, {request.lon.toFixed(3)}°E</bdi>
        {" · "}
        <span className="badge">
          {t("ui.parcel_selected", { feddan, ha })}
        </span>
        {info && (
          <>
            {" · "}
            {t(`ui.region.${info.region}`)}
            {" · "}
            {t("ui.lookup_summary", {
              tmax: fmt(lang, info.climate.mean_tmax, 1),
              rain: fmt(lang, info.climate.annual_rain_mm),
              et0: fmt(lang, info.climate.annual_et0_mm),
            })}
            {info.climate.source === "synthetic" && <span className="badge warn">{t("ui.placeholder_climate")}</span>}
          </>
        )}
      </p>
    </div>
  );
}
