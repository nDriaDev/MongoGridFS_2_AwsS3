import { DeleteObjectsCommand, GetObjectCommand, ListObjectsCommand } from "@aws-sdk/client-s3";
import { NextFunction, Request, Response } from "express";
import { s3Utils } from "../../../utils/s3.js";
import { Progress } from "@aws-sdk/lib-storage";
import { SSEUtils } from "../../../utils/sse.js";

export const apiV2Controller = {
	getCollections: async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.app.locals.dbClient) {
				res.status(500).send({ message: "No Mongo Client initialized." })
			} else {
				const db = req.app.locals.dbClient.db(process.env.MONGO_DB_NAME!);
				const data = await db.collections();
				if (!data) {
					res.status(400).send({ message: "DB empty" });
				} else {
					res.status(200).json(data.map(el => el.collectionName).sort());
				}
			}
		} catch (error) {
			next(error);
		}
	},
	getFields: async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { collection } = req.params;
			if (!req.app.locals.dbClient) {
				res.status(500).send({ message: "No Mongo Client initialized." })
			} else if (!collection) {
				res.status(400).send({ message: "Collection param missing." })
			} else {
				const db = req.app.locals.dbClient.db(process.env.MONGO_DB_NAME!);
				const data = await db.collection(collection).findOne();
				if (!data) {
					res.status(400).send({ message: "Collection empty" });
				} else {
					const keys = Reflect.ownKeys(data);
					res.status(200).json(keys.filter(el => el !== "_class"));
				}
			}
		} catch (error) {
			next(error);
		}
	},
	getData: async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.app.locals.dbClient) {
				res.status(500).send({message: "No Mongo Client initialized."})
			} else {
				const { query } = req.params;
				const queryParsed = JSON.parse(query);
				if ("options" in queryParsed && !("filter" in queryParsed)) {
					res.status(500).send({ message: "No filter query provided." })
				}
				const db = req.app.locals.dbClient.db(process.env.MONGO_DB_NAME!);
				let mongoData;
				if ("filter" in queryParsed) {
					mongoData = await db.collection(process.env.MONGO_DB_COLLECTION!).find(queryParsed.filter, queryParsed?.options).toArray();
				} else {
					mongoData = await db.collection(process.env.MONGO_DB_COLLECTION!).find(queryParsed).toArray();
				}
				req.app.locals.data = mongoData;
				req.app.locals.dataFields = mongoData[0] && Reflect.ownKeys(mongoData[0]) as string[];
				req.app.locals.gridFsIdField = process.env.MONGO_DB_COLLECTION_FIELD_FOR_ID_GRIDFS!;
				res.status(200).send(mongoData);
			}
		} catch (error) {
			next(error);
		}
	},
	uploadFile: async (req: Request, res: Response, next: NextFunction) => {
		try {
			const data = req.app.locals.data;
			if (!req.app.locals.dbClient) {
				res.status(500).send({ message: "No Mongo Client initialized." })
			} else if (!data || data.length === 0) {
				res.status(400).send({ message: "No data to retrieve file." })
			} else {
				const now = Date.now();
				const onTransfer = (id: string, progress: Progress | null, err?: Error) => {
					console.table({
						id,
						...(err ? {errore: err.message} : {loaded: progress?.loaded, total: progress?.total})
					});
				}
				await s3Utils.uploadFile({
					awsS3BucketName: process.env.AWS_BUCKET_NAME!,
					data,
					dbClient: req.app.locals.dbClient,
					dbName: process.env.MONGO_DB_NAME!,
					gridFsBucketName: process.env.MONGO_DB_GRIDFS_BUCKET!,
					parallel: false,
					prefix: process.env.AWS_BUCKET_FOLDER_PREFIX + "/" + new Date().toLocaleDateString().replaceAll("/", ""),
					s3Client: req.app.locals.s3Client!,
					onTransfer
				});
				req.app.locals.data = [];
				res.status(200).json({ message: `Upload completed in ${(Date.now() - now) / 1000} secondi` })
			}
		} catch (error) {
			next(error);
		}
	},
	uploadFileParallel: async (req: Request, res: Response, next: NextFunction) => {
		try {
			const data = req.app.locals.data;
			if (!req.app.locals.dbClient) {
				res.status(500).send({ message: "No Mongo Client initialized." })
			} else if (!data || data.length === 0) {
				res.status(400).send({ message: "No data to retrieve file." })
			} else {
				const now = Date.now();
				const onTransfer = (id: string, progress: Progress | null, err?: Error) => {
					console.table({
						id,
						...(err ? { errore: err.message } : { loaded: progress?.loaded, total: progress?.total })
					});
				}
				await s3Utils.uploadFile({
					awsS3BucketName: process.env.AWS_BUCKET_NAME!,
					data,
					dbClient: req.app.locals.dbClient,
					dbName: process.env.MONGO_DB_NAME!,
					gridFsBucketName: process.env.MONGO_DB_GRIDFS_BUCKET!,
					parallel: true,
					prefix: process.env.AWS_BUCKET_FOLDER_PREFIX + "/" + new Date().toLocaleDateString().replaceAll("/", ""),
					s3Client: req.app.locals.s3Client!,
					onTransfer
				});
				req.app.locals.data = [];
				res.status(200).json({message: `Upload completed in ${(Date.now()-now)/1000} secondi`})
			}
		} catch (error) {
			next(error);
		}
	},
	sseUploadFile: async (req: Request, res: Response, next: NextFunction) => {
		try {
			const data = req.app.locals.data;
			if (!req.app.locals.dbClient) {
				res.status(500).send({ message: "No Mongo Client initialized." })
			} else if (!data || data.length === 0) {
				res.status(400).send({ message: "No data to retrieve file." })
			} else {
				SSEUtils.initSSE(req, res);
				const onTransfer = (id: string, progress: Progress | null, err?: Error) => {
					SSEUtils.sendData({
						id,
						loaded: progress?.loaded || "",
						total: progress?.total || "",
						error: err?.message || ""
					});
				}
				await s3Utils.uploadFile({
					awsS3BucketName: process.env.AWS_BUCKET_NAME!,
					data,
					dbClient: req.app.locals.dbClient,
					dbName: process.env.MONGO_DB_NAME!,
					gridFsBucketName: process.env.MONGO_DB_GRIDFS_BUCKET!,
					parallel: false,
					prefix: process.env.AWS_BUCKET_FOLDER_PREFIX + "/" + new Date().toLocaleDateString().replaceAll("/", ""),
					s3Client: req.app.locals.s3Client!,
					onTransfer
				});
				req.app.locals.data = [];
			}
		} catch (error) {
			SSEUtils.sendData({
				error: (error as Error).message
			});
		} finally {
			SSEUtils.closeEvent();
		}
	},
	sseUploadFileParallel: async (req: Request, res: Response, next: NextFunction) => {
		try {
			const data = req.app.locals.data;
			if (!req.app.locals.dbClient) {
				res.status(500).send({ message: "No Mongo Client initialized." })
			} else if (!data || data.length === 0) {
				res.status(400).send({ message: "No data to retrieve file." })
			} else {
				SSEUtils.initSSE(req, res);
				const onTransfer = (id: string, progress: Progress | null, err?: Error) => {
					SSEUtils.sendData({
						id,
						loaded: progress?.loaded || "",
						total: progress?.total || "",
						error: err?.message || ""
					});
				}
				await s3Utils.uploadFile({
					awsS3BucketName: process.env.AWS_BUCKET_NAME!,
					data,
					dbClient: req.app.locals.dbClient,
					dbName: process.env.MONGO_DB_NAME!,
					gridFsBucketName: process.env.MONGO_DB_GRIDFS_BUCKET!,
					parallel: true,
					prefix: process.env.AWS_BUCKET_FOLDER_PREFIX + "/" + new Date().toLocaleDateString().replaceAll("/", ""),
					s3Client: req.app.locals.s3Client!,
					onTransfer
				});
				req.app.locals.data = [];
			}
		} catch (error) {
			SSEUtils.sendData({
				error: (error as Error).message
			});
		} finally {
			SSEUtils.closeEvent();
		}
	},
	readBucketContent: async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.app.locals.s3Client) {
				res.status(500).send({ message: "No AWS S3 Client initialized." })
			} else {
				const { prefix } = req.params;
				const command = new ListObjectsCommand({ Bucket: process.env.AWS_BUCKET_NAME!, Prefix: prefix && prefix.indexOf(process.env.AWS_BUCKET_FOLDER_PREFIX!) === -1 ? (process.env.AWS_BUCKET_FOLDER_PREFIX + "/" + prefix) : (prefix || process.env.AWS_BUCKET_FOLDER_PREFIX) });
				const result = await req.app.locals.s3Client.send(command);
				const list = (result.Contents || []).map(el => ({ fileName: el.Key, size: el.Size, tag: el.ETag, storage: el.StorageClass, owner: el.Owner }));
				res.status(200).json(list);
			}
		} catch (error) {
			next(error);
		}
	},
	deleteBucketFile: async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.app.locals.s3Client) {
				res.status(500).send({ message: "No AWS S3 Client initialized." })
			} else {
				const { filename, prefix } = req.params;
				let command;
				if (prefix) {
					const commandList = new ListObjectsCommand({ Bucket: process.env.AWS_BUCKET_NAME!, Prefix: prefix && prefix.indexOf(process.env.AWS_BUCKET_FOLDER_PREFIX!) === -1 ? (process.env.AWS_BUCKET_FOLDER_PREFIX + "/" + prefix) : (prefix || process.env.AWS_BUCKET_FOLDER_PREFIX) });
					const result = await req.app.locals.s3Client.send(commandList);
					if (!result.Contents || result.Contents.length === 0) {
						res.status(404).json({ message: "No files found with prefix " + prefix });
						return;
					}
					command = new DeleteObjectsCommand({
						Bucket: process.env.AWS_BUCKET_NAME!,
						Delete: {
							Objects: (result.Contents || []).map(el => ({ Key: el.Key }))
						}
					});
				} else {
					command = new DeleteObjectsCommand({
						Bucket: process.env.AWS_BUCKET_NAME!,
						Delete: {
							Objects: [{ Key: filename as string }]
						}
					});
				}
				const result = await req.app.locals.s3Client.send(command);
				if ((result.Errors || []).length > 0) {
					res.status(400).json((result.Errors || []).map(el => `${el.Key}: ${el.Message}`));
				} else {
					res.status(200).json({ message: (result.Deleted || [{Key: "0 files "}]).map(el => el.Key).join(", ") + " deleted successfully" });
				}
			}
		} catch (error) {
			next(error);
		}
	},
	downloadBucketFile: async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.app.locals.s3Client) {
				res.status(500).send({ message: "No AWS S3 Client initialized." })
			} else {
				const { filename } = req.params;
				const command = new GetObjectCommand({
					Bucket: process.env.AWS_BUCKET_NAME!,
					Key: filename
				});
				const result = await req.app.locals.s3Client.send(command);
				if (!result.Body) {
					res.status(400).json({message: "File " + filename + " not found."});
				} else {
					res.set({
						"Content-type": result.ContentType || "application/octet-stream",
						"Content-disposition": `attachment; filename=${filename}`
					});
					res.status(200).send(await result.Body?.transformToByteArray());
				}
			}
		} catch (error) {
			next(error);
		}
	}
}
