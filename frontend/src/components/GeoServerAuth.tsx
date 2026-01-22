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
                'Automatic authentication failed. ' +
                'Please use the "Access Token" tab and enter a token manually.\n\n' +
                'How to get an Access Token:\n' +
                '1. Log in to GeoNode in your browser\n' +
                '2. Open the Developer Tools (F12)\n' +
                '3. Go to Network > any request > Headers > Cookie\n' +
                '4. Copy the access_token value'
            );
        } catch (err) {
            setError(
                `Connection error: ${err instanceof Error ? err.message : 'Unknown error'}. ` +
                'Please check the server URL and try again.'
            );
        } finally {
            setLoading(false);
        }
    }, [serverUrl, username, password, getBaseUrl, onAuthenticated]);

    // Use manual access token
    const useAccessToken = useCallback(() => {
        if (!accessToken.trim()) {
            setError('Please enter an Access Token.');
            return;
        }
        if (!serverUrl.trim()) {
            setError('Please enter a Server URL.');
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
            <DialogTitle>GeoServer / GeoNode Authentication</DialogTitle>
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
                    helperText="Base URL of GeoServer or GeoNode (e.g. https://example.com)"
                />

                <FormControl fullWidth sx={{ mt: 2 }}>
                    <InputLabel>Server Type</InputLabel>
                    <Select
                        value={serverType}
                        label="Server Type"
                        onChange={(e) => setServerType(e.target.value as 'geonode' | 'geoserver')}
                    >
                        <MenuItem value="geonode">GeoNode</MenuItem>
                        <MenuItem value="geoserver">GeoServer</MenuItem>
                    </Select>
                </FormControl>

                <TabPanel value={tabValue} index={0}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Enter your GeoNode/GeoServer credentials.
                    </Typography>
                    <TextField
                        margin="dense"
                        label="Username"
                        fullWidth
                        variant="outlined"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                    <TextField
                        margin="dense"
                        label="Password"
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
                        If automatic login does not work, you can enter an Access Token manually.
                    </Typography>
                    <Alert severity="info" sx={{ mb: 2 }}>
                        <Typography variant="body2">
                            <strong>How to get an Access Token:</strong><br />
                            1. Log in to GeoNode/GeoServer in your browser<br />
                            2. Open the Developer Tools (F12)<br />
                            3. Go to the Network tab<br />
                            4. Make any WFS request<br />
                            5. Look for "access_token" in the Request Headers or copy the Cookie value
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
                <Button onClick={handleClose}>Cancel</Button>
                {tabValue === 0 ? (
                    <Button
                        onClick={loginToGeoNode}
                        variant="contained"
                        disabled={loading || !username || !password || !serverUrl}
                        startIcon={loading ? <CircularProgress size={16} /> : null}
                    >
                        {loading ? 'Logging in...' : 'Login'}
                    </Button>
                ) : (
                    <Button
                        onClick={useAccessToken}
                        variant="contained"
                        disabled={!accessToken || !serverUrl}
                    >
                        Use Token
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}
