import { Express } from "express";

export const views = (app: Express) => {
	app.get("/", (req, res) => {
		res.render("query", { title: "Query Builder v1" });
	});
	app.get("/results", (req, res) => {
		res.render("result", { title: "Query Results", results: req.app.locals.data, fields: req.app.locals.dataFields, id: req.app.locals.gridFsIdField });
	});
	app.get("/resultsS3", (req, res) => {
		res.render("resultS3", { title: "Aws Bucket S3" });
	});
	/**
	 * INFO V2 VIEWS
	 */
	app.get("/v2", (req, res) => {
		res.render("queryv2", { title: "Query Builder v2" });
	});
	app.get("/v2/visualize", (req, res) => {
		res.render("visualize", { title: "Visualizer" });
	});
	app.get("/v2/resultsS3", (req, res) => {
		res.render("resultS3v2", { title: "Aws Bucket S3 v2" });
	});
}
