import {describe, expect, it} from "@jest/globals";
import {ValidatorFactory} from "../../../services/util/Validator.ts";
import {BaseHttpClientSchema} from "../../../services/httpclient/BaseHttpClientSchema.ts";
import validateDataEng from "../../assets/validate_en.json";
import validateDataFr from "../../assets/validate_data_fr.json";


// Hilfsklasse um einen Fehler beim Laden zu simulieren
class FailingMockSchema extends BaseHttpClientSchema {
    getSchema(): Promise<any[]> { return Promise.reject(new Error("io")); }
}

// Helper um ValidatorFactory Instanz mit gewünschtem SchemaClient zu bekommen
const factoryWithMock = () => ValidatorFactory.createWithMock();
const factoryWithFailing = () => new ValidatorFactory(new FailingMockSchema());


// Wir lesen reale Dateien über MockHttpClientSchema -> keine fetch Mocks mehr nötig

describe("ValidatorFactory (DI) getProjectValidator", () => {

    it("returns a validator function for 'en' and validates correctly", async () => {
        const validator = await factoryWithMock().getProjectValidator("en") as any;
        expect(typeof validator).toBe("function");
        // feature_project_schema.json verlangt required [foo]; unsere lokale Datei muss das widerspiegeln
        // Falls nicht vorhanden, wird Test entsprechend angepasst
        const valid = validator(validateDataEng);
        const invalid = validator({});
        expect(valid).toBe(true);
        expect(invalid).toBe(false);
    });

    it("returns a validator function for 'fr' and validates correctly", async () => {
        const validator = await factoryWithMock().getProjectValidator("fr") as any;
        expect(typeof validator).toBe("function");
        const valid = validator(validateDataFr);
        const invalid = validator({});
        expect(valid).toBe(true);
        expect(invalid).toBe(false);
    });

    it("propagates failure as rejected promise (simulated) for 'en'", async () => {
        await expect(factoryWithFailing().getProjectValidator("en") as Promise<any>)
            .rejects
            .toThrow("can not load validation schemas - please check your internet connection");
    });

    it("propagates failure as rejected promise (simulated) for 'fr'", async () => {
        await expect(factoryWithFailing().getProjectValidator("fr") as Promise<any>)
            .rejects
            .toThrow("can not load validation schemas - please check your internet connection");
    });

    it("rejects promise for unsupported language", async () => {
        await expect(factoryWithMock().getProjectValidator("de" as any))
            .rejects
            .toThrow("Unsupported language: de");
    });

    it("validator fails when required field missing", async () => {
        const validator = await factoryWithMock().getProjectValidator("en") as any;
        const ok = validator(validateDataEng);
        const bad = validator({ other: "x" });
        expect(ok).toBe(true);
        expect(bad).toBe(false);
        expect(Array.isArray(validator.errors) || validator.errors === null).toBe(true);
    });
});
