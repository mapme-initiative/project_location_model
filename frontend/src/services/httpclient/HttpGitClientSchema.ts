// filepath: frontend/src/services/httpclient/HttpClientSchema.ts
import {BaseHttpClientSchema} from "./BaseHttpClientSchema.ts";
import {SupportedLangs} from "../util/Utils.ts";

/**
 * Lädt Schema Dateien von GitHub (raw URLs) abhängig von der Sprache.
 */
export class HttpGitClientSchema extends BaseHttpClientSchema {
    private static readonly branch = "250729-french-schema";
    private static readonly URL_PREFIX = "https://raw.githubusercontent.com/openkfw/open-geodata-model/refs/heads";

    private static schemaUrls(lang: SupportedLangs): string[] {
        const b = HttpGitClientSchema.branch;
        const U = HttpGitClientSchema.URL_PREFIX;
        if (lang === "en") {
            return [
                `${U}/${b}/references/sector_location_schema_en.json`,
                `${U}/${b}/references/dac5_schema.json`,
                `${U}/${b}/references/feature_project_schema.json`,
                `${U}/${b}/references/project_core_schema_en.json`
            ];
        }
        return [
            `${U}/${b}/references/sector_location_schema_fr.json`,
            `${U}/${b}/references/dac5_schema.json`,
            `${U}/${b}/references/feature_project_schema.json`,
            `${U}/${b}/references/project_core_schema_fr.json`
        ];
    }

    async getSchema(lang: SupportedLangs): Promise<any[]> {
        const urls = HttpGitClientSchema.schemaUrls(lang);
        const fetches = urls.map(url => fetch(url).then(r => r.json()));
        return Promise.all(fetches);
    }
}

