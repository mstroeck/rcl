# Review Council (rcl)

Cross-provider AI code review tool with consensus voting.

## Overview

Review Council runs the same code diff through multiple LLM providers (Claude, GPT, Gemini) in parallel, then synthesizes findings by consensus — deduplicating by file+line, scoring by agreement, and elevating severity when multiple models agree.

## Features

- **Multi-Provider Support**: Claude (Anthropic), GPT (OpenAI), Gemini (Google), and OpenAI-compatible APIs
- **Consensus Voting**: Deduplicate findings across models, score by agreement
- **Severity Elevation**: Automatically elevate severity when 2+ models agree
- **Security Boundaries**: Prompt hardening to protect against injection attacks
- **Multiple Output Formats**: Terminal (pretty), JSON, Markdown
- **GitHub Integration**: Post reviews directly to PRs
- **CI/CD Ready**: Exit with error codes for automation

## Installation

\`\`\`bash
npm install -g review-council
\`\`\`

Or use directly with npx:

\`\`\`bash
npx review-council review owner/repo#123
\`\`\`

## Quick Start

### Review a GitHub PR

\`\`\`bash
rcl review owner/repo#123
\`\`\`

### Review a local diff

\`\`\`bash
rcl review changes.patch
\`\`\`

### Use specific models

\`\`\`bash
rcl review owner/repo#123 --models claude,gpt
\`\`\`

## Environment Variables

Set API keys for the providers you want to use:

\`\`\`bash
export ANTHROPIC_API_KEY="your-key"
export OPENAI_API_KEY="your-key"
export GOOGLE_API_KEY="your-key"
export GITHUB_TOKEN="your-token"
\`\`\`

## GitHub Actions

Review Council can be used as a GitHub Action to automatically review pull requests.

### Quick Setup

\`\`\`bash
# Initialize with GitHub Actions workflow
rcl init --github-action
\`\`\`

This creates \`.github/workflows/rcl.yml\` in your repository. Add your API keys as repository secrets:
- \`ANTHROPIC_API_KEY\`
- \`OPENAI_API_KEY\`
- \`GOOGLE_API_KEY\`

### Manual Setup

Create \`.github/workflows/rcl.yml\`:

\`\`\`yaml
name: Review Council

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
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Review with AI Council
        uses: ./
        with:
          github-token: \${{ secrets.GITHUB_TOKEN }}
          anthropic-key: \${{ secrets.ANTHROPIC_API_KEY }}
          openai-key: \${{ secrets.OPENAI_API_KEY }}
          google-key: \${{ secrets.GOOGLE_API_KEY }}
          models: 'claude,gpt'
          fail-on: 'high'
          post-mode: 'inline'
\`\`\`

### Action Inputs

| Input | Description | Default |
|-------|-------------|---------|
| \`github-token\` | GitHub token for API access | \`\${{ github.token }}\` |
| \`anthropic-key\` | Anthropic API key for Claude models | - |
| \`openai-key\` | OpenAI API key for GPT models | - |
| \`google-key\` | Google API key for Gemini models | - |
| \`models\` | Comma-separated list of models | All available |
| \`fail-on\` | Severity threshold for CI failure | \`high\` |
| \`post-mode\` | How to post results (\`comment\`, \`inline\`, \`both\`) | \`inline\` |
| \`ignore\` | Comma-separated glob patterns to ignore | - |
| \`require-consensus\` | Minimum models that must agree for blocking finding | - |
| \`max-cost\` | Maximum cost in USD for this review run | - |
| \`soft-fail\` | Report findings but always exit 0 | \`false\` |

### Action Outputs

| Output | Description |
|--------|-------------|
| \`findings-count\` | Number of findings detected |
| \`blocking-count\` | Number of blocking findings based on policy |
| \`policy-passed\` | Whether the policy evaluation passed |

### Example: Custom Configuration

\`\`\`yaml
- name: Review with AI Council
  uses: ./
  with:
    github-token: \${{ secrets.GITHUB_TOKEN }}
    anthropic-key: \${{ secrets.ANTHROPIC_API_KEY }}
    openai-key: \${{ secrets.OPENAI_API_KEY }}
    models: 'claude-sonnet-4,gpt-4o'
    fail-on: 'medium'
    require-consensus: 2
    max-cost: '0.50'
    ignore: '*.lock,dist/**'
    post-mode: 'both'
\`\`\`

## License

MIT
