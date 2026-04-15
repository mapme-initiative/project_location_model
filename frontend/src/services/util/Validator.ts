import Ajv, { ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import { SupportedLangs } from "./Utils.ts";


/**
 * Validator class providing static methods to create AJV validators
 * for project location model schemas.
 */
export default class Validator {

    /**
     * Load both feature and core schemas from the public/schemas directory
     */

    /* eslint-disable @typescript-eslint/no-explicit-any */
    private static async loadAllSchemas(lang: SupportedLangs): Promise<{ feature: any; core: any }> {
        try {
            const [featureResponse, coreResponse] = await Promise.all([
                fetch(`schemas/feature_project_schema.json`),
                fetch(`schemas/project_core_schema_${lang}.json`)
            ]);

            if (!featureResponse.ok || !coreResponse.ok) {
                throw new Error(`Failed to load schemas`);
            }

            const feature = await featureResponse.json();
            const core = await coreResponse.json();

            return { feature, core };
        } catch (error) {
            console.error(`Error loading all-schemas for language ${lang}:`, error);
            throw new Error(`Cannot load validation schemas - please check your setup`);
        }
    }

    /**
     * Load only the core schema for a given language
     */

    /* eslint-disable @typescript-eslint/no-explicit-any */
    private static async loadCoreSchemas(lang: SupportedLangs): Promise<any> {
        try {
            const [coreResponse] = await Promise.all([
                fetch(`schemas/project_core_schema_${lang}.json`)
            ]);

            if (!coreResponse.ok) {
                throw new Error(`Failed to load core-schema`);
            }

            return await coreResponse.json();
        } catch (error) {
            console.error(`Error loading core-schema for language ${lang}:`, error);
            throw new Error(`Cannot load validation core-schemas - please check your setup`);
        }
    }

    /**
     * Create a configured AJV instance with formats support
     */
    private static createAjv(): Ajv {
        const ajv = new Ajv({ allErrors: true, useDefaults: true });
        addFormats(ajv);
        return ajv;
    }

    /**
     * Create an AJV validator for the core schema (properties only)
     */
    static async getCoreValidator(lang: SupportedLangs): Promise<ValidateFunction<unknown>> {
        if (lang !== "en" && lang !== "fr") {
            throw new Error(`Unsupported language: ${lang}`);
        }

        const core = await Validator.loadCoreSchemas(lang);
        const ajv = Validator.createAjv();

        ajv.addSchema(core);

        const validator = ajv.getSchema("project_core_schema.json");
        if (!validator) {
            throw new Error("Failed to compile validation core-schema");
        }

        return validator;
    }

    /**
     * Create an AJV validator for the full feature project schema
     * Automatically resolves the project_core_schema reference based on language
     */
    static async getProjectValidator(lang: SupportedLangs): Promise<ValidateFunction<unknown>> {
        if (lang !== "en" && lang !== "fr") {
            throw new Error(`Unsupported language: ${lang}`);
        }

        const { feature, core } = await Validator.loadAllSchemas(lang);
        const ajv = Validator.createAjv();

        ajv.addSchema(core);
        ajv.addSchema(feature);

        const validator = ajv.getSchema("feature_project_schema");
        if (!validator) {
            throw new Error("Failed to compile validation schema");
        }

        return validator;
    }
}
