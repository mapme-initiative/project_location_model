import React from "react";
import {CircularProgress} from "@mui/material";




export function Processing(): React.ReactElement {
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '1.5rem' }}>
                <CircularProgress />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <p>processing...</p>
            </div>
        </div>
    );
}