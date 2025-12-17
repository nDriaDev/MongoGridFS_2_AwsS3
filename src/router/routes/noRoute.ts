import { Express } from "express"
import { controllers } from "../../controllers/index.js";

export const noRouteHandler = (app: Express) => {
	app.use(controllers.noRouteController);
}
