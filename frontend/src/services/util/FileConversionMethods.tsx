/* eslint-disable  @typescript-eslint/no-explicit-any */
export const excelDateToString = (excelDate: number): string => {
    try {
        if (typeof excelDate !== 'number' || isNaN(excelDate)) return String(excelDate);
        // Excel's day 1 is 1900-01-01, but JS Date.UTC(1899, 11, 31) is day 0
        const utc_days = Math.floor(excelDate - 1);
        const utc_value = Date.UTC(1899, 11, 31) + utc_days * 86400000;
        return new Date(utc_value).toISOString().slice(0, 10);
    } catch (error) {
        return "" + excelDate;
    }
};
export const safeParseFloat = (unsafeFloatString: string): number => {
    try {
        return parseFloat(unsafeFloatString)
    } catch (error) {
        return NaN
    }
};
export const safeParseInt = (unsafeFloatString: string): number => {
    try {
        return parseInt(unsafeFloatString)
    } catch (error) {
        return NaN
    }
};
// Transform CSV/Excel data to use location with nested latitude and longitude
export const transformCsvToLocation = (data: any[]) => {
    return data.map(row => {
        const { latitude, longitude, budgetShare, dac5PurposeCode, sector, location_type, ...rest } = row;

        return {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [safeParseFloat(longitude), safeParseFloat(latitude)]
            },
            properties: {
                budgetShare: safeParseFloat(budgetShare),
                dac5PurposeCode: safeParseInt(dac5PurposeCode),
                sector_location:
                {
                    sector: sector,
                    location_type: location_type
                },
                ...rest
            }
        };
    });
};
