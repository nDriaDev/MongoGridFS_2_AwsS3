import { apiController } from "./api/v1/api.js";
import { errorController } from "./error.js";
import { healthController } from "./health.js";
import { noRouteController } from "./noRoute.js";

export const controllers = {
	healthController,
	apiController,
	noRouteController,
	errorController
}
