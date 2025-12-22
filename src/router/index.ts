import express, { Express } from "express"
import { apiRoutes } from "./routes/api/v1/apiv1.js";
import { healthRoutes } from "./routes/health.js";
import { noRouteHandler } from "./routes/noRoute.js";
import { errorHandler } from "./routes/error.js";
import { middleware } from "../middlewares/middlewares.js";
import { views } from "./routes/views.js";
import { apiV2Routes } from "./routes/api/v2/apiv2.js";

export const routes = (app: Express) => {
	views(app);
	app.use(middleware);
	app.use("/health", healthRoutes(express.Router()));
	app.use("/api/v1", apiRoutes(express.Router()));
	app.use("/api/v2", apiV2Routes(express.Router()));
	noRouteHandler(app);
	errorHandler(app);
}
