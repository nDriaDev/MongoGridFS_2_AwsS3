import express, { Express } from "express"
import { apiRoutes } from "./routes/api.js";
import { healthRoutes } from "./routes/health.js";
import { noRouteHandler } from "./routes/noRoute.js";
import { errorHandler } from "./routes/error.js";
import { middleware } from "../middlewares/middlewares.js";

export const routes = (app: Express) => {
	app.use(middleware);
	app.use("/health", healthRoutes(express.Router()));
	app.use("/api/v1", apiRoutes(express.Router()));
	noRouteHandler(app);
	errorHandler(app);
}
