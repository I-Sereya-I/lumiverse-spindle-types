import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const fixtureDir = join(repoRoot, "test/fixtures/packed-0.6.16-consumer");
const cacheDir = join(fixtureDir, "npm-cache");
const sourceConsumer = join(repoRoot, "test/packed-0.6.16-consumer.ts");

function quoteArg(arg) {
  if (!/[\s"]/.test(arg)) {
    return arg;
  }
  return `"${arg.replace(/"/g, '\\"')}"`;
}

function runNpm(args, options = {}) {
  const line = ["npm", ...args.map(quoteArg)].join(" ");
  const result = spawnSync(line, {
    encoding: "utf8",
    windowsHide: true,
    shell: true,
    ...options,
  });
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr, result.error?.message].filter(Boolean).join("\n");
    throw new Error(`${line} failed (${result.status}): ${detail}`);
  }
  return result;
}

function runNode(args, options = {}) {
  execFileSync(process.execPath, args, {
    windowsHide: true,
    ...options,
  });
}

function readPackFilename(raw) {
  const parsed = JSON.parse(raw);
  const entry = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!entry || typeof entry.filename !== "string") {
    throw new Error(`npm pack --json did not return a filename: ${raw}`);
  }
  return entry.filename;
}

let tarballAbs = "";

try {
  const pack = runNpm(["pack", "--json"], { cwd: repoRoot });
  tarballAbs = resolve(repoRoot, readPackFilename(pack.stdout.trim()));

  rmSync(fixtureDir, { recursive: true, force: true });
  mkdirSync(fixtureDir, { recursive: true });

  writeFileSync(
    join(fixtureDir, "package.json"),
    `${JSON.stringify(
      {
        name: "packed-0.6.16-consumer",
        private: true,
        type: "module",
      },
      null,
      2,
    )}\n`,
  );

  writeFileSync(
    join(fixtureDir, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: "ESNext",
          module: "ESNext",
          moduleResolution: "bundler",
          strict: true,
          skipLibCheck: true,
          lib: ["ESNext", "DOM"],
          noEmit: true,
        },
        include: ["packed-0.6.16-consumer.ts", "frontend-runtime-consumer.ts"],
      },
      null,
      2,
    )}\n`,
  );

  copyFileSync(sourceConsumer, join(fixtureDir, "packed-0.6.16-consumer.ts"));
  copyFileSync(join(repoRoot, "test/frontend-runtime-consumer.ts"), join(fixtureDir, "frontend-runtime-consumer.ts"));

  runNpm(
    [
      "--prefix",
      fixtureDir,
      "--cache",
      cacheDir,
      "install",
      "--ignore-scripts",
      "--no-package-lock",
      "--no-save",
      tarballAbs,
    ],
    { cwd: repoRoot, stdio: "inherit" },
  );

  const rootPkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
  const installedPkgPath = join(fixtureDir, "node_modules/lumiverse-spindle-types/package.json");
  const installed = JSON.parse(readFileSync(installedPkgPath, "utf8"));
  if (installed.version !== rootPkg.version) {
    throw new Error(`installed version ${installed.version}, expected ${rootPkg.version}`);
  }
  if (installed.types !== "./dist/index.d.ts") {
    throw new Error(`installed types ${installed.types}, expected ./dist/index.d.ts`);
  }
  if (installed.exports?.["."]?.types !== "./dist/index.d.ts") {
    throw new Error(`exports["."].types is ${installed.exports?.["."]?.types}`);
  }
  const installedDts = join(fixtureDir, "node_modules/lumiverse-spindle-types/dist/index.d.ts");
  if (!existsSync(installedDts)) {
    throw new Error("packed package is missing dist/index.d.ts");
  }

  const requireFromFixture = createRequire(join(fixtureDir, "package.json"));
  const resolvedExport = requireFromFixture.resolve("lumiverse-spindle-types");
  const expectedJs = join(fixtureDir, "node_modules/lumiverse-spindle-types/dist/index.js");
  if (resolve(resolvedExport) !== resolve(expectedJs)) {
    throw new Error(`package export resolved to ${resolvedExport}, expected ${expectedJs}`);
  }
  if (!existsSync(expectedJs)) {
    throw new Error("packed package is missing dist/index.js");
  }

  const tscJs = join(repoRoot, "node_modules/typescript/lib/tsc.js");
  runNode([tscJs, "--noEmit", "-p", join(fixtureDir, "tsconfig.json")], {
    cwd: fixtureDir,
    stdio: "inherit",
  });

  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "import('lumiverse-spindle-types').then(m => { if (!m.SPINDLE_HOST_CAPABILITIES) process.exit(1); if (typeof m.validateIdentifier !== 'function') process.exit(1); console.log('Node ESM import verified'); })",
    ],
    {
      cwd: fixtureDir,
      stdio: "inherit",
      windowsHide: true,
    },
  );
} finally {
  rmSync(fixtureDir, { recursive: true, force: true });
  const fixturesRoot = dirname(fixtureDir);
  try {
    rmSync(fixturesRoot, { recursive: true, force: true });
  } catch {
    // Parent may be non-empty if another process reused test/fixtures.
  }
  if (tarballAbs) {
    rmSync(tarballAbs, { force: true });
  }
}
