#!/usr/bin/env node
/**
 * Claude Code LSP Windows .cmd Fix Patch
 *
 * 問題: Windows環境で typescript-language-server 等の npm グローバルパッケージが
 *       .cmd ファイルとしてインストールされるが、child_process.spawn() は
 *       shell: true なしでは .cmd を実行できない (ENOENT エラー)
 *
 * 修正: LSPサーバーのspawnオプションに shell: true を追加 (Windows時のみ)
 *
 * 参考: https://github.com/anthropics/claude-code/issues/19658
 *
 * 使い方:
 *   node scripts/patch-lsp-windows-cmd.js          # パッチ適用
 *   node scripts/patch-lsp-windows-cmd.js --check   # 確認のみ
 *   node scripts/patch-lsp-windows-cmd.js --revert  # バックアップから復元
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

const BUGGY = 'windowsHide:!0})';
const FIXED = 'windowsHide:!0,shell:process.platform==="win32"})';

function findLspSpawnRegion(content) {
  // LSPのspawn呼び出しを特定:
  // stdio:["pipe","pipe","pipe"] + windowsHide がある箇所で、
  // 付近に "LSP server" 文字列がある箇所
  let idx = 0;
  while (true) {
    idx = content.indexOf('stdio:["pipe","pipe","pipe"]', idx);
    if (idx < 0) return -1;

    // 前後500文字のコンテキストを確認
    const regionStart = Math.max(0, idx - 500);
    const regionEnd = Math.min(content.length, idx + 500);
    const context = content.substring(regionStart, regionEnd);

    if (context.includes("LSP server")) {
      // LSP関連のspawn呼び出しを発見
      return idx;
    }
    idx++;
  }
}

function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes("--check");
  const revert = args.includes("--revert");

  const cliJsPath = findCliJs();
  const backupPath = cliJsPath + ".bak-lsp-cmd";

  console.log(`Claude Code cli.js: ${cliJsPath}`);

  const content = fs.readFileSync(cliJsPath, "utf8");

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

  // LSPのspawn呼び出しを特定
  const pipeIdx = findLspSpawnRegion(content);
  if (pipeIdx < 0) {
    console.error("Error: LSPのspawn呼び出しパターンが見つかりません。");
    console.error("Claude Codeのバージョンが変わり、コードが変更された可能性があります。");
    process.exit(1);
  }

  // pipeIdx 付近の windowsHide パターンを探す
  const searchStart = pipeIdx;
  const searchEnd = Math.min(content.length, pipeIdx + 300);
  const region = content.substring(searchStart, searchEnd);

  const fixedIdx = region.indexOf(FIXED);
  if (fixedIdx >= 0) {
    console.log("Patch already applied. Nothing to do.");
    return;
  }

  const buggyIdx = region.indexOf(BUGGY);
  if (buggyIdx < 0) {
    console.error("Error: パッチ対象のパターンが見つかりません。");
    console.error("Region:", region.substring(0, 200));
    process.exit(1);
  }

  if (checkOnly) {
    console.log("Patch needed: LSP spawn に shell オプションが未設定です。");
    process.exit(1);
  }

  // バックアップ
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(cliJsPath, backupPath);
    console.log(`Backup created: ${backupPath}`);
  } else {
    console.log(`Backup already exists: ${backupPath}`);
  }

  // パッチ適用 - LSPのspawn呼び出しのみ対象 (位置で特定)
  const absIdx = searchStart + buggyIdx;
  const patched = content.substring(0, absIdx) + FIXED + content.substring(absIdx + BUGGY.length);

  // 検証
  const verifyRegion = patched.substring(searchStart, searchStart + 400);
  if (!verifyRegion.includes(FIXED)) {
    console.error("Error: パッチの検証に失敗しました。");
    process.exit(1);
  }

  fs.writeFileSync(cliJsPath, patched);
  console.log("Patch applied: LSP spawn に shell オプションを追加しました。");
  console.log(`  Before: ...${BUGGY}`);
  console.log(`  After:  ...${FIXED}`);
  console.log("\nClaude Codeを再起動してください。");
}

main();
