import { Db } from "mongodb";

async function getCounts(includeData: boolean, db: Db, collection: string, filter: Record<string, any>, options: {} | { sort?: Record<string, -1 | 1>; limit?: number; projection?: Record<string, 1 | -1>; }, gridfsOptions: {} | { gridFsPrefixOnS3: string; collectionField: string; matchField: string; prefix?: string; suffix?: string; }) {
	const result: { data: number; files: number; } = { data: -1, files: -1 };
	if (includeData) {
		const countData = await db.collection(collection).countDocuments(filter, options);
		result.data = countData;
	}
	if ("collectionField" in gridfsOptions) {
		const data = await db.collection(collection).find(filter, options).toArray();
		const files = await db.collection(process.env.MONGO_DB_GRIDFS_BUCKET + ".files").countDocuments({
			[gridfsOptions.matchField]: { $in: data.map(el => `${gridfsOptions.prefix}${el[gridfsOptions.collectionField]}${gridfsOptions.suffix}`) }
		});
		result.files = files;
	}
	return result;
}

export const MongoUtils = {
	getCounts
}
