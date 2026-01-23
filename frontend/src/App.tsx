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
    <Box sx={{ pb: 7, minHeight: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100vw', maxWidth: '100vw', position: 'relative' }}>
      <Box sx={{ flex: 1, overflow: 'visible', width: '100vw', maxWidth: '100vw', position: 'relative' }}>
        {currentPage === 'validator' && <FileValidator />}
        {currentPage === 'geoserver' && (
          <GeoServerEditor onNavigateHome={() => setCurrentPage('validator')} />
        )}
      </Box>
      <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000 }} elevation={3}>
        <BottomNavigation
          showLabels
          value={currentPage}
          onChange={(_, newValue) => setCurrentPage(newValue)}
        >
          <BottomNavigationAction
            label="File Validator"
            value="validator"
            icon={<UploadFileIcon />}
          />
            <BottomNavigationAction
              label="Location Mapper"
              value="geoserver"
              icon={<MapIcon />}
            />
        </BottomNavigation>
      </Paper>
    </Box>
  );
}
