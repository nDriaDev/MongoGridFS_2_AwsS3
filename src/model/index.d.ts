import { S3Client } from "@aws-sdk/client-s3";
import { MongoClient } from "mongodb";

declare global {
	namespace Express {
		interface Locals {
			dbClient?: MongoClient;
			s3Client?: S3Client;
			data: ({id: string, type: string, mimeType: string} & Record<string, string>)[]
		}
	}
}
