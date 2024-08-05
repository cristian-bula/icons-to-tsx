import camelcase from "camelcase";
import rmfr from "rmfr";
import { promises as fs } from "fs";
import { loadConfig, optimize } from "svgo";

const RAW_PATH = "./src/icons/raw";
const OPTIMIZED_PATH = "./src/icons/optimized";
const OUTPUT_PATH = "./src/icons/components";
const IS_TYPESCRIPT = true;
const config = await loadConfig();

function generateComponentName(fileName: string) {
  let componentName = `${camelcase(fileName.replace(/.svg/, ""), {
    pascalCase: true,
  })}Icon`;
  return componentName.replace("IconIcon", "Icon");
}

async function processSvgFile(fileName: string, outDir: string) {
  const content = await fs.readFile(`${OPTIMIZED_PATH}/${fileName}`, "utf-8");
  const componentName = generateComponentName(fileName);
  let processedContent = content
    .replaceAll(/="#(fff|ffffff|000|000000)"/g, '="currentColor"')
    .replaceAll(/(\r\n|\n|\r)/gm, "")
    .replaceAll(/\s+/g, " ")
    .replaceAll("> <", "><");

  const startSVG = processedContent.indexOf("<svg");
  const endSVG = processedContent.slice(startSVG).indexOf(">") + startSVG;
  processedContent =
    processedContent.substring(0, endSVG) +
    " {...props}" +
    processedContent.substring(endSVG);

  const props = IS_TYPESCRIPT
    ? `props?:React.SVGProps<SVGSVGElement>`
    : "props";

  const svgReactContent = `import React from "react";export default function ${componentName}(${props}){return ${processedContent}};`;

  await fs.writeFile(
    `${outDir}/${componentName}.${IS_TYPESCRIPT ? "tsx" : "jsx"}`,
    svgReactContent,
    "utf-8"
  );
}

async function processFile(file: string) {
  if (file.endsWith(".svg")) {
    const { data } = optimize(
      await fs.readFile(`${RAW_PATH}/${file}`, "utf8"),
      {
        ...config,
        path: `${OPTIMIZED_PATH}/${file}`,
      }
    );
    await fs.writeFile(`${OPTIMIZED_PATH}/${file}`, data, "utf-8");
  }
}

async function buildIcons() {
  await fs.mkdir(OUTPUT_PATH, { recursive: true });

  //Optimize icons
  await fs.mkdir(OPTIMIZED_PATH, { recursive: true });
  const filesRaw = await fs.readdir(RAW_PATH, "utf-8");
  await Promise.all(
    filesRaw.map(async (file: string) => {
      await processFile(file);
    })
  );

  //Generate icons
  const filesOptimized = await fs.readdir(OPTIMIZED_PATH, "utf-8");
  await Promise.all(
    filesOptimized.map((file: string) => processSvgFile(file, OUTPUT_PATH))
  );

  //Generate index file
  const indexContent: string[] = filesOptimized.map((file: string) => {
    const componentName = generateComponentName(file);
    return `export { default as ${componentName} } from './${componentName}';\n`;
  });
  const dataArr = new Set(indexContent);
  let result = [...dataArr].join("");
  await fs.writeFile(
    `${OUTPUT_PATH}/index.${IS_TYPESCRIPT ? "ts" : "js"}`,
    result,
    "utf-8"
  );
}

(function main() {
  console.log("📦 Building icon package...");

  Promise.all([
    rmfr(`${OUTPUT_PATH}/*`, { glob: true }),
    rmfr(`${OPTIMIZED_PATH}/*`, { glob: true }),
  ])
    .then(async () => await buildIcons())
    .then(() => console.log("✅ Finished building package."));
})();
