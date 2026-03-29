import inquirer from 'inquirer';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

interface InitOptions {
  yes?: boolean;
  githubAction?: boolean;
}

const DEFAULT_CONFIG = {
  models: [
    { provider: 'anthropic', model: 'claude-sonnet-4' },
    { provider: 'openai', model: 'gpt-4o' },
  ],
  thresholds: {
    minConsensusScore: 0.5,
    minSeverity: 'low',
    requireUnanimous: false,
  },
  policy: {
    failOn: 'high',
    requireConsensus: 1,
  },
};

const WORKFLOW_TEMPLATE = `name: Review Council

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Review Council
        run: npm install -g review-council

      - name: Run Review
        env:
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
          OPENAI_API_KEY: \${{ secrets.OPENAI_API_KEY }}
          GOOGLE_API_KEY: \${{ secrets.GOOGLE_API_KEY }}
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: |
          rcl review "\${{ github.repository }}#\${{ github.event.pull_request.number }}" \\
            --post \\
            --ci \\
            --github-token "$GITHUB_TOKEN"
`;

function detectApiKeys(): { anthropic?: string; openai?: string; google?: string } {
  return {
    anthropic: process.env.ANTHROPIC_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    google: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
  };
}

function getAvailableModels(apiKeys: ReturnType<typeof detectApiKeys>): Array<{ name: string; value: { provider: string; model: string } }> {
  const models: Array<{ name: string; value: { provider: string; model: string } }> = [];

  if (apiKeys.anthropic) {
    models.push(
      { name: 'Claude Sonnet 4.5 (Anthropic)', value: { provider: 'anthropic', model: 'claude-sonnet-4.5' } },
      { name: 'Claude Opus 4.6 (Anthropic)', value: { provider: 'anthropic', model: 'claude-opus-4.6' } }
    );
  }

  if (apiKeys.openai) {
    models.push(
      { name: 'GPT-4o (OpenAI)', value: { provider: 'openai', model: 'gpt-4o' } },
      { name: 'GPT-5.4 (OpenAI)', value: { provider: 'openai', model: 'gpt-5.4' } }
    );
  }

  if (apiKeys.google) {
    models.push(
      { name: 'Gemini 2.0 Flash (Google)', value: { provider: 'google', model: 'gemini-2.0-flash' } },
      { name: 'Gemini 1.5 Pro (Google)', value: { provider: 'google', model: 'gemini-1.5-pro' } }
    );
  }

  return models;
}

export async function initCommand(options: InitOptions): Promise<void> {
  console.log(chalk.bold.cyan('\n🏛️  Review Council Setup\n'));

  const apiKeys = detectApiKeys();
  const availableModels = getAvailableModels(apiKeys);

  if (availableModels.length === 0) {
    console.log(chalk.yellow('⚠️  No API keys detected in environment variables.'));
    console.log(chalk.dim('   Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY'));
    console.log(chalk.dim('   to enable model selection.\n'));
  } else {
    console.log(chalk.green(`✓ Detected ${availableModels.length} available model(s)`));
    if (apiKeys.anthropic) console.log(chalk.dim('  - Anthropic API key found'));
    if (apiKeys.openai) console.log(chalk.dim('  - OpenAI API key found'));
    if (apiKeys.google) console.log(chalk.dim('  - Google API key found'));
    console.log('');
  }

  let config: Record<string, unknown> = { ...DEFAULT_CONFIG };

  if (options.yes) {
    // Non-interactive mode with defaults
    console.log(chalk.dim('Using default configuration...\n'));
  } else {
    // Interactive mode
    const answers = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'models',
        message: 'Select models to use for review:',
        choices: availableModels.length > 0 ? availableModels : [
          { name: 'Claude Sonnet 4 (requires ANTHROPIC_API_KEY)', value: { provider: 'anthropic', model: 'claude-sonnet-4' } },
          { name: 'GPT-4o (requires OPENAI_API_KEY)', value: { provider: 'openai', model: 'gpt-4o' } },
        ],
        default: availableModels.length > 0 ? [availableModels[0].value, availableModels[1]?.value].filter(Boolean) : undefined,
        validate: (input: any) => input.length > 0 || 'Select at least one model',
      },
      {
        type: 'list',
        name: 'minSeverity',
        message: 'Minimum severity to report:',
        choices: ['info', 'low', 'medium', 'high', 'critical'],
        default: 'low',
      },
      {
        type: 'list',
        name: 'failOn',
        message: 'Severity threshold for CI failure:',
        choices: ['info', 'low', 'medium', 'high', 'critical'],
        default: 'high',
      },
      {
        type: 'input',
        name: 'ignorePatterns',
        message: 'Files to ignore (comma-separated glob patterns):',
        default: 'package-lock.json,yarn.lock,*.min.js',
      },
    ]);

    config = {
      models: answers.models,
      thresholds: {
        ...(config.thresholds as Record<string, unknown> || {}),
        minSeverity: answers.minSeverity,
      },
      policy: {
        ...(config.policy as Record<string, unknown> || {}),
        failOn: answers.failOn,
      },
      ignore: answers.ignorePatterns.split(',').map((s: string) => s.trim()).filter((s: string) => s),
    };
  }

  // Write config file
  const configPath = path.join(process.cwd(), '.review-councilrc.json');
  await fs.writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  console.log(chalk.green(`✓ Created ${configPath}`));

  // Generate GitHub Action if requested
  if (options.githubAction) {
    const workflowDir = path.join(process.cwd(), '.github', 'workflows');
    const workflowPath = path.join(workflowDir, 'rcl.yml');

    await fs.mkdir(workflowDir, { recursive: true });
    await fs.writeFile(workflowPath, WORKFLOW_TEMPLATE, 'utf-8');
    console.log(chalk.green(`✓ Created ${workflowPath}`));
    console.log(chalk.dim('  Remember to add API keys as repository secrets:'));
    console.log(chalk.dim('  - ANTHROPIC_API_KEY'));
    console.log(chalk.dim('  - OPENAI_API_KEY'));
    console.log(chalk.dim('  - GOOGLE_API_KEY'));
  }

  console.log(chalk.bold.green('\n✨ Setup complete!\n'));
  console.log('Next steps:');
  console.log(chalk.cyan('  rcl review <pr-url>') + ' - Review a pull request');
  console.log(chalk.cyan('  rcl review <diff-file>') + ' - Review a local diff file');
  console.log('');
}
