import fs from 'node:fs';
import path from 'node:path';

// Compact JSON/JSONC without reserializing numbers, keys or string values.
function compactJson(text) {
  let output = '';
  let inString = false;
  let escaped = false;

  for (let index = text.charCodeAt(0) === 0xFEFF ? 1 : 0; index < text.length; index++) {
    const character = text[index];
    if (inString) {
      output += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }

    if (character === '"') {
      inString = true;
      output += character;
    } else if (character === '/' && text[index + 1] === '/') {
      index += 2;
      while (index < text.length && text[index] !== '\n' && text[index] !== '\r') index++;
    } else if (character === '/' && text[index + 1] === '*') {
      const end = text.indexOf('*/', index + 2);
      if (end < 0) throw new Error('Unterminated block comment.');
      index = end + 1;
    } else if (!' \t\n\r'.includes(character)) {
      output += character;
    }
  }

  if (inString) throw new Error('Unterminated string.');
  return output;
}

let count = 0;
let savedBytes = 0;
for (const root of ['BP', 'RP']) {
  for (const entry of fs.readdirSync(root, {recursive: true, withFileTypes: true})) {
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.json') continue;
    const file = path.join(entry.parentPath, entry.name);
    try {
      const original = fs.readFileSync(file, 'utf8');
      const compact = compactJson(original);
      fs.writeFileSync(file, compact);
      count++;
      savedBytes += Buffer.byteLength(original) - Buffer.byteLength(compact);
    } catch (error) {
      throw new Error(`${file}: ${error.message}`, {cause: error});
    }
  }
}
console.log(`Minified ${count} JSON files; removed ${savedBytes} bytes of formatting/comments.`);
