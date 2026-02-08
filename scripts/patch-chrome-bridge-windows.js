#!/usr/bin/env node
/**
 * Claude in Chrome MCP Bridge Windows Named Pipe Fix
 *
 * 問題: Windows環境で Claude in Chrome の MCP ブリッジが接続できない
 *       getSocketPaths() がUnixソケットパスのみ返し、Windows named pipe を含まない
 *
 * 修正: getSocketPaths() の return 前に Windows named pipe パスを追加
 *
 * 参考: https://github.com/anthropics/claude-code/issues/21337
 *
 * 使い方:
 *   node scripts/patch-chrome-bridge-windows.js          # パッチ適用
 *   node scripts/patch-chrome-bridge-windows.js --check   # 確認のみ
 *   node scripts/patch-chrome-bridge-windows.js --revert  # バックアップから復元
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

/**
 * getSocketPaths() 関数を特定する
 * 特徴: endsWith(".sock") と "claude-mcp-browser-bridge" の両方を含む関数で、
 *        配列を return する
 */
function findGetSocketPaths(content) {
  // endsWith(".sock") の直後に claude-mcp-browser-bridge がある関数を探す
  const marker = 'endsWith(".sock")';
  let sockIdx = 0;
  while (true) {
    sockIdx = content.indexOf(marker, sockIdx);
    if (sockIdx < 0) return null;

    // .sock の後を見て、近くに claude-mcp-browser-bridge → return X} がある構造か確認
    const afterSock = content.substring(sockIdx, sockIdx + 500);

    if (afterSock.includes("claude-mcp-browser-bridge")) {
      // 最初の return X} を探す (cc4 関数の末尾)
      const returnMatch = afterSock.match(/return (\w+)\}(?=function)/);
      if (!returnMatch) { sockIdx++; continue; }

      const returnVar = returnMatch[1];
      const returnStr = `return ${returnVar}}`;
      const returnOffset = afterSock.indexOf(returnStr);
      const absPos = sockIdx + returnOffset;

      return { absPos, returnVar, returnStr };
    }
    sockIdx++;
  }
}

const PATCH_MARKER = '/*patch:win-pipe*/';

function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes("--check");
  const revert = args.includes("--revert");

  const cliJsPath = findCliJs();
  const backupPath = cliJsPath + ".bak-chrome-bridge";

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

  // 適用済みチェック
  if (content.includes(PATCH_MARKER)) {
    console.log("Patch already applied. Nothing to do.");
    return;
  }

  // getSocketPaths 関数を特定
  const found = findGetSocketPaths(content);
  if (!found) {
    console.error("Error: getSocketPaths() 関数が見つかりません。");
    console.error("Claude Codeのバージョンが変わり、コードが変更された可能性があります。");
    process.exit(1);
  }

  console.log(`Found getSocketPaths return at pos ${found.absPos} (var: ${found.returnVar})`);

  if (checkOnly) {
    console.log("Patch needed: Windows named pipe パスが未追加です。");
    process.exit(1);
  }

  // バックアップ
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(cliJsPath, backupPath);
    console.log(`Backup created: ${backupPath}`);
  } else {
    console.log(`Backup already exists: ${backupPath}`);
  }

  // パッチ: return の前に Windows named pipe パスを追加
  // 元: return A}
  // 後: if(process.platform==="win32"){let _p=`\\\\.\\pipe\\claude-mcp-browser-bridge-${...username}`;if(!A.includes(_p))A.push(_p)}/*patch:win-pipe*/return A}
  const v = found.returnVar;
  const inject =
    `if(process.platform==="win32"){` +
    `let _p="\\\\\\\\.\\\\pipe\\\\claude-mcp-browser-bridge-"+(process.env.USERNAME||"default");` +
    `if(!${v}.includes(_p))${v}.push(_p)}` +
    PATCH_MARKER;

  const patched =
    content.substring(0, found.absPos) +
    inject +
    content.substring(found.absPos);

  // 検証
  if (!patched.includes(PATCH_MARKER)) {
    console.error("Error: パッチの検証に失敗しました。");
    process.exit(1);
  }

  fs.writeFileSync(cliJsPath, patched);
  console.log("Patch applied: getSocketPaths() に Windows named pipe パスを追加しました。");
  console.log("\nClaude Codeを再起動してください。");
}

main();
