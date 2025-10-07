// filepath: frontend/src/services/httpclient/MockHttpClientSchema.ts
import {BaseHttpClientSchema} from "../../../services/httpclient/BaseHttpClientSchema.ts";
import {SupportedLangs} from "../../../services/util/Utils.ts";
import * as fs from "fs";
import * as path from "path";

export class MockHttpClientSchema extends BaseHttpClientSchema {
    private readJson(filePath: string) {
        const content = fs.readFileSync(filePath, {encoding: "utf-8"});
        return JSON.parse(content);
    }

    async getSchema(lang: SupportedLangs): Promise<any[]> {
        const baseDir = path.resolve(process.cwd(), "../model/schema");
        const filesEn = [
            "sector_location_schema_en.json",
            "dac5_schema.json",
            "feature_project_schema.json",
            "project_core_schema_en.json"
        ];
        const filesFr = [
            "sector_location_schema_fr.json",
            "dac5_schema.json",
            "feature_project_schema.json",
            "project_core_schema_fr.json"
        ];
        const files = lang === "en" ? filesEn : filesFr;
        return files.map(f => this.readJson(path.join(baseDir, f)));
    }
}

