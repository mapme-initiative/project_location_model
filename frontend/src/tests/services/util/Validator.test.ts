import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import Validator from "../../../services/util/Validator.ts";
import validateDataEng from "../../assets/validate_en.json";
import validateDataFr from "../../assets/validate_data_fr.json";
import validateDataEs from "../../assets/validate_es.json";
import validateDataPt from "../../assets/validate_pt.json";
import * as fs from "fs";
import * as path from "path";

// Mock fetch for testing - simulates loading from public/schemas/
const mockFetch = (url: string) => {
    const schemaDir = path.resolve(process.cwd(), "../model/schema");

    let schemaPath: string;
    if (url.includes('feature_project_schema.json')) {
        schemaPath = path.join(schemaDir, 'feature_project_schema.json');
    } else if (url.includes('project_core_schema_en.json')) {
        schemaPath = path.join(schemaDir, 'project_core_schema_en.json');
    } else if (url.includes('project_core_schema_fr.json')) {
        schemaPath = path.join(schemaDir, 'project_core_schema_fr.json');
    } else if (url.includes('project_core_schema_es.json')) {
        schemaPath = path.join(schemaDir, 'project_core_schema_es.json');
    } else if (url.includes('project_core_schema_pt.json')) {
        schemaPath = path.join(schemaDir, 'project_core_schema_pt.json');
    } else {
        return Promise.resolve({
            ok: false,
            statusText: 'Not Found'
        } as Response);
    }

    const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));

    return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(schema)
    } as Response);
};

describe("getProjectValidator", () => {
    beforeEach(() => {
        // Reset fetch mock before each test
        jest.clearAllMocks();
    });

    it("returns a validator function for 'en' and validates correctly", async () => {
        global.fetch = jest.fn((url) => mockFetch(url as string)) as any;

        const validator = await Validator.getProjectValidator("en") as any;
        expect(typeof validator).toBe("function");

        const valid = validator(validateDataEng);
        const invalid = validator({});
        expect(valid).toBe(true);
        expect(invalid).toBe(false);
    });

    it("returns a validator function for 'fr' and validates correctly", async () => {
        global.fetch = jest.fn((url) => mockFetch(url as string)) as any;

        const validator = await Validator.getProjectValidator("fr") as any;
        expect(typeof validator).toBe("function");

        const valid = validator(validateDataFr);
        const invalid = validator({});
        expect(valid).toBe(true);
        expect(invalid).toBe(false);
    });

    it("returns a validator function for 'es' and validates correctly", async () => {
        global.fetch = jest.fn((url) => mockFetch(url as string)) as any;

        const validator = await Validator.getProjectValidator("es") as any;
        expect(typeof validator).toBe("function");

        const valid = validator(validateDataEs);
        const invalid = validator({});
        expect(valid).toBe(true);
        expect(invalid).toBe(false);
    });

    it("returns a validator function for 'pt' and validates correctly", async () => {
        global.fetch = jest.fn((url) => mockFetch(url as string)) as any;

        const validator = await Validator.getProjectValidator("pt") as any;
        expect(typeof validator).toBe("function");

        const valid = validator(validateDataPt);
        const invalid = validator({});
        expect(valid).toBe(true);
        expect(invalid).toBe(false);
    });

    it("rejects when fetch fails", async () => {
        global.fetch = jest.fn(() => Promise.reject(new Error("Network error"))) as any;

        await expect(Validator.getProjectValidator("en"))
            .rejects
            .toThrow("Cannot load validation schemas - please check your setup");
    });

    it("rejects for unsupported language", async () => {
        await expect(Validator.getProjectValidator("de" as any))
            .rejects
            .toThrow("Unsupported language: de");
    });

    it("validator fails when required field missing", async () => {
        global.fetch = jest.fn((url) => mockFetch(url as string)) as any;

        const validator = await Validator.getProjectValidator("en") as any;
        const ok = validator(validateDataEng);
        const bad = validator({ other: "x" });
        expect(ok).toBe(true);
        expect(bad).toBe(false);
        expect(Array.isArray(validator.errors) || validator.errors === null).toBe(true);
    });

    it("rejects when schema fetch returns 404", async () => {
        global.fetch = jest.fn(() =>
            Promise.resolve({ ok: false, statusText: "Not Found" } as Response)
        ) as any;

        await expect(Validator.getProjectValidator("en"))
            .rejects
            .toThrow("Cannot load validation schemas - please check your setup");
    });

    it("fails when Feature type is wrong", async () => {
        global.fetch = jest.fn((url) => mockFetch(url as string)) as any;
        const validator = await Validator.getProjectValidator("en") as any;

        const wrongType = { ...validateDataEng, type: "FeatureCollection" };
        expect(validator(wrongType)).toBe(false);
    });

    it("null geometry is valid", async () => {
        global.fetch = jest.fn((url) => mockFetch(url as string)) as any;
        const validator = await Validator.getProjectValidator("en") as any;

        const nullGeometry = { ...validateDataEng, geometry: null };
        expect(validator(nullGeometry)).toBe(true);
    });

    it("fails with invalid enum value in properties", async () => {
        global.fetch = jest.fn((url) => mockFetch(url as string)) as any;
        const validator = await Validator.getProjectValidator("en") as any;

        const invalidEnum = {
            ...validateDataEng,
            properties: { ...validateDataEng.properties, geographic_exactness: "ungültig" }
        };
        expect(validator(invalidEnum)).toBe(false);
    });

    it("validates date fields as ISO strings", async () => {
        global.fetch = jest.fn((url) => mockFetch(url as string)) as any;
        const validator = await Validator.getProjectValidator("en") as any;

        // ISO-Datetime-Strings sind jetzt der erwartete Typ
        expect(validator(validateDataEng)).toBe(true);
    });

    it("fails when date field has an invalid format", async () => {
        global.fetch = jest.fn((url) => mockFetch(url as string)) as any;
        const validator = await Validator.getProjectValidator("en") as any;

        const invalidDate = {
            ...validateDataEng,
            properties: { ...validateDataEng.properties, activity_start_date: "not-a-date" }
        };
        expect(validator(invalidDate)).toBe(false);
    });

    it("errors array is populated on validation failure", async () => {
        global.fetch = jest.fn((url) => mockFetch(url as string)) as any;
        const validator = await Validator.getProjectValidator("en") as any;

        validator({});
        expect(Array.isArray(validator.errors)).toBe(true);
        expect(validator.errors.length).toBeGreaterThan(0);
    });

    it("errors are null after successful validation", async () => {
        global.fetch = jest.fn((url) => mockFetch(url as string)) as any;
        const validator = await Validator.getProjectValidator("en") as any;

        validator({}); // Fehler auslösen
        validator(validateDataEng); // valide Daten – Fehler müssen gecleared werden
        expect(validator.errors).toBeNull();
    });
});

describe("getCoreValidator", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("returns a validator function for 'en'", async () => {
        global.fetch = jest.fn((url) => mockFetch(url as string)) as any;
        const validator = await Validator.getCoreValidator("en");
        expect(typeof validator).toBe("function");
    });

    it("returns a validator function for 'fr'", async () => {
        global.fetch = jest.fn((url) => mockFetch(url as string)) as any;
        const validator = await Validator.getCoreValidator("fr");
        expect(typeof validator).toBe("function");
    });

    it("returns a validator function for 'es'", async () => {
        global.fetch = jest.fn((url) => mockFetch(url as string)) as any;
        const validator = await Validator.getCoreValidator("es");
        expect(typeof validator).toBe("function");
    });

    it("returns a validator function for 'pt'", async () => {
        global.fetch = jest.fn((url) => mockFetch(url as string)) as any;
        const validator = await Validator.getCoreValidator("pt");
        expect(typeof validator).toBe("function");
    });

    it("validates correct EN core properties", async () => {
        global.fetch = jest.fn((url) => mockFetch(url as string)) as any;
        const validator = await Validator.getCoreValidator("en") as any;

        const valid = validator(validateDataEng.properties);
        expect(valid).toBe(true);
        expect(validator.errors).toBeNull();
    });

    it("validates correct FR core properties", async () => {
        global.fetch = jest.fn((url) => mockFetch(url as string)) as any;
        const validator = await Validator.getCoreValidator("fr") as any;

        const valid = validator(validateDataFr.properties);
        expect(valid).toBe(true);
        expect(validator.errors).toBeNull();
    });

    it("validates correct ES core properties", async () => {
        global.fetch = jest.fn((url) => mockFetch(url as string)) as any;
        const validator = await Validator.getCoreValidator("es") as any;

        const valid = validator(validateDataEs.properties);
        expect(valid).toBe(true);
        expect(validator.errors).toBeNull();
    });

    it("validates correct PT core properties", async () => {
        global.fetch = jest.fn((url) => mockFetch(url as string)) as any;
        const validator = await Validator.getCoreValidator("pt") as any;

        const valid = validator(validateDataPt.properties);
        expect(valid).toBe(true);
        expect(validator.errors).toBeNull();
    });

    it("fails when required property 'donor_project_no' is missing", async () => {
        global.fetch = jest.fn((url) => mockFetch(url as string)) as any;
        const validator = await Validator.getCoreValidator("en") as any;

        const { donor_project_no: _, ...withoutDonorNo } = validateDataEng.properties as any;
        expect(validator(withoutDonorNo)).toBe(false);
        expect(validator.errors?.some((e: any) => e.params?.missingProperty === "donor_project_no")).toBe(true);
    });

    it("fails when required property 'location_name' is missing", async () => {
        global.fetch = jest.fn((url) => mockFetch(url as string)) as any;
        const validator = await Validator.getCoreValidator("en") as any;

        const { location_name: _, ...rest } = validateDataEng.properties as any;
        expect(validator(rest)).toBe(false);
    });

    it("fails with invalid 'geographic_exactness' enum", async () => {
        global.fetch = jest.fn((url) => mockFetch(url as string)) as any;
        const validator = await Validator.getCoreValidator("en") as any;

        const invalidData = { ...validateDataEng.properties, geographic_exactness: "invalid" };
        expect(validator(invalidData)).toBe(false);
    });

    it("fails with invalid 'location_activity_status' enum", async () => {
        global.fetch = jest.fn((url) => mockFetch(url as string)) as any;
        const validator = await Validator.getCoreValidator("en") as any;

        const invalidData = { ...validateDataEng.properties, location_activity_status: "Running" };
        expect(validator(invalidData)).toBe(false);
    });

    it("fails when date field has an invalid format", async () => {
        global.fetch = jest.fn((url) => mockFetch(url as string)) as any;
        const validator = await Validator.getCoreValidator("en") as any;

        const invalidData = { ...validateDataEng.properties, activity_start_date: "invalid-date" };
        expect(validator(invalidData)).toBe(false);
    });

    it("fails when donor_project_no is a string instead of a number", async () => {
        global.fetch = jest.fn((url) => mockFetch(url as string)) as any;
        const validator = await Validator.getCoreValidator("en") as any;

        const invalidData = { ...validateDataEng.properties, donor_project_no: "29937" };
        expect(validator(invalidData)).toBe(false);
    });

    it("rejects for unsupported language", async () => {
        await expect(Validator.getCoreValidator("de" as any))
            .rejects
            .toThrow("Unsupported language: de");
    });

    it("rejects when fetch fails", async () => {
        global.fetch = jest.fn(() => Promise.reject(new Error("Network error"))) as any;

        await expect(Validator.getCoreValidator("en"))
            .rejects
            .toThrow("Cannot load validation core-schemas - please check your setup");
    });

    it("rejects when schema fetch returns 404", async () => {
        global.fetch = jest.fn(() =>
            Promise.resolve({ ok: false, statusText: "Not Found" } as Response)
        ) as any;

        await expect(Validator.getCoreValidator("en"))
            .rejects
            .toThrow("Cannot load validation core-schemas - please check your setup");
    });
});
