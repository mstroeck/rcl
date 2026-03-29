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

## License

MIT
