import "server-only";
import { pool } from "./db";
import { createModels3d } from "./models3d-core";

export { MODELS_DIR, type ModelState } from "./models3d-core";
export const { getModelState, requestModel, modelFileName } = createModels3d(pool);
