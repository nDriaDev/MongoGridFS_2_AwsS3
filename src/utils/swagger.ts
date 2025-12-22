import { Express } from "express";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

export function configSwagger(app: Express) {
	const options = {
		definition: {
			openapi: "3.0.0",
			info: {
				title: "MongoGridFS 2 AWS S3",
				version: "1.0.0",
				description: "Api to upload file from mongo GridFS to AWS S3 Bucket",
			},
		},
		apis: ["./src/router/*.ts", "./src/router/routes/*.ts", "./src/router/routes/**/*.ts"], // percorsi ai file dove annoti le rotte
	};

	const swaggerSpec = swaggerJsdoc(options);
	app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}
