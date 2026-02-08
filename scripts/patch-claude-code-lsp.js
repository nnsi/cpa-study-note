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
 * 修正: `file://${PATH.resolve(ARG)}` → PATHTOURI(PATH.resolve(ARG)).href に統一
 *   (変数名はminifiedされているため正規表現で動的に検出)
 *
 * 使い方:
 *   node scripts/patch-claude-code-lsp.js
 *   node scripts/patch-claude-code-lsp.js --check   (適用済みか確認のみ)
 *   node scripts/patch-claude-code-lsp.js --revert  (バックアップから復元)
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function findCliJs() {
  try {
    const which = execSync("where claude", { encoding: "utf8" }).trim().split("\n")[0].trim();
    const dir = path.dirname(which);
    const cliJs = path.join(dir, "node_modules", "@anthropic-ai", "claude-code", "cli.js");
    if (fs.existsSync(cliJs)) return cliJs;
  } catch {}

  try {
    const npmRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
    const cliJs = path.join(npmRoot, "@anthropic-ai", "claude-code", "cli.js");
    if (fs.existsSync(cliJs)) return cliJs;
  } catch {}

  console.error("Error: Claude Code cli.js が見つかりません");
  process.exit(1);
}

// `file://${X.resolve(Y)}` にマッチ (X=path module, Y=file arg, 変数名は任意)
const BUGGY_RE = /`file:\/\/\$\{(\w+)\.resolve\((\w+)\)\}`/g;

// pathToFileURL alias を検出
function findPathToFileURL(content) {
  const m = content.match(/pathToFileURL as (\w+)/);
  return m ? m[1] : null;
}

function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes("--check");
  const revert = args.includes("--revert");

  const cliJsPath = findCliJs();
  const backupPath = cliJsPath + ".bak-lsp";

  console.log(`Claude Code cli.js: ${cliJsPath}`);

  const content = fs.readFileSync(cliJsPath, "utf8");

  // バージョン表示
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

  // pathToFileURL alias を検出
  const ptuAlias = findPathToFileURL(content);
  if (!ptuAlias) {
    console.error("Error: pathToFileURL のimportが見つかりません。");
    process.exit(1);
  }
  console.log(`pathToFileURL alias: ${ptuAlias}`);

  // バグの有無を確認
  const buggyMatches = [...content.matchAll(BUGGY_RE)];
  const buggyCount = buggyMatches.length;

  // 修正済みパターン: ALIAS(X.resolve(Y)).href
  const fixedRe = new RegExp(`${ptuAlias}\\(\\w+\\.resolve\\(\\w+\\)\\)\\.href`, "g");
  const fixedCount = (content.match(fixedRe) || []).length;

  console.log(`Buggy patterns: ${buggyCount}`);
  console.log(`Already fixed:  ${fixedCount}`);

  if (buggyCount === 0 && fixedCount > 0) {
    console.log("\nPatch already applied. Nothing to do.");
    return;
  }

  if (buggyCount === 0 && fixedCount === 0) {
    console.log("\nWarning: パターンが見つかりません。Claude Codeのバージョンが変わり、");
    console.log("コードの構造が変更された可能性があります。手動確認が必要です。");
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

  // パッチ適用: `file://${X.resolve(Y)}` → ALIAS(X.resolve(Y)).href
  const patched = content.replace(BUGGY_RE, (match, pathMod, fileArg) => {
    return `${ptuAlias}(${pathMod}.resolve(${fileArg})).href`;
  });

  // 検証
  const remaining = [...patched.matchAll(new RegExp(BUGGY_RE.source, "g"))].length;
  if (remaining > 0) {
    console.error(`Error: ${remaining} occurrences remaining after patch.`);
    process.exit(1);
  }

  fs.writeFileSync(cliJsPath, patched);

  const newFixedCount = (patched.match(fixedRe) || []).length;
  console.log(`\nPatch applied: ${buggyCount} occurrences fixed (total fixed: ${newFixedCount})`);
  console.log("\nClaude Codeを再起動してください。");
}

main();
