import { CompleteMultipartUploadCommandOutput, DeleteObjectsCommand, GetObjectCommand, ListObjectsCommand } from "@aws-sdk/client-s3";
import { NextFunction, Request, Response } from "express";
import { s3Utils } from "../../../utils/s3.js";
import { Upload } from "@aws-sdk/lib-storage";
import { SSEUtils } from "../../../utils/sse.js";
import { QueryOptions } from "../../../model/index.js";
import { PassThrough, Transform } from "stream";
import pLimit from "p-limit";
import { Db, GridFSBucket, ObjectId } from "mongodb";
import { pipeline } from "stream/promises";
import { MongoUtils } from "../../../utils/mongo.js";

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
				const data = await db.collection(collection).find().sort({_id: -1}).limit(5).toArray();
				if (!data || data.length === 0) {
					res.status(400).send({ message: "Collection empty" });
				} else {
					const keys = new Set();
					data.forEach(el => Reflect.ownKeys(el).forEach(key => keys.add(key)));
					res.status(200).json(Array.from(keys).filter(el => el !== "_class"));
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
				const queryParsed: QueryOptions = JSON.parse(query);
				if (Reflect.ownKeys(queryParsed.gridfsOptions).length === 0 && !queryParsed.includeData) {
					res.status(400).send({ message: "No data selected to upload on S3." });
					return;
				}
				if (queryParsed.use === "query" && "collectionField" in queryParsed.gridfsOptions && "projection" in queryParsed.options && queryParsed.options.projection) {
					const val = queryParsed.options.projection[queryParsed.gridfsOptions.collectionField];
					if (queryParsed.gridfsOptions.collectionField !== "_id" && val !== 1) {
						res.status(400).send({ message: "GridFS collection field missing in projection query." });
						return;
					}
				}
				req.app.locals.queryOptions = queryParsed;
				res.status(200).send();
			}
		} catch (error) {
			next(error);
		}
	},
	countData: async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.app.locals.dbClient) {
				res.status(500).send({ message: "No Mongo Client initialized." });
				return;
			}
			if (!req.app.locals.queryOptions) {
				res.status(500).send({ message: "No query options provided." });
				return;
			}
			const db = req.app.locals.dbClient.db(process.env.MONGO_DB_NAME!);
			const { collection, includeData, filter, gridfsOptions, options, aggregation, use } = req.app.locals.queryOptions;
			const result: { data?: number; files?: number; } = await MongoUtils.getCounts(includeData, db, collection, use, aggregation, filter, options, gridfsOptions);
			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	},
	sseUploadFile: async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (!req.app.locals.dbClient) {
				res.status(500).send({ message: "No Mongo Client initialized." });
				return;
			}
			if (!req.app.locals.queryOptions) {
				res.status(500).send({ message: "No query options provided." });
				return;
			}
			SSEUtils.initSSE(req, res);
			const db = req.app.locals.dbClient.db(process.env.MONGO_DB_NAME!);
			const { collection, includeData, dataPrefixOnS3, use, aggregation, filter, gridfsOptions, options } = req.app.locals.queryOptions;
			let data = Number(req.params.data);
			let files = Number(req.params.files);
			if (data !== -1 && files === -1) {
				SSEUtils.sendData({ event: "no-count" });
			} else {
				SSEUtils.sendData({ event: "count", totalData: data, totalGridFS: files });
			}

			//@ts-ignore
			const UPLOAD_GRIDFS_FILE = "collectionField" in gridfsOptions;
			let gridFsBucket;
			if (UPLOAD_GRIDFS_FILE) {
				gridFsBucket = new GridFSBucket(db, { bucketName: gridfsOptions.gridFsCollection });
			}
			const stream = use === "query"
				? db.collection(collection).find(filter, { ...options, batchSize: 1000 }).stream()
				: db.collection(collection).aggregate(aggregation).stream();
			let uploadData: Promise<void | CompleteMultipartUploadCommandOutput> = Promise.resolve();
			const limit = pLimit(10);
			const fileTasks: Promise<void>[] = [];
			const dataPassThrough = new PassThrough();
			const uploadTransform = new Transform({
				objectMode: true,
				transform(doc, _, callback) {
					let canContinue = true;
					if (includeData) {
						canContinue = dataPassThrough.write(JSON.stringify(doc) + "\n");
					}
					if (UPLOAD_GRIDFS_FILE) {
						let founded = true;
						const task = limit(async () => {
							try {
								const match = (gridfsOptions.prefix || "") + doc[gridfsOptions.collectionField] + (gridfsOptions.suffix || "");
								const valueMatchFile = gridfsOptions.matchField === "_id"
									? new ObjectId(match)
									: match;
								const fileExists = await db.collection(gridfsOptions.gridFsCollection + ".files").findOne({ [gridfsOptions.matchField]: valueMatchFile }, { projection: { _id: 1 } });
								if (!fileExists) {
									founded = false;
									return;
								}
								let gridFsStream, mimeStream;
								if (gridfsOptions.matchField === "_id") {
									gridFsStream = gridFsBucket!.openDownloadStream(valueMatchFile as ObjectId);
									mimeStream = gridFsBucket!.openDownloadStream(valueMatchFile as ObjectId);
								} else {
									gridFsStream = gridFsBucket!.openDownloadStreamByName(valueMatchFile as string);
									mimeStream = gridFsBucket!.openDownloadStreamByName(valueMatchFile as string);
								}
								const contentType = await s3Utils.detectContentType(mimeStream);
								const filePassThrough = new PassThrough();
								const upload = new Upload({
									client: req.app.locals.s3Client!,
									params: {
										Bucket: process.env.AWS_BUCKET_NAME!,
										Key: `${gridfsOptions.gridFsPrefixOnS3 ? gridfsOptions.gridFsPrefixOnS3 + "/" : ""}${valueMatchFile}${contentType.indexOf("stream") === -1 ? "." + contentType.split("/")[1] : ""}`,
										Body: filePassThrough,
										ContentType: contentType
									}
								});
								await Promise.all([
									pipeline(gridFsStream, filePassThrough),
									upload.done()
								]);
								SSEUtils.sendData({ event: "data", type: "files" });
							} catch (error) {
								SSEUtils.sendData({
									error: (error as Error).message
								});
							}
						});
						founded && fileTasks.push(task);
					}
					if (canContinue) {
						includeData && SSEUtils.sendData({ event: "data", type: "data" });
						callback();
					} else {
						dataPassThrough.once("drain", () => {
							includeData && SSEUtils.sendData({ event: "data", type: "data" });
							callback();
						});
					}
				},
				flush(callback) {
					dataPassThrough.end();
					callback();
				},
			});
			if (includeData) {
				const upload = new Upload({
					client: req.app.locals.s3Client!,
					params: {
						Bucket: process.env.AWS_BUCKET_NAME!,
						Key: `${dataPrefixOnS3 ? dataPrefixOnS3 + "/" : ""}${collection}${use === "query" ? "" : "_aggregated"}.jsonl`,
						Body: dataPassThrough,
						ContentType: 'application/x-jsonlines'
					}
				});
				uploadData = upload.done();
			}
			await pipeline(stream, uploadTransform);
			await Promise.all([
				uploadData,
				...fileTasks
			]);
			req.app.locals.queryOptions = undefined as unknown as QueryOptions;
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
				let { prefix } = req.params;
				prefix = decodeURIComponent(prefix);
				const command = new ListObjectsCommand({ Bucket: process.env.AWS_BUCKET_NAME!, Prefix: prefix });
				const result = await req.app.locals.s3Client.send(command);
				const list = (result.Contents || []).map(el => ({ fileName: el.Key, size: el.Size, tag: el.ETag, lastModified: el.LastModified, storage: el.StorageClass, owner: el.Owner }));
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
				let { filename, prefix } = req.params;
				let command;
				if (prefix) {
					prefix = decodeURIComponent(prefix);
					const commandList = new ListObjectsCommand({ Bucket: process.env.AWS_BUCKET_NAME!, Prefix: prefix });
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
					filename = decodeURIComponent(filename);
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

