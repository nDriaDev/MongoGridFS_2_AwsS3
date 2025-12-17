import { RequestHandler } from "express";

export const middleware: RequestHandler = (req, res, next) => {
	console.log(`\n#########################\nHandling request:\nurl: ${req.originalUrl}\nmethod: ${req.method}\n#########################`);
	next();
};
