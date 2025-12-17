import { Express } from "express";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

export function configSwagger(app: Express) {
	const options = {
		definition: {
			openapi: "3.0.0",
			info: {
				title: "ARTS DEI UDA IMAGES UPLOADER",
				version: "1.0.0",
				description: "Api to upload photo from mongo GridFS to AWS S3 Bucket",
			},
		},
		apis: ["./src/router/*.ts", "./src/router/routes/*.ts"], // percorsi ai file dove annoti le rotte
	};

	const swaggerSpec = swaggerJsdoc(options);
	app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}
