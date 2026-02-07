#!/usr/bin/env node
/**
 * Claude Code LSP URI Fix Patch
 *
 * 問題: Windows環境でClaude CodeのLSPクライアントが生成するファイルURIに不整合がある
 *
 * didOpen/didChange/didSave/didClose:  `file://${path.resolve(f)}`
 *   → file://D:\workspace\...  (バックスラッシュ、スラッシュ2つ)
 *
 * hover/definition等のリクエスト:  pathToFileURL(f).href
 *   → file:///D:/workspace/...  (フォワードスラッシュ、スラッシュ3つ)
 *
 * URIが不一致のためLSPサーバーが「ファイルが開かれていない」と判断し、
 * hover, goToDefinition, findReferences, documentSymbol が null を返す。
 *
 * 修正: `file://${Kd.resolve(j)}` → nkY(Kd.resolve(j)).href に統一
 *   (nkY = pathToFileURL, Kd = path — いずれもcli.js内で既にimport済み)
 *
 * 使い方:
 *   node scripts/patch-claude-code-lsp.js
 *   node scripts/patch-claude-code-lsp.js --check   (適用済みか確認のみ)
 *   node scripts/patch-claude-code-lsp.js --revert  (バックアップから復元)
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Claude Code cli.js のパスを特定
function findCliJs() {
  try {
    const which = execSync("where claude", { encoding: "utf8" }).trim().split("\n")[0].trim();
    // claude → cli.js のパスを導出
    // Windows: C:\...\nodejs\claude → C:\...\nodejs\node_modules\@anthropic-ai\claude-code\cli.js
    // shell script の場合: basedir/node_modules/@anthropic-ai/claude-code/cli.js
    const dir = path.dirname(which);
    const cliJs = path.join(dir, "node_modules", "@anthropic-ai", "claude-code", "cli.js");
    if (fs.existsSync(cliJs)) return cliJs;
  } catch {}

  // フォールバック: npmのグローバルパスから探す
  try {
    const npmRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
    const cliJs = path.join(npmRoot, "@anthropic-ai", "claude-code", "cli.js");
    if (fs.existsSync(cliJs)) return cliJs;
  } catch {}

  console.error("Error: Claude Code cli.js が見つかりません");
  process.exit(1);
}

const BACKTICK = String.fromCharCode(96);
const BUGGY_TEMPLATE = `${BACKTICK}file://\${Kd.resolve(j)}${BACKTICK}`;
const FIXED_EXPR = "nkY(Kd.resolve(j)).href";

function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes("--check");
  const revert = args.includes("--revert");

  const cliJsPath = findCliJs();
  const backupPath = cliJsPath + ".bak-lsp";

  console.log(`Claude Code cli.js: ${cliJsPath}`);

  // バージョン表示
  const content = fs.readFileSync(cliJsPath, "utf8");
  const versionMatch = content.match(/\/\/ Version: ([\d.]+)/);
  if (versionMatch) {
    console.log(`Version: ${versionMatch[1]}`);
  }

  // --revert
  if (revert) {
    if (!fs.existsSync(backupPath)) {
      console.error("Error: バックアップファイルが見つかりません:", backupPath);
      process.exit(1);
    }
    fs.copyFileSync(backupPath, cliJsPath);
    console.log("Reverted from backup.");
    return;
  }

  // バグの有無を確認
  const buggyCount = content.split(BUGGY_TEMPLATE).length - 1;
  const fixedCount = (content.match(/nkY\(Kd\.resolve\(j\)\)\.href/g) || []).length;

  console.log(`Buggy patterns: ${buggyCount}`);
  console.log(`Already fixed:  ${fixedCount}`);

  if (buggyCount === 0 && fixedCount > 0) {
    console.log("\nPatch already applied. Nothing to do.");
    return;
  }

  if (buggyCount === 0 && fixedCount === 0) {
    console.log("\nWarning: パターンが見つかりません。Claude Codeのバージョンが変わり、");
    console.log("コードの変数名が変更された可能性があります。手動確認が必要です。");
    console.log("\n以下で確認:");
    console.log('  grep -oP "file://.*resolve.*" cli.js');
    process.exit(1);
  }

  if (checkOnly) {
    console.log(`\nPatch needed: ${buggyCount} occurrences to fix.`);
    process.exit(buggyCount > 0 ? 1 : 0);
  }

  // バックアップ作成
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(cliJsPath, backupPath);
    console.log(`\nBackup created: ${backupPath}`);
  } else {
    console.log(`\nBackup already exists: ${backupPath}`);
  }

  // パッチ適用
  const patched = content.split(BUGGY_TEMPLATE).join(FIXED_EXPR);
  const remaining = patched.split(BUGGY_TEMPLATE).length - 1;

  if (remaining > 0) {
    console.error(`Error: ${remaining} occurrences remaining after patch.`);
    process.exit(1);
  }

  fs.writeFileSync(cliJsPath, patched);

  const newFixedCount = (patched.match(/nkY\(Kd\.resolve\(j\)\)\.href/g) || []).length;
  console.log(`\nPatch applied: ${buggyCount} occurrences fixed (total fixed: ${newFixedCount})`);
  console.log("\nClaude Codeを再起動してください。");
}

main();
