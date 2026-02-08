import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { PageState, ConsoleMessage, NetworkError, BrowserAction } from './types.js';
import { log } from './utils.js';

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  consoleMessages: ConsoleMessage[];
  networkErrors: NetworkError[];
}

export async function launchBrowser(
  headed: boolean,
  viewport: { width: number; height: number }
): Promise<BrowserSession> {
  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();

  const consoleMessages: ConsoleMessage[] = [];
  const networkErrors: NetworkError[] = [];

  page.on('console', msg => {
    const type = msg.type() as string;
    const mapped = type === 'warn' ? 'warning' : type as ConsoleMessage['type'];
    consoleMessages.push({ type: mapped, text: msg.text() });
  });

  page.on('response', response => {
    if (response.status() >= 400) {
      networkErrors.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
        method: response.request().method(),
      });
    }
  });

  return { browser, context, page, consoleMessages, networkErrors };
}

export async function capturePageState(session: BrowserSession): Promise<PageState> {
  const { page, consoleMessages, networkErrors } = session;

  const [screenshotBuffer, ariaSnapshot, title] = await Promise.all([
    page.screenshot({ type: 'jpeg', fullPage: false, quality: 50 }),
    page.locator('body').ariaSnapshot().catch((e: Error) => {
      log(`ariaSnapshot failed: ${e.message}`);
      return 'Failed to capture accessibility snapshot';
    }),
    page.title(),
  ]);

  return {
    url: page.url(),
    title,
    ariaSnapshot,
    screenshotBase64: screenshotBuffer.toString('base64'),
    consoleMessages: [...consoleMessages],
    networkErrors: [...networkErrors],
    timestamp: Date.now(),
  };
}

export async function executeBrowserAction(
  page: Page,
  action: BrowserAction,
  timeout: number
): Promise<void> {
  log(`Executing: ${action.type} - ${action.description}`);

  switch (action.type) {
    case 'click': {
      const locator = resolveSelector(page, action.selector);
      await locator.click({ timeout });
      break;
    }
    case 'fill': {
      const locator = resolveSelector(page, action.selector);
      await locator.fill(action.value, { timeout });
      break;
    }
    case 'select': {
      const locator = resolveSelector(page, action.selector);
      await locator.selectOption(action.value, { timeout });
      break;
    }
    case 'press_key': {
      await page.keyboard.press(action.key);
      break;
    }
    case 'navigate': {
      await page.goto(action.url, { waitUntil: 'networkidle', timeout });
      break;
    }
    case 'wait': {
      await page.waitForTimeout(action.milliseconds);
      break;
    }
    case 'scroll': {
      const distance = action.amount ?? 500;
      await page.mouse.wheel(0, action.direction === 'down' ? distance : -distance);
      break;
    }
    case 'hover': {
      const locator = resolveSelector(page, action.selector);
      await locator.hover({ timeout });
      break;
    }
    case 'assert_visible': {
      // Try multiple strategies to find the text/element
      const text = action.text;
      // 1. Check getByText (visible text nodes)
      const byText = await page.getByText(text).first().isVisible().catch(() => false);
      if (byText) break;
      // 2. Check getByRole with name (buttons, headings, links, etc.)
      const byRole = await page.getByRole('heading', { name: text }).first().isVisible().catch(() => false);
      if (byRole) break;
      // 3. Check alt text, title, aria-label, placeholder (images, icons, inputs)
      const escapedText = text.replace(/"/g, '\\"');
      const byAttr = await page.locator(`[alt*="${escapedText}" i], [title*="${escapedText}" i], [aria-label*="${escapedText}" i], [placeholder*="${escapedText}" i]`).first().isVisible().catch(() => false);
      if (byAttr) break;
      // 4. Check form fields by label or placeholder
      const byLabel = await page.getByLabel(text).first().isVisible().catch(() => false);
      if (byLabel) break;
      const byPlaceholder = await page.getByPlaceholder(text).first().isVisible().catch(() => false);
      if (byPlaceholder) break;
      // 4. Check full page text content (includes hidden text, but catches edge cases)
      const bodyText = await page.textContent('body') ?? '';
      if (bodyText.toLowerCase().includes(text.toLowerCase())) break;
      // 5. Check page title
      const title = await page.title();
      if (title.toLowerCase().includes(text.toLowerCase())) break;

      throw new Error(`Assertion failed: expected "${text}" to be visible on the page`);
    }
    case 'assert_text': {
      const text = action.text;
      const content = await page.textContent('body') ?? '';
      const title = await page.title();
      const combined = `${title} ${content}`;
      if (!combined.toLowerCase().includes(text.toLowerCase())) {
        throw new Error(`Assertion failed: page does not contain text "${text}"`);
      }
      break;
    }
  }
}

function resolveSelector(page: Page, selector: string) {
  // role=button[name="Submit"]
  const roleMatch = selector.match(/^role=(\w+)\[name="(.+)"\]$/);
  if (roleMatch) {
    return page.getByRole(roleMatch[1] as any, { name: roleMatch[2] });
  }

  // role=button (no name)
  const roleOnly = selector.match(/^role=(\w+)$/);
  if (roleOnly) {
    return page.getByRole(roleOnly[1] as any);
  }

  // text=Click here
  if (selector.startsWith('text=')) {
    return page.getByText(selector.slice(5));
  }

  // label=Email
  if (selector.startsWith('label=')) {
    return page.getByLabel(selector.slice(6));
  }

  // placeholder=Enter email
  if (selector.startsWith('placeholder=')) {
    return page.getByPlaceholder(selector.slice(12));
  }

  // css=#my-id
  if (selector.startsWith('css=')) {
    return page.locator(selector.slice(4));
  }

  // Handle Haiku's common non-standard formats:
  // link[text="Insure"], button[text="Submit"], etc.
  const tagTextMatch = selector.match(/^(\w+)\[text="(.+)"\]$/);
  if (tagTextMatch) {
    const [, tag, text] = tagTextMatch;
    const roleMap: Record<string, string> = {
      link: 'link', button: 'button', heading: 'heading',
      input: 'textbox', a: 'link', h1: 'heading', h2: 'heading',
    };
    const role = roleMap[tag];
    if (role) {
      return page.getByRole(role as any, { name: text });
    }
    return page.getByText(text);
  }

  // If it looks like plain text (no special chars), try getByText
  if (/^[a-zA-Z0-9 .,!?'"()-]+$/.test(selector) && !selector.includes('.') && !selector.includes('#')) {
    return page.getByText(selector);
  }

  // Default: treat as CSS selector
  return page.locator(selector);
}
