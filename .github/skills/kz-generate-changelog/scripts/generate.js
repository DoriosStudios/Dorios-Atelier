const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { Octokit } = require("@octokit/rest");

const SECTION_ORDER = [
  "BLOCKS",
  "ITEMS",
  "RECIPES",
  "UI/UX",
  "FLUIDS",
  "BUG FIXES",
  "TECHNICAL CHANGES",
  "THIRD-PARTY / INTEGRATION",
  "TEXTURES",
  "MISC",
];

const PLAYER_FACING_SECTIONS = new Set([
  "BLOCKS",
  "ITEMS",
  "RECIPES",
  "UI/UX",
  "FLUIDS",
  "BUG FIXES",
  "TEXTURES",
]);

const SECTION_ALIASES = {
  "BLOCKS": ["block", "blocks"],
  "ITEMS": ["item", "items"],
  "RECIPES": ["recipe", "recipes"],
  "UI/UX": ["ui", "ux", "ui/ux"],
  "FLUIDS": ["fluid", "fluids"],
  "BUG FIXES": ["bug", "bugs", "bug fix", "bug fixes"],
  "TECHNICAL CHANGES": ["technical", "technical changes", "internal"],
  "THIRD-PARTY / INTEGRATION": ["third-party", "integration", "compatibility"],
  "TEXTURES": ["texture", "textures"],
  "MISC": ["misc"],
};

function runGit(args, allowFailure = false) {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).trim();
  } catch (error) {
    if (allowFailure) {
      return "";
    }
    throw error;
  }
}

function loadDotEnvFile() {
  const envPath = path.resolve(".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

function parseArgs(argv) {
  const positionals = [];
  const options = {
    output: "",
    lang: "en",
    draft: false,
    version: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token.startsWith("--output=")) {
      options.output = token.slice("--output=".length).trim();
      continue;
    }
    if (token === "--output") {
      options.output = (argv[index + 1] || "").trim();
      index += 1;
      continue;
    }

    if (token.startsWith("--lang=")) {
      options.lang = token.slice("--lang=".length).trim().toLowerCase();
      continue;
    }
    if (token === "--lang") {
      options.lang = (argv[index + 1] || "en").trim().toLowerCase();
      index += 1;
      continue;
    }

    if (token.startsWith("--version=")) {
      options.version = token.slice("--version=".length).trim();
      continue;
    }
    if (token === "--version") {
      options.version = (argv[index + 1] || "").trim();
      index += 1;
      continue;
    }

    if (token === "--draft") {
      options.draft = true;
      continue;
    }

    if (token === "--help" || token === "-h") {
      options.help = true;
      continue;
    }

    positionals.push(token);
  }

  if (!["en", "pt", "ptbr", "pt-br"].includes(options.lang)) {
    options.lang = "en";
  }

  return { positionals, options };
}

function usage() {
  return [
    "Usage:",
    "  node scripts/generate.js",
    "  node scripts/generate.js <until>",
    "  node scripts/generate.js <since> <until>",
    "",
    "Options:",
    "  --lang <en|ptbr>          Output summary language (default: en)",
    "  --output <file>           Write markdown to file",
    "  --version <header>        Force changelog header value",
    "  --draft                   Append (Draft) to header",
    "",
    "Defaults:",
    "  - No positional args: latest_tag..HEAD",
    "  - One positional arg: latest_tag..<until>",
    "  - Two positional args: <since>..<until>",
  ].join("\n");
}

function resolveSinceUntil(positionals) {
  const latestTag = runGit(["describe", "--tags", "--abbrev=0"], true);
  const head = "HEAD";

  if (positionals.length === 0) {
    return {
      since: latestTag || "",
      until: head,
    };
  }

  if (positionals.length === 1) {
    return {
      since: latestTag || "",
      until: positionals[0],
    };
  }

  return {
    since: positionals[0],
    until: positionals[1],
  };
}

function ensureRefExists(ref) {
  if (!ref) {
    return;
  }
  runGit(["rev-parse", "--verify", `${ref}^{commit}`]);
}

function buildRange(since, until) {
  if (since) {
    return `${since}..${until}`;
  }
  return until;
}

function parseGitLog(rangeExpression) {
  const raw = runGit([
    "log",
    rangeExpression,
    "--reverse",
    "--pretty=format:%H%x1f%s%x1f%b%x1e",
  ], true);

  if (!raw) {
    return [];
  }

  return raw
    .split("\x1e")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [sha = "", subject = "", body = ""] = entry.split("\x1f");
      return {
        sha: sha.trim(),
        subject: subject.trim(),
        body: (body || "").trim(),
      };
    })
    .filter((entry) => entry.sha && entry.subject);
}

function filesForCommit(sha) {
  const raw = runGit(["show", "--pretty=format:", "--name-only", sha], true);
  if (!raw) {
    return [];
  }
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseRemoteGitHub() {
  const remote = runGit(["config", "--get", "remote.origin.url"], true);
  if (!remote) {
    return { owner: "", repo: "" };
  }

  let match = remote.match(/^https?:\/\/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?$/i);
  if (!match) {
    match = remote.match(/^git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?$/i);
  }
  if (!match) {
    return { owner: "", repo: "" };
  }

  return {
    owner: match[1],
    repo: match[2],
  };
}

function extractPrNumber(text) {
  if (!text) {
    return 0;
  }

  const patterns = [/\(#(\d+)\)/i, /pull request\s+#(\d+)/i, /pr\s*#(\d+)/i];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return Number(match[1]);
    }
  }
  return 0;
}

function normalizeTitle(rawTitle) {
  const title = (rawTitle || "").trim();
  if (!title) {
    return "Updated project content.";
  }

  let normalized = title
    .replace(/^\[[^\]]+\]\s*/g, "")
    .replace(/^(feat|fix|chore|refactor|build|docs|style|test|perf|ci)(\([^)]+\))?!?:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const wrapped = normalized.match(/^\((.+)\)$/);
  if (wrapped) {
    normalized = wrapped[1].trim();
  }

  normalized = normalized.replace(/[\s.;:,-]+$/g, "").trim();
  return normalized || "Updated project content.";
}

async function enrichWithPullRequestData(entries, owner, repo) {
  const hasRepoContext = owner && repo;
  const pullRequestNumbers = entries
    .map((entry) => entry.prNumber)
    .filter((value, index, values) => value > 0 && values.indexOf(value) === index);

  if (!hasRepoContext || pullRequestNumbers.length === 0) {
    return {};
  }

  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN || undefined });
  const prData = {};

  for (const number of pullRequestNumbers) {
    try {
      const response = await octokit.pulls.get({ owner, repo, pull_number: number });
      prData[number] = response.data;
    } catch {
      prData[number] = null;
    }
  }

  return prData;
}

function labelToSection(label) {
  const normalized = label.toLowerCase().trim();

  if (normalized.startsWith("type:")) {
    const typed = normalized.replace("type:", "").trim();
    return labelToSection(typed);
  }
  if (["blocks", "block"].includes(normalized)) return "BLOCKS";
  if (["items", "item"].includes(normalized)) return "ITEMS";
  if (["recipes", "recipe"].includes(normalized)) return "RECIPES";
  if (["ui", "ux", "ui/ux"].includes(normalized)) return "UI/UX";
  if (["fluids", "fluid"].includes(normalized)) return "FLUIDS";
  if (["bug", "bugs", "fix", "bugfix", "bug fixes"].includes(normalized)) return "BUG FIXES";
  if (["technical", "tech", "internal"].includes(normalized)) return "TECHNICAL CHANGES";
  if (["third-party", "integration", "compat", "compatibility"].includes(normalized)) return "THIRD-PARTY / INTEGRATION";
  if (["texture", "textures", "art"].includes(normalized)) return "TEXTURES";

  return "";
}

function classifyByFiles(fileList) {
  const files = fileList.map((filePath) => filePath.toLowerCase());

  if (files.some((item) => item.includes("/recipes/") || item.includes("\\recipes\\"))) return "RECIPES";
  if (files.some((item) => item.includes("/textures/") || item.includes("\\textures\\") || item.includes("terrain_texture"))) return "TEXTURES";
  if (files.some((item) => item.includes("/blocks/") || item.includes("\\blocks\\") || item.includes("assets/blocks.json") || item.includes("assets\\blocks.json"))) return "BLOCKS";
  if (files.some((item) => item.includes("/items/") || item.includes("\\items\\") || item.includes("item_catalog"))) return "ITEMS";
  if (files.some((item) => item.includes("/fluids/") || item.includes("\\fluids\\") || item.includes("liquid"))) return "FLUIDS";
  if (files.some((item) => item.includes("/ui/") || item.includes("\\ui\\") || item.includes("/texts/") || item.includes("\\texts\\") || item.includes("localization"))) return "UI/UX";
  if (files.some((item) => item.includes("scripts") || item.endsWith(".ts") || item.endsWith(".js") || item.includes("ci") || item.includes("workflow"))) return "TECHNICAL CHANGES";

  return "";
}

function classifyByTitle(title) {
  const normalized = title.toLowerCase();

  if (/\b(block|slab|stairs|wall|ore|brick|tile)\b/.test(normalized)) return "BLOCKS";
  if (/\b(item|tool|armor|glove|ingot|nugget|mesh)\b/.test(normalized)) return "ITEMS";
  if (/\b(recipe|craft|stonecutter|uncraft)\b/.test(normalized)) return "RECIPES";
  if (/\b(ui|ux|menu|screen|tooltip|hud|localization|translation)\b/.test(normalized)) return "UI/UX";
  if (/\b(fluid|liquid|tank|coolant)\b/.test(normalized)) return "FLUIDS";
  if (/\b(fix|bug|hotfix|issue|crash)\b/.test(normalized)) return "BUG FIXES";
  if (/\b(texture|sprite|atlas|model|icon)\b/.test(normalized)) return "TEXTURES";
  if (/\b(api|script|refactor|build|ci|pipeline|performance|perf|internal)\b/.test(normalized)) return "TECHNICAL CHANGES";
  if (/\b(integration|compat|compatibility|third[ -]?party|addon)\b/.test(normalized)) return "THIRD-PARTY / INTEGRATION";

  return "";
}

function shouldForceTechnical(title) {
  return /\b(refactor|lint|format|ci|pipeline|build|internal|typing|types|cleanup)\b/i.test(title);
}

function detectSection(entry) {
  for (const label of entry.labels) {
    const fromLabel = labelToSection(label);
    if (fromLabel) {
      return fromLabel;
    }
  }

  const byFiles = classifyByFiles(entry.files);
  if (byFiles) {
    return byFiles;
  }

  const byTitle = classifyByTitle(entry.title);
  if (byTitle) {
    return byTitle;
  }

  return "MISC";
}

function toTitleCase(text) {
  return text
    .split(" ")
    .map((word) => {
      if (!word) {
        return word;
      }
      if (/^[A-Z0-9]{2,}$/.test(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function normalizeSubcategoryName(rawValue, section) {
  const cleaned = (rawValue || "")
    .replace(/^[`'"\[]+/, "")
    .replace(/[`'"\]]+$/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "";
  }

  const lowered = cleaned.toLowerCase();
  const aliases = SECTION_ALIASES[section] || [];
  if (lowered === "general" || aliases.includes(lowered)) {
    return "General";
  }

  return toTitleCase(cleaned);
}

function extractSubcategoryFromLabels(labels, section) {
  for (const label of labels) {
    const match = label.match(/^(?:sub(?:category)?|area|group|module|scope)\s*:\s*(.+)$/i);
    if (!match) {
      continue;
    }

    const normalized = normalizeSubcategoryName(match[1], section);
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function extractSubcategoryFromTitle(title, section) {
  const fromPrefix = title.match(/^([A-Za-z0-9][A-Za-z0-9 /&+_-]{1,40}):\s+.+/);
  if (fromPrefix) {
    const normalized = normalizeSubcategoryName(fromPrefix[1], section);
    if (normalized) {
      return normalized;
    }
  }

  const fromBracket = title.match(/^\[([^\]]{2,40})\]\s+.+/);
  if (fromBracket) {
    const normalized = normalizeSubcategoryName(fromBracket[1], section);
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function extractSubcategoryFromFiles(section, fileList) {
  const files = fileList.map((filePath) => filePath.toLowerCase());

  if (section === "BLOCKS") {
    if (files.some((item) => item.includes("decorative"))) return "Decorative";
    if (files.some((item) => item.includes("block_culling"))) return "Culling";
    if (files.some((item) => item.includes("ore"))) return "Ores";
  }

  if (section === "ITEMS") {
    if (files.some((item) => item.includes("attachables") || item.includes("glove"))) return "Gloves";
    if (files.some((item) => item.includes("armor"))) return "Armor";
    if (files.some((item) => item.includes("tool"))) return "Tools";
  }

  if (section === "RECIPES") {
    if (files.some((item) => item.includes("stonecutter"))) return "Stonecutter";
    if (files.some((item) => item.includes("crafting_table"))) return "Crafting Table";
    if (files.some((item) => item.includes("equipment"))) return "Equipment";
    if (files.some((item) => item.includes("uncraft"))) return "Uncrafting";
  }

  if (section === "UI/UX") {
    if (files.some((item) => item.includes("texts") || item.includes("lang") || item.includes("localization"))) return "Localization";
    if (files.some((item) => item.includes("hud") || item.includes("screen") || item.includes("ui"))) return "HUD";
  }

  if (section === "TECHNICAL CHANGES") {
    if (files.some((item) => item.includes("scripts"))) return "Scripts";
    if (files.some((item) => item.includes("workflow") || item.includes(".github") || item.endsWith("package.json") || item.endsWith("deno.json"))) return "Tooling";
  }

  return "";
}

function extractSubcategoryFromKeywords(section, title) {
  const normalized = title.toLowerCase();

  if (section === "BLOCKS") {
    if (/\b(ore|deepslate|raw)\b/.test(normalized)) return "Ores";
    if (/\b(stairs|slab|wall|tile|brick)\b/.test(normalized)) return "Variants";
  }

  if (section === "ITEMS") {
    if (/\b(glove|gauntlet)\b/.test(normalized)) return "Gloves";
    if (/\b(armor|helmet|chestplate|leggings|boots)\b/.test(normalized)) return "Armor";
    if (/\b(tool|pickaxe|axe|sword|shovel|hoe|paxel|hammer)\b/.test(normalized)) return "Tools";
    if (/\b(mesh|net|material|ingot|nugget|shard)\b/.test(normalized)) return "Materials";
  }

  if (section === "RECIPES") {
    if (/\b(stonecutter)\b/.test(normalized)) return "Stonecutter";
    if (/\b(crafting|crafting table)\b/.test(normalized)) return "Crafting Table";
    if (/\b(uncraft|decraft)\b/.test(normalized)) return "Uncrafting";
  }

  if (section === "UI/UX") {
    if (/\b(localization|translation|lang|text)\b/.test(normalized)) return "Localization";
    if (/\b(hud|screen|menu|tooltip)\b/.test(normalized)) return "HUD";
  }

  if (section === "TECHNICAL CHANGES") {
    if (/\b(script|api|runtime)\b/.test(normalized)) return "Scripts";
    if (/\b(build|ci|workflow|pipeline|release|tooling)\b/.test(normalized)) return "Tooling";
  }

  return "";
}

function detectSubcategory(section, entry) {
  const fromLabel = extractSubcategoryFromLabels(entry.labels, section);
  if (fromLabel) {
    return fromLabel;
  }

  const fromTitle = extractSubcategoryFromTitle(entry.title, section);
  if (fromTitle) {
    return fromTitle;
  }

  const fromFiles = extractSubcategoryFromFiles(section, entry.files);
  if (fromFiles) {
    return fromFiles;
  }

  const fromKeywords = extractSubcategoryFromKeywords(section, entry.title);
  if (fromKeywords) {
    return fromKeywords;
  }

  return "General";
}

function sortSubcategoryNames(names) {
  const unique = Array.from(new Set(names.map((name) => normalizeSubcategoryName(name, "MISC") || "General")));
  const hasGeneral = unique.some((name) => name.toLowerCase() === "general");
  const otherNames = unique
    .filter((name) => name.toLowerCase() !== "general")
    .sort((left, right) => left.localeCompare(right, "en", { sensitivity: "base" }));

  return hasGeneral ? ["General", ...otherNames] : otherNames;
}

function toSentence(text) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "Updated project content.";
  }
  const first = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  return /[.!?]$/.test(first) ? first : `${first}.`;
}

function inferHeaderValue(until, explicitVersion, draft) {
  const base = explicitVersion.trim();
  let header = base;

  if (!header) {
    const exactTag = runGit(["describe", "--tags", "--exact-match", until], true);
    if (exactTag) {
      header = exactTag;
    } else if (/^v?\d+([.-]\d+)*$/i.test(until)) {
      header = until;
    } else {
      header = "Unreleased";
    }
  }

  if (draft && !/\(Draft\)$/i.test(header)) {
    return `${header} (Draft)`;
  }

  return header;
}

function buildSummary(entriesBySection, lang) {
  const sectionCount = Object.fromEntries(
    Object.entries(entriesBySection).map(([section, entries]) => [section, entries.length])
  );

  const primarySections = ["BLOCKS", "ITEMS", "RECIPES", "UI/UX", "FLUIDS", "TEXTURES"]
    .map((section) => ({ section, count: sectionCount[section] || 0 }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)
    .map((item) => item.section);

  const bugCount = sectionCount["BUG FIXES"] || 0;
  const technicalCount = sectionCount["TECHNICAL CHANGES"] || 0;

  if (entriesBySection.__total === 0) {
    if (lang === "pt" || lang === "ptbr" || lang === "pt-br") {
      return "Atualização de manutenção sem mudanças relevantes detectadas no intervalo selecionado.";
    }
    return "Maintenance update with no notable changes detected in the selected range.";
  }

  if (lang === "pt" || lang === "ptbr" || lang === "pt-br") {
    const focusText = primarySections.length
      ? `Esta atualização foca principalmente em ${primarySections.join(" e ")}`
      : "Esta atualização traz melhorias gerais";
    const bugText = bugCount > 0 ? `, além de ${bugCount} correç${bugCount === 1 ? "ão" : "ões"} de bugs` : "";
    const techText = technicalCount > 0 ? ` e ${technicalCount} ajustes técnicos` : "";
    return `${focusText}${bugText}${techText}.`;
  }

  const focusText = primarySections.length
    ? `This update primarily focuses on ${primarySections.join(" and ")}`
    : "This update includes broad improvements";
  const bugText = bugCount > 0 ? `, plus ${bugCount} bug fix${bugCount === 1 ? "" : "es"}` : "";
  const techText = technicalCount > 0 ? ` and ${technicalCount} technical change${technicalCount === 1 ? "" : "s"}` : "";
  return `${focusText}${bugText}${techText}.`;
}

function formatEntries(entriesBySection, header, summaryText) {
  const lines = [];
  lines.push(`# ${header}`);
  lines.push("");
  lines.push(summaryText);
  lines.push("");

  for (const section of SECTION_ORDER) {
    const entries = entriesBySection[section] || [];
    if (entries.length === 0) {
      continue;
    }

    lines.push(`## ${section}`);
    const groupedBySubcategory = {};
    for (const entry of entries) {
      const subcategory = normalizeSubcategoryName(entry.subcategory || "General", section) || "General";
      if (!groupedBySubcategory[subcategory]) {
        groupedBySubcategory[subcategory] = [];
      }
      groupedBySubcategory[subcategory].push(entry);
    }

    const orderedSubcategories = sortSubcategoryNames(Object.keys(groupedBySubcategory));
    for (const subcategory of orderedSubcategories) {
      lines.push(`### ${subcategory}`);

      const subsectionEntries = sortEntries(groupedBySubcategory[subcategory]);
      for (const entry of subsectionEntries) {
        const ref = entry.prNumber > 0 ? `(PR #${entry.prNumber})` : `(commit ${entry.sha.slice(0, 7)})`;
        lines.push(`- ${toSentence(entry.title)} ${ref}`);
        if (entry.note) {
          lines.push(`  - ${toSentence(entry.note)}`);
        }
      }
    }

    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

function extractBodyNote(body) {
  const lines = body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    const noteMatch = line.match(/^(?:[-*]\s*)?(?:note|player impact|impact)\s*:?\s*(.+)$/i);
    if (noteMatch) {
      return noteMatch[1].trim();
    }
  }
  return "";
}

function aggregateEntries(commits) {
  const map = new Map();

  for (const commit of commits) {
    const files = filesForCommit(commit.sha);
    const prNumber = extractPrNumber(`${commit.subject}\n${commit.body}`);
    const key = prNumber > 0 ? `pr:${prNumber}` : `commit:${commit.sha}`;

    if (!map.has(key)) {
      map.set(key, {
        key,
        prNumber,
        sha: commit.sha,
        title: normalizeTitle(commit.subject),
        body: commit.body,
        labels: [],
        files: [...files],
        note: extractBodyNote(commit.body),
      });
      continue;
    }

    const current = map.get(key);
    current.files = Array.from(new Set([...current.files, ...files]));
    if (!current.note) {
      current.note = extractBodyNote(commit.body);
    }
  }

  return Array.from(map.values());
}

function sortEntries(entries) {
  return [...entries].sort((left, right) => left.title.localeCompare(right.title, "en", { sensitivity: "base" }));
}

async function main() {
  loadDotEnvFile();

  const { positionals, options } = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const { since, until } = resolveSinceUntil(positionals);
  ensureRefExists(until);
  ensureRefExists(since);

  const rangeExpression = buildRange(since, until);
  const commits = parseGitLog(rangeExpression);
  const baseEntries = aggregateEntries(commits);

  const { owner, repo } = parseRemoteGitHub();
  const pullRequestData = await enrichWithPullRequestData(baseEntries, owner, repo);

  const enrichedEntries = baseEntries.map((entry) => {
    if (entry.prNumber <= 0) {
      return entry;
    }

    const pr = pullRequestData[entry.prNumber];
    if (!pr) {
      return entry;
    }

    return {
      ...entry,
      title: normalizeTitle(pr.title || entry.title),
      body: (pr.body || entry.body || "").trim(),
      labels: (pr.labels || []).map((label) => label.name).filter(Boolean),
      note: entry.note || extractBodyNote(pr.body || ""),
    };
  });

  const bySection = Object.fromEntries(SECTION_ORDER.map((section) => [section, []]));

  for (const entry of enrichedEntries) {
    let section = detectSection(entry);
    if (PLAYER_FACING_SECTIONS.has(section) && shouldForceTechnical(entry.title)) {
      section = "TECHNICAL CHANGES";
    }
    if (!bySection[section]) {
      section = "MISC";
    }

    const subcategory = detectSubcategory(section, entry);
    bySection[section].push({
      ...entry,
      subcategory,
    });
  }

  for (const section of SECTION_ORDER) {
    bySection[section] = sortEntries(bySection[section]);
  }

  bySection.__total = enrichedEntries.length;

  const header = inferHeaderValue(until, options.version || "", options.draft);
  const summary = buildSummary(bySection, options.lang);
  const markdown = formatEntries(bySection, header, summary);

  process.stdout.write(markdown);

  if (options.output) {
    const outputPath = path.resolve(options.output);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, markdown, "utf8");
  }
}

main().catch((error) => {
  const message = error && error.message ? error.message : String(error);
  process.stderr.write(`Failed to generate changelog: ${message}\n`);
  process.exitCode = 1;
});