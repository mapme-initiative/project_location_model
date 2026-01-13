import {
    excelToGeoJson,
    formatError,
    toValidatedFeature,
    notNull,
    notUndefined,
    formatAjvErrorsWithRow,
    removeWhiteSpaceInFeatureProperty
} from "../../../services/util/Utils.ts";
import { ErrorObject } from "ajv";


describe("Utils", () => {
    describe("formatError", () => {
        it("formats error with instancePath and message", () => {
            const error = { instancePath: "/foo", message: "bar" };
            expect(formatError(error as ErrorObject)).toBe('Error at "/foo": bar');
        });

        it("formats error with only message", () => {
            const error = { message: "bar" };
            expect(formatError(error as ErrorObject)).toBe('Error: bar');
        });

        it("formats error with only instancePath", () => {
            const error = { instancePath: "/foo" };
            expect(formatError(error as ErrorObject)).toBe('Error at "/foo"');
        });

        it("formats error with neither", () => {
            const error = {};
            expect(formatError(error as ErrorObject)).toBe('Error');
        });
    });

    describe("toValidatedFeature", () => {
        it("returns feature if validator returns true", () => {
            const validator = () => true;
            const feature = { foo: "bar" };
            expect(toValidatedFeature(feature, validator as any)).toBe(feature);
        });

        it("returns null if validator returns false", () => {
            const validator = () => false;
            const feature = { foo: "bar" };
            expect(toValidatedFeature(feature, validator as any)).toBeNull();
        });
    });

    describe("notNull", () => {
        it("returns true for non-null value", () => {
            expect(notNull(1)).toBe(true);
        });

        it("returns false for null", () => {
            expect(notNull(null)).toBe(false);
        });
    });

    describe("notUndefined", () => {
        it("returns true for defined value", () => {
            expect(notUndefined(1)).toBe(true);
        });

        it("returns false for undefined", () => {
            expect(notUndefined(undefined)).toBe(false);
        });
    });

    describe("formatAjvErrorsWithRow", () => {
        it("returns empty array if errors is falsy", () => {
            expect(formatAjvErrorsWithRow(null as any, 1)).toEqual([]);
        });

        it("consolidates coordinate errors", () => {
            const errors: ErrorObject[] = [
                { instancePath: "/geometry/coordinates", message: "must be array" } as ErrorObject,
                { instancePath: "/geometry/type", message: "must be string" } as ErrorObject
            ];
            expect(formatAjvErrorsWithRow(errors, 2)).toEqual([
                "Row 2: Invalid or missing coordinates (latitude/longitude values). The project location is not printed on the map."
            ]);
        });

        it("formats non-coordinate errors", () => {
            const errors: ErrorObject[] = [
                { instancePath: "/foo", message: "bar" } as ErrorObject
            ];
            expect(formatAjvErrorsWithRow(errors, 3)).toEqual([
                'Row 3 at "/foo": bar'
            ]);
        });

        it("skips coordinate errors and formats others", () => {
            const errors: ErrorObject[] = [
                { instancePath: "/geometry/coordinates", message: "must be array" } as ErrorObject,
                { instancePath: "/foo", message: "bar" } as ErrorObject
            ];
            expect(formatAjvErrorsWithRow(errors, 4)).toEqual([
                "Row 4: Invalid or missing coordinates (latitude/longitude values). The project location is not printed on the map.",
                'Row 4 at "/foo": bar'
            ]);
        });
    });
});

describe("Excel conversion functions", () => {
    describe("removeWhiteSpaceInFeatureProperty", () => {
        it("removes all spaces from kfwProjectNoINPRO", () => {
            const feature = { properties: { kfwProjectNoINPRO: "A B C 123" } };
            expect(removeWhiteSpaceInFeatureProperty(feature)).toBe("ABC123");
        });
    });

    describe("excelToGeoJson", () => {
        const fs = require("fs");
        const path = require("path");
        const assetsDir = path.resolve(__dirname, "../../assets");

        function loadFile(filename) {
            return fs.readFileSync(path.join(assetsDir, filename));
        }

        it("parses valid English template", () => {
            const data = loadFile("Project_Location_Data_Template_EN_V03.xlsx");
            const features = excelToGeoJson(data, "en");
            expect(Array.isArray(features)).toBe(true);
            expect(features.length).toBeGreaterThan(0);
            expect(features[0]).toHaveProperty("type", "Feature");
        });

        it("parses valid French template", () => {
            const data = loadFile("Project_Location_Data_Template_FR_V03.xlsx");
            const features = excelToGeoJson(data, "fr");
            expect(Array.isArray(features)).toBe(true);
            expect(features.length).toBeGreaterThan(0);
            expect(features[0]).toHaveProperty("type", "Feature");
        });

        it("throws error for missing sheet", () => {
            const data = loadFile("sheet_not_found.xlsx");
            expect(() => excelToGeoJson(data, "en")).toThrow(/does not contain a valid sheet/);
        });

        it("throws error if expected sheet for lang is not present", () => {
            const data = loadFile("Project_Location_Data_Template_EN_V03.xlsx");
            expect(() => excelToGeoJson(data, "fr")).toThrow(/Sheet "fill-me Remplissez-moi" not found/);
        });
    });
});

