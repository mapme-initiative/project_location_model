import { excelDateToString, safeParseFloat, safeParseInt, transformCsvToLocation } from '../../../services/util/FileConversionMethods';

describe('excelDateToString', () => {
    it('converts Excel date to string (normal case)', () => {
        // Excel date 44561 = 2021-12-31
        expect(excelDateToString(44561)).toBe('2021-12-31');
    });
    it('returns input as string if not a number', () => {
        expect(excelDateToString(NaN)).toBe('NaN');
        expect(excelDateToString(undefined)).toBe('undefined');
    });
});

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

describe('safeParseInt', () => {
    it('parses valid int string', () => {
        expect(safeParseInt('42')).toBe(42);
    });
    it('returns NaN for invalid int', () => {
        expect(safeParseInt('abc')).toBeNaN();
    });
    it('parses negative and zero', () => {
        expect(safeParseInt('-7')).toBe(-7);
        expect(safeParseInt('0')).toBe(0);
    });
});

describe('transformCsvToLocation', () => {
    it('transforms array of objects to GeoJSON features', () => {
        const input = [
            {
                latitude: '10.1',
                longitude: '20.2',
                budgetShare: '100.5',
                dac5PurposeCode: '123',
                sector: 'A',
                location_type: 'B',
                foo: 'bar'
            }
        ];
        const result = transformCsvToLocation(input);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [20.2, 10.1] },
            properties: {
                budgetShare: 100.5,
                dac5PurposeCode: 123,
                sector_location: { sector: 'A', location_type: 'B' },
                foo: 'bar'
            }
        });
    });
    it('handles missing/invalid numbers gracefully', () => {
        const input = [
            { latitude: 'x', longitude: 'y', budgetShare: 'z', dac5PurposeCode: 'q', sector: null, location_type: undefined }
        ];
        const result = transformCsvToLocation(input);
        expect(result[0].geometry.coordinates[0]).toBeNaN();
        expect(result[0].geometry.coordinates[1]).toBeNaN();
        expect(result[0].properties.budgetShare).toBeNaN();
        expect(result[0].properties.dac5PurposeCode).toBeNaN();
        expect(result[0].properties.sector_location).toEqual({ sector: null, location_type: undefined });
    });
});

