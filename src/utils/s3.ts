import { CompleteMultipartUploadCommandOutput, S3Client } from "@aws-sdk/client-s3";
import { BodyDataTypes, Progress, Upload } from "@aws-sdk/lib-storage";
import { Db, GridFSBucket, MongoClient } from "mongodb";
import pLimit from "p-limit";
import { PassThrough } from "stream";

function uploadStream({ bucketName, body, id, key, s3Client, onTransfer }: { bucketName?: string, body?: BodyDataTypes, id: string, key: string, s3Client: S3Client, onTransfer?: (id: string, progress: Progress) => void }) {
	try {
		const parallelUploadS3 = new Upload({
			client: s3Client,
			params: {
				Bucket: bucketName,
				Body: body,
				Key: key
			}
		})
		!!onTransfer && parallelUploadS3.on("httpUploadProgress", progress => {
			onTransfer(id, progress);
		});
		return parallelUploadS3.done();
	} catch (error) {
		throw error;
	}
}

async function uploadStreamParallel({ bucket, s3Client, bucketS3Name, id, filename, s3KeyFile, onTransfer }: { bucket: GridFSBucket, s3Client: S3Client, bucketS3Name: string, id: string, filename: string, s3KeyFile: string, onTransfer?: (id: string, progress: Progress) => void }) {
	try {
		const stream = bucket.openDownloadStreamByName(filename);
		const passStream = new PassThrough();
		const upload = new Upload({
			client: s3Client,
			params: {
				Bucket: bucketS3Name,
				Key: s3KeyFile,
				Body: passStream
			},
			queueSize: 4,
			partSize: 10 * 1024 * 1024
		});
		!!onTransfer && upload.on("httpUploadProgress", progress => {
			console.log("transfer")
			onTransfer(id, progress);
		});
		stream.pipe(passStream);
		await upload.done();
	} catch (error) {
		throw error;
	}
}

async function uploadPhoto({ s3Client, dbClient, dbName, gridFsBucketName, awsS3BucketName, prefix, parallel, data, onTransfer }: { s3Client: S3Client, dbClient: MongoClient, dbName: string, gridFsBucketName: string, awsS3BucketName: string, prefix: string, parallel: boolean, data: { id: string, type: string, mimeType: string }[], onTransfer?: (id: string, progress: Progress) => void }) {
	try {
		const db = dbClient.db(dbName);
		const bucket = new GridFSBucket(db, { bucketName: gridFsBucketName });
		if (parallel) {
			const uploads: Promise<CompleteMultipartUploadCommandOutput>[] = [];
			data.forEach(uda => {
				const stream = bucket.openDownloadStreamByName(uda.type + "_" + uda.id);
				uploads.push(uploadStream({
					id: uda.id,
					key: prefix + "/" + uda.type + "_" + uda.id + ".jpg",
					body: stream,
					s3Client: s3Client,
					bucketName: awsS3BucketName,
					onTransfer
				}));
			});
			await Promise.all(uploads);
		} else {
			const parallelLimit = pLimit(3);
			await Promise.all(
				data.map(uda => parallelLimit(() => uploadStreamParallel({
					bucket,
					bucketS3Name: awsS3BucketName,
					filename: uda.type + "_" + uda.id,
					s3Client: s3Client,
					id: uda.id,
					s3KeyFile: prefix + "/" + uda.type + "_" + uda.id + ".jpg",
					onTransfer
				})))
			)
		}
	} catch (error) {

	}
}

export const s3Utils = {
	uploadPhoto
}
