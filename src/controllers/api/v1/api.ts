import { DeleteObjectsCommand, ListObjectsCommand } from "@aws-sdk/client-s3";
import { NextFunction, Request, Response } from "express";
import { s3Utils } from "../../../utils/s3.js";
import { Progress } from "@aws-sdk/lib-storage";
import { SSEUtils } from "../../../utils/sse.js";

export const apiController = {
	getUdaFields: async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.app.locals.dbClient) {
				res.status(500).send({ message: "No Mongo Client initialized." })
			} else {
				const db = req.app.locals.dbClient.db(process.env.MONGO_DB_NAME!);
				const uda = await db.collection(process.env.MONGO_DB_COLLECTION!).findOne();
				if (!uda) {
					res.status(400).send({ message: "Collection empty" });
				} else {
					const keys = Reflect.ownKeys(uda);
					res.status(200).json(keys.filter(el => el !== "_class"));
				}
			}
		} catch (error) {
			next(error);
		}
	},
	getUdaData: async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.app.locals.dbClient) {
				res.status(500).send({message: "No Mongo Client initialized."})
			} else if (!process.env.MONGO_COLLECTION_PROJECT_FIELD || process.env.MONGO_COLLECTION_PROJECT_FIELD === "") {
				res.status(500).send({ message: "No field provided to project mongo data." })
			} else {
				const { query } = req.params;
				const queryParsed = JSON.parse(query);
				const db = req.app.locals.dbClient.db(process.env.MONGO_DB_NAME!);
				const project = {};
				const fields = process.env.MONGO_COLLECTION_PROJECT_FIELD.split(",");
				fields.map(el => Reflect.set(project, el, 1));
				const mongoData = await db.collection(process.env.MONGO_DB_COLLECTION!).find(queryParsed).project(project).toArray();
				const data = mongoData.map(el => {
					const obj: { id: string; type: string; mimeType: string; } & Record<string, string> = {
						id: "",
						type: "",
						mimeType: ""
					};
					fields.forEach(field => {
						if (Array.isArray(el[field])) {
							obj.type = el[field][0].nomeFile;
							obj.mimeType = el[field][0].mimeType;
						} else {
							!obj.id ? (obj.id = el[field]) : (obj[field] = el[field]);
						}
					})
					return obj;
				});
				req.app.locals.data = data;
				res.status(200).send(data);
			}
		} catch (error) {
			next(error);
		}
	},
	uploadPhoto: async (req: Request, res: Response, next: NextFunction) => {
		try {
			const data = req.app.locals.data;
			if (!req.app.locals.dbClient) {
				res.status(500).send({ message: "No Mongo Client initialized." })
			} else if (!data || data.length === 0) {
				res.status(400).send({ message: "No data to retrieve file." })
			} else {
				const now = Date.now();
				const onTransfer = (id: string, progress: Progress) => {
					console.table({
						id,
						loaded: progress.loaded,
						total: progress.total
					});
				}
				await s3Utils.uploadPhoto({
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
				SSEUtils.closeEvent();
				req.app.locals.data = [];
				res.status(200).json({ message: `Upload completed in ${(Date.now() - now) / 1000} secondi` })
			}
		} catch (error) {
			next(error);
		}
	},
	uploadPhotoParallel: async (req: Request, res: Response, next: NextFunction) => {
		try {
			const data = req.app.locals.data;
			if (!req.app.locals.dbClient) {
				res.status(500).send({ message: "No Mongo Client initialized." })
			} else if (!data || data.length === 0) {
				res.status(400).send({ message: "No data to retrieve file." })
			} else {
				const now = Date.now();
				const onTransfer = (id: string, progress: Progress) => {
					console.table({
						id,
						loaded: progress.loaded,
						total: progress.total
					});
				}
				await s3Utils.uploadPhoto({
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
				SSEUtils.closeEvent();
				req.app.locals.data = [];
				res.status(200).json({message: `Upload completed in ${(Date.now()-now)/1000} secondi`})
			}
		} catch (error) {
			next(error);
		}
	},
	sseUploadPhoto: async (req: Request, res: Response, next: NextFunction) => {
		try {
			const data = req.app.locals.data;
			if (!req.app.locals.dbClient) {
				res.status(500).send({ message: "No Mongo Client initialized." })
			} else if (!data || data.length === 0) {
				res.status(400).send({ message: "No data to retrieve file." })
			} else {
				SSEUtils.initSSE(req, res);
				const onTransfer = (id: string, progress: Progress) => {
					SSEUtils.sendData({
						id,
						loaded: progress.loaded,
						total: progress.total
					});
				}
				await s3Utils.uploadPhoto({
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
				SSEUtils.closeEvent();
			}
		} catch (error) {
			next(error);
		}
	},
	sseUploadPhotoParallel: async (req: Request, res: Response, next: NextFunction) => {
		try {
			const data = req.app.locals.data;
			if (!req.app.locals.dbClient) {
				res.status(500).send({ message: "No Mongo Client initialized." })
			} else if (!data || data.length === 0) {
				res.status(400).send({ message: "No data to retrieve file." })
			} else {
				SSEUtils.initSSE(req, res);
				const onTransfer = (id: string, progress: Progress) => {
					SSEUtils.sendData({
						id,
						loaded: progress.loaded,
						total: progress.total
					});
				}
				await s3Utils.uploadPhoto({
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
				SSEUtils.closeEvent();
			}
		} catch (error) {
			next(error);
		}
	},
	readBucketContent: async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.app.locals.s3Client) {
				res.status(500).send({ message: "No AWS S3 Client initialized." })
			} else {
				const { prefix } = req.params;
				const command = new ListObjectsCommand({ Bucket: process.env.AWS_BUCKET_NAME!, Prefix: prefix && prefix.indexOf(process.env.AWS_BUCKET_FOLDER_PREFIX!) !== -1 ? process.env.AWS_BUCKET_FOLDER_PREFIX + "/" + prefix : (prefix || process.env.AWS_BUCKET_FOLDER_PREFIX) });
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
					const commandList = new ListObjectsCommand({ Bucket: process.env.AWS_BUCKET_NAME!, Prefix: prefix && prefix.indexOf(process.env.AWS_BUCKET_FOLDER_PREFIX!) !== -1 ? process.env.AWS_BUCKET_FOLDER_PREFIX + "/" + prefix : (prefix || process.env.AWS_BUCKET_FOLDER_PREFIX) });
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
	}
}
