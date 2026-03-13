import Papa from "papaparse";

export const safeParseFloat = (unsafeFloatString: string): number => {
    try {
        return parseFloat(unsafeFloatString)
    } catch {
        return NaN
    }
};


// Transform CSV/Excel data to use location with nested latitude and longitude
/* eslint-disable  @typescript-eslint/no-explicit-any */
export const transformCsvToLocation = (data: string | ArrayBuffer | null | undefined) => {
    const parsedData:Array<any> = Papa.parse(data as string, { header: true, dynamicTyping: true }).data;

    return parsedData.map(row => {
        const { latitude, longitude, ...rest } = row;

        return {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [safeParseFloat(longitude), safeParseFloat(latitude)]
            },
            properties: {
                ...rest
            }
        };
    });
};
