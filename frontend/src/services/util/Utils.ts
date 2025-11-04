import {AsyncValidateFunction, ErrorObject, ValidateFunction} from "ajv";
import * as xlsx from "xlsx";
import {WorkBook} from "xlsx";
import {excelDateToString, safeParseFloat} from "./FileConversionMethods.tsx";

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

export class ExcelConverter {
    private static getDataBySheetName(workbook: WorkBook, sheetName: string) {
        const excelData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {range: 2});
        return excelData.map(this.toGeoFeature);
    }

    private static toGeoFeature(row) {
        const {
            primaryKey,
            kfwProjectNoINPRO,
            uniqueId,
            latitude,
            longitude,
            sector,
            location_type,
            plannedOrActualEndDate,
            plannedOrActualStartDate,
            dateOfDataCollection,
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
                sector_location:
                    {
                        sector: sector,
                        location_type: location_type
                    },
                ...rest
            }
        };
    }
    public static removeWhiteSpaceInOneFeatureProperty(f): string {
        return f.properties.kfwProjectNoINPRO.replaceAll(" ", "")
    }
    public static toGeoJson(data: string | ArrayBuffer | null | undefined, lang: SupportedLangs) {
        const wb = xlsx.read(
            // Support both Buffer (Node.js / testing) and binary string (browser)
            typeof data === 'string' ? data as string : data, //if it's a buffer it comes from testing-code/nodejs
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

        return this.getDataBySheetName(wb, expectedSheetName);
    }
}

export class Utils {

    public static toFormatErrors(error) {
        console.log(error);
        const path = error.instancePath ? ` at "${error.instancePath}"` : "";
        const message = error.message ? `: ${error.message}` : "";
        return `Error${path}${message}`;
    }

    public static validateProject:  ValidateFunction<unknown> | AsyncValidateFunction<unknown> | ((data: unknown) => boolean | Promise<boolean>);
    /**
     * iterator function - correct execution: .map(Utils.toFeature, {validateProject})
     * @param feature
     */
    public static toFeature(feature) {
        // support passing via thisArg or using static property
        const validateProject = (this && (this as any).validateProject) || Utils.validateProject;
        const isValid = validateProject ? validateProject(feature) : false;
        // if async promise returned, we cannot await in sync map; treat promise resolving truthy later by returning feature only if already boolean true
        if (typeof isValid === 'boolean') {
            return isValid ? feature : null;
        }
        // Promise case: assume validation will resolve to boolean; optimistic include only if promise already settled true (not typical). Otherwise exclude.
        return null;
    }

    public static notNull(value) {
        return value !== null;
    }

    //TODO: refactor this
    public static notUndefined(value) {
        return value !== undefined;
    }


    /**
     *  formatieren der Fehler für Excel und CSV, ähnlich zu Geojson hier wird noch Zeilennummer mit angegeben
     * @param errors
     * @param rowNumber
     */
    public static formatAjvErrorsCSVExcel(errors: ErrorObject[], rowNumber: number) {

        //console.log(errors)
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
        const resultErrors = [];

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


}