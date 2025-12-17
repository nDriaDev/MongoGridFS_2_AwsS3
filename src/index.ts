import express from "express";
import { MongoClient } from "mongodb";
import { routes } from "./router/index.js";
import { S3Client } from "@aws-sdk/client-s3";
import { configSwagger } from "./utils/swagger.js";
import path from "path";

const port = process.env.PORT ?? "9001";

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "src", "views"))
app.use(express.static(path.join(process.cwd(), "public")));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

configSwagger(app);

app.get("/", (req, res) => {
	res.render("query", { title: "Query Builder" });
});
app.get("/results", (req, res) => {
	res.render("result", { title: "Query Results", results: req.app.locals.data });
});
app.get("/resultsS3", (req, res) => {
	res.render("resultS3", { title: "Aws Bucket S3" });
});
routes(app);

let serverClosed = false;
const server = app.listen(port, async () => {
	console.log(`Example app listening on port ${port}`);
	if (!process.env.MONGO_CONNECTION_STRING) {
		console.warn("No Mongo connection string provided");
	} else {
		app.locals.dbClient = new MongoClient(process.env.MONGO_CONNECTION_STRING);
		console.log("Client Mongo initialized");
	}
	if (!process.env.AWS_REGION || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
		console.warn("No AWS S3 data provided");
	} else {
		app.locals.s3Client = new S3Client({
			region: process.env.AWS_REGION,
			credentials: {
				accessKeyId: process.env.AWS_ACCESS_KEY_ID,
				secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
			}
		});
		console.log("Client AWS S3 initialized");
	}
});

function closeApp(event: string) {
	console.log(`Event: ${event}`)
	if (serverClosed) {
		return;
	}
	console.log("Closing...")
	server.close(async (err) => {
		serverClosed = true;
		if (err) {
			console.error(err);
		}
		await app.locals.dbClient?.close();
		console.log("Client db close");
		console.log("Closed")
	})
}
process.on("SIGINT", closeApp.bind("SIGINT"));
process.on("SIGTERM", closeApp.bind("SIGTERM"));
process.on("beforeExit", closeApp.bind("beforeExit"));
process.on("exit", closeApp.bind("exit"));
process.on("SIGUSR1", closeApp.bind("SIGUSR1"));
process.on("SIGUSR2", closeApp.bind("SIGUSR2"));
process.on("uncaughtException", closeApp.bind("uncaughtException"));
