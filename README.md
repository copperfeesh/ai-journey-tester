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

### Record a journey from browser interactions

Open a browser and record your clicks, typing, and navigation into a journey YAML file automatically:

```bash
npx tsx src/cli.ts record https://example.com
npx tsx src/cli.ts record https://example.com --name "Login Flow" --output journeys/login.yaml
```

A headed Chromium window will open at the given URL. Interact with the page normally — clicks, form fills, dropdown selections, scrolling, and page navigations are all captured. When you're done, press **Ctrl+C** in the terminal. The recorder will:

1. Coalesce raw events (e.g. a click on an input followed by typing becomes a single "Type into..." step)
2. Convert each interaction into a natural language step
3. Write the journey YAML file

| Option | Default | Description |
|---|---|---|
| `--name <name>` | `Recorded Journey` | Name for the journey |
| `--output <file>` | `journeys/<slugified-name>.yaml` | Output file path |

**What gets captured:**
- Clicks on buttons, links, and other elements
- Text typed into input fields and textareas
- Dropdown selections
- Page scrolling (coalesced — consecutive scrolls in the same direction become one step)
- Form submissions
- Page navigations

**Privacy:** Password field values are automatically redacted as `[password]`.

The generated YAML can be run immediately with `npx tsx src/cli.ts run` or edited further in the Web UI.

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

Steps are plain English — the AI interprets them and drives the browser. The AI can click, type, scroll, navigate, assert visibility, and wait for dynamic content to appear or disappear.

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
  - action: Wait for the search results to appear  # waits for dynamic content
```

For pages with dynamic content (AJAX, SPAs), write steps like "Wait for the results to load" or "Wait for the spinner to disappear". The AI uses Playwright's `waitFor()` under the hood, polling until the element reaches the desired state or the step times out.

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
| `--fallback-model <model>` | — | Fallback model if primary fails (see [Model Fallback](#model-fallback)) |
| `--delay <seconds>` | `10` | Delay between steps (rate limit friendly) |
| `--output <dir>` | `./reports` | Report output directory |
| `--timeout <ms>` | `30000` | Timeout per step |
| `--verbose` | `false` | Detailed logging |
| `--retries <count>` | `1` | Retries per step on failure |
| `--base-url <url>` | — | Override the journey start URL (run/suite) |
| `--var <key=value>` | — | Set a variable, repeatable |
| `--port <port>` | `3000` | Port for the web UI (ui only) |

## Model Fallback

If the primary model (e.g. Haiku) fails after all retries, a fallback model gets a second chance before the step errors out. This is useful when a cheaper/faster model handles most steps, but occasionally needs a smarter model for complex pages.

Set it via CLI:

```bash
npx tsx src/cli.ts run journeys/example.yaml --fallback-model claude-sonnet-4-5-20250929
```

Or in `.journeytester.yaml`:

```yaml
model: claude-haiku-4-5-20251001
fallbackModel: claude-sonnet-4-5-20250929
```

When the primary model fails, you'll see:

```
  Primary model (claude-haiku-4-5-20251001) failed, trying fallback: claude-sonnet-4-5-20250929
```

## Shared Browser Sessions (Suites)

By default, each journey in a suite gets a fresh browser — cookies and login state are not preserved. Set `sharedSession: true` to reuse a single browser context across all journeys in the suite:

```yaml
name: Authenticated Flow
sharedSession: true

journeys:
  - path: ../journeys/login.yaml
  - path: ../journeys/dashboard.yaml      # inherits login cookies
  - path: ../journeys/update-profile.yaml  # still logged in
```

This is useful for testing flows that depend on authentication or multi-step state that spans multiple journey files.

## Configuration File

Create a `.journeytester.yaml` in your project root to set defaults for all commands:

```yaml
model: claude-haiku-4-5-20251001
fallbackModel: claude-sonnet-4-5-20250929
delay: 10
timeout: 30000
retries: 1
outputDir: ./reports
headed: false
```

CLI options override config file values when both are provided.

## Reports

HTML reports are generated in `./reports/` after each run, including pass/fail status, UX scores, and screenshots.

## Troubleshooting

**"Could not resolve authentication method"**
Your API key is missing or invalid. Make sure `.env` contains a valid `ANTHROPIC_API_KEY`.

**Playwright browser not found**
Run `npx playwright install chromium` to install it manually.

**Windows: command not found**
Use `npx tsx src/cli.ts` instead of `./src/cli.ts`. If using PowerShell, ensure Node.js is in your PATH.
