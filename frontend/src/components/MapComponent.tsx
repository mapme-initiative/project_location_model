/* eslint-disable  @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {GeoJSON, LayersControl, MapContainer, TileLayer, useMap, ZoomControl} from "react-leaflet";
import L from "leaflet";
import 'leaflet/dist/leaflet.css';
import 'leaflet.fullscreen/Control.FullScreen.css';
import 'leaflet.fullscreen';
import './scss/MapComponent.scss';


interface GeoJSONFeature {
  type: "Feature";
  geometry: {
    type: string;
    coordinates?: number[] | number[][] | number[][][] | number[][][][];
    geometries?: unknown[];
  } | null;
  properties: NonNullable<unknown>;
}

const PINNED_GEOMETRY_TYPES = new Set([
  "Polygon",
  "MultiPolygon",
  "LineString",
  "MultiLineString",
]);

type PinGlyph = "point" | "line" | "area";

/** Inner mark: dot = Point, bar = Line, triangle = Polygon/area. */
function pinGlyphSvg(glyph: PinGlyph): string {
  if (glyph === "line") {
    return `<rect x="7.5" y="10" width="10" height="2.5" rx="1" fill="#fff"/>`;
  }
  if (glyph === "area") {
    return `<path fill="#fff" d="M12.5 6.5 L17.5 15.5 L7.5 15.5 Z"/>`;
  }
  return `<circle fill="#fff" cx="12.5" cy="11.5" r="3.2"/>`;
}

/** Same teardrop pin; color + center glyph distinguish geometry type (no icon library). */
function makePinIcon(color: string, glyph: PinGlyph): L.DivIcon {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41" aria-hidden="true">` +
    `<path fill="${color}" stroke="#2b2b2b" stroke-width="1" d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 28.5 12.5 28.5S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z"/>` +
    pinGlyphSvg(glyph) +
    `</svg>`;
  return L.divIcon({
    className: `plm-map-pin plm-map-pin--${glyph}`,
    html: svg,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });
}

const pointPinIcon = makePinIcon("#2A81CB", "point");
const linePinIcon = makePinIcon("#E65100", "line");
const areaPinIcon = makePinIcon("#2E7D32", "area");
interface GeoJSONCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

interface MapComponentProps {
  geoJsonData?: {
    type: "FeatureCollection";
    features: GeoJSONFeature[];
  };
}
let controlAdded = false;

// Fullscreen control component
const FullscreenControl: React.FC = () => {
  const map = useMap();
  // Add fullscreen control only once
  if (!controlAdded) {
    const fullscreenControl = L.control.fullscreen({ position: "topleft" });
    fullscreenControl.addTo(map);
    controlAdded = true; // Mark as added
  }

  return null;
};

// Sidebar that is rendered inside the map container via portal when in fullscreen
const FullscreenSidebar: React.FC<{
  selectedFeature: GeoJSONFeature | null;
  onClose: () => void;
  formatValue: (v: any) => string;
}> = ({ selectedFeature, onClose, formatValue }) => {
  const map = useMap();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const portalContainer = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create a dedicated container inside the map DOM for the portal
    const container = document.createElement('div');
    container.className = 'fullscreen-sidebar-portal';
    map.getContainer().appendChild(container);
    portalContainer.current = container;

    const onEnter = () => setIsFullscreen(true);
    const onExit = () => setIsFullscreen(false);
    map.on('enterFullscreen', onEnter);
    map.on('exitFullscreen', onExit);

    return () => {
      map.off('enterFullscreen', onEnter);
      map.off('exitFullscreen', onExit);
      container.remove();
    };
  }, [map]);

  if (!isFullscreen || !selectedFeature || !portalContainer.current) return null;

  return createPortal(
    <div className="map-sidebar map-sidebar--open map-sidebar--fullscreen">
      <div className="map-sidebar__header">
        <h3>{(selectedFeature.properties as any)?.['location_name'] || 'Details'}</h3>
        <button
          className="map-sidebar__close"
          onClick={onClose}
          aria-label="Schließen"
        >
          ×
        </button>
      </div>
      <div className="map-sidebar__content">
        {Object.entries(selectedFeature.properties).map(([key, value]) => (
          <div key={key} className="map-sidebar__row">
            <span className="map-sidebar__label">{key.replace(/_/g, ' ')}</span>
            <span className="map-sidebar__value">{formatValue(value)}</span>
          </div>
        ))}
      </div>
    </div>,
    portalContainer.current
  );
};

/**
 * Checks if the given coordinates array contains any NaN values.
 * @param coordinates - The coordinates to check.
 * @returns true if any NaN is found, false otherwise.
 */
function hasInvalidCoordinates(coordinates: unknown): boolean {
  if (!Array.isArray(coordinates)) {
    return false;
  }
  return coordinates.some((coord) =>
    Array.isArray(coord) ? hasInvalidCoordinates(coord) : typeof coord === "number" && isNaN(coord)
  );
}

/**
 * Drops features that cannot be drawn (null geometry or NaN coordinates).
 * GeometryCollection uses geometries[], not coordinates.
 */
function filterValidFeatures(features: GeoJSONFeature[]): GeoJSONFeature[] {
  return features.filter((feature) => {
    const geometry = feature?.geometry;
    if (geometry == null || typeof geometry !== "object") {
      return false;
    }
    if (geometry.type === "GeometryCollection") {
      return Array.isArray(geometry.geometries);
    }
    if (!("coordinates" in geometry) || geometry.coordinates == null) {
      return false;
    }
    return !hasInvalidCoordinates(geometry.coordinates);
  });
}

function pinIconForGeometryType(type: string): L.DivIcon {
  if (type === "LineString" || type === "MultiLineString") {
    return linePinIcon;
  }
  if (type === "Point" || type === "MultiPoint") {
    return pointPinIcon;
  }
  return areaPinIcon;
}

const MapComponent: React.FC<MapComponentProps> = ({ geoJsonData }) => {
  const [selectedFeature, setSelectedFeature] = useState<GeoJSONFeature | null>(null);

  useEffect(()=>{
    setSelectedFeature(null)
  },[geoJsonData])

  const validGeoJsonData: GeoJSONCollection = geoJsonData && geoJsonData.features ? {
    type: "FeatureCollection",
    features: filterValidFeatures(geoJsonData?.features)
  } : null;

  /** Formatiert einen Property-Wert für die Anzeige (u.a. Date-Objekte). */
  const formatValue = (value: any): string => {
    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }
    if (value === null || value === undefined || value === '') {
      return 'N/A';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  };

  const onEachFeature = (feature: any, layer: L.Layer) => {
    const openSidebar = () => setSelectedFeature(feature);
    layer.on("click", openSidebar);

    // Visual pin only — does not change exported geometry. No extra pin for GeometryCollection.
    const geometryType = feature?.geometry?.type;
    if (!PINNED_GEOMETRY_TYPES.has(geometryType)) {
      return;
    }
    if (!("getBounds" in layer) || typeof (layer as L.Polygon).getBounds !== "function") {
      return;
    }

    let pin: L.Marker | null = null;
    const addPin = () => {
      const bounds = (layer as L.Polygon | L.Polyline).getBounds();
      const map = (layer as any)._map as L.Map | undefined;
      if (!map || !bounds?.isValid()) {
        return;
      }
      pin = L.marker(bounds.getCenter(), { icon: pinIconForGeometryType(geometryType) });
      pin.on("click", openSidebar);
      pin.addTo(map);
    };
    const removePin = () => {
      if (pin) {
        pin.remove();
        pin = null;
      }
    };
    layer.on("add", addPin);
    layer.on("remove", removePin);
  };

  // Remount when features change (properties or geometry) so pins/layers stay in sync.
  const geoJsonKey = JSON.stringify(validGeoJsonData?.features ?? null);

  return (
    <div style={mapWrapperStyle}>
      <MapContainer
        center={[20, 30]}
        zoom={2}
        style={mapContainerStyle}
        zoomControl={false}
      >
        <ZoomControl position="topleft" />
        <FullscreenControl />

        <LayersControl position="topleft">
          <LayersControl.BaseLayer name="GoogleStreets">
            <TileLayer
              url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
              subdomains={["mt0", "mt1", "mt2", "mt3"]}
              maxZoom={20}
              attribution="Map data © GoogleMaps contributors"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer checked name="GoogleHybrid">
            <TileLayer
              url="https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"
              subdomains={["mt0", "mt1", "mt2", "mt3"]}
              maxZoom={20}
              attribution="Map data © GoogleMaps contributors"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="GoogleEarth">
            <TileLayer
              url="https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
              subdomains={["mt0", "mt1", "mt2", "mt3"]}
              maxZoom={20}
              attribution="Map data © GoogleMaps contributors"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="GoogleTerrain">
            <TileLayer
              url="https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}"
              subdomains={["mt0", "mt1", "mt2", "mt3"]}
              maxZoom={20}
              attribution="Map data © GoogleMaps contributors"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="OpenStreetMap">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap contributors"
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        {validGeoJsonData && (
          <GeoJSON
            key={geoJsonKey}
            data={validGeoJsonData}
            pointToLayer={(_feature, latlng) => L.marker(latlng, { icon: pointPinIcon })}
            onEachFeature={onEachFeature}
          />
        )}

        <FullscreenSidebar
          selectedFeature={selectedFeature}
          onClose={() => setSelectedFeature(null)}
          formatValue={formatValue}
        />
      </MapContainer>

      {/* Sidebar – erscheint rechts neben der Karte beim Klick auf ein Feature */}
      <div className={`map-sidebar${selectedFeature ? ' map-sidebar--open' : ''}`}>
        {selectedFeature && (
          <>
            <div className="map-sidebar__header">
              <h3>{selectedFeature.properties?.['location_name'] || 'Details'}</h3>
              <button
                className="map-sidebar__close"
                onClick={() => setSelectedFeature(null)}
                aria-label="Schließen"
              >
                ×
              </button>
            </div>
            <div className="map-sidebar__content">
              {Object.entries(selectedFeature.properties).map(([key, value]) => (
                <div key={key} className="map-sidebar__row">
                  <span className="map-sidebar__label">{key.replace(/_/g, ' ')}</span>
                  <span className="map-sidebar__value">{formatValue(value)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MapComponent;

const mapWrapperStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "stretch",
  width: "100%",
  margin: "20px 0",
};

const mapContainerStyle: React.CSSProperties = {
  position: "relative",
  flex: "1 1 auto",
  minWidth: 0,
  aspectRatio: "16 / 13.5",
};