import { apiController } from "./api/v1/apiv1.js";
import { apiV2Controller } from "./api/v2/apiv2.js";
import { errorController } from "./error.js";
import { healthController } from "./health.js";
import { noRouteController } from "./noRoute.js";

export const controllers = {
	healthController,
	apiController,
	apiV2Controller,
	noRouteController,
	errorController
}
