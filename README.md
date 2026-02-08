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

### Web UI

Launch a local web interface to create, edit, and delete journey and suite files through structured forms — no YAML editing required:

```bash
npm run ui                # starts on port 3000
npx tsx src/cli.ts ui --port 8080  # custom port
```

Open [http://localhost:3000](http://localhost:3000) in your browser. From the dashboard you can:

- View all journeys and suites at a glance
- Create new journeys with a step builder (add, remove, reorder steps)
- Create suites by picking from existing journey files
- Edit journey/suite fields, variables, and steps via forms
- Delete journeys and suites

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

### Run a test suite (multiple journeys)

```bash
npx tsx src/cli.ts suite suites/smoke-test.yaml
npx tsx src/cli.ts suite suites/smoke-test.yaml --headed --var base_url=https://example.com
```

## Writing Journey Files

Create a YAML file in `journeys/` (or use the [Web UI](#web-ui)):

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

### Variables

Journeys support variable substitution with `{{varName}}` placeholders:

```yaml
name: Search Test
url: "{{base_url}}"
variables:
  base_url: https://en.wikipedia.org
  search_term: quantum computing

steps:
  - action: Type "{{search_term}}" into the search box
```

Override variables from the CLI with `--var key=value`. Use `{{env:VAR_NAME}}` to read from environment variables.

### Step options

Steps can include optional fields:

```yaml
steps:
  - action: Click the submit button
    description: Submit the registration form
    timeout: 60000      # step-specific timeout in ms
    waitAfter: 2000     # wait after step completes in ms
  - action: pause "Check the page manually"   # pauses for manual inspection
```

## Writing Suite Files

Create a YAML file in `suites/` (or use the [Web UI](#web-ui)):

```yaml
name: Smoke Test Suite
description: Runs multiple journeys with shared variables
variables:
  base_url: https://en.wikipedia.org

journeys:
  - path: ../journeys/variables-test.yaml
    variables:
      search_term: machine learning   # override journey variables
  - path: ../journeys/quick-test.yaml
```

Suite-level variables are inherited by all journeys. Per-journey variables take precedence.

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
| `--base-url <url>` | — | Override the journey start URL (run/suite) |
| `--var <key=value>` | — | Set a variable, repeatable |
| `--port <port>` | `3000` | Port for the web UI (ui only) |

## Reports

HTML reports are generated in `./reports/` after each run, including pass/fail status, UX scores, and screenshots.

## Troubleshooting

**"Could not resolve authentication method"**
Your API key is missing or invalid. Make sure `.env` contains a valid `ANTHROPIC_API_KEY`.

**Playwright browser not found**
Run `npx playwright install chromium` to install it manually.

**Windows: command not found**
Use `npx tsx src/cli.ts` instead of `./src/cli.ts`. If using PowerShell, ensure Node.js is in your PATH.
