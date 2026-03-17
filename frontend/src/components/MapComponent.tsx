/* eslint-disable  @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import {GeoJSON, LayersControl, MapContainer, TileLayer, useMap, ZoomControl} from "react-leaflet";
import L from "leaflet";
import 'leaflet/dist/leaflet.css';
import 'leaflet.fullscreen/Control.FullScreen.css';
import 'leaflet.fullscreen';
import './scss/MapComponent.scss';


interface GeoJSONFeature {
  type: "Feature";
  geometry: {
    type: "Point" | "Polygon" | "LineString";
    coordinates: number[] | number[][] | number[][][];
  };
  properties: NonNullable<unknown>;
}
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

/**
 * Checks if the given coordinates array contains any NaN values.
 * @param coordinates - The coordinates to check.
 * @returns true if any NaN is found, false otherwise.
 */
function hasInvalidCoordinates(coordinates: number[] | number[][] | number[][][]): boolean {
  if (Array.isArray(coordinates)) {
    return coordinates.some((coord) =>
      Array.isArray(coord) ? hasInvalidCoordinates(coord) : isNaN(coord)
    );
  }
  return false;
}

/**
 * Filters the features array to remove those with invalid coordinates.
 * @param features - Array of GeoJSON features.
 * @returns A new array containing only valid features.
 */
function filterValidFeatures(features: GeoJSONFeature[]): GeoJSONFeature[] {
  return features.filter((feature) => !hasInvalidCoordinates(feature.geometry.coordinates));
}

const MapComponent: React.FC<MapComponentProps> = ({ geoJsonData }) => {
  const [selectedFeature, setSelectedFeature] = useState<GeoJSONFeature | null>(null);

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
    layer.on('click', () => {
      setSelectedFeature(feature);
    });
  };

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
          <GeoJSON data={validGeoJsonData} onEachFeature={onEachFeature} />
        )}
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