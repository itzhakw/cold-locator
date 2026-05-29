import { useEffect, useRef, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { UserLocation } from "../App";
import type { TempUnit } from "../lib/mapUtils";
import {
  getCitiesInView,
  getCitiesInViewEscalated,
  prefetchTilesForBbox,
  prefetchAdjacentTiles,
  prefetchZoomTransition,
  estimateBboxForZoom,
  type City,
  type BBox,
} from "../lib/cityTiles";
import {
  fetchWeatherBatch,
  fetchSingleWeather,
  type WeatherData,
} from "../lib/weather";
import { debounce } from "../lib/mapUtils";
import { renderCityMarker } from "./CityMarker";
import { renderUserPin } from "./UserPin";

interface Props {
  userLocation: UserLocation | null;
  userTemp: number | null;
  unit: TempUnit;
  onUserTempUpdate: (temp: number) => void;
  initialZoom?: number;
}

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const DEBOUNCE_MS = 300;
const DEFAULT_FLYTO_ZOOM = 7;

export default function MapView({
  userLocation,
  userTemp,
  unit,
  onUserTempUpdate,
  initialZoom,
}: Props) {
  const FLYTO_ZOOM = initialZoom ?? DEFAULT_FLYTO_ZOOM;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<number, maplibregl.Marker>>(new Map());
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const escalationLoaderRef = useRef<maplibregl.Marker | null>(null);
  const unitRef = useRef(unit);
  const userTempRef = useRef(userTemp);

  unitRef.current = unit;
  userTempRef.current = userTemp;

  const cityPositionsRef = useRef<Map<number, { lat: number; lng: number }>>(
    new Map()
  );
  const cityDataRef = useRef<
    Map<number, { city: City; weather: WeatherData }>
  >(new Map());

  const refreshMarkerLabels = useCallback(() => {
    for (const [id, { city, weather }] of cityDataRef.current) {
      const marker = markersRef.current.get(id);
      if (!marker) continue;
      const uTemp = userTempRef.current ?? 0;
      const delta = weather.temperature - uTemp;
      if (delta > -1.0) {
        marker.remove();
        markersRef.current.delete(id);
        cityDataRef.current.delete(id);
        cityPositionsRef.current.delete(id);
        continue;
      }
      const el = marker.getElement();
      el.innerHTML = renderCityMarker(city, weather, delta, unitRef.current);
    }
  }, []);

  const updateMarkers = useCallback(
    async (map: maplibregl.Map) => {
      if (userTempRef.current === null) return;

      const bounds = map.getBounds();
      const zoom = map.getZoom();

      const bbox: BBox = {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      };

      for (const [id, marker] of markersRef.current) {
        const pos = cityPositionsRef.current.get(id);
        if (!pos) continue;
        const outsideBbox =
          pos.lat < bbox.south ||
          pos.lat > bbox.north ||
          pos.lng < bbox.west ||
          pos.lng > bbox.east;
        if (outsideBbox) {
          marker.remove();
          markersRef.current.delete(id);
          cityPositionsRef.current.delete(id);
        }
      }

      const addColdMarkers = (cities: City[], weatherMap: Map<number, import("../lib/weather").WeatherData>): number => {
        let added = 0;
        for (const city of cities) {
          if (markersRef.current.has(city.id)) continue;
          const weather = weatherMap.get(city.id);
          if (!weather) continue;

          const uTemp = userTempRef.current ?? 0;
          const delta = weather.temperature - uTemp;
          if (delta > -1.0) continue;

          const el = document.createElement("div");
          el.innerHTML = renderCityMarker(city, weather, delta, unitRef.current);
          el.addEventListener("click", () => {
            (window as any).dataLayer = (window as any).dataLayer || [];
            (window as any).dataLayer.push({
              event: "click_cold_city",
              city_id: city.id,
              city_name: city.name,
              country: city.country,
              temperature: weather.temperature,
              delta: delta
            });
          });
          const marker = new maplibregl.Marker({
            element: el,
            anchor: "bottom",
          })
            .setLngLat([city.lng, city.lat])
            .addTo(map);
          markersRef.current.set(city.id, marker);
          cityPositionsRef.current.set(city.id, {
            lat: city.lat,
            lng: city.lng,
          });
          cityDataRef.current.set(city.id, { city, weather });
          added++;
        }
        return added;
      };

      let coldFound = 0;

      const cities = await getCitiesInView(bbox, zoom);
      const toFetch = cities.filter((c) => !markersRef.current.has(c.id));
      if (toFetch.length > 0) {
        const weatherMap = await fetchWeatherBatch(
          toFetch.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng }))
        );
        coldFound = addColdMarkers(toFetch, weatherMap);
      }

      if (coldFound === 0) {
        const center = map.getCenter();
        const loaderEl = document.createElement("div");
        loaderEl.className = "escalation-loader";
        loaderEl.innerHTML = '<div class="escalation-loader-ring"></div>';
        escalationLoaderRef.current?.remove();
        escalationLoaderRef.current = new maplibregl.Marker({
          element: loaderEl,
          anchor: "center",
        })
          .setLngLat([center.lng, center.lat])
          .addTo(map);

        try {
          const { cities: escalatedCities, escalated } =
            await getCitiesInViewEscalated(bbox, zoom, 50);
          if (escalated && escalatedCities.length > 0) {
            const escToFetch = escalatedCities.filter(
              (c) => !markersRef.current.has(c.id)
            );
            if (escToFetch.length > 0) {
              const weatherMap = await fetchWeatherBatch(
                escToFetch.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng }))
              );
              addColdMarkers(escToFetch, weatherMap);
            }
          }
        } finally {
          escalationLoaderRef.current?.remove();
          escalationLoaderRef.current = null;
        }
      }

      prefetchAdjacentTiles(bbox, zoom);
      prefetchZoomTransition(bbox, zoom);
    },
    []
  );

  const debouncedUpdate = useCallback(
    debounce((map: maplibregl.Map) => {
      updateMarkers(map);
    }, DEBOUNCE_MS),
    [updateMarkers]
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [0, 20],
      zoom: 2,
      attributionControl: false,
    });

    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right"
    );

    map.addControl(new maplibregl.NavigationControl(), "bottom-right");

    map.on("moveend", () => debouncedUpdate(map));
    map.on("zoomend", () => debouncedUpdate(map));
    map.on("load", () => debouncedUpdate(map));

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [debouncedUpdate]);

  useEffect(() => {
    if (!userLocation || !mapRef.current) return;
    const map = mapRef.current;

    map.flyTo({
      center: [userLocation.lng, userLocation.lat],
      zoom: FLYTO_ZOOM,
      duration: 1800,
      essential: true,
    });

    if (userMarkerRef.current) userMarkerRef.current.remove();

    const el = document.createElement("div");
    el.innerHTML = renderUserPin(userLocation.label, userTemp, unit);
    userMarkerRef.current = new maplibregl.Marker({
      element: el,
      anchor: "bottom",
    })
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(map);

    const destBbox = estimateBboxForZoom(userLocation, FLYTO_ZOOM);

    Promise.all([
      fetchSingleWeather(userLocation.lat, userLocation.lng),
      prefetchTilesForBbox(destBbox, FLYTO_ZOOM),
    ]).then(async ([weather]) => {
      if (!weather) return;
      onUserTempUpdate(weather.temperature);
      const cities = await getCitiesInView(destBbox, FLYTO_ZOOM);
      if (cities.length > 0) {
        await fetchWeatherBatch(
          cities.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng }))
        );
      }
    });
  }, [userLocation]);

  useEffect(() => {
    if (!userMarkerRef.current || !userLocation) return;
    const el = userMarkerRef.current.getElement();
    el.innerHTML = renderUserPin(userLocation.label, userTemp, unit);
  }, [userTemp, unit, userLocation]);

  useEffect(() => {
    if (mapRef.current) debouncedUpdate(mapRef.current);
  }, [debouncedUpdate]);

  useEffect(() => {
    refreshMarkerLabels();
  }, [userTemp, unit, refreshMarkerLabels]);

  return (
    <div
      ref={containerRef}
      className="map-container"
      id="map"
      role="application"
      aria-label="Interactive temperature map showing places colder than your location"
    />
  );
}
