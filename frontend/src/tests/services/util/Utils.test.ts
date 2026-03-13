import { ErrorObject, ValidateFunction } from "ajv";
import Utils from "../../../services/util/Utils.ts";

const fs   = require("fs");
const path = require("path");
const assetsDir = path.resolve(__dirname, "../../assets");
function loadFile(filename: string): ArrayBuffer {
    const buf: Buffer = fs.readFileSync(path.join(assetsDir, filename));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

// ============================================================================
describe("Utils", () => {

    // -----------------------------------------------------------------------
    describe("formatError", () => {
        it("formats error with instancePath and message", () => {
            const e = { instancePath: "/foo", message: "bar" } as ErrorObject;
            expect(Utils.formatError(e)).toBe('Error at "/foo": bar');
        });
        it("formats error with only message", () => {
            const e = { message: "bar" } as ErrorObject;
            expect(Utils.formatError(e)).toBe("Error: bar");
        });
        it("formats error with only instancePath", () => {
            const e = { instancePath: "/foo" } as ErrorObject;
            expect(Utils.formatError(e)).toBe('Error at "/foo"');
        });
        it("formats error with neither instancePath nor message", () => {
            expect(Utils.formatError({} as ErrorObject)).toBe("Error");
        });
    });

    // -----------------------------------------------------------------------
    describe("toDateObj", () => {
        it("converts a full ISO datetime string to a Date object", () => {
            const result = Utils.toDateObj("k", "2024-03-13T10:00:00.000Z");
            expect(result).toBeInstanceOf(Date);
            expect((result as Date).toISOString()).toBe("2024-03-13T10:00:00.000Z");
        });
        it("converts ISO datetime string without milliseconds", () => {
            const result = Utils.toDateObj("k", "2024-03-13T10:00:00Z");
            expect(result).toBeInstanceOf(Date);
        });
        it("does NOT convert a plain date string (YYYY-MM-DD)", () => {
            const result = Utils.toDateObj("k", "2024-03-13");
            expect(result).toBe("2024-03-13");
        });
        it("does NOT convert a random string", () => {
            expect(Utils.toDateObj("k", "hello")).toBe("hello");
        });
        it("passes through numbers unchanged", () => {
            expect(Utils.toDateObj("k", 42)).toBe(42);
        });
        it("passes through null unchanged", () => {
            expect(Utils.toDateObj("k", null)).toBeNull();
        });
        it("can be used as JSON.parse reviver", () => {
            const json = '{"date":"2020-01-01T00:00:00.000Z","name":"test"}';
            const obj = JSON.parse(json, Utils.toDateObj);
            expect(obj.date).toBeInstanceOf(Date);
            expect(obj.name).toBe("test");
        });
    });

    // -----------------------------------------------------------------------
    describe("toGeoFeature", () => {
        it("creates a valid GeoJSON Feature", () => {
            const row = { latitude: "10.5", longitude: "20.3", name: "test" };
            const feature = Utils.toGeoFeature(row);
            expect(feature.type).toBe("Feature");
            expect(feature.geometry.type).toBe("Point");
        });
        it("maps longitude as first coordinate, latitude as second", () => {
            const row = { latitude: "10.5", longitude: "20.3" };
            const feature = Utils.toGeoFeature(row);
            expect(feature.geometry.coordinates).toEqual([20.3, 10.5]);
        });
        it("puts all non-lat/lon fields in properties", () => {
            const row = { latitude: "1", longitude: "2", name: "x", value: "y" };
            const feature = Utils.toGeoFeature(row);
            expect(feature.properties).toEqual({ name: "x", value: "y" });
        });
        it("returns NaN coordinates for non-numeric lat/lon", () => {
            const row = { latitude: "invalid", longitude: "also-invalid" };
            const feature = Utils.toGeoFeature(row);
            expect(feature.geometry.coordinates[0]).toBeNaN();
            expect(feature.geometry.coordinates[1]).toBeNaN();
        });
        it("properties does not contain latitude or longitude", () => {
            const row = { latitude: "1", longitude: "2", extra: "x" };
            const feature = Utils.toGeoFeature(row);
            expect(feature.properties).not.toHaveProperty("latitude");
            expect(feature.properties).not.toHaveProperty("longitude");
        });
    });

    // -----------------------------------------------------------------------
    describe("isExcelObjectWithProperties", () => {
        it("returns true for object with more than one key", () => {
            expect(Utils.isExcelObjectWithProperties({ a: 1, b: 2 })).toBe(true);
        });
        it("returns false for object with exactly one key", () => {
            expect(Utils.isExcelObjectWithProperties({ a: 1 })).toBe(false);
        });
        it("returns false for empty object", () => {
            expect(Utils.isExcelObjectWithProperties({})).toBe(false);
        });
    });

    // -----------------------------------------------------------------------

    // -----------------------------------------------------------------------
    describe("toValidatedFeature", () => {
        it("returns feature if validator returns true", () => {
            const feature = { foo: "bar" };
            expect(Utils.toValidatedFeature(feature, (() => true) as unknown as ValidateFunction<unknown>)).toBe(feature);
        });
        it("returns null if validator returns false", () => {
            expect(Utils.toValidatedFeature({}, (() => false) as unknown as ValidateFunction<unknown>)).toBeNull();
        });
    });

    // -----------------------------------------------------------------------
    describe("notNull", () => {
        it("returns true for a number", () => expect(Utils.notNull(1)).toBe(true));
        it("returns true for 0", ()       => expect(Utils.notNull(0)).toBe(true));
        it("returns true for false", ()   => expect(Utils.notNull(false)).toBe(true));
        it("returns true for empty string", () => expect(Utils.notNull("")).toBe(true));
        it("returns false for null", ()   => expect(Utils.notNull(null)).toBe(false));
    });

    // -----------------------------------------------------------------------
    describe("notUndefined", () => {
        it("returns true for a number", ()  => expect(Utils.notUndefined(1)).toBe(true));
        it("returns true for null", ()       => expect(Utils.notUndefined(null)).toBe(true));
        it("returns true for false", ()      => expect(Utils.notUndefined(false)).toBe(true));
        it("returns true for empty string", () => expect(Utils.notUndefined("")).toBe(true));
        it("returns false for undefined", () => expect(Utils.notUndefined(undefined)).toBe(false));
    });

    // -----------------------------------------------------------------------
    describe("formatAjvErrorsWithRow", () => {
        it("returns empty array for null errors", () => {
            expect(Utils.formatAjvErrorsWithRow(null as any, 1)).toEqual([]);
        });
        it("returns empty array for empty errors array", () => {
            expect(Utils.formatAjvErrorsWithRow([], 1)).toEqual([]);
        });
        it("consolidates /geometry/coordinates errors into one message", () => {
            const errors = [
                { instancePath: "/geometry/coordinates", message: "must be array" },
                { instancePath: "/geometry/type",        message: "must be string" },
            ] as ErrorObject[];
            const result = Utils.formatAjvErrorsWithRow(errors, 2);
            expect(result).toHaveLength(1);
            expect(result[0]).toContain("Row 2");
            expect(result[0]).toContain("coordinates");
        });
        it("consolidates /geometry required-property error", () => {
            const errors = [
                { instancePath: "/geometry", message: "must have required property" },
            ] as ErrorObject[];
            const result = Utils.formatAjvErrorsWithRow(errors, 5);
            expect(result).toHaveLength(1);
            expect(result[0]).toContain("coordinates");
        });
        it("formats non-coordinate errors with row number", () => {
            const errors = [
                { instancePath: "/properties/name", message: "is required" },
            ] as ErrorObject[];
            expect(Utils.formatAjvErrorsWithRow(errors, 3)).toEqual([
                'Row 3 at "/properties/name": is required',
            ]);
        });
        it("formats error without instancePath", () => {
            const errors = [{ message: "some error" }] as ErrorObject[];
            expect(Utils.formatAjvErrorsWithRow(errors, 7)).toEqual(["Row 7: some error"]);
        });
        it("formats error without message", () => {
            const errors = [{ instancePath: "/foo" }] as ErrorObject[];
            expect(Utils.formatAjvErrorsWithRow(errors, 8)).toEqual(['Row 8 at "/foo"']);
        });
        it("mixes coordinate and non-coordinate errors correctly", () => {
            const errors = [
                { instancePath: "/geometry/coordinates", message: "must be array" },
                { instancePath: "/properties/name",      message: "is required" },
            ] as ErrorObject[];
            const result = Utils.formatAjvErrorsWithRow(errors, 4);
            expect(result).toHaveLength(2);
            expect(result[0]).toContain("coordinates");
            expect(result[1]).toContain("/properties/name");
        });
        it("uses correct row number in all messages", () => {
            const errors = [{ instancePath: "/x", message: "y" }] as ErrorObject[];
            expect(Utils.formatAjvErrorsWithRow(errors, 99)[0]).toMatch(/^Row 99/);
        });
    });

    // -----------------------------------------------------------------------
    describe("excelToJson", () => {
        it("returns an array of objects for the English template", () => {
            const data = loadFile("Project_Location_Data_Template_EN_V03.xlsx");
            const result = Utils.excelToJson(data, "en");
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
            expect(typeof result[0]).toBe("object");
        });
        it("returns an array of objects for the French template", () => {
            const data = loadFile("Project_Location_Data_Template_FR_V03.xlsx");
            const result = Utils.excelToJson(data, "fr");
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
        });
        it("throws when sheet for language is missing", () => {
            const data = loadFile("Project_Location_Data_Template_EN_V03.xlsx");
            expect(() => Utils.excelToJson(data, "fr")).toThrow(/Sheet "fill-me Remplissez-moi" not found/);
        });
    });

    // -----------------------------------------------------------------------
    describe("excelToGeoJson", () => {
        it("parses valid English template", () => {
            const data = loadFile("Project_Location_Data_Template_EN_V03.xlsx");
            const features = Utils.excelToGeoJson(data, "en");
            expect(Array.isArray(features)).toBe(true);
            expect(features.length).toBeGreaterThan(0);
            expect(features[0]).toHaveProperty("type", "Feature");
        });
        it("parses valid French template", () => {
            const data = loadFile("Project_Location_Data_Template_FR_V03.xlsx");
            const features = Utils.excelToGeoJson(data, "fr");
            expect(Array.isArray(features)).toBe(true);
            expect(features.length).toBeGreaterThan(0);
            expect(features[0]).toHaveProperty("type", "Feature");
        });
        it("each feature has correct GeoJSON structure", () => {
            const data = loadFile("Project_Location_Data_Template_EN_V03.xlsx");
            const features = Utils.excelToGeoJson(data, "en");
            const f = features[0] as any;
            expect(f).toHaveProperty("geometry");
            expect(f.geometry).toHaveProperty("type", "Point");
            expect(Array.isArray(f.geometry.coordinates)).toBe(true);
            expect(f.geometry.coordinates).toHaveLength(2);
            expect(f).toHaveProperty("properties");
        });
        it("throws error for missing sheet", () => {
            const data = loadFile("sheet_not_found.xlsx");
            expect(() => Utils.excelToGeoJson(data, "en")).toThrow(/Sheet "fill-me" not found/);
        });
        it("throws error if expected sheet for lang is not present", () => {
            const data = loadFile("Project_Location_Data_Template_EN_V03.xlsx");
            expect(() => Utils.excelToGeoJson(data, "fr")).toThrow(/Sheet "fill-me Remplissez-moi" not found/);
        });
    });

    // -----------------------------------------------------------------------
    describe("excelJSToJSON", () => {
        it("returns an array for the English template", async () => {
            const data = loadFile("Project_Location_Data_Template_EN_V03.xlsx");
            const result = await Utils.excelJSToJSON(data, "en");
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
        });
        it("returns an array for the French template", async () => {
            const data = loadFile("Project_Location_Data_Template_FR_V03.xlsx");
            const result = await Utils.excelJSToJSON(data, "fr");
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
        });
        it("returns Date objects for date fields", async () => {
            const data = loadFile("Project_Location_Data_Template_EN_V03.xlsx");
            const result = await Utils.excelJSToJSON(data, "en") as any[];
            const dateFields = ["activity_start_date", "activity_end_date", "date_of_data_collection"];
            const firstRow = result[0];
            const foundDateField = dateFields.find(f => firstRow[f] !== undefined);
            if (foundDateField) {
                expect(firstRow[foundDateField]).toBeInstanceOf(Date);
            }
        });
        it("rejects when the expected sheet is missing", async () => {
            const data = loadFile("Project_Location_Data_Template_EN_V03.xlsx");
            await expect(Utils.excelJSToJSON(data, "fr"))
                .rejects.toThrow(/Sheet "fill-me Remplissez-moi" not found/);
        });
    });
});

