// filepath: frontend/src/services/httpclient/BaseHttpClientSchema.ts
import {SupportedLangs} from "../util/Utils.ts";

/**
 * Abstrakte Basisklasse für das Laden von JSON-Schemas.
 */
export abstract class BaseHttpClientSchema {
    abstract getSchema(lang: SupportedLangs): Promise<any[]>;
}

