import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { JourneyResult, StepResult } from './types.js';
import { escapeHtml } from './utils.js';

const REPORT_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; line-height: 1.6; }
  header { background: #1a1a2e; color: white; padding: 2rem; }
  header h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
  header .description { opacity: 0.8; font-size: 0.9rem; margin-bottom: 1rem; }
  .summary { display: flex; gap: 1rem; flex-wrap: wrap; }
  .stat { background: rgba(255,255,255,0.1); padding: 0.75rem 1.25rem; border-radius: 8px; text-align: center; min-width: 100px; }
  .stat .label { display: block; font-size: 0.75rem; opacity: 0.7; text-transform: uppercase; }
  .stat .value { display: block; font-size: 1.5rem; font-weight: bold; }
  .stat.passed .value { color: #4caf50; }
  .stat.failed .value { color: #f44336; }
  .stat.warning .value { color: #ff9800; }
  main { max-width: 1200px; margin: 2rem auto; padding: 0 1rem; }
  .step { background: white; border-radius: 8px; margin-bottom: 1rem; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .step-header { display: flex; align-items: center; gap: 0.75rem; padding: 1rem 1.25rem; cursor: pointer; user-select: none; }
  .step-header:hover { background: #fafafa; }
  .step-number { background: #e0e0e0; color: #555; width: 2rem; height: 2rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: bold; flex-shrink: 0; }
  .step.passed .step-number { background: #e8f5e9; color: #2e7d32; }
  .step.failed .step-number { background: #ffebee; color: #c62828; }
  .step.warning .step-number { background: #fff3e0; color: #e65100; }
  .step-action { flex: 1; font-weight: 500; }
  .badge { padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.75rem; font-weight: bold; text-transform: uppercase; }
  .badge.passed { background: #e8f5e9; color: #2e7d32; }
  .badge.failed { background: #ffebee; color: #c62828; }
  .badge.warning { background: #fff3e0; color: #e65100; }
  .duration { font-size: 0.8rem; color: #999; }
  .step-body { padding: 0 1.25rem 1.25rem; display: none; }
  .step:not(.collapsed) .step-body { display: block; }
  .step.collapsed .step-body { display: none; }
  .screenshots { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
  .screenshot h4 { font-size: 0.8rem; color: #666; margin-bottom: 0.5rem; }
  .screenshot img { width: 100%; border: 1px solid #e0e0e0; border-radius: 4px; }
  .thinking { margin-bottom: 1rem; }
  .thinking summary { font-weight: 500; cursor: pointer; color: #666; font-size: 0.9rem; }
  .thinking p { margin-top: 0.5rem; font-size: 0.85rem; color: #555; background: #f9f9f9; padding: 0.75rem; border-radius: 4px; white-space: pre-wrap; }
  .actions { margin-bottom: 1rem; }
  .actions h4 { font-size: 0.85rem; color: #666; margin-bottom: 0.5rem; }
  .actions ol { padding-left: 1.5rem; }
  .actions li { font-size: 0.85rem; margin-bottom: 0.25rem; }
  .actions code { background: #f0f0f0; padding: 0.1rem 0.4rem; border-radius: 3px; font-size: 0.8rem; }
  .error-box { background: #ffebee; border: 1px solid #ef9a9a; border-radius: 4px; padding: 0.75rem; margin-bottom: 1rem; color: #c62828; font-size: 0.85rem; }
  .ux-analysis h4 { font-size: 0.85rem; color: #666; margin-bottom: 0.5rem; }
  .ux-issue { border-left: 3px solid #ccc; padding: 0.5rem 0.75rem; margin-bottom: 0.5rem; font-size: 0.85rem; background: #fafafa; border-radius: 0 4px 4px 0; }
  .ux-issue.critical { border-color: #f44336; background: #fff5f5; }
  .ux-issue.warning { border-color: #ff9800; background: #fffaf0; }
  .ux-issue.info { border-color: #2196f3; background: #f5f9ff; }
  .severity-badge { font-size: 0.7rem; font-weight: bold; text-transform: uppercase; margin-right: 0.5rem; }
  .ux-issue.critical .severity-badge { color: #c62828; }
  .ux-issue.warning .severity-badge { color: #e65100; }
  .ux-issue.info .severity-badge { color: #1565c0; }
  .category { font-size: 0.7rem; color: #999; text-transform: uppercase; }
  .recommendation { margin-top: 0.25rem; color: #555; font-style: italic; }
  .ux-positives { margin-top: 0.75rem; }
  .ux-positives h5 { font-size: 0.8rem; color: #2e7d32; margin-bottom: 0.25rem; }
  .ux-positives li { font-size: 0.85rem; color: #555; }
  .footer { text-align: center; padding: 2rem; color: #999; font-size: 0.8rem; }
`;

function renderStep(step: StepResult, index: number): string {
  const issuesHtml = step.interpretation.uxAnalysis.issues.map(issue => `
    <div class="ux-issue ${escapeHtml(issue.severity)}">
      <span class="severity-badge">${escapeHtml(issue.severity)}</span>
      <span class="category">${escapeHtml(issue.category)}</span>
      <p>${escapeHtml(issue.description)}</p>
      ${issue.recommendation ? `<p class="recommendation">${escapeHtml(issue.recommendation)}</p>` : ''}
    </div>
  `).join('');

  const positivesHtml = step.interpretation.uxAnalysis.positives.length > 0 ? `
    <div class="ux-positives">
      <h5>Positive Observations</h5>
      <ul>${step.interpretation.uxAnalysis.positives.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
    </div>
  ` : '';

  const actionsHtml = step.interpretation.actions.map(a =>
    `<li><code>${escapeHtml(a.type)}</code> - ${escapeHtml(a.description)}</li>`
  ).join('');

  const beforeImg = step.pageStateBefore.screenshotBase64
    ? `<img src="data:image/jpeg;base64,${step.pageStateBefore.screenshotBase64}" alt="Before" />`
    : '<p>No screenshot</p>';

  const afterImg = step.pageStateAfter.screenshotBase64
    ? `<img src="data:image/jpeg;base64,${step.pageStateAfter.screenshotBase64}" alt="After" />`
    : '<p>No screenshot</p>';

  return `
  <section class="step ${escapeHtml(step.status)} collapsed">
    <div class="step-header">
      <span class="step-number">${index + 1}</span>
      <span class="step-action">${escapeHtml(step.action)}</span>
      <span class="badge ${escapeHtml(step.status)}">${escapeHtml(step.status)}</span>
      <span class="duration">${step.durationMs}ms</span>
    </div>
    <div class="step-body">
      <div class="screenshots">
        <div class="screenshot">
          <h4>Before</h4>
          ${beforeImg}
        </div>
        <div class="screenshot">
          <h4>After</h4>
          ${afterImg}
        </div>
      </div>

      <details class="thinking">
        <summary>AI Reasoning</summary>
        <p>${escapeHtml(step.interpretation.thinking)}</p>
      </details>

      ${actionsHtml ? `
      <div class="actions">
        <h4>Actions Performed</h4>
        <ol>${actionsHtml}</ol>
      </div>` : ''}

      ${step.error ? `<div class="error-box"><strong>Error:</strong> ${escapeHtml(step.error)}</div>` : ''}

      <div class="ux-analysis">
        <h4>UX Analysis (Score: ${step.interpretation.uxAnalysis.score}/10)</h4>
        ${issuesHtml || '<p style="font-size: 0.85rem; color: #999;">No issues found</p>'}
        ${positivesHtml}
      </div>
    </div>
  </section>`;
}

export function generateReport(result: JourneyResult, outputDir: string): string {
  mkdirSync(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const safeName = result.journey.name.replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase();
  const filename = `${safeName}_${timestamp}.html`;
  const outputPath = join(outputDir, filename);

  const stepsHtml = result.steps.map((step, i) => renderStep(step, i)).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Journey Report: ${escapeHtml(result.journey.name)}</title>
  <style>${REPORT_CSS}</style>
</head>
<body>
  <header>
    <h1>${escapeHtml(result.journey.name)}</h1>
    ${result.journey.description ? `<p class="description">${escapeHtml(result.journey.description)}</p>` : ''}
    <div class="summary">
      <div class="stat ${result.status}">
        <span class="label">Status</span>
        <span class="value">${result.status.toUpperCase()}</span>
      </div>
      <div class="stat">
        <span class="label">Steps</span>
        <span class="value">${result.summary.totalSteps}</span>
      </div>
      <div class="stat passed">
        <span class="label">Passed</span>
        <span class="value">${result.summary.passed}</span>
      </div>
      <div class="stat failed">
        <span class="label">Failed</span>
        <span class="value">${result.summary.failed}</span>
      </div>
      <div class="stat warning">
        <span class="label">Warnings</span>
        <span class="value">${result.summary.warnings}</span>
      </div>
      <div class="stat">
        <span class="label">UX Score</span>
        <span class="value">${result.summary.overallUXScore}/10</span>
      </div>
      <div class="stat">
        <span class="label">UX Issues</span>
        <span class="value">${result.summary.uxIssuesFound}</span>
      </div>
      <div class="stat">
        <span class="label">Duration</span>
        <span class="value">${(result.totalDurationMs / 1000).toFixed(1)}s</span>
      </div>
    </div>
  </header>

  <main>
    ${stepsHtml}
  </main>

  <div class="footer">
    Generated ${result.completedAt} | AI Journey Tester
  </div>

  <script>
    document.querySelectorAll('.step-header').forEach(header => {
      header.addEventListener('click', () => {
        header.parentElement.classList.toggle('collapsed');
      });
    });
  </script>
</body>
</html>`;

  writeFileSync(outputPath, html);
  return outputPath;
}
