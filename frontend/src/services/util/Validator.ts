import Ajv, { ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import { SupportedLangs } from "./Utils.ts";

/**
 * Load schemas from the public/schemas directory
 * Schemas are copied there during build from model/schema/
 */
async function loadSchemas(lang: SupportedLangs): Promise<{ feature: any, core: any }> {
    try {
        const [featureResponse, coreResponse] = await Promise.all([
            fetch(`/schemas/feature_project_schema.json`),
            fetch(`/schemas/project_core_schema_${lang}.json`)
        ]);

        if (!featureResponse.ok || !coreResponse.ok) {
            throw new Error(`Failed to load schemas`);
        }

        const feature = await featureResponse.json();
        const core = await coreResponse.json();

        return { feature, core };
    } catch (error) {
        console.error(`Error loading schemas for language ${lang}:`, error);
        throw new Error(`Cannot load validation schemas - please check your setup`);
    }
}

/**
 * Create an AJV validator function for the given language
 * Automatically resolves the project_core_schema reference based on language
 */
export async function getProjectValidator(lang: SupportedLangs): Promise<ValidateFunction<unknown>> {
    if (lang !== "en" && lang !== "fr") {
        throw new Error(`Unsupported language: ${lang}`);
    }

    const { feature, core } = await loadSchemas(lang);

    // Create AJV instance and add both schemas
    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);

    // Add the core schema first (it's referenced by feature schema)
    ajv.addSchema(core);
    ajv.addSchema(feature);

    // Get the validator for feature_project_schema
    const validator = ajv.getSchema("feature_project_schema");
    if (!validator) {
        throw new Error("Failed to compile validation schema");
    }

    return validator;
}
