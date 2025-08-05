#!/usr/bin/env bun

/**
 * Comprehensive test runner for OpenAnalytics
 */

import { spawn } from "bun";
import { existsSync } from "fs";

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title: string) {
  log(`\n${'='.repeat(60)}`, colors.cyan);
  log(`${title}`, colors.cyan + colors.bright);
  log(`${'='.repeat(60)}`, colors.cyan);
}

async function runCommand(command: string, args: string[] = [], options: any = {}) {
  log(`\n▶ Running: ${command} ${args.join(' ')}`, colors.blue);
  
  const proc = spawn([command, ...args], {
    stdio: ['inherit', 'pipe', 'pipe'],
    ...options,
  });

  let stdout = '';
  let stderr = '';

  if (proc.stdout) {
    for await (const chunk of proc.stdout) {
      const text = new TextDecoder().decode(chunk);
      stdout += text;
      process.stdout.write(text);
    }
  }

  if (proc.stderr) {
    for await (const chunk of proc.stderr) {
      const text = new TextDecoder().decode(chunk);
      stderr += text;
      process.stderr.write(text);
    }
  }

  const result = await proc.exited;
  
  if (result === 0) {
    log(`✅ Command completed successfully`, colors.green);
  } else {
    log(`❌ Command failed with exit code ${result}`, colors.red);
  }

  return { 
    exitCode: result, 
    stdout, 
    stderr,
    success: result === 0 
  };
}

async function checkPrerequisites() {
  logSection('Checking Prerequisites');

  // Check if Docker is available
  try {
    const dockerCheck = await runCommand('docker', ['--version']);
    if (dockerCheck.success) {
      log('✅ Docker is available', colors.green);
    }
  } catch (error) {
    log('❌ Docker not available - skipping Docker tests', colors.yellow);
  }

  // Check if Puppeteer can be used
  try {
    const puppeteerTest = await runCommand('bun', ['-e', 'import puppeteer from "puppeteer"; console.log("Puppeteer OK")']);
    if (puppeteerTest.success) {
      log('✅ Puppeteer is available', colors.green);
    }
  } catch (error) {
    log('❌ Puppeteer not available - skipping E2E tests', colors.yellow);
  }
}

async function runUnitTests() {
  logSection('Running Unit Tests');
  
  const packages = [
    'packages/core/test/',
    'packages/client/test/',
    'packages/storage-d1/test/',
    'packages/storage-kv/test/',
    'packages/adapters/react/test/',
  ];

  let allPassed = true;

  for (const pkg of packages) {
    if (existsSync(pkg)) {
      log(`\n📦 Testing ${pkg}`, colors.magenta);
      const result = await runCommand('bun', ['test', pkg]);
      if (!result.success) {
        allPassed = false;
        log(`❌ Tests failed in ${pkg}`, colors.red);
      } else {
        log(`✅ Tests passed in ${pkg}`, colors.green);
      }
    } else {
      log(`⚠️  Skipping ${pkg} (not found)`, colors.yellow);
    }
  }

  return allPassed;
}

async function runE2ETests() {
  logSection('Running E2E Tests');
  
  if (!existsSync('test/e2e/')) {
    log('⚠️  E2E tests directory not found', colors.yellow);
    return true;
  }

  const result = await runCommand('bun', ['test', 'test/e2e/']);
  return result.success;
}

async function runIntegrationTests() {
  logSection('Running Integration Tests');
  
  if (!existsSync('test/integration/')) {
    log('⚠️  Integration tests directory not found', colors.yellow);
    return true;
  }

  const result = await runCommand('bun', ['test', 'test/integration/']);
  return result.success;
}

async function runDockerTests() {
  logSection('Running Docker Tests');
  
  try {
    // Check if Docker is available
    const dockerCheck = await runCommand('docker', ['--version']);
    if (!dockerCheck.success) {
      log('⚠️  Docker not available - skipping Docker tests', colors.yellow);
      return true;
    }

    // Build test image
    log('\n🐳 Building Docker test image...', colors.blue);
    const buildResult = await runCommand('docker', [
      'build',
      '-f', 'Dockerfile.test',
      '-t', 'openanalytics-test',
      '.'
    ]);

    if (!buildResult.success) {
      log('❌ Failed to build Docker test image', colors.red);
      return false;
    }

    // Run tests in container
    log('\n🚀 Running tests in Docker container...', colors.blue);
    const testResult = await runCommand('docker', [
      'run',
      '--rm',
      'openanalytics-test',
      'bun',
      'test'
    ]);

    return testResult.success;
  } catch (error) {
    log(`❌ Docker tests failed: ${error}`, colors.red);
    return false;
  }
}

async function generateTestReport(results: Record<string, boolean>) {
  logSection('Test Summary');
  
  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;
  
  log(`\n📊 Test Results:`, colors.bright);
  
  for (const [testType, success] of Object.entries(results)) {
    const icon = success ? '✅' : '❌';
    const color = success ? colors.green : colors.red;
    log(`  ${icon} ${testType}`, color);
  }
  
  log(`\n📈 Overall: ${passed}/${total} test suites passed`, 
    passed === total ? colors.green : colors.red);
  
  if (passed === total) {
    log('\n🎉 All tests passed!', colors.green + colors.bright);
    return true;
  } else {
    log('\n💥 Some tests failed!', colors.red + colors.bright);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const runAll = args.includes('--all') || args.length === 0;
  const runUnit = args.includes('--unit') || runAll;
  const runE2E = args.includes('--e2e') || runAll;
  const runIntegration = args.includes('--integration') || runAll;
  const runDocker = args.includes('--docker') || runAll;

  log('🧪 OpenAnalytics Test Runner', colors.cyan + colors.bright);
  log('=====================================', colors.cyan);

  await checkPrerequisites();

  const results: Record<string, boolean> = {};

  if (runUnit) {
    results['Unit Tests'] = await runUnitTests();
  }

  if (runE2E) {
    results['E2E Tests'] = await runE2ETests();
  }

  if (runIntegration) {
    results['Integration Tests'] = await runIntegrationTests();
  }

  if (runDocker) {
    results['Docker Tests'] = await runDockerTests();
  }

  const allPassed = await generateTestReport(results);

  process.exit(allPassed ? 0 : 1);
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  log('\n🛑 Test run interrupted', colors.yellow);
  process.exit(1);
});

if (import.meta.main) {
  main().catch((error) => {
    log(`💥 Test runner crashed: ${error}`, colors.red);
    process.exit(1);
  });
}