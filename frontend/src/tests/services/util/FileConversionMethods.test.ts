import { safeParseFloat, transformCsvToLocation } from '../../../services/util/FileConversionMethods';
import * as fs from 'fs';
import * as path from 'path';




describe('safeParseFloat', () => {
    it('parses valid float string', () => {
        expect(safeParseFloat('123.45')).toBeCloseTo(123.45);
    });
    it('returns NaN for invalid float', () => {
        expect(safeParseFloat('abc')).toBeNaN();
    });
    it('parses negative and zero', () => {
        expect(safeParseFloat('-1.5')).toBeCloseTo(-1.5);
        expect(safeParseFloat('0')).toBe(0);
    });
});


describe('transformCsvToLocation', () => {
    it('parses CSV string and maps to GeoJSON Features', () => {
        // dynamicTyping: true konvertiert Zahlen-Strings automatisch zu numbers
        const csv = fs.readFileSync(path.join(__dirname, 'testData/sampleLocation.csv'), 'utf-8');
        const result = transformCsvToLocation(csv);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [20.2, 10.1] },
            properties: {
                budgetShare: 100.5,
                dac5PurposeCode: 123,
                sector: 'A',
                location_type: 'B',
                foo: 'bar'
            }
        });
    });

    it('returns NaN coordinates for non-numeric lat/lon', () => {
        const csv = 'latitude,longitude\nx,y';
        const result = transformCsvToLocation(csv);
        expect(result[0].geometry.coordinates[0]).toBeNaN();
        expect(result[0].geometry.coordinates[1]).toBeNaN();
    });
});

