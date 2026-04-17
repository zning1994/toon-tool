export function validateToon(src) {
    const lines = src.split("\n");
    const errors = [];
    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const content = raw.trim();
        // Rule 1: unclosed quotes
        const quoteCount = (content.match(/(?<!\\)"/g) || []).length;
        if (quoteCount % 2 !== 0) {
            errors.push(`Line ${i + 1}: Unclosed quote — odd number of " characters`);
        }
        // Rule 2: duplicate keys at same indent
        const keyMatch = content.match(/^(\S+)\s*:/);
        if (keyMatch) {
            const key = keyMatch[1];
            for (let j = i + 1; j < lines.length; j++) {
                const next = lines[j].trim();
                const nextKey = next.match(/^(\S+)\s*:/)?.[1];
                if (nextKey === key) {
                    const currIndent = raw.search(/\S/);
                    const nextIndent = lines[j].search(/\S/);
                    if (currIndent === nextIndent) {
                        errors.push(`Line ${i + 1} & ${j + 1}: Duplicate key "${key}" at same indent level`);
                    }
                }
            }
        }
        // Rule 3: array size mismatch (only when values are inline on same line;
        // nested form `key[n]:` with values on following lines is allowed)
        const sizeMatch = raw.match(/^\s*(\S+)\[(\d+)\]\s*:\s*(.*)$/);
        if (sizeMatch) {
            const expected = parseInt(sizeMatch[2], 10);
            const inline = sizeMatch[3].trim();
            if (inline !== "") {
                const vals = inline.split(",").map((s) => s.trim()).filter(Boolean);
                if (expected !== vals.length) {
                    errors.push(`Line ${i + 1}: Array size [${expected}] doesn't match row value count ${vals.length}`);
                }
            }
        }
        // Rule 4: mixed bracket syntax (can't mix : and [n]: in same object)
        // Rule 5: empty key
        if (content.match(/^:\s*./) || content.startsWith(":")) {
            errors.push(`Line ${i + 1}: Empty or missing key name`);
        }
        // Rule 6: trailing comma in inline object
        if (content.match(/\},?\s*$/)) {
            // check for trailing comma before closing brace
            const trailingComma = content.match(/,\s*(\}|$)/);
            if (trailingComma) {
                errors.push(`Line ${i + 1}: Trailing comma not allowed in TOON`);
            }
        }
    }
    // Rule 7: check balanced brackets across the whole file
    const openSquare = (src.match(/\[/g) || []).length;
    const closeSquare = (src.match(/\]/g) || []).length;
    const openCurly = (src.match(/\{/g) || []).length;
    const closeCurly = (src.match(/\}/g) || []).length;
    if (openSquare !== closeSquare) {
        errors.push(`Unbalanced square brackets: ${openSquare} [ vs ${closeSquare} ]`);
    }
    if (openCurly !== closeCurly) {
        errors.push(`Unbalanced curly braces: ${openCurly} { vs ${closeCurly} }`);
    }
    return { valid: errors.length === 0, errors };
}
