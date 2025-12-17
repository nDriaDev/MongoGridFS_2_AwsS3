import { Express } from "express"
import { controllers } from "../../controllers/index.js";

export const errorHandler = (app: Express) => {
	app.use(controllers.errorController);
}
