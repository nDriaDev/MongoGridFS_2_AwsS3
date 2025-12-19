import { CompleteMultipartUploadCommandOutput, S3Client } from "@aws-sdk/client-s3";
import { BodyDataTypes, Progress, Upload } from "@aws-sdk/lib-storage";
import { GridFSBucket, MongoClient } from "mongodb";
import pLimit from "p-limit";
import { PassThrough } from "stream";

async function uploadStream({ bucket, s3Client, bucketS3Name, id, filename, s3KeyFile, onTransfer }: { bucket: GridFSBucket, s3Client: S3Client, bucketS3Name: string, id: string, filename: string, s3KeyFile: string, onTransfer?: (id: string, progress: Progress | null, err?: Error) => void }) {
	let error = false;
	try {
		const stream = bucket.openDownloadStreamByName(filename);
		const passStream = new PassThrough();
		const upload = new Upload({
			client: s3Client,
			params: {
				Bucket: bucketS3Name,
				Key: s3KeyFile,
				Body: passStream,
				ContentType: process.env.MONGO_DB_GRIDFS_CONTENT_TYPE
			},
			queueSize: 4,
			partSize: 10 * 1024 * 1024
		});
		!!onTransfer && upload.on("httpUploadProgress", progress => {
			onTransfer(id, progress);
		});
		stream.on("error", (err) => {
			!!onTransfer
				? onTransfer(id, null, err)
				: console.error(`File ${id} non trovato su GridFS:`, err);
			error = true;
			passStream.destroy(err);
		});

		passStream.on("error", (err) => {
			error = true;
			!!onTransfer
				? onTransfer(id, null, err)
				: console.error(`Errore durante il caricamento su S3 per il file ${id}:`, err);
		});

		stream.pipe(passStream);
		const result = await upload.done();
		return result;
	} catch (err) {
		if (!error) {
			throw err;
		}
	}
}

async function uploadFile({ s3Client, dbClient, dbName, gridFsBucketName, awsS3BucketName, prefix, parallel, data, onTransfer }: { s3Client: S3Client, dbClient: MongoClient, dbName: string, gridFsBucketName: string, awsS3BucketName: string, prefix: string, parallel: boolean, data: Record<string, string>[], onTransfer?: (id: string, progress: Progress | null, err?: Error) => void }) {
	try {
		const db = dbClient.db(dbName);
		const bucket = new GridFSBucket(db, { bucketName: gridFsBucketName });
		if (parallel) {
			const parallelLimit = pLimit(3);
			await Promise.all(
				data.map(doc => parallelLimit(() => {
					const filename = (process.env.MONGO_DB_GRIDFS_ID_PREFIX || "") + doc[process.env.MONGO_DB_COLLECTION_FIELD_FOR_ID_GRIDFS!] + (process.env.MONGO_DB_GRIDFS_ID_SUFFIX || "");
					return uploadStream({
						bucket,
						bucketS3Name: awsS3BucketName,
						filename,
						s3Client: s3Client,
						id: doc[process.env.MONGO_DB_COLLECTION_FIELD_FOR_ID_GRIDFS!],
						s3KeyFile: prefix + "/" + filename + "." + process.env.MONGO_DB_GRIDFS_FILE_EXTENSION,
						onTransfer
					});
				}))
			)
		} else {
			const uploads: Promise<CompleteMultipartUploadCommandOutput | undefined>[] = [];
			data.forEach(doc => {
				const filename = (process.env.MONGO_DB_GRIDFS_ID_PREFIX || "") + doc[process.env.MONGO_DB_COLLECTION_FIELD_FOR_ID_GRIDFS!] + (process.env.MONGO_DB_GRIDFS_ID_SUFFIX || "");
				uploads.push(uploadStream({
					bucket,
					bucketS3Name: awsS3BucketName,
					filename,
					s3Client: s3Client,
					id: doc[process.env.MONGO_DB_COLLECTION_FIELD_FOR_ID_GRIDFS!],
					s3KeyFile: prefix + "/" + filename + "." + process.env.MONGO_DB_GRIDFS_FILE_EXTENSION,
					onTransfer
				}));
			});
			await Promise.all(uploads);
		}
	} catch (error) {
		throw error;
	}
}

export const s3Utils = {
	uploadFile
}
