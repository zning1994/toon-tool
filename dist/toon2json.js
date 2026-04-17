function isPrimitive(v) {
    return v === null || ["string", "number", "boolean"].includes(typeof v);
}
function splitCSV(s) {
    const result = [];
    let accum = "";
    let inQuotes = false;
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === '"' && (i === 0 || s[i - 1] !== "\\"))
            inQuotes = !inQuotes;
        if (ch === "," && !inQuotes) {
            result.push(accum.trim());
            accum = "";
        }
        else {
            accum += s[i];
        }
    }
    result.push(accum.trim());
    return result;
}
function needsQuote(s, inCSV = false) {
    if (!inCSV)
        return false;
    return /[,\s"()]/.test(s) || s === "" || s === "true" || s === "false" || s === "null";
}
function renderString(s, inCSV = false) {
    if (!inCSV || !needsQuote(s, true))
        return s;
    return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
function renderValue(val, inCSV = false) {
    if (val === null)
        return "null";
    if (typeof val === "boolean")
        return val ? "true" : "false";
    if (typeof val === "number")
        return String(val);
    if (typeof val === "string")
        return renderString(val, inCSV);
    if (Array.isArray(val)) {
        if (val.every(isPrimitive))
            return val.map((v) => renderValue(v, true)).join(", ");
        return `(${val.map((v) => renderValue(v)).join(", ")})`;
    }
    const keys = Object.keys(val);
    const padded = keys.map((k) => `  ${k}: ${renderValue(val[k])}`);
    return `{\n${padded.join("\n")}\n}`;
}
export function json2toon(data) {
    const parsed = typeof data === "string" ? JSON.parse(data) : data;
    return renderValue(parsed);
}
export function lex(toon) {
    return toon.split("\n").map((raw) => {
        const match = raw.match(/^(\s*)(.*)/);
        const indent = match[1].length;
        const content = match[2];
        const rootTabMatch = content.match(/^(\S+)\s*:\s*(\S[\s\S]*)$/);
        const kvMatch = content.match(/^(\S+)\s*:\s*(.*)$/);
        const sizeMatch = content.match(/^(\S+)\[(\d+)\]\s*:\s*(.*)$/);
        let kind = "unknown";
        let key;
        let fields;
        let rowVals;
        let size;
        if (sizeMatch) {
            kind = "sized";
            key = sizeMatch[1];
            size = parseInt(sizeMatch[2], 10);
            rowVals = splitCSV(sizeMatch[3]);
        }
        else if (rootTabMatch) {
            const v = rootTabMatch[2];
            if (v.includes(",")) {
                kind = "tabular";
                key = rootTabMatch[1];
                fields = splitCSV(v);
            }
            else {
                kind = "rootKV";
                key = rootTabMatch[1];
            }
        }
        else if (kvMatch) {
            kind = "kv";
            key = kvMatch[1];
        }
        return { raw, content, indent, kind, key, fields, rowVals, size };
    });
}
function parsePrimitive(raw) {
    const s = raw.trim();
    if (s === "null")
        return null;
    if (s === "true")
        return true;
    if (s === "false")
        return false;
    if (s === "")
        return "";
    if (!isNaN(Number(s)) && s !== "")
        return Number(s);
    if (s.length >= 2 && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))) {
        return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\\/g, "\\");
    }
    return s;
}
function parseBlock(lines, start, currentIndent) {
    let i = start;
    const obj = {};
    let arr = [];
    while (i < lines.length) {
        const line = lines[i];
        if (line.raw.trim() === "" || line.content === "") {
            i++;
            continue;
        }
        if (line.indent < currentIndent)
            break;
        if (line.kind === "rootKV" || line.kind === "kv") {
            const key = line.key;
            const rawVal = line.content.match(/^[^:]+:\s*(.*)$/)?.[1] ?? "";
            obj[key] = parsePrimitive(rawVal);
            i++;
        }
        else if (line.kind === "sized") {
            const key = line.key;
            const expectedSize = line.size;
            const vals = line.rowVals;
            const innerIndent = line.indent + 2;
            const items = [];
            i++;
            while (i < lines.length && lines[i].indent >= innerIndent) {
                const { value, consumed } = parseBlock(lines, i, innerIndent);
                items.push(value);
                i += consumed;
            }
            if (items.length === expectedSize) {
                obj[key] = items;
            }
            else {
                obj[key] = vals.map(parsePrimitive);
            }
        }
        else if (line.kind === "tabular") {
            const key = line.key;
            const fields = line.fields;
            const rows = [];
            const expectedSize = fields.length;
            const innerIndent = line.indent + 2;
            i++;
            while (i < lines.length && lines[i].indent >= innerIndent) {
                if (lines[i].kind === "tabular") {
                    const rowVals = splitCSV(lines[i].content.match(/^[^:]+:\s*(.*)$/)?.[1] ?? "");
                    if (rowVals.length === expectedSize) {
                        const row = {};
                        fields.forEach((f, idx) => { row[f] = parsePrimitive(rowVals[idx]); });
                        rows.push(row);
                    }
                }
                i++;
            }
            obj[key] = rows;
        }
        else {
            if (line.indent === currentIndent && line.content.match(/^\(/)) {
                const items = [];
                const innerContent = line.content.replace(/^\(/, "").replace(/\)$/, "");
                innerContent.split(",").forEach((v) => items.push(parsePrimitive(v.trim())));
                arr.push(items.length === 1 ? items[0] : items);
                i++;
            }
            else {
                i++;
            }
        }
    }
    return { value: Object.keys(obj).length > 0 ? obj : (arr.length > 0 ? arr : {}), consumed: i - start };
}
export function toon2json(src) {
    const lines = lex(src);
    const { value } = parseBlock(lines, 0, 0);
    return JSON.stringify(value, null, 2);
}
