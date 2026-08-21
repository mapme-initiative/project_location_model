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
    describe("sanitizeLang", () => {
        it("returns 'en' for English", () => {
            expect(Utils.sanitizeLang("en")).toBe("en");
        });
        it("returns 'fr' for French", () => {
            expect(Utils.sanitizeLang("fr")).toBe("fr");
        });
        it("returns 'es' for Spanish", () => {
            expect(Utils.sanitizeLang("es")).toBe("es");
        });
        it("falls back to 'en' and warns for unsupported language", () => {
            const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
            expect(Utils.sanitizeLang("de")).toBe("en");
            expect(warnSpy).toHaveBeenCalledWith(
                'Unsupported language "de", falling back to "en"'
            );
            warnSpy.mockRestore();
        });
        it("falls back to 'en' and warns for empty string", () => {
            const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
            expect(Utils.sanitizeLang("")).toBe("en");
            expect(warnSpy).toHaveBeenCalled();
            warnSpy.mockRestore();
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
        it("converts a plain date string (YYYY-MM-DD) to a Date object", () => {
            const result = Utils.toDateObj("k", "2024-03-13");
            expect(result).toBeInstanceOf(Date);
            expect((result as Date).toISOString()).toBe("2024-03-13T00:00:00.000Z");
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
            const row = { latitude: 1, longitude: 2, name: "x", value: "y" };
            const feature = Utils.toGeoFeature(row);
            expect(feature.properties).toEqual({ name: "x", value: "y", latitude: 1, longitude: 2 });
        });
        it("returns NaN coordinates for non-numeric lat/lon", () => {
            const row = { latitude: "invalid", longitude: "also-invalid" };
            const feature = Utils.toGeoFeature(row);
            expect(feature.geometry.coordinates[0]).toBeNaN();
            expect(feature.geometry.coordinates[1]).toBeNaN();
        });
    });

    // -----------------------------------------------------------------------
    describe("buildOrderedProperties", () => {
        it("places prefix fields first, suffix fields last, and preserves rest order", () => {
            const raw = {
                donor_project_no: 29937,
                scheme_version: "4.0",
                location_name: "Site A",
                fid: -1,
                geographic_exactness: "exact",
                date_of_data_collection: "2026-07-14",
                longitude: 74.59,
                latitude: 36.29,
            };
            const ordered = Utils.buildOrderedProperties(raw);
            expect(Object.keys(ordered)).toEqual([
                "fid",
                "scheme_version",
                "date_of_data_collection",
                "donor_project_no",
                "location_name",
                "geographic_exactness",
                "latitude",
                "longitude",
            ]);
        });
        it("omits prefix keys that are not present", () => {
            const raw = { scheme_version: "4.0", donor_project_no: 1 };
            const ordered = Utils.buildOrderedProperties(raw);
            expect(Object.keys(ordered)).toEqual(["scheme_version", "donor_project_no"]);
        });
        it("orderFeature applies ordering to feature properties", () => {
            const feature = Utils.orderFeature({
                type: "Feature",
                properties: { longitude: 1, scheme_version: "4.0", fid: -1, latitude: 2 },
            });
            expect(Object.keys(feature.properties!)).toEqual([
                "fid",
                "scheme_version",
                "latitude",
                "longitude",
            ]);
        });
    });

    // -----------------------------------------------------------------------
    describe("stripExampleRows", () => {
        it("removes flat rows with donor_project_no as number 123456789", () => {
            const rows = [
                { donor_project_no: 123456789, location_name: "Example" },
                { donor_project_no: 29937, location_name: "Real" },
            ];
            const { items, removedCount } = Utils.stripExampleRows(rows);
            expect(removedCount).toBe(1);
            expect(items).toEqual([{ donor_project_no: 29937, location_name: "Real" }]);
        });
        it("removes flat rows with donor_project_no as string '123456789'", () => {
            const rows = [
                { donor_project_no: "123456789", location_name: "Example" },
                { donor_project_no: 29937, location_name: "Real" },
            ];
            const { items, removedCount } = Utils.stripExampleRows(rows);
            expect(removedCount).toBe(1);
            expect(items).toHaveLength(1);
        });
        it("removes GeoJSON features with example project number in properties", () => {
            const features = [
                { type: "Feature", properties: { donor_project_no: 123456789 } },
                { type: "Feature", properties: { donor_project_no: 29937 } },
            ];
            const { items, removedCount } = Utils.stripExampleRows(features);
            expect(removedCount).toBe(1);
            expect(items).toHaveLength(1);
            expect(items[0].properties.donor_project_no).toBe(29937);
        });
        it("returns removedCount 0 when no example rows present", () => {
            const { items, removedCount } = Utils.stripExampleRows([
                { donor_project_no: 29937 },
            ]);
            expect(removedCount).toBe(0);
            expect(items).toHaveLength(1);
        });
        it("getExampleRowsRemovedNote returns null when nothing removed", () => {
            expect(Utils.getExampleRowsRemovedNote(0)).toBeNull();
        });
        it("getExampleRowsRemovedNote returns note when rows were removed", () => {
            expect(Utils.getExampleRowsRemovedNote(1)).toContain("123456789");
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
    describe("extractFieldName", () => {
        it("extracts from /properties/field_name path", () => {
            const error = { instancePath: "/properties/data_provider", keyword: "type" } as ErrorObject;
            expect(Utils.extractFieldName(error)).toBe("data_provider");
        });
        it("extracts from /field_name path (core validator)", () => {
            const error = { instancePath: "/donor_project_no", keyword: "type" } as ErrorObject;
            expect(Utils.extractFieldName(error)).toBe("donor_project_no");
        });
        it("extracts missingProperty for required errors", () => {
            const error = { instancePath: "", keyword: "required", schemaPath: "", params: { missingProperty: "scheme_version" } } as ErrorObject;
            expect(Utils.extractFieldName(error)).toBe("scheme_version");
        });
        it("returns empty string for root path without required", () => {
            const error = { instancePath: "", keyword: "type" } as ErrorObject;
            expect(Utils.extractFieldName(error)).toBe("");
        });
    });

    // -----------------------------------------------------------------------
    describe("formatSingleError", () => {
        it("formats required error with missing property name", () => {
            const error = { keyword: "required", instancePath: "", schemaPath: "", params: { missingProperty: "data_provider" }, message: "must have required property 'data_provider'" } as ErrorObject;
            const result = Utils.formatSingleError(error, 1);
            expect(result).toBe('Row 1: Missing value for "data_provider".');
        });
        it("formats type error", () => {
            const error = { keyword: "type", instancePath: "/properties/donor_project_no", schemaPath: "", params: { type: "number" }, message: "must be number" } as ErrorObject;
            const result = Utils.formatSingleError(error, 2);
            expect(result).toBe('Row 2: "donor_project_no" must be of type number.');
        });
        it("formats enum error with short allowed values list", () => {
            const error = { keyword: "enum", instancePath: "/properties/geographic_exactness", schemaPath: "", params: { allowedValues: ["exact", "approximate (yet unknown)", "approximate (security)", "approximate (admin unit)"] }, message: "must be equal to one of the allowed values" } as ErrorObject;
            const result = Utils.formatSingleError(error, 3);
            expect(result).toContain('Row 3: "geographic_exactness" has an invalid value.');
            expect(result).toContain("exact");
            expect(result).toContain("approximate (admin unit)");
        });
        it("formats enum error with long list as doc reference", () => {
            const longValues = Array.from({ length: 20 }, (_, i) => `value_${i}`);
            const error = { keyword: "enum", instancePath: "/properties/location_type_name", schemaPath: "", params: { allowedValues: longValues }, message: "must be equal to one of the allowed values" } as ErrorObject;
            const result = Utils.formatSingleError(error, 4);
            expect(result).toContain("check the documentation");
        });
        it("formats instanceof Date error", () => {
            const error = { keyword: "instanceof", instancePath: "/properties/date_of_data_collection", schemaPath: "", params: { instanceof: "Date" }, message: 'must pass "instanceof" keyword validation' } as ErrorObject;
            const result = Utils.formatSingleError(error, 5);
            expect(result).toBe('Row 5: "date_of_data_collection" must be a valid date (e.g. 2022-01-01).');
        });
        it("formats unknown keyword with fallback", () => {
            const error = { keyword: "minLength", instancePath: "/properties/project_acronym", params: {}, message: "must NOT have fewer than 1 characters" } as ErrorObject;
            const result = Utils.formatSingleError(error, 6);
            expect(result).toBe('Row 6: "project_acronym" — must NOT have fewer than 1 characters.');
        });
    });

    // -----------------------------------------------------------------------
    describe("isCoordinateError", () => {
        it("returns true for /geometry/coordinates path", () => {
            expect(Utils.isCoordinateError({ instancePath: "/geometry/coordinates/0", message: "must be number" } as ErrorObject)).toBe(true);
        });
        it("returns true for /geometry/type path", () => {
            expect(Utils.isCoordinateError({ instancePath: "/geometry/type", message: "must be string" } as ErrorObject)).toBe(true);
        });
        it("returns true for /geometry required property error", () => {
            expect(Utils.isCoordinateError({ instancePath: "/geometry", message: "must have required property" } as ErrorObject)).toBe(true);
        });
        it("returns false for property path", () => {
            expect(Utils.isCoordinateError({ instancePath: "/properties/name", message: "is required" } as ErrorObject)).toBe(false);
        });
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
        it("formats required errors with human-readable message", () => {
            const errors = [
                { keyword: "required", instancePath: "", schemaPath: "", params: { missingProperty: "data_provider" }, message: "must have required property 'data_provider'" },
            ] as ErrorObject[];
            const result = Utils.formatAjvErrorsWithRow(errors, 3);
            expect(result).toEqual(['Row 3: Missing value for "data_provider".']);
        });
        it("formats type errors with expected type", () => {
            const errors = [
                { keyword: "type", instancePath: "/donor_project_no", schemaPath: "", params: { type: "number" }, message: "must be number" },
            ] as ErrorObject[];
            const result = Utils.formatAjvErrorsWithRow(errors, 7);
            expect(result[0]).toContain('"donor_project_no" must be of type number');
        });
        it("formats enum errors with allowed values", () => {
            const errors = [
                { keyword: "enum", instancePath: "/geographic_exactness", schemaPath: "", params: { allowedValues: ["exact", "approximate (yet unknown)"] }, message: "must be equal to one of the allowed values" },
            ] as ErrorObject[];
            const result = Utils.formatAjvErrorsWithRow(errors, 1);
            expect(result[0]).toContain("invalid value");
            expect(result[0]).toContain("exact");
        });
        it("formats instanceof Date errors", () => {
            const errors = [
                { keyword: "instanceof", instancePath: "/date_of_data_collection", schemaPath: "", params: { instanceof: "Date" }, message: 'must pass "instanceof" keyword validation' },
            ] as ErrorObject[];
            const result = Utils.formatAjvErrorsWithRow(errors, 1);
            expect(result[0]).toContain("valid date");
            expect(result[0]).toContain("2022-01-01");
        });
        it("mixes coordinate and non-coordinate errors correctly", () => {
            const errors = [
                { instancePath: "/geometry/coordinates", message: "must be array" },
                { keyword: "required", instancePath: "", params: { missingProperty: "name" }, message: "must have required property 'name'" },
            ] as ErrorObject[];
            const result = Utils.formatAjvErrorsWithRow(errors, 4);
            expect(result).toHaveLength(2);
            expect(result[0]).toContain("coordinates");
            expect(result[1]).toContain('Missing value for "name"');
        });
        it("uses correct row number in all messages", () => {
            const errors = [{ keyword: "type", instancePath: "/x", schemaPath: "", params: { type: "string" }, message: "must be string" }] as ErrorObject[];
            expect(Utils.formatAjvErrorsWithRow(errors, 99)[0]).toMatch(/^Row 99/);
        });
    });

    // -----------------------------------------------------------------------
    describe("excelToJson", () => {
        it("returns an array of objects for the English template", () => {
            const data = loadFile("Project_Location_Data_Template_EN_V04.xlsx");
            const result = Utils.excelToJson(data, "en");
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
            expect(typeof result[0]).toBe("object");
        });
        // TODO: re-enable once an official FR V04 template is available.
        // The parser reads the V04 layout (header row 3); the FR V03 fixture uses the old layout.
        it.skip("returns an array of objects for the French template", () => {
            const data = loadFile("Project_Location_Data_Template_FR_V04.xlsx");
            const result = Utils.excelToJson(data, "fr");
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
        });
        it("returns an array of objects for the Spanish template", () => {
            const data = loadFile("Project_Location_Data_Template_ES_V04.xlsx");
            const result = Utils.excelToJson(data, "es");
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
            expect(typeof result[0]).toBe("object");
        });
        it("throws when sheet for language is missing", () => {
            const data = loadFile("Project_Location_Data_Template_EN_V04.xlsx");
            expect(() => Utils.excelToJson(data, "fr")).toThrow(/Sheet "fill-me Remplissez-moi" not found/);
        });
        it("throws when ES sheet is missing from EN template", () => {
            const data = loadFile("Project_Location_Data_Template_EN_V04.xlsx");
            expect(() => Utils.excelToJson(data, "es")).toThrow(/Sheet "fill-me - relléname" not found/);
        });
    });

    // -----------------------------------------------------------------------
    describe("excelToGeoJson", () => {
        it("parses valid English template", () => {
            const data = loadFile("Project_Location_Data_Template_EN_V04.xlsx");
            const features = Utils.excelToGeoJson(data, "en");
            expect(Array.isArray(features)).toBe(true);
            expect(features.length).toBeGreaterThan(0);
            expect(features[0]).toHaveProperty("type", "Feature");
        });
        // TODO: re-enable once an official FR V04 template is available.
        // The parser reads the V04 layout (header row 3); the FR V03 fixture uses the old layout.
        it.skip("parses valid French template", () => {
            const data = loadFile("Project_Location_Data_Template_FR_V04.xlsx");
            const features = Utils.excelToGeoJson(data, "fr");
            expect(Array.isArray(features)).toBe(true);
            expect(features.length).toBeGreaterThan(0);
            expect(features[0]).toHaveProperty("type", "Feature");
        });
        it("each feature has correct GeoJSON structure", () => {
            const data = loadFile("Project_Location_Data_Template_EN_V04.xlsx");
            const features = Utils.excelToGeoJson(data, "en");
            const f = features[0] as any;
            expect(f).toHaveProperty("geometry");
            expect(f.geometry).toHaveProperty("type", "Point");
            expect(Array.isArray(f.geometry.coordinates)).toBe(true);
            expect(f.geometry.coordinates).toHaveLength(2);
            expect(f).toHaveProperty("properties");
        });
        it("parses valid Spanish template", () => {
            const data = loadFile("Project_Location_Data_Template_ES_V04.xlsx");
            const features = Utils.excelToGeoJson(data, "es");
            expect(Array.isArray(features)).toBe(true);
            expect(features.length).toBeGreaterThan(0);
            expect(features[0]).toHaveProperty("type", "Feature");
        });
        it("throws error for missing sheet", () => {
            const data = loadFile("sheet_not_found.xlsx");
            expect(() => Utils.excelToGeoJson(data, "en")).toThrow(/Sheet "fill-me" not found/);
        });
        it("throws error if expected sheet for lang is not present", () => {
            const data = loadFile("Project_Location_Data_Template_EN_V04.xlsx");
            expect(() => Utils.excelToGeoJson(data, "fr")).toThrow(/Sheet "fill-me Remplissez-moi" not found/);
        });
    });

    // -----------------------------------------------------------------------
    describe("excelJSToJSON", () => {
        it("returns an array for the English template", async () => {
            const data = loadFile("Project_Location_Data_Template_EN_V04.xlsx");
            const result = await Utils.excelJSToJSON(data, "en");
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
        });
        // TODO: re-enable once an official FR V04 template is available.
        // The parser reads the V04 layout (header row 3); the FR V03 fixture uses the old layout.
        it.skip("returns an array for the French template", async () => {
            const data = loadFile("Project_Location_Data_Template_FR_V04.xlsx");
            const result = await Utils.excelJSToJSON(data, "fr");
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
        });
        it("returns date strings in YYYY-MM-DD format for date fields", async () => {
            const data = loadFile("Project_Location_Data_Template_EN_V04.xlsx");
            const result = await Utils.excelJSToJSON(data, "en") as any[];
            const dateFields = ["activity_start_date", "activity_end_date", "date_of_data_collection"];
            const firstRow = result[0];
            const foundDateField = dateFields.find(f => firstRow[f] !== undefined);
            if (foundDateField) {
                expect(typeof firstRow[foundDateField]).toBe("string");
                expect(firstRow[foundDateField]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            }
        });
        it("returns an array for the Spanish template", async () => {
            const data = loadFile("Project_Location_Data_Template_ES_V04.xlsx");
            const result = await Utils.excelJSToJSON(data, "es");
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
        });
        it("rejects when the expected sheet is missing", async () => {
            const data = loadFile("Project_Location_Data_Template_EN_V04.xlsx");
            await expect(Utils.excelJSToJSON(data, "fr"))
                .rejects.toThrow(/Sheet "fill-me Remplissez-moi" not found/);
        });
    });
});

