import { NextFunction, Request, Response } from "express";

export const healthController = (req: Request, res: Response, next: NextFunction) => {
	res.json({ status: "OK" })
}
