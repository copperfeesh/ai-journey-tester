import Anthropic from '@anthropic-ai/sdk';
import type { PageState, JourneyStep, AIStepInterpretation, BrowserAction, UXIssue } from './types.js';
import { withRetry, log } from './utils.js';
import { getConfig } from './config.js';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a browser test automation agent. You receive a page's accessibility tree and a natural language instruction. You must call the appropriate tool to execute the step.

Selector formats (in order of preference):
- role=button[name="Submit"] - role-based selectors from the accessibility tree
- label=Email - for labeled form fields
- placeholder=Search - for inputs with placeholder text
- text=Click here - for visible text
- css=#my-id - CSS selectors as last resort

Rules:
- You MUST call exactly one action tool per step
- For verification steps (verify, check, confirm, ensure), use assert_visible
- Pick the single most appropriate action tool for the instruction
- Also call report_ux_issues to report any UX/accessibility problems you notice`;

// Simple, flat tools that Haiku can handle
const TOOLS: Anthropic.Tool[] = [
  {
    name: 'click',
    description: 'Click an element on the page',
    input_schema: {
      type: 'object' as const,
      properties: {
        selector: { type: 'string', description: 'Element selector, e.g. role=button[name="Submit"]' },
        thinking: { type: 'string', description: 'Why you chose this action and selector' },
      },
      required: ['selector', 'thinking'],
    },
  },
  {
    name: 'fill',
    description: 'Type text into an input field',
    input_schema: {
      type: 'object' as const,
      properties: {
        selector: { type: 'string', description: 'Input field selector, e.g. role=searchbox[name="Search"]' },
        value: { type: 'string', description: 'Text to type into the field' },
        thinking: { type: 'string', description: 'Why you chose this action and selector' },
      },
      required: ['selector', 'value', 'thinking'],
    },
  },
  {
    name: 'select_option',
    description: 'Select an option from a dropdown',
    input_schema: {
      type: 'object' as const,
      properties: {
        selector: { type: 'string', description: 'Dropdown selector' },
        value: { type: 'string', description: 'Option value to select' },
        thinking: { type: 'string', description: 'Why you chose this action' },
      },
      required: ['selector', 'value', 'thinking'],
    },
  },
  {
    name: 'press_key',
    description: 'Press a keyboard key (Enter, Tab, Escape, etc.)',
    input_schema: {
      type: 'object' as const,
      properties: {
        key: { type: 'string', description: 'Key to press, e.g. Enter, Tab, Escape' },
        thinking: { type: 'string', description: 'Why you chose this action' },
      },
      required: ['key', 'thinking'],
    },
  },
  {
    name: 'navigate',
    description: 'Navigate to a URL',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'Full URL to navigate to' },
        thinking: { type: 'string', description: 'Why you chose this action' },
      },
      required: ['url', 'thinking'],
    },
  },
  {
    name: 'scroll',
    description: 'Scroll the page up or down',
    input_schema: {
      type: 'object' as const,
      properties: {
        direction: { type: 'string', enum: ['up', 'down'], description: 'Scroll direction' },
        thinking: { type: 'string', description: 'Why you chose this action' },
      },
      required: ['direction', 'thinking'],
    },
  },
  {
    name: 'hover',
    description: 'Hover over an element',
    input_schema: {
      type: 'object' as const,
      properties: {
        selector: { type: 'string', description: 'Element selector to hover over' },
        thinking: { type: 'string', description: 'Why you chose this action' },
      },
      required: ['selector', 'thinking'],
    },
  },
  {
    name: 'assert_visible',
    description: 'Verify that text or an element is visible on the page. Use for verification/check steps.',
    input_schema: {
      type: 'object' as const,
      properties: {
        text: { type: 'string', description: 'Text that should be visible on the page' },
        thinking: { type: 'string', description: 'Your assessment of whether the condition is met' },
      },
      required: ['text', 'thinking'],
    },
  },
  {
    name: 'report_ux_issues',
    description: 'Report UX, accessibility, or usability issues found on the current page',
    input_schema: {
      type: 'object' as const,
      properties: {
        score: { type: 'number', description: 'UX quality score from 1-10' },
        issues: { type: 'string', description: 'JSON array of issues, each with severity (critical/warning/info), category (accessibility/usability/error/performance/visual), description, and recommendation' },
        positives: { type: 'string', description: 'Comma-separated list of good UX patterns observed' },
      },
      required: ['score', 'issues', 'positives'],
    },
  },
];

function truncateAriaSnapshot(snapshot: string, maxLines: number = 150): string {
  const lines = snapshot.split('\n');
  if (lines.length <= maxLines) return snapshot;
  return lines.slice(0, maxLines).join('\n') + `\n... (truncated, ${lines.length - maxLines} more lines)`;
}

function buildPromptText(step: JourneyStep, pageState: PageState): string {
  const consoleMsgs = pageState.consoleMessages.length > 0
    ? pageState.consoleMessages.slice(-10).map(m => `[${m.type}] ${m.text}`).join('\n')
    : 'None';

  const networkErrs = pageState.networkErrors.length > 0
    ? pageState.networkErrors.slice(-5).map(e => `${e.method} ${e.url} -> ${e.status} ${e.statusText}`).join('\n')
    : 'None';

  const ariaSnapshot = truncateAriaSnapshot(pageState.ariaSnapshot);

  return `Page URL: ${pageState.url}
Page Title: ${pageState.title}

Accessibility Tree:
\`\`\`
${ariaSnapshot}
\`\`\`

Console: ${consoleMsgs}
Network Errors: ${networkErrs}

STEP: ${step.action}${step.description ? ` (${step.description})` : ''}

Call the appropriate action tool for this step. Also call report_ux_issues.`;
}

function isVisualStep(step: JourneyStep): boolean {
  const action = step.action.toLowerCase();
  return /\b(verify|check|confirm|ensure|assert|look|visual|layout|screenshot)\b/.test(action);
}

export async function interpretStep(
  step: JourneyStep,
  pageState: PageState,
  model?: string
): Promise<AIStepInterpretation> {
  return withRetry(async () => {
    const includeScreenshot = isVisualStep(step);
    log(`Sending step to Claude: "${step.action}" (screenshot: ${includeScreenshot})`);

    const userContent: Anthropic.MessageParam['content'] = [];

    if (includeScreenshot && pageState.screenshotBase64) {
      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: pageState.screenshotBase64,
        },
      });
    }

    userContent.push({
      type: 'text',
      text: buildPromptText(step, pageState),
    });

    const response = await client.messages.create({
      model: model ?? getConfig().model,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: [
        {
          role: 'user',
          content: userContent,
        },
      ],
    });

    // Extract all tool calls from the response
    const toolCalls = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    log(`Claude returned ${toolCalls.length} tool call(s): ${toolCalls.map(t => t.name).join(', ')}`);

    const actions: BrowserAction[] = [];
    let thinking = '';
    let uxAnalysis: AIStepInterpretation['uxAnalysis'] = { score: 5, issues: [], positives: [] };

    for (const call of toolCalls) {
      const inp = call.input as any;
      const callThinking = inp.thinking ?? '';
      if (callThinking) thinking = callThinking;

      log(`Tool: ${call.name} -> ${JSON.stringify(inp).substring(0, 200)}`);

      switch (call.name) {
        case 'click':
          actions.push({ type: 'click', selector: inp.selector, description: callThinking });
          break;
        case 'fill':
          actions.push({ type: 'fill', selector: inp.selector, value: inp.value, description: callThinking });
          break;
        case 'select_option':
          actions.push({ type: 'select', selector: inp.selector, value: inp.value, description: callThinking });
          break;
        case 'press_key':
          actions.push({ type: 'press_key', key: inp.key, description: callThinking });
          break;
        case 'navigate':
          actions.push({ type: 'navigate', url: inp.url, description: callThinking });
          break;
        case 'scroll':
          actions.push({ type: 'scroll', direction: inp.direction ?? 'down', description: callThinking });
          break;
        case 'hover':
          actions.push({ type: 'hover', selector: inp.selector, description: callThinking });
          break;
        case 'assert_visible':
          actions.push({ type: 'assert_visible', text: inp.text, description: callThinking });
          break;
        case 'report_ux_issues':
          uxAnalysis = parseUXReport(inp);
          break;
      }
    }

    // Also capture any text blocks as additional thinking
    const textBlocks = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(b => b.text);
    if (textBlocks.length > 0 && !thinking) {
      thinking = textBlocks.join('\n');
    }

    return { thinking, actions, uxAnalysis };
  });
}

function parseUXReport(inp: any): AIStepInterpretation['uxAnalysis'] {
  let issues: UXIssue[] = [];
  try {
    const parsed = typeof inp.issues === 'string' ? JSON.parse(inp.issues) : inp.issues;
    if (Array.isArray(parsed)) {
      issues = parsed.map((i: any) => ({
        severity: i.severity ?? 'info',
        category: i.category ?? 'usability',
        description: i.description ?? '',
        element: i.element,
        recommendation: i.recommendation,
      }));
    }
  } catch {
    if (typeof inp.issues === 'string' && inp.issues.trim()) {
      issues = [{ severity: 'info', category: 'usability', description: inp.issues }];
    }
  }

  const positives = typeof inp.positives === 'string'
    ? inp.positives.split(',').map((s: string) => s.trim()).filter(Boolean)
    : [];

  return {
    score: inp.score ?? 5,
    issues,
    positives,
  };
}
