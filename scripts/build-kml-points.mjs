import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const inputPath = process.argv[2];
const outputPath =
  process.argv[3] ?? path.join(process.cwd(), "public", "data", "equitable-stochastic-2023-06-24.points.json");

if (!inputPath) {
  console.error("Usage: node scripts/build-kml-points.mjs <input.kml> [output.json]");
  process.exit(1);
}

await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

const inputStream = fs.createReadStream(inputPath, { encoding: "utf8" });
const lineReader = readline.createInterface({
  crlfDelay: Infinity,
  input: inputStream,
});

const coordinateRegex = /<coordinates>([^<]+)<\/coordinates>/g;
const points = [];
let placemarkIndex = 0;

for await (const line of lineReader) {
  for (const match of line.matchAll(coordinateRegex)) {
    if (placemarkIndex % 3 === 2) {
      const [lngText, latText] = match[1].trim().split(",");
      const lat = Number.parseFloat(latText);
      const lng = Number.parseFloat(lngText);

      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        points.push([Number(lat.toFixed(6)), Number(lng.toFixed(6))]);
      }
    }

    placemarkIndex += 1;
  }
}

await fs.promises.writeFile(outputPath, JSON.stringify(points));

console.log(
  JSON.stringify(
    {
      outputPath,
      placemarksRead: placemarkIndex,
      pointsWritten: points.length,
    },
    null,
    2
  )
);
