import { CompleteMultipartUploadCommandOutput, DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, Owner } from "@aws-sdk/client-s3";
import { NextFunction, Request, Response } from "express";
import { s3Utils } from "../../../utils/s3.js";
import { Upload } from "@aws-sdk/lib-storage";
import { SSEUtils } from "../../../utils/sse.js";
import { QueryOptions } from "../../../model/index.js";
import { PassThrough, Transform } from "stream";
import pLimit from "p-limit";
import { GridFSBucket, ObjectId } from "mongodb";
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
	sseUploadFileWithStream: async (req: Request, res: Response, next: NextFunction) => {
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
			if (data === -1 && files === -1) {
				SSEUtils.sendData({ event: "no-count" });
			} else {
				SSEUtils.sendData({ event: "count", totalData: data, totalGridFS: files });
			}

			const UPLOAD_GRIDFS_FILE = "collectionField" in gridfsOptions;
			let gridFsBucket;
			if (UPLOAD_GRIDFS_FILE) {
				gridFsBucket = new GridFSBucket(db, { bucketName: gridfsOptions.gridFsCollection });
			}
			const stream = use === "query"
				? db.collection(collection).find(filter, { ...options, batchSize: 1000 }).stream()
				: db.collection(collection).aggregate(aggregation).stream();
			let uploadData: Promise<void | CompleteMultipartUploadCommandOutput> = Promise.resolve();
			const CONCURRENCY_LIMIT = 10;
			const limit = pLimit(CONCURRENCY_LIMIT);
			const dataPassThrough = new PassThrough();
			const uploadTransform = new Transform({
				objectMode: true,
				async transform(doc, _, callback) {
					if (includeData) {
						const line = JSON.stringify(doc) + "\n";
						if (!dataPassThrough.write(line)) {
							await new Promise<void>(resolve => dataPassThrough.once('drain', () => {
								SSEUtils.sendData({ event: "data", type: "data" });
								resolve();
							}));
						} else {
							SSEUtils.sendData({ event: "data", type: "data" });
						}
					}
					if (UPLOAD_GRIDFS_FILE) {
						if (limit.activeCount >= CONCURRENCY_LIMIT) {
							await new Promise<void>(resolve => {
								const interval = setInterval(() => {
									if (limit.activeCount < CONCURRENCY_LIMIT) {
										clearInterval(interval);
										resolve();
									}
								}, 50);
							})
						}
						limit(async () => {
							try {
								const match = (gridfsOptions.prefix || "") + doc[gridfsOptions.collectionField] + (gridfsOptions.suffix || "");
								const valueMatchFile = gridfsOptions.matchField === "_id"
									? new ObjectId(match)
									: match;
								const fileExists = await db.collection(gridfsOptions.gridFsCollection + ".files").findOne({ [gridfsOptions.matchField]: valueMatchFile }, { projection: { _id: 1 } });
								if (!fileExists) {
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
									},
									partSize: 100 * 1024 * 1024,
									queueSize: 5
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
					}
					callback();
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
						ContentType: 'application/x-jsonlines',
					},
					partSize: 100 * 1024 * 1024,
					queueSize: 5
				});
				uploadData = upload.done();
			}
			await pipeline(stream, uploadTransform);
			await uploadData;
			while (limit.activeCount > 0 || limit.pendingCount > 0) {
				await new Promise<void>(resolve => setTimeout(resolve, 500));
			}
			req.app.locals.queryOptions = undefined as unknown as QueryOptions;
		} catch (error) {
			SSEUtils.sendData({
				error: (error as Error).message
			});
		} finally {
			SSEUtils.closeEvent();
		}
	},
	sseUploadFileWithCursor: async (req: Request, res: Response, next: NextFunction) => {
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
			if (data === -1 && files === -1) {
				SSEUtils.sendData({ event: "no-count" });
			} else {
				SSEUtils.sendData({ event: "count", totalData: data, totalGridFS: files });
			}

			const UPLOAD_GRIDFS_FILE = "collectionField" in gridfsOptions;
			let gridFsBucket;
			if (UPLOAD_GRIDFS_FILE) {
				gridFsBucket = new GridFSBucket(db, { bucketName: gridfsOptions.gridFsCollection });
			}
			const cursor = use === "query"
				? db.collection(collection).find(filter, { ...options, batchSize: 1000 })
				: db.collection(collection).aggregate(aggregation);
			const CONCURRENCY_LIMIT = 10;
			const limit = pLimit(CONCURRENCY_LIMIT);

			const dataPassThrough = new PassThrough();
			let uploadPromise;
			if (includeData) {
				const upload = new Upload({
					client: req.app.locals.s3Client!,
					params: {
						Bucket: process.env.AWS_BUCKET_NAME!,
						Key: `${dataPrefixOnS3 ? dataPrefixOnS3 + "/" : ""}${collection}${use === "query" ? "" : "_aggregated"}.jsonl`,
						Body: dataPassThrough,
						ContentType: 'application/x-jsonlines'
					},
					partSize: 100 * 1024 * 1024,
					queueSize: 5
				});
				uploadPromise = upload.done();
			} else {
				uploadPromise = Promise.resolve();
			}

			for await (const doc of cursor) {
				const line = JSON.stringify(doc) + "\n";
				const matchGridFsStringValue: string | ObjectId = UPLOAD_GRIDFS_FILE
					? (gridfsOptions.prefix || "") + doc[gridfsOptions.collectionField] + (gridfsOptions.suffix || "")
					: "";
				if (includeData) {
					if (!dataPassThrough.write(line)) {
						await new Promise<void>(res => dataPassThrough.once('drain', () => {
							SSEUtils.sendData({ event: "data", type: "data" });
							res();
						}));
					} else {
						SSEUtils.sendData({ event: "data", type: "data" });
					}
				}
				if (UPLOAD_GRIDFS_FILE) {
					if (limit.activeCount >= CONCURRENCY_LIMIT) {
						await new Promise<void>(res => {
							const id = setInterval(() => {
								if (limit.activeCount < CONCURRENCY_LIMIT) {
									clearInterval(id);
									res();
								}
							}, 50);
						})
					}
					limit(async () => {
						try {
							const matchGridFsValue = gridfsOptions.matchField === "_id"
								? new ObjectId(matchGridFsStringValue)
								: matchGridFsStringValue;
							const fileExists = await db.collection(gridfsOptions.gridFsCollection + ".files").findOne({ [gridfsOptions.matchField]: matchGridFsValue }, { projection: { _id: 1 } });
							if (!fileExists) {
								return;
							}
							let gridFsStream, mimeStream;
							if (gridfsOptions.matchField === "_id") {
								gridFsStream = gridFsBucket!.openDownloadStream(matchGridFsValue as ObjectId);
								mimeStream = gridFsBucket!.openDownloadStream(matchGridFsValue as ObjectId);
							} else {
								gridFsStream = gridFsBucket!.openDownloadStreamByName(matchGridFsValue as string);
								mimeStream = gridFsBucket!.openDownloadStreamByName(matchGridFsValue as string);
							}
							const contentType = await s3Utils.detectContentType(mimeStream);
							const filePassThrough = new PassThrough();
							const upload = new Upload({
								client: req.app.locals.s3Client!,
								params: {
									Bucket: process.env.AWS_BUCKET_NAME!,
									Key: `${gridfsOptions.gridFsPrefixOnS3 ? gridfsOptions.gridFsPrefixOnS3 + "/" : ""}${matchGridFsStringValue}${contentType.indexOf("stream") === -1 ? "." + contentType.split("/")[1] : ""}`,
									Body: filePassThrough,
									ContentType: contentType
								},
								partSize: 100 * 1024 * 1024,
								queueSize: 5
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
					})
				}
			}
			dataPassThrough.end();
			await uploadPromise;

			while (limit.activeCount > 0 || limit.pendingCount > 0) {
				await new Promise<void>(r => setTimeout(r, 100));
			}
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
				let { prefix, limit } = req.params as { prefix: string, limit: string | number };
				prefix = prefix === "-1" ? "" : decodeURIComponent(prefix);
				limit = Number(limit);
				isNaN(limit) && (limit = 1000);
				const list: { fileName?: string, size?: number, tag?: string, lastModified?: Date, storage?: string, owner?: Owner }[] = [];
				let isTruncated = true;
				let nextToken: string | undefined;
				while (isTruncated) {
					// INFO la list ha un limite di 1000 elementi per richiesta
					const command = new ListObjectsV2Command({
						Bucket: process.env.AWS_BUCKET_NAME!,
						Prefix: prefix,
						ContinuationToken: nextToken
					});
					const result = await req.app.locals.s3Client.send(command);
					(result.Contents || []).forEach(el => list.push({ fileName: el.Key, size: el.Size, tag: el.ETag, lastModified: el.LastModified, storage: el.StorageClass, owner: el.Owner }));
					isTruncated = result.IsTruncated ?? false;
					nextToken = result.NextContinuationToken;
					if (limit !== -1 && list.length >= limit) {
						list.splice(limit, list.length - limit);
						isTruncated = false;
					}
				}
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
				let { filename, prefix, limit } = req.params as { filename: string, prefix: string, limit: string | number };
				let commands = [];
				if (prefix) {
					prefix = prefix === "-1" ? "" : decodeURIComponent(prefix);
					limit = Number(limit);
					isNaN(limit) && (limit = 1000);
					const list: { Key: string }[] = [];
					let isTruncated = true;
					let nextToken: string | undefined;
					while (isTruncated) {
						// INFO la list ha un limite di 1000 elementi per richiesta
						const command = new ListObjectsV2Command({
							Bucket: process.env.AWS_BUCKET_NAME!,
							Prefix: prefix,
							ContinuationToken: nextToken
						});
						const result = await req.app.locals.s3Client.send(command);
						if (!result.Contents || result.Contents.length === 0) {
							res.status(404).json({ message: "No files found with prefix " + prefix });
							return;
						}
						(result.Contents || []).forEach(el => el.Key && list.push({ Key: el.Key }));
						isTruncated = result.IsTruncated ?? false;
						nextToken = result.NextContinuationToken;
						if (limit !== -1 && list.length >= limit) {
							list.splice(limit, list.length - limit);
							isTruncated = false;
						}
					}
					// INFO la delete ha un limite di 1000 cancellazioni per richiesta
					for (let i = 0; i < list.length; i += 1000) {
						const subList = list.slice(i, i + 1000);
						commands.push(new DeleteObjectsCommand({
							Bucket: process.env.AWS_BUCKET_NAME!,
							Delete: {
								Objects: subList
							}
						}));
					}
				} else {
					filename = decodeURIComponent(filename);
					if (!filename) {
						res.status(400).json({ message: "Filename cannot be empty." });
						return;
					}
					commands.push(new DeleteObjectsCommand({
						Bucket: process.env.AWS_BUCKET_NAME!,
						Delete: {
							Objects: [{ Key: filename as string }]
						}
					}));
				}
				const errors: string[] = [];
				let deleted = 0;
				for (const command of commands) {
					const result = await req.app.locals.s3Client.send(command);
					(result.Errors || []).length > 0
						? (result.Errors || []).forEach(el => {
							errors.push(`${el.Key}: ${el.Message}`);
						})
						: (deleted += (result.Deleted || []).length);
				}
				res.status(200).json({
					errors,
					deleted
				})
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

