import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import * as yaml from 'yaml';
import { validateNavigationUrl } from './utils.js';

interface RawEvent {
  type: 'click' | 'input' | 'select' | 'scroll' | 'submit' | 'navigation';
  timestamp: number;
  tag?: string;
  text?: string;
  role?: string;
  ariaLabel?: string;
  placeholder?: string;
  value?: string;
  isPassword?: boolean;
  direction?: 'up' | 'down';
  url?: string;
}

// Script injected into the page to capture user interactions
const INJECTED_SCRIPT = `
(function() {
  if (window.__journeyRecorderActive) return;
  window.__journeyRecorderActive = true;

  var inputTimer = null;
  var scrollTimer = null;
  var lastScrollY = window.scrollY;

  function describeElement(el) {
    return {
      tag: el.tagName.toLowerCase(),
      text: (el.textContent || '').trim().substring(0, 100),
      role: el.getAttribute('role') || el.tagName.toLowerCase(),
      ariaLabel: el.getAttribute('aria-label') || '',
      placeholder: el.getAttribute('placeholder') || '',
      type: el.getAttribute('type') || '',
    };
  }

  document.addEventListener('click', function(e) {
    if (e.button !== 0) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    var el = e.target;
    var desc = describeElement(el);
    window.__onRecordedEvent(JSON.stringify({
      type: 'click',
      timestamp: Date.now(),
      tag: desc.tag,
      text: desc.text,
      role: desc.role,
      ariaLabel: desc.ariaLabel,
      placeholder: desc.placeholder,
    }));
  }, true);

  document.addEventListener('input', function(e) {
    var el = e.target;
    if (!el || !el.tagName) return;
    clearTimeout(inputTimer);
    var isPassword = (el.type === 'password');
    var desc = describeElement(el);
    inputTimer = setTimeout(function() {
      window.__onRecordedEvent(JSON.stringify({
        type: 'input',
        timestamp: Date.now(),
        tag: desc.tag,
        text: desc.ariaLabel || desc.placeholder || el.name || '',
        ariaLabel: desc.ariaLabel,
        placeholder: desc.placeholder,
        value: isPassword ? '***' : el.value,
        isPassword: isPassword,
      }));
    }, 800);
  }, true);

  document.addEventListener('change', function(e) {
    var el = e.target;
    if (!el || el.tagName.toLowerCase() !== 'select') return;
    var option = el.options[el.selectedIndex];
    var desc = describeElement(el);
    window.__onRecordedEvent(JSON.stringify({
      type: 'select',
      timestamp: Date.now(),
      tag: 'select',
      text: desc.ariaLabel || desc.placeholder || el.name || '',
      ariaLabel: desc.ariaLabel,
      value: option ? option.text : el.value,
    }));
  }, true);

  window.addEventListener('scroll', function() {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function() {
      var dir = window.scrollY > lastScrollY ? 'down' : 'up';
      lastScrollY = window.scrollY;
      window.__onRecordedEvent(JSON.stringify({
        type: 'scroll',
        timestamp: Date.now(),
        direction: dir,
      }));
    }, 500);
  }, true);

  document.addEventListener('submit', function(e) {
    window.__onRecordedEvent(JSON.stringify({
      type: 'submit',
      timestamp: Date.now(),
      tag: 'form',
    }));
  }, true);
})();
`;

function elementDescription(event: RawEvent): string {
  if (event.ariaLabel) return `'${event.ariaLabel}'`;
  if (event.placeholder) return `'${event.placeholder}'`;
  const text = event.text?.replace(/\n/g, ' ').trim();
  if (text && text.length <= 60) return `'${text}'`;
  return `the ${event.tag || 'element'}`;
}

function roleLabel(event: RawEvent): string {
  const tag = event.tag?.toLowerCase() || '';
  if (tag === 'a' || event.role === 'link') return 'link';
  if (tag === 'button' || event.role === 'button') return 'button';
  if (tag === 'input' || tag === 'textarea') return 'field';
  if (tag === 'select') return 'dropdown';
  if (/^h[1-6]$/.test(tag)) return 'heading';
  if (tag === 'img') return 'image';
  return tag;
}

function toNaturalLanguage(event: RawEvent): string {
  switch (event.type) {
    case 'click': {
      const role = roleLabel(event);
      const desc = elementDescription(event);
      if (role === 'link') return `Click the ${desc} link`;
      if (role === 'button') return `Click the ${desc} button`;
      return `Click on ${desc}`;
    }
    case 'input': {
      const desc = elementDescription(event);
      const val = event.isPassword ? '[password]' : event.value ?? '';
      return `Type '${val}' into the ${desc} field`;
    }
    case 'select': {
      const desc = elementDescription(event);
      return `Select '${event.value}' from the ${desc} dropdown`;
    }
    case 'scroll':
      return `Scroll ${event.direction || 'down'} the page`;
    case 'navigation':
      return `Navigate to ${event.url}`;
    case 'submit':
      return 'Submit the form';
    default:
      return `Perform ${event.type}`;
  }
}

function coalesceEvents(events: RawEvent[]): RawEvent[] {
  const result: RawEvent[] = [];

  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    // Coalesce click-on-input + subsequent input into one input event
    if (event.type === 'click') {
      const next = events[i + 1];
      if (next && next.type === 'input' && next.timestamp - event.timestamp < 2000) {
        // Skip the click, the input event captures the intent
        continue;
      }
    }

    // Coalesce consecutive scrolls in the same direction
    if (event.type === 'scroll') {
      const prev = result[result.length - 1];
      if (prev && prev.type === 'scroll' && prev.direction === event.direction) {
        // Skip — already have a scroll in this direction
        continue;
      }
    }

    result.push(event);
  }

  return result;
}

export interface RecordOptions {
  url: string;
  name: string;
  output: string;
}

export async function recordJourney(options: RecordOptions): Promise<string> {
  const { url, name, output } = options;
  const rawEvents: RawEvent[] = [];
  let startUrl = url;

  console.log(`\nStarting recording session...`);
  console.log(`Opening: ${url}`);
  console.log(`\nInteract with the page. Press Ctrl+C when done.\n`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // Bridge function: page JS -> Node
  await page.exposeFunction('__onRecordedEvent', (data: string) => {
    try {
      const event: RawEvent = JSON.parse(data);
      rawEvents.push(event);
      const desc = toNaturalLanguage(event);
      console.log(`  [${rawEvents.length}] ${desc}`);
    } catch {
      // Ignore parse errors from page
    }
  });

  // Inject the listener script — survives navigations
  await page.addInitScript(INJECTED_SCRIPT);

  // Capture navigation events (after initial load)
  let initialNavDone = false;
  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame()) return;
    const navUrl = frame.url();
    if (!initialNavDone) {
      initialNavDone = true;
      startUrl = navUrl;
      return; // Skip initial navigation
    }
    // Skip about:blank and similar
    if (navUrl.startsWith('about:') || navUrl === startUrl) return;
    rawEvents.push({
      type: 'navigation',
      timestamp: Date.now(),
      url: navUrl,
    });
    console.log(`  [${rawEvents.length}] Navigate to ${navUrl}`);
  });

  validateNavigationUrl(url);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

  // Wait for Ctrl+C
  await new Promise<void>((resolve) => {
    const handler = () => {
      process.removeListener('SIGINT', handler);
      resolve();
    };
    process.on('SIGINT', handler);
  });

  console.log(`\n\nRecording stopped. Captured ${rawEvents.length} raw events.`);

  await browser.close();

  // Coalesce and convert
  const coalesced = coalesceEvents(rawEvents);
  const steps = coalesced.map(e => toNaturalLanguage(e));

  if (steps.length === 0) {
    console.log('No interactions recorded. No file written.');
    return '';
  }

  const journey = {
    name,
    url: startUrl,
    steps: steps.map(action => ({ action })),
  };

  const yamlContent = yaml.stringify(journey);

  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, yamlContent);

  console.log(`\nJourney saved: ${output}`);
  console.log(`Steps: ${steps.length}`);
  steps.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));

  return output;
}
