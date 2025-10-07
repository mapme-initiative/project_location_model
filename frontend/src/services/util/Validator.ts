import Ajv, {AsyncValidateFunction, ValidateFunction} from "ajv";
import addFormats from "ajv-formats";
import {SupportedLangs} from "./Utils.ts";
import {HttpClientSchema} from "../httpclient/HttpClientSchema.ts";
import {BaseHttpClientSchema} from "../httpclient/BaseHttpClientSchema.ts";
import {MockHttpClientSchema} from "../../tests/services/httpclient/MockHttpClientSchema.ts";

export class ValidatorFactory {
    // Standard Instanz für produktiven Code (HttpClientSchema)
    private static readonly defaultInstance = new ValidatorFactory(new HttpClientSchema());

    // Optionaler Zugriff für Legacy Code: weiterhin statische Nutzung möglich
    public static getProjectValidator(lang: SupportedLangs) {
        return ValidatorFactory.defaultInstance.getProjectValidator(lang);
    }

    // Convenience Factory Methods
    public static createWithHttp(): ValidatorFactory { return new ValidatorFactory(new HttpClientSchema()); }
    public static createWithMock(): ValidatorFactory { return new ValidatorFactory(new MockHttpClientSchema()); }

    constructor(private readonly schemaClient: BaseHttpClientSchema) {}

    private buildAjvWithSchemas(schemas: any[]) {
        const ajv = new Ajv({allErrors: true});
        schemas.forEach(s => ajv.addSchema(s));
        addFormats(ajv);
        return ajv.getSchema("feature_project_schema.json");
    }

    public getProjectValidator(lang: SupportedLangs): Promise<ValidateFunction<unknown> | AsyncValidateFunction<unknown>> {
        // Sprache explizit prüfen, damit ein synchroner Fehlerpfad klar wird, aber aufgrund der Signatur
        // (Promise Rückgabe) konsistent als Promise-Reject geliefert wird.
        if (lang !== "en" && lang !== "fr") {
            return Promise.reject(new Error(`Unsupported language: ${lang}`));
        }

        return this.schemaClient.getSchema(lang)
            .then(schemas => this.buildAjvWithSchemas(schemas))
            .catch(() => Promise.reject(new Error("can not load validation schemas - please check your internet connection")));
    }
}
