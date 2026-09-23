import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

const requireFromApi = createRequire(resolve("apps/api/package.json"));
const ExcelJS = requireFromApi("exceljs");

const args = parseArguments(process.argv.slice(2));
const isoSourcePath = requiredPathArgument(args, "iso-source");
const unlocodeArchivePath = requiredPathArgument(args, "unlocode-archive");
const unlocodeCsvDirectory = requiredPathArgument(args, "unlocode-csv-dir");
const retrievedAt = requiredArgument(args, "retrieved-at");
const outputDirectory = resolve(
  args.get("output-dir") ?? "database/seeds/reference-data",
);

const ISO_SOURCE_URL = "https://www.iso.org/obp/ui/#search/code/";
const UNLOCODE_SOURCE_URL =
  "https://opensource.unicc.org/un/unece/uncefact/vocab-locode/-/jobs/artifacts/2025-1/download?job=package-release";
const ISO_RELEASE_KEY = "iso-3166-1:current-as-of-2026-09-23";
const UNLOCODE_RELEASE_KEY = "unlocode:2025-1";

const isoSource = await readFile(isoSourcePath);
const isoRows = JSON.parse(isoSource.toString("utf8"));
const countries = parseIsoCountries(isoRows);
const countryByAlpha2 = new Map(
  countries.map((country) => [country.alpha2, country]),
);

const unlocodeRows = [];
for (const fileName of [
  "UNLOCODE CodeListPart1.csv",
  "UNLOCODE CodeListPart2.csv",
  "UNLOCODE CodeListPart3.csv",
]) {
  const rows = await parseCsv(join(unlocodeCsvDirectory, fileName));
  rows.forEach((row, index) =>
    unlocodeRows.push({ fileName, sourceRowNumber: index + 1, row }),
  );
}

const areas = parseUnlocodeAreas(unlocodeRows, countryByAlpha2);
const { ports, entries } = parseUnlocodePorts(unlocodeRows, areas);
const unlocodeArchive = await readFile(unlocodeArchivePath);

const isoSnapshot = {
  schemaVersion: "1.0.0",
  release: {
    id: deterministicUuid(ISO_RELEASE_KEY),
    authority: "ISO",
    datasetCode: "ISO_3166_1",
    version: "current-as-of-2026-09-23",
    sourceUrl: ISO_SOURCE_URL,
    retrievedAt,
    sourceSha256: sha256(isoSource),
    recordsSha256: sha256(JSON.stringify(countries)),
    license: "ISO Online Browsing Platform terms",
  },
  recordCount: countries.length,
  records: countries,
};

const unlocodeSnapshot = {
  schemaVersion: "1.0.0",
  release: {
    id: deterministicUuid(UNLOCODE_RELEASE_KEY),
    authority: "UNECE",
    datasetCode: "UNLOCODE",
    version: "2025-1",
    publishedAt: "2026-01-15",
    sourceUrl: UNLOCODE_SOURCE_URL,
    retrievedAt,
    sourceSha256: sha256(unlocodeArchive),
    recordsSha256: sha256(JSON.stringify({ areas, ports, entries })),
    license: "CC BY 4.0",
    filter: "At least one official entry has Function position 1 = '1' (port)",
  },
  sourceRowCount: unlocodeRows.length,
  areaCount: areas.length,
  portCount: ports.length,
  entryCount: entries.length,
  areas,
  ports,
  entries,
};

assertSnapshotCounts(isoSnapshot, unlocodeSnapshot);
await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeJson(join(outputDirectory, "iso-3166-1-20260923.json"), isoSnapshot),
  writeJson(
    join(outputDirectory, "unlocode-2025-1-ports.json"),
    unlocodeSnapshot,
  ),
]);

console.log(
  `Generated ${countries.length} ISO countries and ${ports.length} UN/LOCODE port identities from ${entries.length} official entries.`,
);

function parseIsoCountries(rows) {
  if (!Array.isArray(rows) || rows.length !== 249) {
    throw new Error(
      `Expected 249 ISO rows, received ${rows?.length ?? "invalid"}`,
    );
  }
  const seenAlpha2 = new Set();
  return rows
    .map((row) => {
      if (!Array.isArray(row) || row.length !== 5) {
        throw new Error(`Invalid ISO row: ${JSON.stringify(row)}`);
      }
      const [nameEnglish, nameFrench, alpha2, alpha3, numeric] = row;
      if (
        !/^[A-Z]{2}$/.test(alpha2) ||
        !/^[A-Z]{3}$/.test(alpha3) ||
        !/^\d{3}$/.test(numeric) ||
        !nameEnglish ||
        !nameFrench
      ) {
        throw new Error(`Invalid ISO values: ${JSON.stringify(row)}`);
      }
      if (seenAlpha2.has(alpha2))
        throw new Error(`Duplicate ISO alpha-2: ${alpha2}`);
      seenAlpha2.add(alpha2);
      return {
        id: deterministicUuid(`${ISO_RELEASE_KEY}:${alpha2}`),
        alpha2,
        alpha3,
        numeric,
        nameEnglish,
        nameFrench,
        sourceRowHash: sha256(JSON.stringify(row)),
      };
    })
    .sort((left, right) => left.alpha2.localeCompare(right.alpha2));
}

function parseUnlocodeAreas(sourceRows, countryByCode) {
  const areas = [];
  const seen = new Set();
  for (const source of sourceRows) {
    const row = normalizeUnlocodeRow(source);
    if (row.locationCode || !row.name.startsWith(".")) continue;
    if (!/^[A-Z]{2}$/.test(row.areaCode) || seen.has(row.areaCode)) {
      throw new Error(`Invalid or duplicate UN/LOCODE area: ${row.areaCode}`);
    }
    seen.add(row.areaCode);
    areas.push({
      id: deterministicUuid(`${UNLOCODE_RELEASE_KEY}:area:${row.areaCode}`),
      areaCode: row.areaCode,
      name: row.name.slice(1),
      isoCountryId: countryByCode.get(row.areaCode)?.id ?? null,
      sourceRowHash: row.sourceRowHash,
    });
  }
  return areas.sort((left, right) =>
    left.areaCode.localeCompare(right.areaCode),
  );
}

function parseUnlocodePorts(sourceRows, areas) {
  const areaByCode = new Map(areas.map((area) => [area.areaCode, area]));
  const portByUnlocode = new Map();
  const entries = [];
  for (const source of sourceRows) {
    const row = normalizeUnlocodeRow(source);
    if (!row.locationCode || row.functionCode[0] !== "1") continue;
    const unlocode = `${row.areaCode}${row.locationCode}`;
    if (!/^[A-Z]{2}[A-Z0-9]{3}$/.test(unlocode)) {
      throw new Error(`Invalid UN/LOCODE port code: ${unlocode}`);
    }
    const area = areaByCode.get(row.areaCode);
    if (!area) throw new Error(`Missing UN/LOCODE area ${row.areaCode}`);
    let port = portByUnlocode.get(unlocode);
    if (!port) {
      port = {
        id: deterministicUuid(`${UNLOCODE_RELEASE_KEY}:port:${unlocode}`),
        unlocode,
        areaId: area.id,
        areaCode: row.areaCode,
        locationCode: row.locationCode,
      };
      portByUnlocode.set(unlocode, port);
    }
    entries.push({
      id: deterministicUuid(
        `${UNLOCODE_RELEASE_KEY}:entry:${source.fileName}:${source.sourceRowNumber}`,
      ),
      portId: port.id,
      sourceFile: basename(source.fileName),
      sourceRowNumber: source.sourceRowNumber,
      changeIndicator: row.changeIndicator || null,
      name: row.name,
      nameNormalized: normalizeName(row.name),
      nameWithoutDiacritics: row.nameWithoutDiacritics || null,
      nameWithoutDiacriticsNormalized: row.nameWithoutDiacritics
        ? normalizeName(row.nameWithoutDiacritics)
        : null,
      subdivisionCode: row.subdivisionCode || null,
      functionCode: row.functionCode,
      statusCode: row.statusCode || null,
      referenceDate: row.referenceDate || null,
      iataCode: row.iataCode || null,
      coordinates: row.coordinates || null,
      remarks: row.remarks || null,
      sourceRowHash: row.sourceRowHash,
    });
  }
  return {
    ports: [...portByUnlocode.values()].sort((left, right) =>
      left.unlocode.localeCompare(right.unlocode),
    ),
    entries: entries.sort(
      (left, right) =>
        left.sourceFile.localeCompare(right.sourceFile) ||
        left.sourceRowNumber - right.sourceRowNumber,
    ),
  };
}

function normalizeUnlocodeRow(source) {
  if (!Array.isArray(source.row) || source.row.length < 12) {
    throw new Error(
      `Invalid UN/LOCODE row ${source.fileName}:${source.sourceRowNumber}`,
    );
  }
  const values = source.row.slice(0, 12).map((value) => value.trim());
  return {
    changeIndicator: values[0],
    areaCode: values[1],
    locationCode: values[2],
    name: values[3],
    nameWithoutDiacritics: values[4],
    subdivisionCode: values[5],
    functionCode: values[6],
    statusCode: values[7],
    referenceDate: values[8],
    iataCode: values[9],
    coordinates: values[10],
    remarks: values[11],
    sourceRowHash: sha256(JSON.stringify(values)),
  };
}

function normalizeName(value) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

async function parseCsv(filePath) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = await workbook.csv.readFile(filePath, {
    parserOptions: { headers: false, ignoreEmpty: true, trim: false },
    map: (value) => value,
  });
  const rows = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    rows.push(
      Array.from({ length: 12 }, (_, index) =>
        String(row.getCell(index + 1).value ?? ""),
      ),
    );
  });
  return rows;
}

function assertSnapshotCounts(isoSnapshot, unlocodeSnapshot) {
  if (
    isoSnapshot.recordCount !== 249 ||
    unlocodeSnapshot.sourceRowCount !== 116_533 ||
    unlocodeSnapshot.areaCount !== 249 ||
    unlocodeSnapshot.portCount !== 17_524 ||
    unlocodeSnapshot.entryCount !== 17_600
  ) {
    throw new Error(
      `Unexpected snapshot counts: ${JSON.stringify({
        countries: isoSnapshot.recordCount,
        sourceRows: unlocodeSnapshot.sourceRowCount,
        areas: unlocodeSnapshot.areaCount,
        ports: unlocodeSnapshot.portCount,
        entries: unlocodeSnapshot.entryCount,
      })}`,
    );
  }
}

function deterministicUuid(value) {
  const bytes = Buffer.from(sha256(value).slice(0, 32), "hex");
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function writeJson(filePath, value) {
  return writeFile(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

function parseArguments(values) {
  const parsed = new Map();
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error(`Invalid argument sequence near ${key ?? "<end>"}`);
    }
    parsed.set(key.slice(2), value);
  }
  return parsed;
}

function requiredArgument(parsed, key) {
  const value = parsed.get(key);
  if (!value) throw new Error(`--${key} is required`);
  return value;
}

function requiredPathArgument(parsed, key) {
  return resolve(requiredArgument(parsed, key));
}
