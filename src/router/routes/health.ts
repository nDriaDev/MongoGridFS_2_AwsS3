import { Router } from "express";
import { controllers } from "../../controllers/index.js";

export const healthRoutes = (router: Router) => {
	/**
	* @openapi
	* /health/:
	*   get:
	*     summary: Recupera le informazioni sullo stato del sistema
	*     tags:
	*       - System
	*     responses:
	*       200:
	*         description: Lo stato del sistema
	*         content:
	*           application/json:
	*             schema:
	*               type: object
	*               properties:
	*                 status:
	*                   type: string
	*/
	router.get("/", controllers.healthController);
	return router;
}
