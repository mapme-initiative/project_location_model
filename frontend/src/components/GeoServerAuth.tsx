import React, { useState, useCallback } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    CircularProgress,
    Alert,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Box,
    Typography,
    Tabs,
    Tab
} from '@mui/material';

interface GeoServerAuthProps {
    open: boolean;
    onClose: () => void;
    onAuthenticated: (token: string, serverUrl: string) => void;
    initialServerUrl?: string;
}

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`auth-tabpanel-${index}`}
            aria-labelledby={`auth-tab-${index}`}
            {...other}
        >
            {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
        </div>
    );
}

export default function GeoServerAuth({
    open,
    onClose,
    onAuthenticated,
    initialServerUrl = ''
}: GeoServerAuthProps): React.ReactElement {
    const [tabValue, setTabValue] = useState(0);
    const [serverUrl, setServerUrl] = useState(initialServerUrl);
    const [serverType, setServerType] = useState<'geonode' | 'geoserver'>('geonode');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [accessToken, setAccessToken] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
        setError(null);
    };

    // Extract base URL from full URL
    const getBaseUrl = useCallback((url: string): string => {
        try {
            const urlObj = new URL(url);
            return `${urlObj.protocol}//${urlObj.host}`;
        } catch {
            return url;
        }
    }, []);

    // Login to GeoNode using OAuth2 or session
    const loginToGeoNode = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const baseUrl = getBaseUrl(serverUrl);

            // Try to get OAuth2 token from GeoNode
            const tokenUrl = `${baseUrl}/o/token/`;

            const formData = new URLSearchParams();
            formData.append('grant_type', 'password');
            formData.append('username', username);
            formData.append('password', password);

            // GeoNode uses a default client for password grant
            // You might need to configure this in GeoNode admin
            formData.append('client_id', 'GeoServer');

            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData.toString(),
            });

            if (response.ok) {
                const data = await response.json();
                if (data.access_token) {
                    onAuthenticated(data.access_token, baseUrl);
                    handleClose();
                    return;
                }
            }

            // If OAuth2 fails, try basic auth token endpoint
            const basicAuthTokenUrl = `${baseUrl}/api/o/v4/tokeninfo/`;
            const basicResponse = await fetch(basicAuthTokenUrl, {
                method: 'GET',
                headers: {
                    'Authorization': 'Basic ' + btoa(`${username}:${password}`),
                },
            });

            if (basicResponse.ok) {
                // Basic auth works, but we need an access token
                // Try to create one via API
                const createTokenUrl = `${baseUrl}/api/v2/users/${username}/tokens/`;
                const tokenResponse = await fetch(createTokenUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Basic ' + btoa(`${username}:${password}`),
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ name: 'GeoServer Editor Token' }),
                });

                if (tokenResponse.ok) {
                    const tokenData = await tokenResponse.json();
                    if (tokenData.token) {
                        onAuthenticated(tokenData.token, baseUrl);
                        handleClose();
                        return;
                    }
                }
            }

            // If all else fails, show error with instructions
            setError(
                'Automatische Authentifizierung fehlgeschlagen. ' +
                'Bitte verwenden Sie den Tab "Access Token" und geben Sie einen Token manuell ein.\n\n' +
                'So erhalten Sie einen Access Token:\n' +
                '1. Loggen Sie sich im Browser bei GeoNode ein\n' +
                '2. Öffnen Sie die Entwicklertools (F12)\n' +
                '3. Gehen Sie zu Network > eine Anfrage > Headers > Cookie\n' +
                '4. Kopieren Sie den access_token Wert'
            );
        } catch (err) {
            setError(
                `Verbindungsfehler: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}. ` +
                'Bitte prüfen Sie die Server-URL und versuchen Sie es erneut.'
            );
        } finally {
            setLoading(false);
        }
    }, [serverUrl, username, password, getBaseUrl, onAuthenticated]);

    // Use manual access token
    const useAccessToken = useCallback(() => {
        if (!accessToken.trim()) {
            setError('Bitte geben Sie einen Access Token ein.');
            return;
        }
        if (!serverUrl.trim()) {
            setError('Bitte geben Sie eine Server-URL ein.');
            return;
        }

        const baseUrl = getBaseUrl(serverUrl);
        onAuthenticated(accessToken.trim(), baseUrl);
        handleClose();
    }, [accessToken, serverUrl, getBaseUrl, onAuthenticated]);

    const handleClose = useCallback(() => {
        setError(null);
        setUsername('');
        setPassword('');
        onClose();
    }, [onClose]);

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>GeoServer / GeoNode Authentifizierung</DialogTitle>
            <DialogContent>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs value={tabValue} onChange={handleTabChange}>
                        <Tab label="Login" />
                        <Tab label="Access Token" />
                    </Tabs>
                </Box>

                {error && (
                    <Alert severity="error" sx={{ mt: 2, whiteSpace: 'pre-line' }}>
                        {error}
                    </Alert>
                )}

                {/* Common fields */}
                <TextField
                    autoFocus
                    margin="dense"
                    label="Server URL"
                    placeholder="https://your-geoserver.com"
                    fullWidth
                    variant="outlined"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    sx={{ mt: 2 }}
                    helperText="Basis-URL des GeoServer oder GeoNode (z.B. https://example.com)"
                />

                <FormControl fullWidth sx={{ mt: 2 }}>
                    <InputLabel>Server Typ</InputLabel>
                    <Select
                        value={serverType}
                        label="Server Typ"
                        onChange={(e) => setServerType(e.target.value as 'geonode' | 'geoserver')}
                    >
                        <MenuItem value="geonode">GeoNode</MenuItem>
                        <MenuItem value="geoserver">GeoServer</MenuItem>
                    </Select>
                </FormControl>

                <TabPanel value={tabValue} index={0}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Geben Sie Ihre GeoNode/GeoServer Anmeldedaten ein.
                    </Typography>
                    <TextField
                        margin="dense"
                        label="Benutzername"
                        fullWidth
                        variant="outlined"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                    <TextField
                        margin="dense"
                        label="Passwort"
                        type="password"
                        fullWidth
                        variant="outlined"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && username && password) {
                                loginToGeoNode();
                            }
                        }}
                    />
                </TabPanel>

                <TabPanel value={tabValue} index={1}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Falls die automatische Anmeldung nicht funktioniert, können Sie einen Access Token manuell eingeben.
                    </Typography>
                    <Alert severity="info" sx={{ mb: 2 }}>
                        <Typography variant="body2">
                            <strong>So erhalten Sie einen Access Token:</strong><br />
                            1. Loggen Sie sich im Browser bei GeoNode/GeoServer ein<br />
                            2. Öffnen Sie die Entwicklertools (F12)<br />
                            3. Gehen Sie zu Network Tab<br />
                            4. Laden Sie eine beliebige WFS-Anfrage<br />
                            5. Suchen Sie in den Request Headers nach "access_token" oder kopieren Sie den Cookie-Wert
                        </Typography>
                    </Alert>
                    <TextField
                        margin="dense"
                        label="Access Token"
                        fullWidth
                        variant="outlined"
                        value={accessToken}
                        onChange={(e) => setAccessToken(e.target.value)}
                        multiline
                        rows={2}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey && accessToken) {
                                e.preventDefault();
                                useAccessToken();
                            }
                        }}
                    />
                </TabPanel>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Abbrechen</Button>
                {tabValue === 0 ? (
                    <Button
                        onClick={loginToGeoNode}
                        variant="contained"
                        disabled={loading || !username || !password || !serverUrl}
                        startIcon={loading ? <CircularProgress size={16} /> : null}
                    >
                        {loading ? 'Anmelden...' : 'Anmelden'}
                    </Button>
                ) : (
                    <Button
                        onClick={useAccessToken}
                        variant="contained"
                        disabled={!accessToken || !serverUrl}
                    >
                        Token verwenden
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}
