// filepath: frontend/src/services/httpclient/HttpClientSchema.ts
import {BaseHttpClientSchema} from "./BaseHttpClientSchema.ts";
import {SupportedLangs} from "../util/Utils.ts";

/**
 * Lädt Schema Dateien von GitHub (raw URLs) abhängig von der Sprache.
 */
export class HttpLocalClientSchema extends BaseHttpClientSchema {

    private static schemaUrls(lang: SupportedLangs): string[] {
        if (lang === "en") {
            return [
                `flatschema/feature_project_schema_en.json`,
            ];
        }
        if (lang === "fr") {
            return [
                `flatschema/feature_project_schema_fr.json`,
            ];
        }
    }

    async getSchema(lang: SupportedLangs): Promise<any[]> {
        const urls = HttpLocalClientSchema.schemaUrls(lang);
        const fetches = urls.map(url => fetch(url).then(r => r.json()));
        return Promise.all(fetches);
    }
}

