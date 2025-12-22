let rules = [];
let activeTab = 0;
let availableFields = [];
let editor = null;
let editorAggr = null;
let mongoOptions = {};
let gridfsOptions = {};

const mongoOperators = ["$eq", "$ne", "$gt", "$gte", "$lt", "$lte", "$in", "$nin", "$regex", "$exists"];

window.initMonaco = function () {
	editor = monaco.editor.create(
		document.getElementById("editor"),
		{
			value: "{}",
			language: "json",
			theme: "vs-dark",
			automaticLayout: true
		}
	);
	editorAggr = monaco.editor.create(
		document.getElementById("editor-aggr"),
		{
			value: "[\n  \n]",
			language: "json",
			theme: "vs-dark",
			automaticLayout: true
		}
	);
	updateQueryPreview();
};

async function loadFields(collection) {
	try {
		const res = await fetch(`/api/v2/collections/${collection}/fields`);
		if (!res.ok) {
			alert("Errore nella ricezione dei campi")
		}
		availableFields = await res.json();
		renderRules();
		renderSortFields();
		renderProjectionFields();
		renderGrifsMatchFields();
	} catch (err) {
		console.error("Errore caricando campi:", err);
	}
}

async function loadCollection() {
	try {
		const res = await fetch(`/api/v2/collections`);
		if (!res.ok) {
			alert("Errore nella ricezione delle collection")
		}
		const data = await res.json();
		const select = document.getElementById("collection");
		let opt = document.createElement("option");
		opt.value = "";
		opt.innerHTML = "-- Seleziona una Collection --"
		select?.appendChild(opt);
		opt = null;
		data.forEach(coll => {
			const opt = document.createElement("option");
			opt.setAttribute("value", coll);
			opt.innerHTML = coll;
			select?.appendChild(opt);
		});
		select.onchange = (e) => {
			e.target.value !== "" && loadFields(e.target.value);
		}
	} catch (err) {
		console.error("Errore caricando campi:", err);
	}
}

function addRule() {
	const id = Date.now();
	rules.push({ id, field: "", operator: "$eq", value: "", logic: "AND" });
	renderRules();
}

function removeRule(id) {
	rules = rules.filter(r => r.id !== id);
	renderRules();
}

function updateRule(id, key, value) {
	const rule = rules.find(r => r.id === id);
	if (!rule) return;
	rule[key] = value;
	updateQueryPreview();
}

function renderRules() {
	const container = document.getElementById("rules");
	rules.length !== 0 ? container?.removeAttribute("hidden") : container?.setAttribute("hidden", true);
	container.innerHTML = "";

	rules.forEach((rule, index) => {
		const row = document.createElement("div");
		row.className = `row g-1 ${index !== 0 && index !== rules.length - 1 ? "my-1" : index === 0 ? "mb-1" : "mt-1"}`;

		const fieldSelect = document.createElement("select");
		fieldSelect.className = "form-select";
		fieldSelect.onchange = e => updateRule(rule.id, "field", e.target.value);
		const defaultFieldOption = document.createElement("option");
		defaultFieldOption.value = "";
		defaultFieldOption.text = "-- Seleziona campo --";
		fieldSelect.appendChild(defaultFieldOption);
		availableFields.forEach(f => {
			const opt = document.createElement("option");
			opt.value = f;
			opt.textContent = f;
			if (f === rule.field) opt.selected = true;
			fieldSelect.appendChild(opt);
		});

		const operatorSelect = document.createElement("select");
		operatorSelect.className = "form-select";
		operatorSelect.onchange = e => updateRule(rule.id, "operator", e.target.value);
		mongoOperators.forEach(op => {
			const opt = document.createElement("option");
			opt.value = op;
			opt.textContent = op;
			if (op === rule.operator) opt.selected = true;
			operatorSelect.appendChild(opt);
		});

		const valueInput = document.createElement("input");
		valueInput.className = "form-control";
		valueInput.value = rule.value;
		valueInput.placeholder = 'Es: "val1", true, 123';
		valueInput.onchange = e => updateRule(rule.id, "value", e.target.value);

		const logicSelect = document.createElement("select");
		logicSelect.className = "form-select";
		["AND", "OR"].forEach(op => {
			const opt = document.createElement("option");
			opt.value = op;
			opt.textContent = op;
			if (rule.logic === op) opt.selected = true;
			logicSelect.appendChild(opt);
		});
		logicSelect.onchange = e => updateRule(rule.id, "logic", e.target.value);

		const removeBtn = document.createElement("button");
		removeBtn.type = "button";
		removeBtn.className = "btn btn-danger";
		removeBtn.textContent = "X";
		removeBtn.onclick = () => removeRule(rule.id);

		const colField = document.createElement("div"); colField.className = "col-4"; colField.appendChild(fieldSelect);
		const colOperator = document.createElement("div"); colOperator.className = "col-2"; colOperator.appendChild(operatorSelect);
		const colValue = document.createElement("div"); colValue.className = "col-3"; colValue.appendChild(valueInput);
		const colLogic = document.createElement("div"); colLogic.className = "col-2"; colLogic.appendChild(logicSelect);
		const colRemove = document.createElement("div"); colRemove.className = "col-auto"; colRemove.appendChild(removeBtn);

		row.appendChild(colField);
		row.appendChild(colOperator);
		row.appendChild(colValue);
		row.appendChild(colLogic);
		row.appendChild(colRemove);

		container.appendChild(row);
	});

	updateQueryPreview();
}

function parseValue(v) {
	if (v === "") return null;

	if (/^"(.*)"$/.test(v)) return v.match(/^"(.*)"$/)[1];
	if (/^'(.*)'$/.test(v)) return v.match(/^'(.*)'$/)[1];
	if (v.toLowerCase() === "true") return true;
	if (v.toLowerCase() === "false") return false;
	if (!isNaN(v)) return Number(v);
	return v;
}

function buildCondition(r) {
	if (!r.field) return {};

	if (r.operator === "$in" || r.operator === "$nin") {
		const arr = r.value.split(",").map(v => parseValue(v.trim()));
		return { [r.field]: { [r.operator]: arr } };
	}

	if (r.operator === "$eq") return { [r.field]: parseValue(r.value) };
	if (r.operator === "$regex") return { [r.field]: { $regex: r.value } };
	return { [r.field]: { [r.operator]: parseValue(r.value) } };
}

function buildMongoQuery() {
	if (rules.length === 0) return {};

	const andMap = {};
	const orConditions = [];

	rules.forEach(r => {
		if (!r.field) return;

		const value = parseValue(r.value);

		if (r.logic === "OR") {
			orConditions.push(buildCondition(r));
			return;
		}

		if (!andMap[r.field]) {
			andMap[r.field] = {};
		}

		if (r.operator === "$eq") {
			andMap[r.field] = value;
			return;
		}

		if (r.operator === "$in" || r.operator === "$nin") {
			const arr = r.value.split(",").map(v => parseValue(v.trim()));
			andMap[r.field][r.operator] = arr;
			return;
		}

		andMap[r.field][r.operator] = value;
	});

	const andConditions = [];

	Object.entries(andMap).forEach(([field, condition]) => {
		if (
			typeof condition === "object" &&
			!Array.isArray(condition)
		) {
			andConditions.push({ [field]: condition });
		} else {
			andConditions.push({ [field]: condition });
		}
	});

	if (andConditions.length && orConditions.length) {
		return {
			$and: [
				...andConditions,
				{ $or: orConditions }
			]
		};
	}

	if (orConditions.length) {
		return { $or: orConditions };
	}

	if (andConditions.length === 1) {
		return andConditions[0];
	}

	return { $and: andConditions };
}


function updateQueryPreview() {
	const filter = buildMongoQuery();

	const preview = {
		filter,
		options: mongoOptions
	};

	const json = JSON.stringify(preview, null, 2);

	if (editor) editor.setValue(json);

	const input = document.getElementById("queryInput");
	if (input) input.value = JSON.stringify(preview);
}

function renderSortFields() {
	const sortSelect = document.getElementById("sortField");
	sortSelect.innerHTML = `<option value="">-- Nessun ordinamento --</option>`;

	availableFields.forEach(f => {
		const opt = document.createElement("option");
		opt.value = f;
		opt.textContent = f;
		sortSelect.appendChild(opt);
	});

	sortSelect.onchange = updateMongoOptions;
	document.getElementById("sortOrder").onchange = updateMongoOptions;
}

function renderProjectionFields() {
	const container = document.getElementById("projectionFields");
	container.innerHTML = "";

	availableFields.forEach(f => {
		const col = document.createElement("div");
		col.className = "col-4";

		const label = document.createElement("label");
		label.className = "form-check-label";

		const checkbox = document.createElement("input");
		checkbox.type = "checkbox";
		checkbox.className = "form-check-input me-1";
		checkbox.value = f;
		checkbox.onchange = updateMongoOptions;

		label.appendChild(checkbox);
		label.append(` ${f}`);

		const wrapper = document.createElement("div");
		wrapper.className = "form-check";
		wrapper.appendChild(label);

		col.appendChild(wrapper);
		container.appendChild(col);
	});
}

function updateMongoOptions() {
	mongoOptions = {};

	const sortField = document.getElementById("sortField").value;
	const sortOrder = document.getElementById("sortOrder").value;
	if (sortField) {
		mongoOptions.sort = { [sortField]: Number(sortOrder) };
	}

	const limit = document.getElementById("limit").value;
	if (limit) {
		mongoOptions.limit = Number(limit);
	}

	const projection = {};
	document
		.querySelectorAll("#projectionFields input[type=checkbox]:checked")
		.forEach(cb => {
			projection[cb.value] = 1;
		});

	if (Object.keys(projection).length > 0) {
		mongoOptions.projection = projection;
	}

	updateQueryPreview();
}

function getOptions() {
	const options = {
		...(Reflect.ownKeys(mongoOptions).length > 0 && { options: mongoOptions}),
		gridfsOptions: {}
	};

	if (document.getElementById("gridfsSwitch").checked) {
		options.gridfsOptions = {
			gridFsPrefixOnS3: document.getElementById("gridfs-prefix-val").value,
			collectionField: document.getElementById(`gridfsField${activeTab === 0 ? "" : "Text"}`).value,
			prefix: document.getElementById("gridfsPrefix").value,
			suffix: document.getElementById("gridfsSuffix").value,
			matchField: document.getElementById("gridfsMatchField").value
		};
	}

	return options;
}

function toggleSpinner() {
	const spinner = document.getElementById("loadingOverlay");
	if (spinner?.classList.contains("d-none")) {
		spinner?.classList.remove("d-none");
	} else {
		spinner?.classList.add("d-none");
	}
}

document.getElementById("limit").onchange = updateMongoOptions;

const btnExec = document.getElementById("exec");
const aS3 = document.getElementById("s3");
const loading = document.getElementById("loading");

btnExec.addEventListener("click", async (e) => {
	const gridSwitch = document.getElementById("gridfsSwitch");
	const gridfsField = document.getElementById("gridfsField");
	const gridfsFieldText = document.getElementById("gridfsFieldText");
	const gridfsMatchField = document.getElementById("gridfsMatchField");
	const collection = document.getElementById("collection");
	const dataPrefixVal = document.getElementById("data-prefix-val");
	const includeData = document.getElementById("includeData");

	const errors = [];
	if (activeTab === 0 && !gridfsField.value || activeTab === 1 && !gridfsFieldText.value) {
		gridSwitch.checked && errors.push("Nome campo per il match con GridFS");
	}
	if (!gridfsMatchField) {
		gridSwitch.checked && errors.push("Campo per il match della collection GridFS");
	}
	if (!collection.value) {
		errors.push("Collection");
	}
	if (errors.length > 0) {
		alert(`${errors.length > 1 ? "I Campi\n" : "Il campo\n"}${errors.join("\n")}${errors.length > 1 ? "\nsono obbligatori" : "\nè obbligatorio"}`);
		return;
	}
	btnExec.disabled = true;
	aS3.disabled = true;
	loading?.removeAttribute("hidden");
	let queryObj = editor ? JSON.parse(editor.getValue()) : {};
	const options = getOptions();
	queryObj = {
		...queryObj,
		...options,
		collection: collection.value,
		includeData: includeData.checked,
		dataPrefixOnS3: dataPrefixVal.value,
		aggregation: JSON.parse(editorAggr.getValue()),
		use: activeTab === 0 ? "query" : "aggregation"
	};
	const query = encodeURIComponent(JSON.stringify(queryObj));
	console.log(queryObj)

	try {
		const response = await fetch(`/api/v2/collections/get/${query}`);
		if (!response.ok) {
			throw Error((await response.json()).message);
		}
		window.location.href = "/v2/visualize";
	} catch (error) {
		alert(error.message);
	} finally {
		btnExec.disabled = false;
		aS3.disabled = false;
		loading?.setAttribute("hidden", true);

	}
});

function renderGrifsMatchFields() {
	let select = document.getElementById("gridfsField");
	availableFields.forEach(coll => {
		const opt = document.createElement("option");
		opt.setAttribute("value", coll);
		opt.innerHTML = coll;
		select?.appendChild(opt);
	});
}

document.getElementById("gridfsSwitch").addEventListener("change", function () {
	const gridfsFields = document.getElementById("gridfsFields");
	if (this.checked) {
		gridfsFields.style.display = "block";
	} else {
		gridfsFields.style.display = "none";
	}
});

document.getElementById("mongoOptionsSwitch").addEventListener("change", function () {
	const gridfsFields = document.getElementById("mongoOptionsFields");
	if (this.checked) {
		gridfsFields.style.display = "block";
	} else {
		gridfsFields.style.display = "none";
	}
});

document.getElementById("includeData").addEventListener("change", function () {
	const div = document.getElementById("data-prefix");
	if (this.checked) {
		div?.removeAttribute("hidden");
	} else {
		div?.setAttribute("hidden", true);
		document.getElementById("data-prefix-val").value = "";
	}
});

document.querySelectorAll('.stage-btn').forEach(btn => {
	btn.addEventListener('click', () => {
		const stage = btn.dataset.stage;
		let pipeline;
		try {
			pipeline = JSON.parse(editor.getValue());
			if (!Array.isArray(pipeline)) pipeline = [];
		} catch {
			pipeline = [];
		}

		switch (stage) {
			case "$match":
				pipeline.push({ "$match": {} });
				break;
			case "$project":
				pipeline.push({ "$project": {} });
				break;
			case "$group":
				pipeline.push({ "$group": {} });
				break;
			case "$sort":
				pipeline.push({ "$sort": {} });
				break;
			case "$limit":
				pipeline.push({ "$limit": 10 });
				break;
			case "$skip":
				pipeline.push({ "$skip": 0 });
				break;
			case "$unwind":
				pipeline.push({ "$unwind": "$field" });
				break;
			case "$lookup":
				pipeline.push({
					"$lookup": {
						from: "otherCollection",
						localField: "field",
						foreignField: "otherField",
						as: "result"
					}
				});
				break;
			case "$addFields":
				pipeline.push({ "$addFields": { "newField": "value" } });
				break;
			case "$count":
				pipeline.push({ "$count": "countField" });
				break;
			case "$facet":
				pipeline.push({ "$facet": { "output1": [{ "$match": {} }], "output2": [{ "$group": {} }] } });
				break;
			case "$bucket":
				pipeline.push({
					"$bucket": {
						groupBy: "$field",
						boundaries: [0, 10, 20, 30],
						default: "Other",
						output: { "count": { "$sum": 1 } }
					}
				});
				break;
			case "$out":
				pipeline.push({ "$out": "newCollection" });
				break;
			case "$geoNear":
				pipeline.push({
					"$geoNear": {
						near: { type: "Point", coordinates: [-73.99279, 40.719296] },
						distanceField: "dist.calculated",
						maxDistance: 1000,
						query: { type: "restaurant" },
						includeLocs: "location",
						num: 5
					}
				});
				break;
			case "$replaceRoot":
				pipeline.push({ "$replaceRoot": { newRoot: "$newDocument" } });
				break;
			default:
				break;
		}

		editorAggr.setValue(JSON.stringify(pipeline, null, 2));
	});
});

document.querySelectorAll('button[data-bs-toggle="tab"]').forEach(el => el.addEventListener('show.bs.tab', function (event) {
	const id = event.target.id.split("-tab")[0];
	const IS_QUERY = id === "query"
	activeTab = IS_QUERY ? 0 : 1;
	document.getElementById(id)?.removeAttribute("hidden");
	document.getElementById(IS_QUERY ? "aggregation" : "query")?.setAttribute("hidden", true);
	const gridfsField = document.getElementById("gridfsField");
	const gridfsFieldText = document.getElementById("gridfsFieldText");
	if (IS_QUERY) {
		gridfsField?.removeAttribute("hidden");
		gridfsFieldText?.setAttribute("hidden", true);
	} else {
		gridfsFieldText?.removeAttribute("hidden");
		gridfsField?.setAttribute("hidden", true);
	}
}));

window.addEventListener("DOMContentLoaded", async () => {
	toggleSpinner();
	await loadCollection();
	toggleSpinner();
});
