import { existsSync, mkdirSync } from "fs";
import { writeFile } from "fs/promises";
import path from "path";
const GEONAMES_URL = "https://download.geonames.org/export/dump/cities1000.zip";
const OUTPUT_DIR = path.resolve("public/cities");
const GLOBAL_TOP_N = 600;
function tileKey(lat, lng) {
    const col = Math.floor((lng + 180) / 10);
    const row = Math.floor((lat + 90) / 10);
    return `${Math.max(0, Math.min(35, col))}_${Math.max(0, Math.min(17, row))}`;
}
async function downloadZip() {
    console.log("Downloading GeoNames cities1000.zip…");
    const res = await fetch(GEONAMES_URL);
    if (!res.ok)
        throw new Error(`Failed to download: ${res.status}`);
    const buf = await res.arrayBuffer();
    return Buffer.from(buf);
}
async function extractTsv(zipBuffer) {
    const { default: AdmZip } = await import("adm-zip");
    const zip = new AdmZip(zipBuffer);
    const entry = zip.getEntries().find((e) => e.entryName === "cities1000.txt");
    if (!entry)
        throw new Error("cities1000.txt not found in zip");
    return entry.getData().toString("utf-8");
}
function parseTsv(tsv) {
    const records = [];
    for (const line of tsv.split("\n")) {
        if (!line.trim())
            continue;
        const parts = line.split("\t");
        const id = parseInt(parts[0], 10);
        const name = parts[1];
        const lat = parseFloat(parts[4]);
        const lng = parseFloat(parts[5]);
        const fclass = parts[6];
        const population = parseInt(parts[14], 10) || 0;
        const country = parts[8];
        if (fclass !== "P" || !name || isNaN(lat) || isNaN(lng))
            continue;
        if (population < 1000)
            continue;
        records.push({ id, name, lat, lng, population, country });
    }
    return records;
}
async function writeTiles(cities) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    const tiles = new Map();
    for (const city of cities) {
        const key = tileKey(city.lat, city.lng);
        if (!tiles.has(key))
            tiles.set(key, []);
        tiles.get(key).push(city);
    }
    const tileKeys = [];
    const writes = [];
    for (const [key, tileCities] of tiles) {
        tileCities.sort((a, b) => b.population - a.population);
        const filePath = path.join(OUTPUT_DIR, `${key}.json`);
        writes.push(writeFile(filePath, JSON.stringify(tileCities)));
        tileKeys.push(key);
        process.stdout.write(`\rWriting tiles: ${tileKeys.length}/${tiles.size}`);
    }
    await Promise.all(writes);
    console.log(`\nWrote ${tileKeys.length} tile files.`);
    const globalCities = [...cities]
        .sort((a, b) => b.population - a.population)
        .slice(0, GLOBAL_TOP_N);
    await writeFile(path.join(OUTPUT_DIR, "global.json"), JSON.stringify(globalCities));
    console.log(`Wrote global.json with top ${GLOBAL_TOP_N} cities.`);
    await writeFile(path.join(OUTPUT_DIR, "manifest.json"), JSON.stringify(tileKeys.sort()));
    console.log("Wrote manifest.json.");
}
async function main() {
    console.log("=== Cold Locator — City Data Builder ===\n");
    let tsv;
    const localZip = path.resolve("scripts/cities1000.zip");
    if (existsSync(localZip)) {
        console.log("Using cached cities1000.zip…");
        const { readFileSync } = await import("fs");
        tsv = await extractTsv(readFileSync(localZip));
    }
    else {
        const zipBuffer = await downloadZip();
        const { writeFileSync } = await import("fs");
        writeFileSync(localZip, zipBuffer);
        tsv = await extractTsv(zipBuffer);
    }
    console.log("Parsing TSV data…");
    const cities = parseTsv(tsv);
    console.log(`Parsed ${cities.length} cities.`);
    await writeTiles(cities);
    console.log("\n✅ Done! City tiles written to public/cities/");
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
