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
  fetchForecastBatch,
  fetchSingleForecast,
  type WeatherData,
  type ForecastWeatherData
} from "../lib/weather";
import { fetchAlerts, citiesInAlertZones, type WeatherAlert } from "../lib/alerts";
import { debounce } from "../lib/mapUtils";
import { renderCityMarker, renderForecastMarker } from "./CityMarker";
import { renderUserPin } from "./UserPin";
import type { ViewMode, MapStyleMode, CustomMarker } from "../App";

interface Props {
  userLocation: UserLocation | null;
  userTemp: number | null;
  unit: TempUnit;
  onUserTempUpdate: (temp: number) => void;
  initialZoom?: number;
  viewMode: ViewMode;
  mapStyle: MapStyleMode;
  savedMarkers: CustomMarker[];
  mapFocus: { lat: number; lng: number; zoom?: number; timestamp: number } | null;
  onMapLongClick: (lat: number, lng: number) => void;
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
  viewMode,
  mapStyle,
  savedMarkers,
  mapFocus,
  onMapLongClick,
}: Props) {
  const FLYTO_ZOOM = initialZoom ?? DEFAULT_FLYTO_ZOOM;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<number, maplibregl.Marker>>(new Map());
  const customMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const escalationLoaderRef = useRef<maplibregl.Marker | null>(null);
  const unitRef = useRef(unit);
  const userTempRef = useRef(userTemp);
  const userLocationRef = useRef(userLocation);
  const viewModeRef = useRef(viewMode);
  const alertsCacheRef = useRef<WeatherAlert[]>([]);
  const onMapLongClickRef = useRef(onMapLongClick);

  unitRef.current = unit;
  userTempRef.current = userTemp;
  userLocationRef.current = userLocation;
  viewModeRef.current = viewMode;
  onMapLongClickRef.current = onMapLongClick;

  const cityPositionsRef = useRef<Map<number, { lat: number; lng: number }>>(
    new Map()
  );
  const cityDataRef = useRef<
    Map<number, { city: City; weather?: WeatherData; forecast?: ForecastWeatherData }>
  >(new Map());

  const refreshMarkerLabels = useCallback(() => {
    for (const [id, { city, weather, forecast }] of cityDataRef.current) {
      const marker = markersRef.current.get(id);
      if (!marker) continue;
      const uTemp = userTempRef.current ?? 0;
      
      if (viewModeRef.current === "forecast" && forecast) {
        const delta = forecast.temperatureMax - uTemp;
        const alertsForCity = citiesInAlertZones([city], alertsCacheRef.current).get(city.id) || [];
        const hasStorm = forecast.weatherCode >= 51;
        const el = marker.getElement();
        el.innerHTML = renderForecastMarker(city, forecast, delta, unitRef.current, hasStorm, alertsForCity.length);
      } else if (viewModeRef.current === "now" && weather) {
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

      const isForecast = viewModeRef.current === "forecast";

      if (isForecast) {
        alertsCacheRef.current = await fetchAlerts();
      }

      const addMarkers = (
        cities: City[], 
        weatherMap?: Map<number, WeatherData>,
        forecastMap?: Map<number, ForecastWeatherData>
      ): number => {
        let added = 0;
        const cityAlerts = isForecast ? citiesInAlertZones(cities, alertsCacheRef.current) : new Map();

        for (const city of cities) {
          if (markersRef.current.has(city.id)) continue;
          
          const uTemp = userTempRef.current ?? 0;
          let delta = 0;
          let elHtml = "";
          let tempForEvent = 0;
          
          if (isForecast && forecastMap) {
            const forecast = forecastMap.get(city.id);
            if (!forecast) continue;
            delta = forecast.temperatureMax - uTemp;
            const hasStorm = forecast.weatherCode >= 51;
            const alerts = cityAlerts.get(city.id) || [];
            
            // Only add if it's colder OR if there's a storm
            if (delta > -1.0 && !hasStorm && alerts.length === 0) continue;
            
            elHtml = renderForecastMarker(city, forecast, delta, unitRef.current, hasStorm, alerts.length);
            tempForEvent = forecast.temperatureMax;
            cityDataRef.current.set(city.id, { city, forecast });
          } else if (!isForecast && weatherMap) {
            const weather = weatherMap.get(city.id);
            if (!weather) continue;
            delta = weather.temperature - uTemp;
            if (delta > -1.0) continue;
            
            elHtml = renderCityMarker(city, weather, delta, unitRef.current);
            tempForEvent = weather.temperature;
            cityDataRef.current.set(city.id, { city, weather });
          } else {
            continue;
          }

          const el = document.createElement("div");
          el.innerHTML = elHtml;
          el.addEventListener("click", () => {
            (window as any).dataLayer = (window as any).dataLayer || [];
            (window as any).dataLayer.push({
              event: "click_cold_city",
              city_id: city.id,
              city_name: city.name,
              country: city.country,
              temperature: tempForEvent,
              delta: delta
            });
            if (userLocationRef.current) {
              const { lat: uLat, lng: uLng } = userLocationRef.current;
              const url = `https://www.google.com/maps/dir/?api=1&origin=${uLat},${uLng}&destination=${city.lat},${city.lng}`;
              window.open(url, "_blank", "noopener");
            }
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
          added++;
        }
        return added;
      };

      let coldFound = 0;

      const cities = await getCitiesInView(bbox, zoom);
      const toFetch = cities.filter((c) => !markersRef.current.has(c.id));
      if (toFetch.length > 0) {
        if (isForecast) {
          const forecastMap = await fetchForecastBatch(
            toFetch.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng })), 7
          );
          coldFound = addMarkers(toFetch, undefined, forecastMap);
        } else {
          const weatherMap = await fetchWeatherBatch(
            toFetch.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng }))
          );
          coldFound = addMarkers(toFetch, weatherMap);
        }
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
              if (isForecast) {
                const forecastMap = await fetchForecastBatch(
                  escToFetch.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng })), 7
                );
                addMarkers(escToFetch, undefined, forecastMap);
              } else {
                const weatherMap = await fetchWeatherBatch(
                  escToFetch.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng }))
                );
                addMarkers(escToFetch, weatherMap);
              }
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
    map.on("contextmenu", (e) => {
      e.originalEvent.preventDefault();
      onMapLongClickRef.current(e.lngLat.lat, e.lngLat.lng);
    });
    map.on("load", () => {
      // Add NASA GIBS satellite raster layers
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      map.addSource('nasa-gibs-yesterday', {
        type: 'raster',
        tiles: [
          `https://gibs-a.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${yesterday}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
          `https://gibs-b.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${yesterday}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
          `https://gibs-c.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${yesterday}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`
        ],
        tileSize: 256,
        maxzoom: 9
      });

      // Insert satellite layers right after background
      const styleLayers = map.getStyle().layers;
      let insertBeforeId;
      if (styleLayers && styleLayers.length > 1) {
        insertBeforeId = styleLayers[1].id;
      }

      const isSat = mapStyle === "satellite";

      map.addLayer({
        id: 'nasa-layer-yesterday',
        type: 'raster',
        source: 'nasa-gibs-yesterday',
        layout: { visibility: isSat ? 'visible' : 'none' }
      }, insertBeforeId);

      if (isSat && styleLayers) {
        for (const layer of styleLayers) {
          if (layer.id.includes("nasa-layer")) continue;
          const shouldHideInSat = layer.type === "background" || layer.type === "fill" || layer.id === "natural_earth";
          if (shouldHideInSat) {
            map.setLayoutProperty(layer.id, "visibility", "none");
          }
        }
      }

      debouncedUpdate(map);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      customMarkersRef.current.clear();
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

    const isForecast = viewMode === "forecast";
    const dateStr = isForecast ? new Date(Date.now() + 7 * 86400000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : undefined;

    const el = document.createElement("div");
    el.innerHTML = renderUserPin(userLocation.label, userTemp, unit, dateStr);
    userMarkerRef.current = new maplibregl.Marker({
      element: el,
      anchor: "bottom",
    })
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(map);

    const destBbox = estimateBboxForZoom(userLocation, FLYTO_ZOOM);

    const userWeatherPromise = isForecast 
      ? fetchSingleForecast(userLocation.lat, userLocation.lng, 7).then(w => w ? { temperature: w.temperatureMax } : null)
      : fetchSingleWeather(userLocation.lat, userLocation.lng);

    Promise.all([
      userWeatherPromise,
      prefetchTilesForBbox(destBbox, FLYTO_ZOOM),
    ]).then(async ([weather]) => {
      if (!weather) return;
      onUserTempUpdate(weather.temperature);
      const cities = await getCitiesInView(destBbox, FLYTO_ZOOM);
      if (cities.length > 0) {
        if (isForecast) {
          await fetchForecastBatch(
            cities.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng })), 7
          );
        } else {
          await fetchWeatherBatch(
            cities.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng }))
          );
        }
      }
    });
  }, [userLocation]);

  useEffect(() => {
    // Re-render user pin when viewMode or temp changes
    if (!userMarkerRef.current || !userLocation) return;
    const isForecast = viewMode === "forecast";
    const dateStr = isForecast ? new Date(Date.now() + 7 * 86400000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : undefined;
    
    const el = userMarkerRef.current.getElement();
    el.innerHTML = renderUserPin(userLocation.label, userTemp, unit, dateStr);
  }, [userTemp, unit, userLocation, viewMode]);

  useEffect(() => {
    // When viewMode changes, clear all markers and re-fetch
    for (const [id, marker] of markersRef.current) {
      marker.remove();
    }
    markersRef.current.clear();
    cityPositionsRef.current.clear();
    cityDataRef.current.clear();
    
    // We also need to refetch the user temp based on the new view mode
    if (userLocationRef.current) {
      const isForecast = viewMode === "forecast";
      if (isForecast) {
        fetchSingleForecast(userLocationRef.current.lat, userLocationRef.current.lng, 7).then(w => {
          if (w) onUserTempUpdate(w.temperatureMax);
        });
      } else {
        fetchSingleWeather(userLocationRef.current.lat, userLocationRef.current.lng).then(w => {
          if (w) onUserTempUpdate(w.temperature);
        });
      }
    }

    if (mapRef.current) debouncedUpdate(mapRef.current);
  }, [viewMode, debouncedUpdate, onUserTempUpdate]);

  useEffect(() => {
    if (mapRef.current) debouncedUpdate(mapRef.current);
  }, [debouncedUpdate]);

  useEffect(() => {
    refreshMarkerLabels();
  }, [userTemp, unit, refreshMarkerLabels]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    
    const applyMapStyle = () => {
      const isSat = mapStyle === "satellite";
      
      if (map.getLayer("nasa-layer-yesterday")) {
        map.setLayoutProperty("nasa-layer-yesterday", "visibility", isSat ? "visible" : "none");
      }
      
      const layers = map.getStyle().layers;
      if (layers) {
        for (const layer of layers) {
          if (layer.id.includes("nasa-layer")) continue;
          const shouldHideInSat = layer.type === "background" || layer.type === "fill" || layer.id === "natural_earth";
          if (shouldHideInSat) {
            map.setLayoutProperty(layer.id, "visibility", isSat ? "none" : "visible");
          }
        }
      }
    };

    if (map.isStyleLoaded()) {
      applyMapStyle();
    } else {
      map.once("styledata", applyMapStyle);
    }
  }, [mapStyle]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const savedIds = new Set(savedMarkers.map((m) => m.id));
    for (const [id, marker] of customMarkersRef.current) {
      if (!savedIds.has(id)) {
        marker.remove();
        customMarkersRef.current.delete(id);
      }
    }

    for (const m of savedMarkers) {
      const existingMarker = customMarkersRef.current.get(m.id);
      if (existingMarker) {
        const el = existingMarker.getElement();
        const nameEl = el.querySelector(".custom-marker-name");
        if (nameEl && nameEl.textContent !== m.name) {
          nameEl.textContent = m.name;
        }
      } else {
        const el = document.createElement("div");
        el.className = "custom-marker";
        el.innerHTML = `
          <div class="custom-marker-body">
            <span class="custom-marker-icon">📌</span>
            <span class="custom-marker-name">${m.name}</span>
          </div>
        `;

        el.addEventListener("click", () => {
          const destination = `${m.lat},${m.lng}`;
          const origin = userLocationRef.current
            ? `${userLocationRef.current.lat},${userLocationRef.current.lng}`
            : "Current+Location";
          const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
          window.open(url, "_blank", "noopener");
        });

        const marker = new maplibregl.Marker({
          element: el,
          anchor: "bottom",
        })
          .setLngLat([m.lng, m.lat])
          .addTo(map);

        customMarkersRef.current.set(m.id, marker);
      }
    }
  }, [savedMarkers]);

  useEffect(() => {
    if (!mapFocus || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [mapFocus.lng, mapFocus.lat],
      zoom: mapFocus.zoom ?? 10,
      duration: 1500,
      essential: true,
    });
  }, [mapFocus]);

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
