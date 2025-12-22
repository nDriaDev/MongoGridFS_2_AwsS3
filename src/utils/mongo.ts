import { Db } from "mongodb";

async function getCounts(includeData: boolean, db: Db, collection: string, use: "query" | "aggregation", aggregation: Document[], filter: Record<string, any>, options: {} | { sort?: Record<string, -1 | 1>; limit?: number; projection?: Record<string, 1 | -1>; }, gridfsOptions: {} | { gridFsPrefixOnS3: string; collectionField: string; matchField: string; prefix?: string; suffix?: string; }) {
	try {
		const result: { data: number; files: number; } = { data: -1, files: -1 };
		let aggregationResult;
		if (includeData) {
			let countData;
			if (use === "query") {
				countData = await db.collection(collection).countDocuments(filter, options);
			} else {
				aggregationResult = await db.collection(collection).aggregate(aggregation).toArray();
				countData = aggregationResult.length;
			}
			result.data = countData;
		}
		if ("collectionField" in gridfsOptions) {
			const data = use === "query"
				? await db.collection(collection).find(filter, options).toArray()
				: aggregationResult!;
			const files = await db.collection(process.env.MONGO_DB_GRIDFS_BUCKET + ".files").countDocuments({
				[gridfsOptions.matchField]: { $in: data.map(el => `${gridfsOptions.prefix}${el[gridfsOptions.collectionField]}${gridfsOptions.suffix}`) }
			});
			result.files = files;
		}
		return result;
	} catch (error) {
		throw error;
	}
}

export const MongoUtils = {
	getCounts
}
