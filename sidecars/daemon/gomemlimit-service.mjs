/**
 * Obsidian Prism — Optional Go Native GOMEMLIMIT User Environment Helper
 *
 * Design & safety boundaries (zero risk to host or Google services):
 *   1. Only reads/writes the standard OS user-level GOMEMLIMIT environment variable
 *      (soft memory limit natively supported by Go 1.19+ runtime);
 *   2. Never modifies any official Antigravity binary, app.asar, or injects flags into running processes;
 *   3. Strict allowlist value validation — never accepts arbitrary expressions or command injection;
 *   4. All actions are explicitly user-triggered, take effect after restarting Antigravity, and can be cleared in one click.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';

export const ALLOWED_GOMEMLIMIT_PRESETS = Object.freeze(['2GiB', '2500MiB', '3GiB', '4GiB']);
export const RECOMMENDED_GOMEMLIMIT = '2GiB';
const GOMEMLIMIT_VALUE_RE = /^(?:1536MiB|2GiB|2500MiB|3GiB|4GiB)$/;
const MAC_LAUNCH_AGENT_LABEL = 'com.obsidian-prism.gomemlimit';

const WIN_GET_USER_ENV_PS =
  '$v = [Environment]::GetEnvironmentVariable("GOMEMLIMIT", "User"); if ($null -ne $v) { [Console]::Out.Write($v) }';
const WIN_GET_USER_ENV_B64 = Buffer.from(WIN_GET_USER_ENV_PS, 'utf16le').toString('base64');

const WIN_SET_USER_ENV_PS = [
  '$ErrorActionPreference = "Stop"',
  '$v = [string]$env:AG_PRISM_GOMEMLIMIT_VAL',
  'if ($v -notmatch "^(1536MiB|2GiB|2500MiB|3GiB|4GiB)$") { throw "Invalid GOMEMLIMIT value" }',
  '[Environment]::SetEnvironmentVariable("GOMEMLIMIT", $v, "User")',
].join('\n');
const WIN_SET_USER_ENV_B64 = Buffer.from(WIN_SET_USER_ENV_PS, 'utf16le').toString('base64');

const WIN_CLEAR_USER_ENV_PS = [
  '$ErrorActionPreference = "Stop"',
  '[Environment]::SetEnvironmentVariable("GOMEMLIMIT", $null, "User")',
].join('\n');
const WIN_CLEAR_USER_ENV_B64 = Buffer.from(WIN_CLEAR_USER_ENV_PS, 'utf16le').toString('base64');

export function isValidGoMemLimitValue(raw) {
  return typeof raw === 'string' && GOMEMLIMIT_VALUE_RE.test(raw.trim());
}

function defaultExecFileAsync(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (err, stdout, stderr) => {
      if (err) {
        const msg = String(stderr || err.message || 'command failed').trim();
        reject(new Error(msg));
        return;
      }
      resolve(String(stdout || ''));
    });
  });
}

function assertNoSymlinkChain(targetPath, label = 'path') {
  const resolved = path.resolve(targetPath);
  const parsed = path.parse(resolved);
  const parts = resolved.slice(parsed.root.length).split(/[\\/]+/).filter(Boolean);
  let cur = parsed.root;
  for (let i = 0; i < parts.length; i += 1) {
    cur = path.join(cur, parts[i]);
    try {
      const st = fs.lstatSync(cur);
      if (st.isSymbolicLink()) {
        if (process.platform === 'darwin' && (cur === '/var' || cur === '/tmp')) continue;
        throw new Error(`Refusing symbolic link in ${label}: ${cur}`);
      }
    } catch (err) {
      if (err && err.code === 'ENOENT') break;
      throw err;
    }
  }
}

function writeAtomicPrivateFile(filePath, content, mode = 0o600) {
  const resolved = path.resolve(filePath);
  assertNoSymlinkChain(resolved, 'GOMEMLIMIT config');
  const dir = path.dirname(resolved);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  assertNoSymlinkChain(dir, 'GOMEMLIMIT directory');
  const tmp = `${resolved}.tmp.${crypto.randomBytes(6).toString('hex')}`;
  let fd = null;
  try {
    fd = fs.openSync(tmp, 'wx', mode);
    fs.writeFileSync(fd, content, 'utf8');
    try { fs.fsyncSync(fd); } catch {}
    fs.closeSync(fd);
    fd = null;
    try { fs.chmodSync(tmp, mode); } catch {}
    fs.renameSync(tmp, resolved);
  } catch (err) {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch {}
    }
    try { fs.unlinkSync(tmp); } catch {}
    throw err;
  }
}

function getMacLaunchAgentPlistPath(homeDir = os.homedir()) {
  return path.join(homeDir, 'Library', 'LaunchAgents', `${MAC_LAUNCH_AGENT_LABEL}.plist`);
}

function getLinuxEnvDFilePath(homeDir = os.homedir(), env = process.env) {
  const customHome = homeDir && path.resolve(homeDir) !== path.resolve(os.homedir());
  const xdgConfig =
    !customHome && typeof env?.XDG_CONFIG_HOME === 'string' && env.XDG_CONFIG_HOME.trim()
      ? env.XDG_CONFIG_HOME.trim()
      : path.join(homeDir, '.config');
  return path.join(xdgConfig, 'environment.d', '90-obsidian-prism-gomemlimit.conf');
}

function buildMacLaunchAgentPlist(value) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    `  <key>Label</key><string>${MAC_LAUNCH_AGENT_LABEL}</string>`,
    '  <key>ProgramArguments</key>',
    '  <array>',
    '    <string>/bin/launchctl</string>',
    '    <string>setenv</string>',
    '    <string>GOMEMLIMIT</string>',
    `    <string>${value}</string>`,
    '  </array>',
    '  <key>RunAtLoad</key><true/>',
    '</dict>',
    '</plist>',
    '',
  ].join('\n');
}

export function buildManualGoMemLimitGuide(platform = process.platform, value = RECOMMENDED_GOMEMLIMIT) {
  const v = isValidGoMemLimitValue(value) ? value : RECOMMENDED_GOMEMLIMIT;
  if (platform === 'win32') {
    return `setx GOMEMLIMIT ${v}`;
  }
  if (platform === 'darwin') {
    return `launchctl setenv GOMEMLIMIT ${v}`;
  }
  return `mkdir -p ~/.config/environment.d && echo "GOMEMLIMIT=${v}" > ~/.config/environment.d/90-obsidian-prism-gomemlimit.conf`;
}

export async function getGoMemLimitStatus({
  platform = process.platform,
  execAsync = defaultExecFileAsync,
  env = process.env,
  homeDir = os.homedir(),
  linuxEnvFile = null,
  macPlistPath = null,
} = {}) {
  const processEnvValue = typeof env?.GOMEMLIMIT === 'string' ? env.GOMEMLIMIT.trim() : '';
  let currentValue = '';
  let source = 'none';

  try {
    if (platform === 'win32') {
      const out = await execAsync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-EncodedCommand', WIN_GET_USER_ENV_B64],
        { encoding: 'utf8', windowsHide: true, timeout: 5000 }
      );
      currentValue = String(out || '').trim();
      if (currentValue) source = 'win-user-env';
    } else if (platform === 'darwin') {
      try {
        const out = await execAsync('/bin/launchctl', ['getenv', 'GOMEMLIMIT'], { encoding: 'utf8', timeout: 4000 });
        currentValue = String(out || '').trim();
        if (currentValue) source = 'macos-launchctl';
      } catch {}
      if (!currentValue) {
        const plistPath = macPlistPath || getMacLaunchAgentPlistPath(homeDir);
        if (fs.existsSync(plistPath)) {
          assertNoSymlinkChain(plistPath, 'LaunchAgent plist');
          const xml = fs.readFileSync(plistPath, 'utf8');
          const m = /<string>GOMEMLIMIT<\/string>\s*<string>([^<]+)<\/string>/i.exec(xml);
          if (m && m[1]) {
            currentValue = m[1].trim();
            source = 'macos-launchagent';
          }
        }
      }
    } else {
      const envFile = linuxEnvFile || getLinuxEnvDFilePath(homeDir, env);
      if (fs.existsSync(envFile)) {
        assertNoSymlinkChain(envFile, 'environment.d file');
        const txt = fs.readFileSync(envFile, 'utf8');
        const m = /^\s*GOMEMLIMIT\s*=\s*([^\s#]+)\s*$/m.exec(txt);
        if (m && m[1]) {
          currentValue = m[1].trim();
          source = 'linux-environment-d';
        }
      }
      if (!currentValue && processEnvValue) {
        currentValue = processEnvValue;
        source = 'process-env';
      }
    }
  } catch {
    if (processEnvValue) {
      currentValue = processEnvValue;
      source = 'process-env';
    }
  }

  const restartRequired = Boolean(currentValue !== processEnvValue);
  return {
    ok: true,
    platform,
    configured: Boolean(currentValue),
    currentValue,
    processEnvValue,
    source,
    supportedAutoApply: platform === 'win32' || platform === 'darwin' || platform === 'linux',
    recommendedValue: RECOMMENDED_GOMEMLIMIT,
    presets: [...ALLOWED_GOMEMLIMIT_PRESETS],
    restartRequired,
    manualGuide: buildManualGoMemLimitGuide(platform, currentValue || RECOMMENDED_GOMEMLIMIT),
  };
}

export async function setGoMemLimit(rawValue, opts = {}) {
  const value = String(rawValue || '').trim();
  if (!isValidGoMemLimitValue(value)) {
    return {
      ok: false,
      code: 'INVALID_GOMEMLIMIT',
      error: `Invalid GOMEMLIMIT value; allowed presets: ${ALLOWED_GOMEMLIMIT_PRESETS.join(', ')}`,
    };
  }
  const platform = opts.platform || process.platform;
  const execAsync = typeof opts.execAsync === 'function' ? opts.execAsync : defaultExecFileAsync;
  const env = opts.env || process.env;
  const homeDir = opts.homeDir || os.homedir();

  try {
    if (platform === 'win32') {
      await execAsync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-EncodedCommand', WIN_SET_USER_ENV_B64],
        {
          encoding: 'utf8',
          windowsHide: true,
          timeout: 12000,
          env: { ...env, AG_PRISM_GOMEMLIMIT_VAL: value },
        }
      );
    } else if (platform === 'darwin') {
      await execAsync('/bin/launchctl', ['setenv', 'GOMEMLIMIT', value], { encoding: 'utf8', timeout: 5000 });
      const plistPath = opts.macPlistPath || getMacLaunchAgentPlistPath(homeDir);
      writeAtomicPrivateFile(plistPath, buildMacLaunchAgentPlist(value), 0o600);
    } else if (platform === 'linux') {
      const envFile = opts.linuxEnvFile || getLinuxEnvDFilePath(homeDir, env);
      writeAtomicPrivateFile(envFile, `# Managed by Obsidian Prism (optional Go soft memory limit)\nGOMEMLIMIT=${value}\n`, 0o600);
    } else {
      return { ok: false, code: 'UNSUPPORTED_PLATFORM', error: `Unsupported platform: ${platform}` };
    }
    const status = await getGoMemLimitStatus({
      platform,
      execAsync,
      env,
      homeDir,
      linuxEnvFile: opts.linuxEnvFile,
      macPlistPath: opts.macPlistPath,
    });
    return { ...status, ok: true, appliedValue: value, restartRequired: true };
  } catch (err) {
    return { ok: false, code: 'APPLY_FAILED', error: String(err?.message || err) };
  }
}

export async function clearGoMemLimit(opts = {}) {
  const platform = opts.platform || process.platform;
  const execAsync = typeof opts.execAsync === 'function' ? opts.execAsync : defaultExecFileAsync;
  const env = opts.env || process.env;
  const homeDir = opts.homeDir || os.homedir();

  try {
    if (platform === 'win32') {
      await execAsync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-EncodedCommand', WIN_CLEAR_USER_ENV_B64],
        { encoding: 'utf8', windowsHide: true, timeout: 12000, env }
      );
    } else if (platform === 'darwin') {
      try {
        await execAsync('/bin/launchctl', ['unsetenv', 'GOMEMLIMIT'], { encoding: 'utf8', timeout: 5000 });
      } catch {}
      const plistPath = opts.macPlistPath || getMacLaunchAgentPlistPath(homeDir);
      if (fs.existsSync(plistPath)) {
        assertNoSymlinkChain(plistPath, 'LaunchAgent plist');
        fs.unlinkSync(plistPath);
      }
    } else if (platform === 'linux') {
      const envFile = opts.linuxEnvFile || getLinuxEnvDFilePath(homeDir, env);
      if (fs.existsSync(envFile)) {
        assertNoSymlinkChain(envFile, 'environment.d file');
        fs.unlinkSync(envFile);
      }
    } else {
      return { ok: false, code: 'UNSUPPORTED_PLATFORM', error: `Unsupported platform: ${platform}` };
    }
    const status = await getGoMemLimitStatus({
      platform,
      execAsync,
      env,
      homeDir,
      linuxEnvFile: opts.linuxEnvFile,
      macPlistPath: opts.macPlistPath,
    });
    return { ...status, ok: true, cleared: true, restartRequired: Boolean(env?.GOMEMLIMIT) };
  } catch (err) {
    return { ok: false, code: 'CLEAR_FAILED', error: String(err?.message || err) };
  }
}
