let rules = [];
let availableFields = [];
let editor = null;
let mongoOptions = {};
let gridfsOptions = {};

const mongoOperators = ["$eq", "$ne", "$gt", "$gte", "$lt", "$lte", "$in", "$nin", "$regex"];

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

window.addEventListener("DOMContentLoaded", () => {
	loadCollection();
});

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
	container.innerHTML = "";

	rules.forEach(rule => {
		const row = document.createElement("div");
		row.className = "row g-2 mb-2 align-items-center";

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

		const colField = document.createElement("div"); colField.className = "col-3"; colField.appendChild(fieldSelect);
		const colOperator = document.createElement("div"); colOperator.className = "col-2"; colOperator.appendChild(operatorSelect);
		const colValue = document.createElement("div"); colValue.className = "col-3"; colValue.appendChild(valueInput);
		const colLogic = document.createElement("div"); colLogic.className = "col-2"; colLogic.appendChild(logicSelect);
		const colRemove = document.createElement("div"); colRemove.className = "col-2"; colRemove.appendChild(removeBtn);

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

	let query = {};
	let orGroup = [];

	rules.forEach((r, i) => {
		if (!r.field) return;
		const condition = buildCondition(r);

		if (i === 0) {
			query = condition;
		} else {
			if (r.logic === "AND") {
				query = { ...query, ...condition };
			} else if (r.logic === "OR") {
				orGroup.push(condition);
			}
		}
	});

	if (orGroup.length > 0) {
		query = { $or: [query, ...orGroup] };
	}

	return query;
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
		col.className = "col-3";

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
		mongoOptions: mongoOptions,
		gridfsOptions: {}
	};

	if (document.getElementById("gridfsSwitch").checked) {
		options.gridfsOptions = {
			field: document.getElementById("gridfsField").value,
			prefix: document.getElementById("gridfsPrefix").value,
			suffix: document.getElementById("gridfsSuffix").value,
			matchField: document.getElementById("gridfsMatchField").value
		};
	}

	return options;
}

document.getElementById("limit").onchange = updateMongoOptions;

const btnExec = document.getElementById("exec");
const aS3 = document.getElementById("s3");
const loading = document.getElementById("loading");

btnExec.addEventListener("click", async (e) => {
	const gridSwitch = document.getElementById("gridfsSwitch");
	const gridfsField = document.getElementById("gridfsField");
	const gridfsMatchField = document.getElementById("gridfsMatchField");
	const errors = [];
	if (!gridfsField.value) {
		errors.push("Nome campo per il match con GridFS");
	}
	if (!gridfsMatchField) {
		errors.push("Campo per il match della collection GridFS");
	}
	if (gridSwitch.checked && errors.length > 0) {
		alert(`${errors.length > 1 ? "I Campi\n" : "Il campo\n"}${errors.join("\n")}${errors.length > 1 ? "\nsono obbligatori" : "\nè obbligatorio"}`);
		return;
	}
	btnExec.disabled = true;
	aS3.disabled = true;
	loading?.removeAttribute("hidden");
	const queryObj = editor ? JSON.parse(editor.getValue()) : {};
	const options = getOptions();
	queryObj.gridFS = options;
	const query = encodeURIComponent(JSON.stringify(queryObj));

	await fetch(`/api/v1/collection/get/${query}`);
	btnExec.disabled = false;
	aS3.disabled = false;
	loading?.setAttribute("hidden", true);
	window.location.href = "/results";
});

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
