# AI Journey Tester

Natural language browser journey testing powered by Claude AI. Write test steps in plain English — the AI figures out what to click, type, and verify.

## Prerequisites

- **Node.js 18+** — [Download](https://nodejs.org/)
- **Anthropic API key** — [Get one here](https://console.anthropic.com/settings/keys)

## Setup (Linux, macOS, Windows)

```bash
# 1. Clone the repo
git clone <repo-url>
cd ai-journey-tester

# 2. Install dependencies + Playwright browser
npm install

# 3. Configure your API key
cp .env.example .env
```

Then edit `.env` and replace the placeholder with your real key:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

> **Windows note:** Use `copy .env.example .env` instead of `cp` if not using Git Bash or WSL.

## Usage

### Interactive mode (no YAML file needed)

```bash
npx tsx src/cli.ts interactive
```

You'll be prompted for a URL and test steps. Options:

```bash
npx tsx src/cli.ts interactive --headed          # show the browser
npx tsx src/cli.ts interactive --verbose          # detailed logging
npx tsx src/cli.ts interactive --model claude-sonnet-4-5-20250929  # use a different model
```

### Run a YAML journey file

```bash
npx tsx src/cli.ts run journeys/example.yaml
npx tsx src/cli.ts run journeys/example.yaml --headed --verbose
```

### Validate a journey file (no execution)

```bash
npx tsx src/cli.ts validate journeys/example.yaml
```

## Writing Journey Files

Create a YAML file in `journeys/`:

```yaml
name: My Test
url: https://example.com

steps:
  - action: Verify the page loaded successfully
  - action: Click the login button
  - action: Type "user@example.com" into the email field
  - action: Verify a welcome message appears
```

Steps are plain English — the AI interprets them and drives the browser.

## CLI Options

| Option | Default | Description |
|---|---|---|
| `--headed` | `false` | Show the browser window |
| `--model <model>` | `claude-haiku-4-5-20251001` | Claude model to use |
| `--delay <seconds>` | `10` | Delay between steps (rate limit friendly) |
| `--output <dir>` | `./reports` | Report output directory |
| `--timeout <ms>` | `30000` | Timeout per step |
| `--verbose` | `false` | Detailed logging |
| `--retries <count>` | `1` | Retries per step on failure |
| `--base-url <url>` | — | Override the journey start URL (run only) |

## Reports

HTML reports are generated in `./reports/` after each run, including pass/fail status, UX scores, and screenshots.

## Troubleshooting

**"Could not resolve authentication method"**
Your API key is missing or invalid. Make sure `.env` contains a valid `ANTHROPIC_API_KEY`.

**Playwright browser not found**
Run `npx playwright install chromium` to install it manually.

**Windows: command not found**
Use `npx tsx src/cli.ts` instead of `./src/cli.ts`. If using PowerShell, ensure Node.js is in your PATH.
