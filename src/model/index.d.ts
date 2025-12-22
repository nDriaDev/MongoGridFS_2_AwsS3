import { S3Client } from "@aws-sdk/client-s3";
import { MongoClient } from "mongodb";

declare global {
	namespace Express {
		interface Locals {
			dbClient?: MongoClient;
			s3Client?: S3Client;
			data: Record<string, string>[];
			dataFields: string[];
			gridFsIdField: string;
			queryOptions: QueryOptions;
		}
	}
}

export interface QueryOptions {
	use: "query" | "aggregation",
	aggregation: Document[];
	collection: string;
	includeData: boolean;
	dataPrefixOnS3: string;
	filter: Record<string, any>;
	options: {} | {
		sort?: Record<string, -1 | 1>;
		limit?: number;
		projection?: Record<string, 1 | -1>;
	};
	gridfsOptions: {
		gridFsPrefixOnS3: string;
		gridFsCollection: string;
		collectionField: string;
		matchField: string;
		prefix?: string;
		suffix?: string;
	} | {};
}
