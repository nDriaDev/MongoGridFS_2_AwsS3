let rules = [];
let availableFields = [];
let editor = null;

const mongoOperators = [
	"$eq", "$ne", "$gt", "$gte", "$lt", "$lte",
	"$in", "$nin", "$regex"
];

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

async function loadFields() {
	try {
		const res = await fetch("/api/v1/uda/fields");
		if (!res.ok) {
			alert("Errore nella ricezione dei campi")
		}
		availableFields = await res.json();
		renderRules();
	} catch (err) {
		console.error("Errore caricando campi:", err);
	}
}

window.addEventListener("DOMContentLoaded", () => {
	loadFields();
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
		removeBtn.textContent = "✖";
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
	const query = buildMongoQuery();
	const json = JSON.stringify(query, null, 2);

	if (editor) editor.setValue(json);
	const input = document.getElementById("queryInput");
	if (input) input.value = json;
}

document.getElementById("exec").addEventListener("click", async () => {
	const queryObj = editor ? JSON.parse(editor.getValue()) : {};
	const query = encodeURIComponent(JSON.stringify(queryObj));
	await fetch(`/api/v1/uda/get/${query}`);
	window.location.href = "/results";
});
