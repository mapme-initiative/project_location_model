import { ErrorObject, ValidateFunction } from "ajv";
import * as xlsx from "xlsx";
import { WorkBook } from "xlsx";
import { excelDateToString, safeParseFloat } from "./FileConversionMethods.tsx";

export enum OGMFileTypes {
    CSV = "text/csv",
    JSON_TEXT = "text/json",
    JSON_APP = "application/json",
    OPENOFFICE = "application/vnd.oasis.opendocument.spreadsheet",
    XLS = "application/vnd.ms-excel",
    XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    GEOJSON = "application/geo+json"
}

export type SupportedLangs = "en" | "fr";

// ============================================================================
// Excel Conversion Functions
// ============================================================================

function getDataBySheetName(workbook: WorkBook, sheetName: string) {
    const excelData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { range: 2 });
    return excelData.map(toGeoFeature);
}

function toGeoFeature(row: any) {
    const {
        primaryKey,
        kfwProjectNoINPRO,
        uniqueId,
        latitude,
        longitude,
        plannedOrActualEndDate,
        plannedOrActualStartDate,
        dateOfDataCollection,
        projectSpecificLocationIdentifier,
        ...rest
    } = row;

    return {
        type: "Feature",
        geometry: {
            type: "Point",
            coordinates: [safeParseFloat(longitude), safeParseFloat(latitude)]
        },
        properties: {
            primaryKey: primaryKey !== undefined && primaryKey !== null ? primaryKey.toString() : undefined,
            kfwProjectNoINPRO: kfwProjectNoINPRO !== undefined && kfwProjectNoINPRO !== null ? kfwProjectNoINPRO?.toString() : undefined,
            uniqueId: uniqueId !== undefined && uniqueId !== null ? uniqueId.toString() : undefined,
            plannedOrActualEndDate: excelDateToString(plannedOrActualEndDate),
            plannedOrActualStartDate: excelDateToString(plannedOrActualStartDate),
            dateOfDataCollection: excelDateToString(dateOfDataCollection),
            projectSpecificLocationIdentifier: projectSpecificLocationIdentifier !== undefined && projectSpecificLocationIdentifier !== null ? projectSpecificLocationIdentifier.toString() : undefined,
            ...rest
        }
    };
}

export function removeWhiteSpaceInFeatureProperty(f: any): string {
    return f.properties.kfwProjectNoINPRO.replaceAll(" ", "");
}

export function excelToGeoJson(data: string | ArrayBuffer | null | undefined, lang: SupportedLangs) {
    const wb = xlsx.read(
        // Support both Buffer (Node.js / testing) and binary string (browser)
        typeof data === 'string' ? data as string : data,
        { type: typeof data === 'string' ? "binary" : "buffer" }
    );
    const sheetName = wb.SheetNames[1];
    const sheetNameArray: Array<string> = ["fill-me", "fill-me Remplissez-moi"];
    const hasCorrectSheet = sheetNameArray.includes(sheetName);
    const sheetNameMap = {
        en: "fill-me",
        fr: "fill-me Remplissez-moi",
    };

    if (!wb) {
        throw new Error('Workbook is null or undefined');
    }
    if (!hasCorrectSheet) {
        throw new Error("The selected Excel file does not contain a valid sheet. Please ensure the sheet is named either 'fill-me' or 'fill-me Remplissez-moi'.");
    }

    if (!(lang in sheetNameMap)) {
        throw new Error(`Unsupported language: ${lang}. Supported languages are: ${Object.keys(sheetNameMap).join(', ')}`);
    }

    const expectedSheetName = sheetNameMap[lang];

    if (!wb.SheetNames.includes(expectedSheetName)) {
        throw new Error(
            `Sheet \"${expectedSheetName}\" not found for language ${lang}. ` +
            `Available sheets are: ${wb.SheetNames.join(', ')}`
        );
    }

    return getDataBySheetName(wb, expectedSheetName);
}

// ============================================================================
// Validation Utility Functions
// ============================================================================

export function formatError(error: ErrorObject): string {
    const path = error.instancePath ? ` at "${error.instancePath}"` : "";
    const message = error.message ? `: ${error.message}` : "";
    return `Error${path}${message}`;
}

export function toValidatedFeature(feature: any, validateProject: ValidateFunction<unknown>): any | null {
    const isValid = validateProject(feature);
    return isValid ? feature : null;
}

export function notNull<T>(value: T | null): value is T {
    return value !== null;
}

export function notUndefined<T>(value: T | undefined): value is T {
    return value !== undefined;
}

/**
 * Format AJV errors for Excel/CSV with row numbers
 */
export function formatAjvErrorsWithRow(errors: ErrorObject[], rowNumber: number): string[] {
    if (!errors) {
        return [];
    }

    // Check if there are any coordinate-related errors
    const hasCoordinateErrors = errors.some(error =>
    (error.instancePath && (
        error.instancePath.startsWith("/geometry/coordinates") ||
        error.instancePath === "/geometry/type" ||
        (error.instancePath === "/geometry" &&
            (error.message?.includes("required property") ||
                error.message?.includes("must match exactly one schema") ||
                error.message?.includes("must be null")))
    ))
    );

    // Initialize the result array
    const resultErrors: string[] = [];

    // If coordinate errors exist, add a single clear message
    if (hasCoordinateErrors) {
        resultErrors.push(`Row ${rowNumber}: Invalid or missing coordinates (latitude/longitude values). The project location is not printed on the map.`);
    }

    // Add all non-coordinate related errors
    errors.forEach(error => {
        // Skip coordinate-related errors since we've already added a consolidated message for them
        if (error.instancePath && (
            error.instancePath.startsWith("/geometry/coordinates") ||
            error.instancePath === "/geometry/type" ||
            (error.instancePath === "/geometry" &&
                (error.message?.includes("required property") ||
                    error.message?.includes("must match exactly one schema") ||
                    error.message?.includes("must be null")))
        )) {
            return; // Skip this error
        }

        // Format and add other errors
        const path = error.instancePath ? ` at "${error.instancePath}"` : "";
        const message = error.message ? `: ${error.message}` : "";
        resultErrors.push(`Row ${rowNumber}${path}${message}`);
    });

    return resultErrors;
}