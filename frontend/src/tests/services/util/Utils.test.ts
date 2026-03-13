import { ErrorObject } from "ajv";
import Utils from "../../../services/util/Utils.ts";

describe("Utils", () => {
    describe("toValidatedFeature", () => {
        it("returns feature if validator returns true", () => {
            const validator = () => true;
            const feature = { foo: "bar" };
            expect(Utils.toValidatedFeature(feature, validator as any)).toBe(feature);
        });

        it("returns null if validator returns false", () => {
            const validator = () => false;
            const feature = { foo: "bar" };
            expect(Utils.toValidatedFeature(feature, validator as any)).toBeNull();
        });
    });

    describe("notNull", () => {
        it("returns true for non-null value", () => {
            expect(Utils.notNull(1)).toBe(true);
        });

        it("returns false for null", () => {
            expect(Utils.notNull(null)).toBe(false);
        });
    });

    describe("notUndefined", () => {
        it("returns true for defined value", () => {
            expect(Utils.notUndefined(1)).toBe(true);
        });

        it("returns false for undefined", () => {
            expect(Utils.notUndefined(undefined)).toBe(false);
        });
    });

    describe("formatAjvErrorsWithRow", () => {
        it("returns empty array if errors is falsy", () => {
            expect(Utils.formatAjvErrorsWithRow(null as any, 1)).toEqual([]);
        });

        it("consolidates coordinate errors", () => {
            const errors: ErrorObject[] = [
                { instancePath: "/geometry/coordinates", message: "must be array" } as ErrorObject,
                { instancePath: "/geometry/type", message: "must be string" } as ErrorObject
            ];
            expect(Utils.formatAjvErrorsWithRow(errors, 2)).toEqual([
                "Row 2: Invalid or missing coordinates (latitude/longitude values). The project location is not printed on the map."
            ]);
        });

        it("formats non-coordinate errors", () => {
            const errors: ErrorObject[] = [
                { instancePath: "/foo", message: "bar" } as ErrorObject
            ];
            expect(Utils.formatAjvErrorsWithRow(errors, 3)).toEqual([
                'Row 3 at "/foo": bar'
            ]);
        });

        it("skips coordinate errors and formats others", () => {
            const errors: ErrorObject[] = [
                { instancePath: "/geometry/coordinates", message: "must be array" } as ErrorObject,
                { instancePath: "/foo", message: "bar" } as ErrorObject
            ];
            expect(Utils.formatAjvErrorsWithRow(errors, 4)).toEqual([
                "Row 4: Invalid or missing coordinates (latitude/longitude values). The project location is not printed on the map.",
                'Row 4 at "/foo": bar'
            ]);
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

        it("throws error for missing sheet", () => {
            const data = loadFile("sheet_not_found.xlsx");
            expect(() => Utils.excelToGeoJson(data, "en")).toThrow(/Sheet "fill-me" not found/);
        });

        it("throws error if expected sheet for lang is not present", () => {
            const data = loadFile("Project_Location_Data_Template_EN_V03.xlsx");
            expect(() => Utils.excelToGeoJson(data, "fr")).toThrow(/Sheet "fill-me Remplissez-moi" not found/);
        });
    });
});

