import { Request, Response } from 'express';
let clients: Response[] = [];
export const SSEUtils = {
	initSSE: (req: Request, res: Response) => {
		res.set({
			"Content-type": "text/event-stream",
			"Cache-Control": "no-cache",
			"Connection": "keep-alive"
		});
		SSEUtils.addClient(res);
		req.on("close", () => {
			SSEUtils.removeClient(res);
		})
	},
	addClient: (res: Response) => clients.push(res),
	removeClient: (res: Response) => clients.filter(el => el !== res),
	sendData: (data: object) => {
		const payload = `data: ${JSON.stringify(data)}\n\n`;
		clients.forEach(res => res.write(payload));
	},
	closeEvent: (message?: string) => {
		clients.forEach(res => {
			res.write(`data: ${JSON.stringify({event: "complete", data: message || ""})}\n\n`);
			res.end();
		});
		clients = [];
	}
}
