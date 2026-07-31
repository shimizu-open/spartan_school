import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const src = resolve(root, "src");

await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, "assets/app/data"), { recursive: true });
await cp(resolve(src, "index.html"), resolve(dist, "index.html"));
await cp(resolve(src, "app"), resolve(dist, "assets/app"), { recursive: true });
await cp(resolve(root, "public"), dist, { recursive: true });

const lines = JSON.parse(await readFile(resolve(src, "data/lines.json"), "utf8"));
const orderedLines = Object.entries(lines).sort(([left], [right]) => left.localeCompare(right));
const alphabet = [...new Set(orderedLines.flatMap(([, line]) => [...line]))].join("");
const sequences = orderedLines.map(([, line]) => [...line].map((character) => alphabet.indexOf(character)));
const merges = [];
for (let round = 0; round < 512; round += 1) {
  const counts = new Map();
  sequences.forEach((sequence) => {
    for (let index = 0; index < sequence.length - 1; index += 1) {
      const pair = `${sequence[index]},${sequence[index + 1]}`;
      counts.set(pair, (counts.get(pair) ?? 0) + 1);
    }
  });
  const best = [...counts].sort((left, right) => right[1] - left[1])[0];
  if (!best || best[1] < 3) break;
  const pair = best[0].split(",").map(Number);
  const token = alphabet.length + merges.length;
  merges.push(pair);
  sequences.forEach((sequence, sequenceIndex) => {
    const replaced = [];
    for (let index = 0; index < sequence.length; index += 1) {
      if (sequence[index] === pair[0] && sequence[index + 1] === pair[1]) {
        replaced.push(token);
        index += 1;
      } else replaced.push(sequence[index]);
    }
    sequences[sequenceIndex] = replaced;
  });
}
const encodeTokens = (tokens) => tokens.map((token) => String.fromCodePoint(0x100 + token)).join("");
const encodedMerges = encodeTokens(merges.flat());
const encodedLines = sequences.map(encodeTokens);
await writeFile(
  resolve(dist, "assets/app/data/lines.js"),
  `const a=${JSON.stringify(alphabet)},m=[...${JSON.stringify(encodedMerges)}],d=[...a],r=${JSON.stringify(encodedLines)};for(let i=0;i<m.length;i+=2)d.push(d[m[i].codePointAt(0)-256]+d[m[i+1].codePointAt(0)-256]);export default r.map(s=>[...s].map(c=>d[c.codePointAt(0)-256]).join(""));\n`,
);

function minifyJavaScript(source) {
  let output = "";
  for (let index = 0; index < source.length;) {
    const character = source[index];
    const next = source[index + 1];
    if (character === "/" && next === "/") {
      index = source.indexOf("\n", index);
      if (index < 0) break;
      continue;
    }
    if (character === "/" && next === "*") {
      index = source.indexOf("*/", index + 2);
      if (index < 0) break;
      index += 2;
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      const quote = character;
      let literal = quote;
      index += 1;
      while (index < source.length) {
        const current = source[index];
        literal += current;
        index += 1;
        if (current === "\\") {
          literal += source[index] ?? "";
          index += 1;
        } else if (current === quote) {
          break;
        }
      }
      output += quote === "`"
        ? literal.replace(/\s+/g, " ").replace(/> </g, "><")
        : literal;
      continue;
    }
    if (/\s/.test(character)) {
      let cursor = index;
      while (/\s/.test(source[cursor] ?? "")) cursor += 1;
      const previous = output.at(-1) ?? "";
      const following = source[cursor] ?? "";
      const word = /[\p{L}\p{N}_$]/u;
      if ((word.test(previous) && (word.test(following) || "'\"`".includes(following)))
        || ("+-".includes(previous) && previous === following)) output += " ";
      index = cursor;
      continue;
    }
    output += character;
    index += 1;
  }
  return output;
}

async function minifyTree(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await minifyTree(path);
    else if (entry.name.endsWith(".js")) {
      await writeFile(path, minifyJavaScript(await readFile(path, "utf8")));
    }
  }
}

await minifyTree(resolve(dist, "assets/app"));
