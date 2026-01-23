/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    Autocomplete,
    TextField,
    Box,
    CircularProgress,
    Typography,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Button,
    IconButton,
    Paper,
    Chip,
    Tooltip,
    Alert,
    Snackbar
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import SearchIcon from '@mui/icons-material/Search';
import ArchitectureIcon from '@mui/icons-material/Architecture';
import AddLocationIcon from '@mui/icons-material/AddLocation';
import SaveIcon from '@mui/icons-material/Save';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import HomeIcon from '@mui/icons-material/Home';
import { MapContainer, TileLayer, GeoJSON, useMap, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { GeoJsonObject, FeatureCollection, Feature, Geometry, Position } from 'geojson';
import GeoServerAuth from './GeoServerAuth';
import './scss/GeoServerEditor.scss';

// Helper: Coordinates array to GML 2.x coordinates string (comma between x,y and space between pairs)
function coordinatesToGml2(coords: Position[]): string {
    return coords.map(coord => `${coord[0]},${coord[1]}`).join(' ');
}

// Helper: Convert GeoJSON Geometry to GML 2.x format (compatible with WFS 1.0.0)
function geometryToGml(geometry: Geometry): string {
    switch (geometry.type) {
        case 'Point':
            return `<gml:Point srsName="EPSG:4326"><gml:coordinates>${geometry.coordinates[0]},${geometry.coordinates[1]}</gml:coordinates></gml:Point>`;

        case 'LineString':
            return `<gml:LineString srsName="EPSG:4326"><gml:coordinates>${coordinatesToGml2(geometry.coordinates)}</gml:coordinates></gml:LineString>`;

        case 'Polygon': {
            const exteriorRing = geometry.coordinates[0];
            const interiorRings = geometry.coordinates.slice(1);
            let polygonGml = `<gml:Polygon srsName="EPSG:4326"><gml:outerBoundaryIs><gml:LinearRing><gml:coordinates>${coordinatesToGml2(exteriorRing)}</gml:coordinates></gml:LinearRing></gml:outerBoundaryIs>`;
            for (const interior of interiorRings) {
                polygonGml += `<gml:innerBoundaryIs><gml:LinearRing><gml:coordinates>${coordinatesToGml2(interior)}</gml:coordinates></gml:LinearRing></gml:innerBoundaryIs>`;
            }
            polygonGml += `</gml:Polygon>`;
            return polygonGml;
        }

        case 'MultiPoint': {
            const pointMembers = geometry.coordinates.map(coord =>
                `<gml:pointMember><gml:Point srsName="EPSG:4326"><gml:coordinates>${coord[0]},${coord[1]}</gml:coordinates></gml:Point></gml:pointMember>`
            ).join('');
            return `<gml:MultiPoint srsName="EPSG:4326">${pointMembers}</gml:MultiPoint>`;
        }

        case 'MultiLineString': {
            const lineMembers = geometry.coordinates.map(line =>
                `<gml:lineStringMember><gml:LineString srsName="EPSG:4326"><gml:coordinates>${coordinatesToGml2(line)}</gml:coordinates></gml:LineString></gml:lineStringMember>`
            ).join('');
            return `<gml:MultiLineString srsName="EPSG:4326">${lineMembers}</gml:MultiLineString>`;
        }

        case 'MultiPolygon': {
            const polygonMembers = geometry.coordinates.map(polygon => {
                const ext = polygon[0];
                const ints = polygon.slice(1);
                let polyGml = `<gml:polygonMember><gml:Polygon srsName="EPSG:4326"><gml:outerBoundaryIs><gml:LinearRing><gml:coordinates>${coordinatesToGml2(ext)}</gml:coordinates></gml:LinearRing></gml:outerBoundaryIs>`;
                for (const int of ints) {
                    polyGml += `<gml:innerBoundaryIs><gml:LinearRing><gml:coordinates>${coordinatesToGml2(int)}</gml:coordinates></gml:LinearRing></gml:innerBoundaryIs>`;
                }
                polyGml += `</gml:Polygon></gml:polygonMember>`;
                return polyGml;
            }).join('');
            return `<gml:MultiPolygon srsName="EPSG:4326">${polygonMembers}</gml:MultiPolygon>`;
        }

        default:
            throw new Error(`Unsupported geometry type: ${(geometry as any).type}`);
    }
}

// Helper: Convert geometry to expected type (e.g., Polygon to MultiPolygon)
function convertGeometryToType(geometry: Geometry, targetType: string): Geometry {
    const sourceType = geometry.type;

    // If already the correct type, return as-is
    if (sourceType === targetType) {
        return geometry;
    }

    // Convert Polygon to MultiPolygon
    if (sourceType === 'Polygon' && targetType === 'MultiPolygon') {
        return {
            type: 'MultiPolygon',
            coordinates: [(geometry as any).coordinates]
        } as Geometry;
    }

    // Convert Point to MultiPoint
    if (sourceType === 'Point' && targetType === 'MultiPoint') {
        return {
            type: 'MultiPoint',
            coordinates: [(geometry as any).coordinates]
        } as Geometry;
    }

    // Convert LineString to MultiLineString
    if (sourceType === 'LineString' && targetType === 'MultiLineString') {
        return {
            type: 'MultiLineString',
            coordinates: [(geometry as any).coordinates]
        } as Geometry;
    }

    console.warn(`Cannot convert ${sourceType} to ${targetType}, using original geometry`);
    return geometry;
}

// Fix Leaflet marker icons
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface NominatimResult {
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
    geojson?: GeoJsonObject;
    boundingbox: string[];
}

interface WfsFeatureRow {
    id: number;
    featureId: string;
    geometry: Geometry;
    [key: string]: unknown;
}

// Component to fit map bounds to GeoJSON
function FitBounds({ geoJson }: { geoJson: GeoJsonObject | null }) {
    const map = useMap();

    useEffect(() => {
        if (geoJson) {
            const geoJsonLayer = L.geoJSON(geoJson);
            const bounds = geoJsonLayer.getBounds();
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [20, 20] });
            }
        }
    }, [geoJson, map]);

    return null;
}

// Component to zoom to a specific geometry
function ZoomToFeature({ geometry, trigger }: { geometry: Geometry | null; trigger: number }) {
    const map = useMap();

    useEffect(() => {
        if (geometry && trigger > 0) {
            const geoJsonLayer = L.geoJSON(geometry as GeoJsonObject);
            const bounds = geoJsonLayer.getBounds();
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [50, 50] });
            }
        }
    }, [geometry, trigger, map]);

    return null;
}

// Component to handle map resize and fix gray tiles
function MapResizeHandler() {
    const map = useMap();

    useEffect(() => {
        // Invalidate size on mount to fix gray areas
        const timer = setTimeout(() => {
            map.invalidateSize();
        }, 100);

        // Also invalidate on window resize
        const handleResize = () => {
            map.invalidateSize();
        };

        window.addEventListener('resize', handleResize);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', handleResize);
        };
    }, [map]);

    return null;
}

interface GeoServerEditorProps {
    onNavigateHome?: () => void;
}

export default function GeoServerEditor({ onNavigateHome }: GeoServerEditorProps): React.ReactElement {
    // Auth state
    const [authDialogOpen, setAuthDialogOpen] = useState(false);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [serverUrl, setServerUrl] = useState<string>('');

    // Geocoding state
    const [options, setOptions] = useState<NominatimResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedGeoJson, setSelectedGeoJson] = useState<GeoJsonObject | null>(null);
    const [inputValue, setInputValue] = useState('');
    const [geoJsonKey, setGeoJsonKey] = useState(0);
    const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Refs for callbacks
    const selectedGeoJsonRef = useRef<GeoJsonObject | null>(null);
    const wfsGeoJsonRef = useRef<FeatureCollection | null>(null);
    const loadWfsDataRef = useRef<(() => Promise<void>) | null>(null);
    const lastAutoLoadRef = useRef<string>('');

    useEffect(() => {
        selectedGeoJsonRef.current = selectedGeoJson;
    }, [selectedGeoJson]);

    // WFS state
    const [wfsUrl, setWfsUrl] = useState('');
    const [wfsLoading, setWfsLoading] = useState(false);
    const [wfsGeoJson, setWfsGeoJson] = useState<FeatureCollection | null>(null);
    const [wfsGeoJsonKey, setWfsGeoJsonKey] = useState(0);
    const [wfsFeatures, setWfsFeatures] = useState<WfsFeatureRow[]>([]);
    const [wfsColumns, setWfsColumns] = useState<GridColDef[]>([]);

    useEffect(() => {
        wfsGeoJsonRef.current = wfsGeoJson;
    }, [wfsGeoJson]);

    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogMessage, setDialogMessage] = useState('');

    // Snackbar state
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info'>('info');

    // Zoom state
    const [zoomToGeometry, setZoomToGeometry] = useState<Geometry | null>(null);
    const [zoomTrigger, setZoomTrigger] = useState(0);

    // WFS-T state
    const [wfsTypeName, setWfsTypeName] = useState<string>('');
    const [wfsNamespace, setWfsNamespace] = useState<string>('');
    const [wfsNamespaceUri, setWfsNamespaceUri] = useState<string>('');
    const [wfsGeomFieldName, setWfsGeomFieldName] = useState<string>('the_geom');
    const [wfsGeomType, setWfsGeomType] = useState<string>(''); // MultiPolygon, Polygon, Point, etc.

    const showError = useCallback((message: string) => {
        setDialogMessage(message);
        setDialogOpen(true);
    }, []);

    const showSnackbar = useCallback((message: string, severity: 'success' | 'error' | 'info' = 'info') => {
        setSnackbarMessage(message);
        setSnackbarSeverity(severity);
        setSnackbarOpen(true);
    }, []);

    const handleCloseDialog = useCallback(() => {
        setDialogOpen(false);
    }, []);

    const handleAuthenticated = useCallback((token: string, url: string, wfsUrlFromAuth: string) => {
        setAccessToken(token);
        setServerUrl(url);
        if (wfsUrlFromAuth.trim()) {
            setWfsUrl(wfsUrlFromAuth);
        }
        showSnackbar('Successfully authenticated!', 'success');
    }, [showSnackbar]);

    const handleLogout = useCallback(() => {
        setAccessToken(null);
        setServerUrl('');
        showSnackbar('Logged out', 'info');
    }, [showSnackbar]);

    // Load WFS data
    const loadWfsData = useCallback(async () => {
        if (!wfsUrl.trim()) return;

        // Validate outputFormat
        const urlLower = wfsUrl.toLowerCase();
        if (!urlLower.includes('outputformat')) {
            showError('The outputFormat parameter is missing. Only JSON is supported.');
            return;
        }

        const outputFormatMatch = urlLower.match(/outputformat=([^&]*)/);
        if (!outputFormatMatch || !outputFormatMatch[1].includes('json')) {
            showError('Invalid output format. Only JSON is supported.');
            return;
        }

        setWfsLoading(true);
        try {
            // Extract typeName and base URL
            const typeNameMatch = wfsUrl.match(/typeName[s]?=([^&]*)/i);
            let fullTypeName = '';
            let namespace = '';

            if (typeNameMatch) {
                fullTypeName = decodeURIComponent(typeNameMatch[1]);
                setWfsTypeName(fullTypeName);
                const colonIndex = fullTypeName.indexOf(':');
                if (colonIndex > 0) {
                    namespace = fullTypeName.substring(0, colonIndex);
                    setWfsNamespace(namespace);
                }
            }

            const baseUrl = wfsUrl.split('?')[0];

            // Fetch DescribeFeatureType to get correct namespace URI and geometry field
            if (fullTypeName && namespace) {
                try {
                    let describeUrl = `${baseUrl}?service=WFS&version=1.1.0&request=DescribeFeatureType&typeName=${encodeURIComponent(fullTypeName)}`;
                    if (accessToken) {
                        describeUrl += `&access_token=${encodeURIComponent(accessToken)}`;
                    }

                    const describeResponse = await fetch(describeUrl, { credentials: 'include' });
                    const describeText = await describeResponse.text();

                    // Extract namespace URI from targetNamespace attribute
                    const nsMatch = describeText.match(/targetNamespace="([^"]+)"/);
                    if (nsMatch) {
                        setWfsNamespaceUri(nsMatch[1]);
                        console.log('Found namespace URI:', nsMatch[1]);
                    }

                    // Extract geometry field name and type from the schema
                    const geomMatch = describeText.match(/name="([^"]+)"[^>]*type="gml:(Multi)?(Point|LineString|Polygon|Geometry|Surface|Curve)/i);
                    if (geomMatch) {
                        setWfsGeomFieldName(geomMatch[1]);
                        // Construct the full geometry type name
                        const geomType = (geomMatch[2] || '') + geomMatch[3]; // e.g., "MultiPolygon" or "Polygon"
                        setWfsGeomType(geomType);
                        console.log('Found geometry field:', geomMatch[1], 'type:', geomType);
                    }
                } catch (describeError) {
                    console.warn('Could not fetch DescribeFeatureType:', describeError);
                    // Fallback: construct namespace URI from base URL
                    const geoserverBase = baseUrl.replace(/\/ows$|\/wfs$/, '');
                    setWfsNamespaceUri(`${geoserverBase}/${namespace}`);
                }
            }

            // Add access token if available
            let fetchUrl = wfsUrl;
            if (accessToken && !wfsUrl.includes('access_token')) {
                fetchUrl += (wfsUrl.includes('?') ? '&' : '?') + `access_token=${encodeURIComponent(accessToken)}`;
            }

            console.log('Requesting URL:', fetchUrl);

            const response = await fetch(fetchUrl, {
                headers: {
                    'Accept': 'application/json, application/geo+json, */*'
                },
                credentials: 'include'
            });

            const text = await response.text();
            const contentType = response.headers.get('content-type');

            console.log('Response Status:', response.status);
            console.log('Response Content-Type:', contentType);
            console.log('Response Preview:', text.substring(0, 300));

            if (!response.ok) {
                console.error('Full Error Response:', text);
                throw new Error(`HTTP ${response.status}: ${response.statusText}\n\nServer Response:\n${text.substring(0, 500)}`);
            }

            // Check if JSON
            const trimmedText = text.trim();
            const looksLikeJson = trimmedText.startsWith('{') || trimmedText.startsWith('[');

            if (!looksLikeJson) {
                let errorMessage = 'Server returned non-JSON response. ';

                if (text.includes('ServiceExceptionReport') || text.includes('ExceptionReport')) {
                    const serviceExceptionMatch = text.match(/<ServiceException[^>]*>(.*?)<\/ServiceException>/s);
                    const exceptionTextMatch = text.match(/<(?:ows:)?ExceptionText>(.*?)<\/(?:ows:)?ExceptionText>/s);

                    if (serviceExceptionMatch) {
                        errorMessage += `WFS Error: ${serviceExceptionMatch[1].trim()}`;
                    } else if (exceptionTextMatch) {
                        errorMessage += `WFS Error: ${exceptionTextMatch[1].trim()}`;
                    }

                    errorMessage += '\n\nPossible solutions:\n';
                    errorMessage += '• Authentication required - please log in\n';
                    errorMessage += '• Check the layer name (typeName)\n';
                    errorMessage += '• Use outputFormat=application/json';
                } else {
                    errorMessage += `Content-Type: ${contentType || 'unknown'}`;
                }

                throw new Error(errorMessage);
            }

            const data: FeatureCollection = JSON.parse(text);

            if (data.type === 'FeatureCollection' && data.features) {
                setWfsGeoJson(data);
                setWfsGeoJsonKey(prev => prev + 1);

                // Detect geometry type from first feature if not already set
                if (data.features.length > 0 && data.features[0].geometry) {
                    const detectedGeomType = data.features[0].geometry.type;
                    if (!wfsGeomType) {
                        setWfsGeomType(detectedGeomType);
                        console.log('Detected geometry type from features:', detectedGeomType);
                    }
                }

                const rows: WfsFeatureRow[] = data.features.map((feature: Feature, index: number) => ({
                    id: index,
                    featureId: (feature.id as string) || `feature-${index}`,
                    geometry: feature.geometry,
                    ...feature.properties
                }));
                setWfsFeatures(rows);

                if (data.features.length > 0 && data.features[0].properties) {
                    const propKeys = Object.keys(data.features[0].properties);
                    const columns: GridColDef[] = [
                        {
                            field: 'actions',
                            headerName: '',
                            width: 50,
                            sortable: false,
                            filterable: false,
                            renderCell: (params) => (
                                <Tooltip title="Zoom to geometry">
                                    <IconButton
                                        size="small"
                                        onClick={() => {
                                            const row = params.row as WfsFeatureRow;
                                            setZoomToGeometry(row.geometry);
                                            setZoomTrigger(prev => prev + 1);
                                        }}
                                    >
                                        <SearchIcon />
                                    </IconButton>
                                </Tooltip>
                            ),
                        },
                        {
                            field: 'replaceGeom',
                            headerName: '',
                            width: 50,
                            sortable: false,
                            filterable: false,
                            renderCell: (params) => (
                                <Tooltip title="Replace geometry with geocoding result">
                                    <IconButton
                                        size="small"
                                        onClick={() => {
                                            const row = params.row as WfsFeatureRow;
                                            handleReplaceGeometry(row.id);
                                        }}
                                        disabled={!selectedGeoJson || !accessToken}
                                    >
                                        <ArchitectureIcon />
                                    </IconButton>
                                </Tooltip>
                            ),
                        },
                        ...propKeys.map((key) => ({
                            field: key,
                            headerName: key,
                            flex: 1,
                            minWidth: 100,
                            editable: !!accessToken,
                        }))
                    ];
                    setWfsColumns(columns);
                }

                showSnackbar(`${data.features.length} features loaded`, 'success');
            }
        } catch (error) {
            console.error('Error loading WFS data:', error);

            if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
                showError('CORS error: The server is blocking the request.');
            } else if (error instanceof Error) {
                showError(`Error loading WFS data: ${error.message}`);
            } else {
                showError('Error loading WFS data.');
            }
        } finally {
            setWfsLoading(false);
        }
    }, [wfsUrl, accessToken, showError, showSnackbar]);

    // Store loadWfsData in ref for auto-loading
    useEffect(() => {
        loadWfsDataRef.current = loadWfsData;
    }, [loadWfsData]);

    // Auto-load WFS data when authenticated with WFS URL (only once per URL+token combination)
    useEffect(() => {
        const loadKey = `${accessToken || ''}:${wfsUrl}`;
        if (accessToken && wfsUrl.trim() && loadKey !== lastAutoLoadRef.current && !wfsLoading && loadWfsDataRef.current) {
            lastAutoLoadRef.current = loadKey;
            // Small delay to ensure state is settled
            const timer = setTimeout(() => {
                if (loadWfsDataRef.current) {
                    loadWfsDataRef.current();
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [accessToken, wfsUrl, wfsLoading]);

    // WFS-T Transaction
    const executeWfsTransaction = useCallback(async (
        featureId: string,
        propertyName: string,
        newValue: unknown,
        isGeometryUpdate?: boolean
    ): Promise<boolean> => {
        if (!accessToken) {
            showError('Please log in to save changes.');
            return false;
        }

        if (!wfsUrl || !wfsTypeName) {
            showError('WFS URL or TypeName is missing for the transaction.');
            return false;
        }

        const baseUrl = wfsUrl.split('?')[0];
        const authenticatedUrl = `${baseUrl}?access_token=${encodeURIComponent(accessToken)}`;

        let valueContent: string;
        if (isGeometryUpdate && newValue && typeof newValue === 'object') {
            valueContent = geometryToGml(newValue as Geometry);
        } else {
            valueContent = String(newValue);
        }

        const transactionXml = `<wfs:Transaction service="WFS" version="1.1.0" 
      xmlns:wfs="http://www.opengis.net/wfs" 
      xmlns:gml="http://www.opengis.net/gml" 
      xmlns:ogc="http://www.opengis.net/ogc" 
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      ${wfsNamespace ? `xmlns:${wfsNamespace}="http://www.${wfsNamespace}.org/"` : ''}>
      <wfs:Update typeName="${wfsTypeName}">
        <wfs:Property>
          <wfs:Name>${propertyName}</wfs:Name>
          <wfs:Value>${valueContent}</wfs:Value>
        </wfs:Property>
        <ogc:Filter>
          <ogc:FeatureId fid="${featureId}"/>
        </ogc:Filter>
      </wfs:Update>
    </wfs:Transaction>`;

        try {
            const response = await fetch(authenticatedUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/xml',
                },
                body: transactionXml,
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const responseText = await response.text();
            console.log('WFS-T Response:', responseText);

            if (responseText.includes('totalUpdated>1') || responseText.includes('totalUpdated="1"')) {
                showSnackbar('Feature successfully updated', 'success');
                return true;
            } else if (responseText.includes('Exception')) {
                throw new Error('WFS server returned an error');
            }

            return true;
        } catch (error) {
            console.error('WFS-T Error:', error);
            showError(`Error saving: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return false;
        }
    }, [accessToken, wfsUrl, wfsTypeName, wfsNamespace, showError, showSnackbar]);

    // WFS-T Insert - Add new feature to layer
    const executeWfsInsert = useCallback(async (
        geometry: Geometry,
        properties: Record<string, unknown> = {}
    ): Promise<boolean> => {
        if (!accessToken) {
            showError('Please log in to add features.');
            return false;
        }

        if (!wfsUrl || !wfsTypeName) {
            showError('Please load a WFS layer first.');
            return false;
        }

        const baseUrl = wfsUrl.split('?')[0];
        const authenticatedUrl = `${baseUrl}?access_token=${encodeURIComponent(accessToken)}`;

        // Build property elements from the first loaded feature's properties (as template)
        const currentWfsGeoJson = wfsGeoJsonRef.current;
        let propertyElements = '';

        if (currentWfsGeoJson && currentWfsGeoJson.features.length > 0) {
            const templateProps = currentWfsGeoJson.features[0].properties || {};
            for (const key of Object.keys(templateProps)) {
                // Skip geometry-related fields and id fields
                const keyLower = key.toLowerCase();
                if (keyLower !== 'geometry' &&
                    keyLower !== 'the_geom' &&
                    keyLower !== 'geom' &&
                    keyLower !== 'id' &&
                    keyLower !== 'fid' &&
                    keyLower !== wfsGeomFieldName.toLowerCase()) {
                    const value = properties[key] !== undefined ? String(properties[key]) : '';
                    // Only add non-empty values to avoid parsing issues
                    if (value || key === 'name') {
                        // Escape XML special characters
                        const escapedValue = value
                            .replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;')
                            .replace(/"/g, '&quot;')
                            .replace(/'/g, '&apos;');
                        propertyElements += `      <${wfsNamespace}:${key}>${escapedValue}</${wfsNamespace}:${key}>\n`;
                    }
                }
            }
        }

        // Use stored geometry field name or detect from features
        let geomFieldName = wfsGeomFieldName || 'the_geom';
        if (currentWfsGeoJson && currentWfsGeoJson.features.length > 0) {
            const firstFeature = currentWfsGeoJson.features[0] as any;
            if (firstFeature.geometry_name) {
                geomFieldName = firstFeature.geometry_name;
            }
        }

        // Convert geometry to expected type if needed (e.g., Polygon to MultiPolygon)
        let finalGeometry = geometry;
        if (wfsGeomType && geometry.type !== wfsGeomType) {
            console.log(`Converting geometry from ${geometry.type} to ${wfsGeomType}`);
            finalGeometry = convertGeometryToType(geometry, wfsGeomType);
        }

        const geometryGml = geometryToGml(finalGeometry);

        // Extract just the layer name without namespace prefix for the feature element
        const layerName = wfsTypeName.includes(':') ? wfsTypeName.split(':')[1] : wfsTypeName;

        // Use the namespace URI from DescribeFeatureType, or fallback to constructed one
        const namespaceUri = wfsNamespaceUri || (() => {
            const geoserverBase = baseUrl.replace(/\/ows$|\/wfs$/, '');
            return `${geoserverBase}/${wfsNamespace}`;
        })();

        // Use WFS 1.0.0 format which is more compatible with GeoServer/GeoNode
        const transactionXml = `<?xml version="1.0" encoding="UTF-8"?>
<wfs:Transaction service="WFS" version="1.0.0" 
  xmlns:wfs="http://www.opengis.net/wfs" 
  xmlns:gml="http://www.opengis.net/gml" 
  xmlns:ogc="http://www.opengis.net/ogc"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.0.0/WFS-transaction.xsd"
  ${wfsNamespace ? `xmlns:${wfsNamespace}="${namespaceUri}"` : ''}>
  <wfs:Insert>
    <${wfsNamespace}:${layerName}>
${propertyElements}      <${wfsNamespace}:${geomFieldName}>${geometryGml}</${wfsNamespace}:${geomFieldName}>
    </${wfsNamespace}:${layerName}>
  </wfs:Insert>
</wfs:Transaction>`;

        console.log('WFS-T Insert XML:', transactionXml);

        try {
            const response = await fetch(authenticatedUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/xml',
                },
                body: transactionXml,
            });

            const responseText = await response.text();
            console.log('WFS-T Insert Response:', responseText);

            // Check for WFS 1.0.0 FAILED status
            if (responseText.includes('<wfs:FAILED') || responseText.includes('FAILED/>')) {
                const messageMatch = responseText.match(/<wfs:Message>(.*?)<\/wfs:Message>/s);
                const errorMsg = messageMatch ? messageMatch[1].trim() : 'WFS Transaction failed';
                throw new Error(errorMsg);
            }

            if (!response.ok) {
                // Try to extract error message from XML
                const exceptionMatch = responseText.match(/<(?:ows:)?ExceptionText>(.*?)<\/(?:ows:)?ExceptionText>/s) ||
                    responseText.match(/<ServiceException[^>]*>(.*?)<\/ServiceException>/s);
                const errorMsg = exceptionMatch ? exceptionMatch[1].trim() : `HTTP ${response.status}`;
                throw new Error(errorMsg);
            }

            if (responseText.includes('<wfs:SUCCESS') || responseText.includes('SUCCESS/>') ||
                responseText.includes('totalInserted>1') || responseText.includes('totalInserted="1"') ||
                responseText.includes('InsertResults')) {
                showSnackbar('Feature successfully added to layer!', 'success');
                // Reload the WFS data to show the new feature
                await loadWfsData();
                return true;
            } else if (responseText.includes('Exception')) {
                const exceptionMatch = responseText.match(/<(?:ows:)?ExceptionText>(.*?)<\/(?:ows:)?ExceptionText>/s);
                throw new Error(exceptionMatch ? exceptionMatch[1].trim() : 'WFS server returned an error');
            }

            // Assume success if no exception
            showSnackbar('Feature added', 'success');
            await loadWfsData();
            return true;
        } catch (error) {
            console.error('WFS-T Insert Error:', error);
            showError(`Error adding feature: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return false;
        }
    }, [accessToken, wfsUrl, wfsTypeName, wfsNamespace, wfsNamespaceUri, wfsGeomFieldName, wfsGeomType, showError, showSnackbar, loadWfsData]);

    // Add geocoded feature to layer
    const handleAddToLayer = useCallback(async () => {
        const currentGeoJson = selectedGeoJsonRef.current;
        if (!currentGeoJson) {
            showError('Please select a location from the geocoding search first.');
            return;
        }

        let geometry: Geometry;
        if ('type' in currentGeoJson) {
            if (currentGeoJson.type === 'Feature') {
                geometry = (currentGeoJson as Feature).geometry;
            } else if (currentGeoJson.type === 'FeatureCollection') {
                const fc = currentGeoJson as FeatureCollection;
                if (fc.features.length > 0) {
                    geometry = fc.features[0].geometry;
                } else {
                    showError('No geometry found.');
                    return;
                }
            } else {
                geometry = currentGeoJson as Geometry;
            }
        } else {
            showError('Invalid geocoding geometry.');
            return;
        }

        await executeWfsInsert(geometry, { name: inputValue });
    }, [showError, executeWfsInsert, inputValue]);

    // Replace geometry handler
    const handleReplaceGeometry = useCallback(async (rowIndex: number) => {
        const currentGeoJson = selectedGeoJsonRef.current;
        if (!currentGeoJson) {
            showError('Please select a location from the geocoding search first.');
            return;
        }

        const currentWfsGeoJson = wfsGeoJsonRef.current;
        if (!currentWfsGeoJson) {
            showError('No WFS data loaded.');
            return;
        }

        const feature = currentWfsGeoJson.features[rowIndex];
        const featureId = feature?.id as string | undefined;

        if (!featureId) {
            showError('No feature ID found.');
            return;
        }

        let newGeometry: Geometry;
        if ('type' in currentGeoJson) {
            if (currentGeoJson.type === 'Feature') {
                newGeometry = (currentGeoJson as Feature).geometry;
            } else if (currentGeoJson.type === 'FeatureCollection') {
                const fc = currentGeoJson as FeatureCollection;
                if (fc.features.length > 0) {
                    newGeometry = fc.features[0].geometry;
                } else {
                    showError('No geometry found.');
                    return;
                }
            } else {
                newGeometry = currentGeoJson as Geometry;
            }
        } else {
            showError('Invalid geocoding geometry.');
            return;
        }

        const success = await executeWfsTransaction(featureId, 'geometry', newGeometry, true);

        if (success) {
            setWfsFeatures(prev => prev.map((row, index) =>
                index === rowIndex ? { ...row, geometry: newGeometry } : row
            ));

            setWfsGeoJson(prev => {
                if (!prev) return prev;
                const updatedFeatures = prev.features.map((f, index) =>
                    index === rowIndex ? { ...f, geometry: newGeometry } : f
                );
                return { ...prev, features: updatedFeatures };
            });
            setWfsGeoJsonKey(prev => prev + 1);
        }
    }, [showError, executeWfsTransaction]);

    // Process row update
    const processRowUpdate = useCallback(async (newRow: WfsFeatureRow, oldRow: WfsFeatureRow) => {
        const changedProperties: { key: string; newValue: unknown }[] = [];

        for (const key of Object.keys(newRow)) {
            if (key !== 'id' && key !== 'featureId' && key !== 'geometry' && newRow[key] !== oldRow[key]) {
                changedProperties.push({ key, newValue: newRow[key] });
            }
        }

        if (changedProperties.length === 0) {
            return oldRow;
        }

        const featureId = newRow.featureId;

        for (const change of changedProperties) {
            const success = await executeWfsTransaction(featureId, change.key, change.newValue);
            if (!success) {
                return oldRow;
            }
        }

        setWfsFeatures(prev => prev.map(row => row.id === newRow.id ? newRow : row));
        return newRow;
    }, [executeWfsTransaction]);

    // Geocoding search
    const searchLocation = useCallback(async (query: string) => {
        if (!query || query.length < 2) {
            setOptions([]);
            return;
        }

        setLoading(true);
        try {
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&polygon_geojson=1`;
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'ProjectLocationModel/1.0'
                }
            });
            const data: NominatimResult[] = await response.json();

            if (data.length === 1 && data[0].geojson) {
                setOptions(data);
                setSelectedGeoJson(data[0].geojson);
                setGeoJsonKey(prev => prev + 1);
            } else if (data.length > 1) {
                setOptions(data);
            } else {
                setOptions([]);
            }
        } catch (error) {
            console.error('Geocoding error:', error);
            setOptions([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleInputChange = useCallback((_event: React.SyntheticEvent, newInputValue: string) => {
        setInputValue(newInputValue);

        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }

        debounceTimeoutRef.current = setTimeout(() => {
            searchLocation(newInputValue);
        }, 1000);
    }, [searchLocation]);

    const handleOptionSelect = useCallback((_event: React.SyntheticEvent, value: string | NominatimResult | null) => {
        if (value && typeof value !== 'string' && value.geojson) {
            setSelectedGeoJson(value.geojson);
            setGeoJsonKey(prev => prev + 1);
        }
    }, []);

    // Helper to get server hostname safely
    const getServerHost = useCallback(() => {
        if (!serverUrl) return 'Server';
        try {
            return new URL(serverUrl).host;
        } catch {
            return serverUrl;
        }
    }, [serverUrl]);

    return (
        <div className="geoserver-editor">
            {/* Header */}
            <Box className="editor-header" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h5" component="h1">
                    Location Mapper
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    {accessToken ? (
                        <>
                            <Chip
                                label={`Connected: ${getServerHost()}`}
                                color="success"
                                size="small"
                            />
                            <Tooltip title="Log out">
                                <IconButton onClick={handleLogout} size="small">
                                    <LogoutIcon />
                                </IconButton>
                            </Tooltip>
                        </>
                    ) : (
                        <Button
                            startIcon={<LoginIcon />}
                            variant="outlined"
                            onClick={() => setAuthDialogOpen(true)}
                        >
                            Log in
                        </Button>
                    )}
                    {onNavigateHome && (
                        <Tooltip title="Back to home">
                            <IconButton onClick={onNavigateHome}>
                                <HomeIcon />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>
            </Box>

            {!accessToken && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    Log in to edit layers and update geometries.
                </Alert>
            )}

            {/* Search location and Add to Layer in same row */}
            <Box className="input-section">
                <Autocomplete<NominatimResult, false, false, true>
                    freeSolo
                    options={options}
                    getOptionLabel={(option) =>
                        typeof option === 'string' ? option : option.display_name
                    }
                    loading={loading}
                    inputValue={inputValue}
                    onInputChange={handleInputChange}
                    onChange={handleOptionSelect}
                    isOptionEqualToValue={(option, value) => {
                        const opt = option as NominatimResult;
                        const val = value as NominatimResult;
                        return opt.place_id === val.place_id;
                    }}
                    sx={{ flex: 1 }}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label="Search location or Address"
                            placeholder="Paul-Löbe-Allee 1, Berlin"
                            InputProps={{
                                ...params.InputProps,
                                startAdornment: <AddLocationIcon sx={{ mr: 1, color: 'action.active' }} />,
                                endAdornment: (
                                    <>
                                        {loading ? <CircularProgress color="inherit" size={20} /> : null}
                                        {params.InputProps.endAdornment}
                                    </>
                                ),
                            }}
                        />
                    )}
                    renderOption={(props, option) => {
                        const item = option as NominatimResult;
                        return (
                            <li {...props} key={item.place_id}>
                                {item.display_name}
                            </li>
                        );
                    }}
                />
                {selectedGeoJson && wfsTypeName && (
                    <Box className="add-to-layer-section">
                        <Typography className="geocoded-info">
                            <strong>Selected:</strong> {inputValue || 'Geocoded location'}
                        </Typography>
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<SaveIcon />}
                            onClick={handleAddToLayer}
                            disabled={!accessToken || !wfsTypeName}
                        >
                            Add to layer
                        </Button>
                    </Box>
                )}
            </Box>

            {/* Map */}
            <Box className="map-container" sx={{ mb: 2 }}>
                <MapContainer
                    center={[51.1657, 10.4515]}
                    zoom={6}
                    style={{ height: '100%', width: '100%' }}
                >
                    <MapResizeHandler />
                    {/* Base Layers */}
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
                    <FitBounds geoJson={selectedGeoJson} />
                    <ZoomToFeature geometry={zoomToGeometry} trigger={zoomTrigger} />
                    {selectedGeoJson && (
                        <GeoJSON
                            key={geoJsonKey}
                            data={selectedGeoJson}
                            style={{
                                color: '#3388ff',
                                weight: 2,
                                opacity: 0.8,
                                fillColor: '#3388ff',
                                fillOpacity: 0.3
                            }}
                        />
                    )}
                    {wfsGeoJson && (
                        <GeoJSON
                            key={`wfs-${wfsGeoJsonKey}`}
                            data={wfsGeoJson}
                            style={{
                                color: '#ff5722',
                                weight: 2,
                                opacity: 0.8,
                                fillColor: '#ff5722',
                                fillOpacity: 0.3
                            }}
                        />
                    )}
                </MapContainer>
            </Box>

            {/* Feature Table */}
            {wfsFeatures.length > 0 && (
                <Paper sx={{ height: 300, width: '100%' }}>
                    <DataGrid
                        rows={wfsFeatures}
                        columns={wfsColumns}
                        pageSizeOptions={[5, 10, 25]}
                        initialState={{
                            pagination: { paginationModel: { pageSize: 5 } },
                        }}
                        disableRowSelectionOnClick
                        processRowUpdate={processRowUpdate}
                        onProcessRowUpdateError={(error) => {
                            console.error('Row update error:', error);
                            showError('Error updating.');
                        }}
                    />
                </Paper>
            )}

            {/* Auth Dialog */}
            <GeoServerAuth
                open={authDialogOpen}
                onClose={() => setAuthDialogOpen(false)}
                onAuthenticated={handleAuthenticated}
                initialServerUrl={serverUrl}
                initialWfsUrl={wfsUrl}
            />

            {/* Error Dialog */}
            <Dialog open={dialogOpen} onClose={handleCloseDialog}>
                <DialogTitle>Error</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ whiteSpace: 'pre-line' }}>{dialogMessage}</DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog} autoFocus>
                        OK
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar */}
            <Snackbar
                open={snackbarOpen}
                autoHideDuration={4000}
                onClose={() => setSnackbarOpen(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>
                    {snackbarMessage}
                </Alert>
            </Snackbar>
        </div>
    );
}
