import { Express } from "express";

export const views = (app: Express) => {
	app.get("/", (req, res) => {
		res.render("query", { title: "Query Builder" });
	});
	app.get("/results", (req, res) => {
		res.render("result", { title: "Query Results", results: req.app.locals.data, fields: req.app.locals.dataFields, id: req.app.locals.gridFsIdField });
	});
	app.get("/resultsS3", (req, res) => {
		res.render("resultS3", { title: "Aws Bucket S3" });
	});
}
