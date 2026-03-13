import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { getProjectValidator } from "../../../services/util/Validator.ts";
import Utils from "../../../services/util/Utils.ts";
import validateDataEng from "../../assets/validate_en.json";
import validateDataFr from "../../assets/validate_data_fr.json";
import * as fs from "fs";
import * as path from "path";

// ISO-Datetime-Strings in echte Date-Objekte konvertieren (für instanceof: "Date" im Schema)
function withDates<T>(data: T): T {
    return JSON.parse(JSON.stringify(data), Utils.toDateObj);
}

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

        const validator = await getProjectValidator("en") as any;
        expect(typeof validator).toBe("function");

        const valid = validator(withDates(validateDataEng));
        const invalid = validator({});
        expect(valid).toBe(true);
        expect(invalid).toBe(false);
    });

    it("returns a validator function for 'fr' and validates correctly", async () => {
        global.fetch = jest.fn((url) => mockFetch(url as string)) as any;

        const validator = await getProjectValidator("fr") as any;
        expect(typeof validator).toBe("function");

        const valid = validator(withDates(validateDataFr));
        const invalid = validator({});
        expect(valid).toBe(true);
        expect(invalid).toBe(false);
    });

    it("rejects when fetch fails", async () => {
        global.fetch = jest.fn(() => Promise.reject(new Error("Network error"))) as any;

        await expect(getProjectValidator("en"))
            .rejects
            .toThrow("Cannot load validation schemas - please check your setup");
    });

    it("rejects for unsupported language", async () => {
        await expect(getProjectValidator("de" as any))
            .rejects
            .toThrow("Unsupported language: de");
    });

    it("validator fails when required field missing", async () => {
        global.fetch = jest.fn((url) => mockFetch(url as string)) as any;

        const validator = await getProjectValidator("en") as any;
        const ok = validator(withDates(validateDataEng));
        const bad = validator({ other: "x" });
        expect(ok).toBe(true);
        expect(bad).toBe(false);
        expect(Array.isArray(validator.errors) || validator.errors === null).toBe(true);
    });
});
