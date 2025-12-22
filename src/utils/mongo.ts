import { Db } from "mongodb";
import { QueryOptions } from "../model/index.js";

async function getCounts(includeData: QueryOptions["includeData"], db: Db, collection: string, use: QueryOptions["use"], aggregation: QueryOptions["aggregation"], filter: QueryOptions["filter"], options: QueryOptions["options"], gridfsOptions: QueryOptions["gridfsOptions"]) {
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
			const files = await db.collection(gridfsOptions.gridFsCollection + ".files").countDocuments({
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
