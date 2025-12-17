import { NextFunction, Request, Response } from "express";

export const errorController = (err: any, req: Request, res: Response, next: NextFunction) => {
	res.status(500);
	res.send({message: err.message, error: JSON.stringify(err.stack)});
}
