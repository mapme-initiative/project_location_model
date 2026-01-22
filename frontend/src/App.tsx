import { useState } from 'react';
import './App.scss'

import FileValidator from './components/FileValidator';
import GeoServerEditor from './components/GeoServerEditor';
import { Box, BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import MapIcon from '@mui/icons-material/Map';

type PageType = 'validator' | 'geoserver';

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('validator');

  return (
    <Box sx={{ pb: 7, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {currentPage === 'validator' && <FileValidator />}
        {currentPage === 'geoserver' && (
          <GeoServerEditor onNavigateHome={() => setCurrentPage('validator')} />
        )}
      </Box>
      <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0 }} elevation={3}>
        <BottomNavigation
          showLabels
          value={currentPage}
          onChange={(_, newValue) => setCurrentPage(newValue)}
        >
          <BottomNavigationAction
            label="Datei-Validator"
            value="validator"
            icon={<UploadFileIcon />}
          />
          <BottomNavigationAction
            label="GeoServer Editor"
            value="geoserver"
            icon={<MapIcon />}
          />
        </BottomNavigation>
      </Paper>
    </Box>
  );
}
