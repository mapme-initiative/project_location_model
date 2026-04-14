import {ErrorObject, ValidateFunction} from "ajv";
import * as xlsx from "xlsx";
import {WorkBook} from "xlsx";
import {safeParseFloat} from "./FileConversionMethods.ts";
import * as ExcelJS from 'exceljs';

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
export default class Utils {
    static sheetNameMap = {
        en: "fill-me",
        fr: "fill-me Remplissez-moi",
    };
    static sheetNameArray: Array<string> = ["fill-me", "fill-me Remplissez-moi"];

    /* eslint-disable @typescript-eslint/no-explicit-any */
    static isExcelObjectWithProperties(obj: any): boolean {
        return Object.keys(obj).length > 1;
    }
    static getDataBySheetNameByXSLX(workbook: WorkBook, sheetName: string) {
        const data = xlsx.utils
            .sheet_to_json(workbook.Sheets[sheetName], {range: 2, raw: false, UTC: true, dateNF:"yyyy-mm-dd"})
            .filter(this.isExcelObjectWithProperties);
        return data;
    }


    /* eslint-disable @typescript-eslint/no-explicit-any */
    static toGeoFeature(row: any) {
        const {
            latitude,
            longitude,
            ...rest
        } = row;

        return {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [safeParseFloat(longitude), safeParseFloat(latitude)]
            },
            properties: {
                ...rest,
                latitude: safeParseFloat(latitude),
                longitude: safeParseFloat(longitude)
            }
        };
    }


    public static excelToJson(data: string | ArrayBuffer | null | undefined, lang: SupportedLangs) {
        const {wb, expectedSheetName} = this.useXlsxLbToConvert(data, lang);
        return this.getDataBySheetNameByXSLX(wb, expectedSheetName);
    }


    public static excelToGeoJson(data: string | ArrayBuffer | null | undefined, lang: SupportedLangs) {
        const {wb, expectedSheetName} = this.useXlsxLbToConvert(data, lang);
        return this.getDataBySheetNameByXSLX(wb, expectedSheetName).map(this.toGeoFeature);
    }
    public static excelJSToJSON(data: string | ArrayBuffer | null | undefined, lang: SupportedLangs) {
        return  this.useExcelJsTo(data, lang);
    }
    private static async useExcelJsTo(data: string | ArrayBuffer | null | undefined, lang: SupportedLangs) {
        // Konvertiere die Daten mit ExcelJS in ein JavaScript-Array
        // WICHTIG: Überspringe Data Validations für bessere Performance
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(data as ArrayBuffer, {
            // Überspringe Features, die wir nicht brauchen
            ignoreNodes: [
                'dataValidations',
                'headerFooter',
                'pageSetup',
                'pageMargins',
                // NEU: alle weiteren unnötigen Nodes
                'conditionalFormattings', // oft sehr groß in Formular-Sheets
                'drawing',                // Charts, Bilder
                'hyperlinks',
                'tableParts',
                'autoFilter',
                'mergeCells',
                'sheetProtection',
                'legacyDrawing',
                'extLst',                 // Erweiterungen
                'rowBreaks',
                'colBreaks',
                'picture',
            ]
        });
        const isLangSupported = this.sheetNameArray.includes(this.sheetNameMap[lang]);


        if (!wb) {
            throw new Error('Workbook is null or undefined');
        }
        if (!isLangSupported) {
            throw new Error("The selected Excel file does not contain a valid sheet. Please ensure the sheet is named either 'fill-me' or 'fill-me Remplissez-moi'.");
        }

        if (!(lang in this.sheetNameMap)) {
            throw new Error(`Unsupported language: ${lang}. Supported languages are: ${Object.keys(this.sheetNameMap).join(', ')}`);
        }

        const expectedSheetName = this.sheetNameMap[lang];

        if (!wb.worksheets.some(sheet => sheet.name === this.sheetNameMap[lang])) {
            throw new Error(
                `Sheet "${expectedSheetName}" not found for language ${lang}. ` +
                `Available sheets are: ${wb.worksheets.map(sheet => sheet.name).join(', ')}`
            );
        }

        return this.getDataBySheetNameByExcelJS(wb, expectedSheetName).filter(this.isExcelObjectWithProperties);


    }
    private static getDataBySheetNameByExcelJS(workbook: ExcelJS.Workbook, sheetName: string) {
        // Hole NUR das "fill-me" Sheet
        const worksheet = workbook.getWorksheet(sheetName);

        if (!worksheet) {
            throw new Error("Error: 'fill-me' worksheet not found in the Excel file.");
        }

        // Einmaliger Bulk-Zugriff: komplettes Sheet als 2D-Array (1-basiert, sparse)
        const allValues = worksheet.getSheetValues() as any[][];

        // Header aus Zeile 3 lesen
        const headerRow = allValues[3];
        if (!headerRow || headerRow.length === 0) return [];

        // Header-Map aufbauen: colIndex → headerName
        const headers: string[] = [];
        for (let i = 1; i < headerRow.length; i++) {
            if (headerRow[i] != null) {
                headers[i] = headerRow[i].toString();
            }
        }

        const jsonData: any[] = [];
        const rowCount = worksheet.actualRowCount;

        for (let rowIndex = 4; rowIndex <= rowCount; rowIndex++) {
            const row = allValues[rowIndex];
            if (!row) continue; // leere Zeile (sparse array)

            const rowData: any = {};
            let hasData = false;

            for (let colIndex = 1; colIndex < row.length; colIndex++) {
                const header = headers[colIndex];
                if (!header) continue;

                const cellValue = row[colIndex];
                if (cellValue == null) continue;

                // Dates als YYYY-MM-DD Strings ausgeben (kompatibel mit format: "date" im Schema)
                if (cellValue instanceof Date) {
                    rowData[header] = cellValue.toISOString().split('T')[0];
                } else if (typeof cellValue === 'object' && 'richText' in cellValue) {
                    rowData[header] = cellValue.richText.map((t: any) => t.text).join('');
                } else if (typeof cellValue === 'object' && 'result' in cellValue) {
                    rowData[header] = cellValue.result;
                } else {
                    rowData[header] = cellValue;
                }

                hasData = true;
            }

            if (hasData) {
                jsonData.push(rowData);
            }
        }

        return jsonData;
    }


    private static useXlsxLbToConvert(data: string | ArrayBuffer, lang: "en" | "fr") {


        const wb = xlsx.read(
            // Support both Buffer (Node.js / testing) and binary string (browser)
            typeof data === 'string' ? data as string : data,
            {type: typeof data === 'string' ? "binary" : "buffer"}
        );
        const isLanguageSupported = this.sheetNameArray.includes(this.sheetNameMap[lang]);


        if (!wb) {
            throw new Error('Workbook is null or undefined');
        }
        if (!isLanguageSupported) {
            throw new Error("The selected Excel file does not contain a valid sheet. Please ensure the sheet is named either 'fill-me' or 'fill-me Remplissez-moi'.");
        }

        if (!(lang in this.sheetNameMap)) {
            throw new Error(`Unsupported language: ${lang}. Supported languages are: ${Object.keys(this.sheetNameMap).join(', ')}`);
        }

        const expectedSheetName = this.sheetNameMap[lang];

        if (!wb.SheetNames.includes(expectedSheetName)) {
            throw new Error(
                `Sheet "${expectedSheetName}" not found for language ${lang}. ` +
                `Available sheets are: ${wb.SheetNames.join(', ')}`
            );
        }
        return {wb, expectedSheetName};
    }



// ============================================================================
// Validation Utility Functions
// ============================================================================
    public static toDateObj(key, value){
        if (typeof value !== 'string') return value;
        // ISO-Datetime: "2019-12-13T00:00:00", "2019-12-13T00:00:00.000Z", "2019-12-13T00:00:00+01:00"
        const isoDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;
        // Nur Datum: "2019-12-13"
        const isoDateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
        if (isoDateTimePattern.test(value) || isoDateOnlyPattern.test(value)) {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                return date;
            }
        }
        return value;
    }
    public static formatError(error: ErrorObject): string {
        const path = error.instancePath ? ` at "${error.instancePath}"` : "";
        const message = error.message ? `: ${error.message}` : "";
        return `Error${path}${message}`;
    }

    public static toValidatedFeature(feature: any, validateProject: ValidateFunction<unknown>): any | null {
        const isValid = validateProject(feature);

        if(isValid == false && validateProject.errors == null)
            console.error("Validation failed but no errors provided by AJV");
        if(isValid == false && validateProject.errors != null) {
            console.log(Utils.formatAjvErrorsWithRow(validateProject.errors, -1).join("\n"));
            throw new Error(Utils.formatAjvErrorsWithRow(validateProject.errors, -1).join("\n"));
        }
        return isValid ? feature : null;
    }

    public static notNull<T>(value: T | null): value is T {
        return value !== null;
    }

    public static notUndefined<T>(value: T | undefined): value is T {
        return value !== undefined;
    }

    /**
     * Extract the field name from an AJV error, handling both core and project validator paths.
     * Core validator paths: "/field_name" or "" (root, for required errors)
     * Project validator paths: "/properties/field_name"
     */
    static extractFieldName(error: ErrorObject): string {
        // For "required" errors, the field name is in params.missingProperty
        if (error.keyword === "required" && error.params?.missingProperty) {
            return error.params.missingProperty;
        }

        // Extract from instancePath: "/properties/field_name" or "/field_name"
        const path = error.instancePath || "";
        const parts = path.split("/").filter(Boolean);

        // Skip "properties" prefix if present
        if (parts[0] === "properties" && parts.length > 1) {
            return parts[1];
        }
        return parts[parts.length - 1] || "";
    }

    /**
     * Format a single AJV error into a human-readable message.
     */
    static formatSingleError(error: ErrorObject, rowNumber: number): string {
        const fieldName = Utils.extractFieldName(error);
        const prefix = `Row ${rowNumber}`;

        switch (error.keyword) {
            case "required": {
                return `${prefix}: Missing value for "${fieldName}".`;
            }
            case "type": {
                const expectedType = error.params?.type || "unknown";
                return `${prefix}: "${fieldName}" must be of type ${expectedType}.`;
            }
            case "enum": {
                const allowed = error.params?.allowedValues;
                if (allowed && allowed.length <= 8) {
                    return `${prefix}: "${fieldName}" has an invalid value. Allowed values: ${allowed.join(", ")}.`;
                }
                return `${prefix}: "${fieldName}" has an invalid value. Please check the documentation for allowed values.`;
            }
            case "instanceof": {
                if (error.params?.instanceof === "Date") {
                    return `${prefix}: "${fieldName}" must be a valid date (e.g. 2022-01-01).`;
                }
                return `${prefix}: "${fieldName}" has an invalid format.`;
            }
            case "format": {
                return `${prefix}: "${fieldName}" has an invalid format (expected: ${error.params?.format || "unknown"}).`;
            }
            case "oneOf":
            case "anyOf": {
                if (!fieldName) {
                    return `${prefix}: Data does not match the expected schema.`;
                }
                return `${prefix}: "${fieldName}" does not match any of the expected formats.`;
            }
            default: {
                // Fallback: use AJV's message but with cleaner formatting
                const msg = error.message || "unknown validation error";
                if (fieldName) {
                    return `${prefix}: "${fieldName}" — ${msg}.`;
                }
                return `${prefix}: ${msg}.`;
            }
        }
    }

    /**
     * Check if an AJV error is coordinate/geometry-related.
     */
    static isCoordinateError(error: ErrorObject): boolean {
        return !!(error.instancePath && (
            error.instancePath.startsWith("/geometry/coordinates") ||
            error.instancePath === "/geometry/type" ||
            (error.instancePath === "/geometry" &&
                (error.message?.includes("required property") ||
                    error.message?.includes("must match exactly one schema") ||
                    error.message?.includes("must be null")))
        ));
    }

    public static sanitizeLang(lang: string): SupportedLangs {
        return lang === 'fr' ? 'fr' : 'en';
    }

    /**
     * Format AJV errors for Excel/CSV with row numbers.
     * Produces human-readable messages grouped by error type.
     */
    public static formatAjvErrorsWithRow(errors: ErrorObject[], rowNumber: number): string[] {
        if (!errors) {
            return [];
        }

        const hasCoordinateErrors = errors.some(Utils.isCoordinateError);
        const resultErrors: string[] = [];

        if (hasCoordinateErrors) {
            resultErrors.push(`Row ${rowNumber}: Invalid or missing coordinates (latitude/longitude). The location will not appear on the map.`);
        }

        errors.forEach(error => {
            if (Utils.isCoordinateError(error)) {
                return;
            }
            resultErrors.push(Utils.formatSingleError(error, rowNumber));
        });

        return resultErrors;
    }
}
