// JSON Doctor's logic, with no DOM. A strict validator exists because native JSON.parse error
// messages and positions differ between browsers; this one gives exact locations everywhere.
window.JsonCore = (() => {
  class JsonError extends Error {
    constructor(message, position, source) {
      super(message);
      const before = source.slice(0, position);
      this.position = position;
      this.line = before.split("\n").length;
      this.column = position - before.lastIndexOf("\n");
    }
  }

  const MAX_DEPTH = 2000;

  function validate(source) {
    let i = 0;
    const fail = (message, at = i) => { throw new JsonError(message, at, source); };
    const skip = () => { while (i < source.length && " \t\n\r".includes(source[i])) i += 1; };
    const describe = (at = i) => (at >= source.length ? "end of input" : `'${source[at]}'`);

    function string() {
      i += 1;
      while (i < source.length) {
        const c = source[i];
        if (c === '"') { i += 1; return; }
        if (c === "\\") {
          const next = source[i + 1];
          if (next === "u") {
            if (!/^[0-9a-fA-F]{4}$/.test(source.slice(i + 2, i + 6))) fail("Invalid \\u escape: expected four hex digits");
            i += 6;
          } else if (next !== undefined && '"\\/bfnrt'.includes(next)) i += 2;
          else fail(`Invalid escape sequence '\\${next ?? ""}'`);
        } else if (c < " ") {
          fail(c === "\n" ? "Unterminated string: raw line breaks aren't allowed, use \\n" : "Unescaped control character in string");
        } else i += 1;
      }
      fail("Unterminated string: missing closing quote");
    }

    function number() {
      const match = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(source.slice(i, i + 400));
      if (!match) fail(`Invalid number starting at ${describe()}`);
      i += match[0].length;
      if (/[0-9.eE]/.test(source[i] ?? "")) fail("Invalid number format (leading zeros and bare decimals aren't allowed)");
    }

    function value(depth) {
      if (depth > MAX_DEPTH) fail("Nesting is too deep to process");
      skip();
      const c = source[i];
      if (c === "{") return object(depth);
      if (c === "[") return array(depth);
      if (c === '"') return string();
      if (c === "'") fail("Strings must use double quotes, not single quotes");
      if (c === "-" || (c >= "0" && c <= "9")) return number();
      for (const word of ["true", "false", "null"]) {
        if (source.startsWith(word, i)) { i += word.length; return undefined; }
      }
      if (c === undefined) fail("Unexpected end of input: expected a value");
      if (/^(undefined|NaN|Infinity)/.test(source.slice(i, i + 9))) fail("undefined, NaN and Infinity aren't valid JSON");
      fail(`Unexpected ${describe()}: expected a value`);
    }

    function object(depth) {
      i += 1;
      skip();
      if (source[i] === "}") { i += 1; return; }
      for (;;) {
        skip();
        if (source[i] === "}") fail("Trailing comma before '}' isn't allowed");
        if (source[i] === "'") fail("Keys must use double quotes, not single quotes");
        if (source[i] !== '"') fail(`Expected a double-quoted key, found ${describe()}`);
        string();
        skip();
        if (source[i] !== ":") fail(`Expected ':' after key, found ${describe()}`);
        i += 1;
        value(depth + 1);
        skip();
        if (source[i] === "}") { i += 1; return; }
        if (source[i] !== ",") fail(`Expected ',' or '}' after value, found ${describe()}`);
        i += 1;
      }
    }

    function array(depth) {
      i += 1;
      skip();
      if (source[i] === "]") { i += 1; return; }
      for (;;) {
        skip();
        if (source[i] === "]") fail("Trailing comma before ']' isn't allowed");
        value(depth + 1);
        skip();
        if (source[i] === "]") { i += 1; return; }
        if (source[i] !== ",") fail(`Expected ',' or ']' after value, found ${describe()}`);
        i += 1;
      }
    }

    value(0);
    skip();
    if (i < source.length) fail(`Unexpected ${describe()} after the end of the JSON document`);
  }

  /** Returns { ok: true, value } or { ok: false, error }. Never throws on bad input. */
  function parse(source) {
    if (!source.trim()) return { ok: false, empty: true };
    try {
      validate(source);
      return { ok: true, value: JSON.parse(source) };
    } catch (error) {
      if (error instanceof JsonError) return { ok: false, error };
      return { ok: false, error: { message: error.message, line: 1, column: 1, position: 0 } };
    }
  }

  function flatten(value, prefix, out) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const keys = Object.keys(value);
      if (!keys.length && prefix) out[prefix] = "{}";
      for (const key of keys) flatten(value[key], prefix ? `${prefix}.${key}` : key, out);
    } else if (Array.isArray(value)) {
      out[prefix] = JSON.stringify(value);
    } else {
      out[prefix || "value"] = value === null ? "" : String(value);
    }
    return out;
  }

  const csvCell = (text) => (/[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text);

  function toCsv(value) {
    const rows = Array.isArray(value) ? value : [value];
    if (!rows.length) throw new Error("The array is empty, so there's nothing to convert.");
    if (rows.some((row) => row === null || typeof row !== "object" || Array.isArray(row))) {
      throw new Error("CSV needs an object or an array of objects at the top level.");
    }
    const flat = rows.map((row) => flatten(row, "", {}));
    const headers = [...new Set(flat.flatMap(Object.keys))];
    const lines = [headers.map(csvCell).join(",")];
    for (const row of flat) lines.push(headers.map((h) => csvCell(row[h] ?? "")).join(","));
    return lines.join("\n");
  }

  /** RFC 4180 reader: handles quoted commas, escaped quotes and line breaks inside quotes. */
  function parseCsv(text) {
    const rows = [];
    let row = [], cell = "", quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
        else if (c === '"') quoted = false;
        else cell += c;
      } else if (c === '"' && cell === "") quoted = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i += 1;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += c;
    }
    if (quoted) throw new Error("Unterminated quoted field in the CSV.");
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.length > 1 || r[0] !== "");
  }

  function coerce(text) {
    if (text === "") return null;
    if (text === "true") return true;
    if (text === "false") return false;
    // Only when it round-trips exactly, so "007" and long IDs stay strings.
    return String(Number(text)) === text ? Number(text) : text;
  }

  function csvToJson(text) {
    const rows = parseCsv(text);
    if (rows.length < 2) throw new Error("CSV needs a header row and at least one data row.");
    const [headers, ...data] = rows;
    return data.map((row, index) => {
      if (row.length > headers.length) throw new Error(`Row ${index + 2} has more cells than the header.`);
      return Object.fromEntries(headers.map((header, i) => [header, coerce(row[i] ?? "")]));
    });
  }

  return { parse, toCsv, csvToJson, parseCsv };
})();
