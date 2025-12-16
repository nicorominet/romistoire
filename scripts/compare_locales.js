import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const frPath = path.join(__dirname, '../src/locales/fr.json');
const enPath = path.join(__dirname, '../src/locales/en.json');

function flattenKeys(obj, prefix = '') {
    let keys = [];
    for (const key in obj) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            keys = keys.concat(flattenKeys(obj[key], fullKey));
        } else {
            keys.push(fullKey);
        }
    }
    return keys;
}

try {
    const fr = JSON.parse(fs.readFileSync(frPath, 'utf8'));
    const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

    const frKeys = new Set(flattenKeys(fr));
    const enKeys = new Set(flattenKeys(en));

    const missingInFr = [...enKeys].filter(k => !frKeys.has(k)).sort();
    const missingInEn = [...frKeys].filter(k => !enKeys.has(k)).sort();

    console.log(`Total Keys FR: ${frKeys.size}`);
    console.log(`Total Keys EN: ${enKeys.size}`);

    if (missingInFr.length === 0 && missingInEn.length === 0) {
        console.log("\n✅ All keys match between FR and EN.");
    } else {
        if (missingInFr.length > 0) {
            console.log("\n❌ Missing in FR (" + missingInFr.length + "):");
            missingInFr.forEach(k => console.log(` - ${k}`));
        }
        if (missingInEn.length > 0) {
            console.log("\n❌ Missing in EN (" + missingInEn.length + "):");
            missingInEn.forEach(k => console.log(` - ${k}`));
        }
    }

} catch (e) {
    console.error("Error comparing files:", e);
}
