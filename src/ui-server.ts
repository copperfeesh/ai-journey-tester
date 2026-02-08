import { readFileSync, writeFileSync, readdirSync, unlinkSync, existsSync, mkdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import express from 'express';
import * as yaml from 'yaml';
import { dashboardPage, journeyFormPage, suiteFormPage } from './ui-templates.js';
import { validateJourneyData, validateSuiteData } from './validation.js';
import { startJourneyRun, getJob, getActiveRun } from './run-manager.js';
import { getConfig } from './config.js';

const JOURNEYS_DIR = resolve('journeys');
const SUITES_DIR = resolve('suites');
const REPORTS_DIR = resolve(getConfig().outputDir);

// ── Helpers ──────────────────────────────────────────────────────────

function sanitizeFilename(name: string): string {
  // Strip path separators, reject traversal
  let clean = name.replace(/[/\\]/g, '').replace(/\.\./g, '');
  if (!clean.endsWith('.yaml')) clean += '.yaml';
  if (!clean || clean === '.yaml') throw new Error('Invalid filename');
  return clean;
}

function listYamlFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(f => f.endsWith('.yaml')).sort();
}

function readYaml(filePath: string): unknown {
  return yaml.parse(readFileSync(filePath, 'utf-8'));
}

function writeYaml(filePath: string, data: unknown): void {
  writeFileSync(filePath, yaml.stringify(data, { lineWidth: 120 }), 'utf-8');
}

export interface ReportSummary {
  filename: string;
  name: string;
  type: 'journey' | 'suite';
  timestamp: string;
  sizeKb: number;
}

function listReportFiles(): ReportSummary[] {
  if (!existsSync(REPORTS_DIR)) return [];
  return readdirSync(REPORTS_DIR)
    .filter(f => f.endsWith('.html'))
    .map(filename => {
      const filePath = join(REPORTS_DIR, filename);
      const stat = statSync(filePath);
      const isSuite = filename.startsWith('suite_');
      // Parse name from filename: name_2024-01-01T00-00-00.html
      const namepart = filename.replace(/\.html$/, '').replace(/_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/, '');
      const displayName = (isSuite ? namepart.replace(/^suite_/, '') : namepart).replace(/_/g, ' ');
      // Parse timestamp from filename
      const tsMatch = filename.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})\.html$/);
      const timestamp = tsMatch ? tsMatch[1].replace(/-/g, (m, i) => i > 9 ? ':' : m) : stat.mtime.toISOString();
      return {
        filename,
        name: displayName,
        type: isSuite ? 'suite' as const : 'journey' as const,
        timestamp,
        sizeKb: Math.round(stat.size / 1024),
      };
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

interface JourneyData {
  name: string;
  description?: string;
  url: string;
  viewport?: { width: number; height: number };
  variables?: Record<string, string>;
  steps: Array<{ action: string; description?: string; timeout?: number; waitAfter?: number }>;
}

interface SuiteData {
  name: string;
  description?: string;
  variables?: Record<string, string>;
  journeys: Array<{ path: string; variables?: Record<string, string> }>;
  sharedSession?: boolean;
}

/** Use string shorthand for steps that only have an action */
function normalizeSteps(steps: JourneyData['steps']): Array<string | Record<string, unknown>> {
  return steps.map(s => {
    if (!s.description && !s.timeout && !s.waitAfter) return s.action;
    const obj: Record<string, unknown> = { action: s.action };
    if (s.description) obj.description = s.description;
    if (s.timeout) obj.timeout = s.timeout;
    if (s.waitAfter) obj.waitAfter = s.waitAfter;
    return obj;
  });
}

/** Use string shorthand when journey ref has no variables */
function normalizeJourneyRefs(refs: SuiteData['journeys']): Array<string | Record<string, unknown>> {
  return refs.map(r => {
    if (!r.variables || Object.keys(r.variables).length === 0) return r.path;
    return { path: r.path, variables: r.variables };
  });
}

/** Convert journey filename to relative path for suite YAML */
function journeyFileToSuitePath(filename: string): string {
  return `../journeys/${filename}`;
}

/** Convert suite journey path back to just filename */
function suitePathToJourneyFile(path: string): string {
  return path.replace(/^.*[\\/]/, '');
}

/** Expand raw step data (may be string shorthand) into full objects */
function expandSteps(raw: unknown[]): JourneyData['steps'] {
  return raw.map(s => {
    if (typeof s === 'string') return { action: s };
    return s as JourneyData['steps'][0];
  });
}

/** Expand raw journey refs (may be string shorthand) */
function expandJourneyRefs(raw: unknown[]): SuiteData['journeys'] {
  return raw.map(r => {
    if (typeof r === 'string') return { path: r };
    return r as SuiteData['journeys'][0];
  });
}

// ── Server ───────────────────────────────────────────────────────────

export function startUIServer(port: number): void {
  const app = express();
  app.use(express.json());

  // Ensure directories exist
  if (!existsSync(JOURNEYS_DIR)) mkdirSync(JOURNEYS_DIR, { recursive: true });
  if (!existsSync(SUITES_DIR)) mkdirSync(SUITES_DIR, { recursive: true });
  if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });

  // Serve report HTML files as static assets
  app.use('/reports', express.static(REPORTS_DIR));

  // ── Page routes ──

  app.get('/', (_req, res) => {
    const journeys = listYamlFiles(JOURNEYS_DIR).map(filename => {
      try {
        const data = readYaml(join(JOURNEYS_DIR, filename)) as Record<string, unknown>;
        const steps = Array.isArray(data.steps) ? data.steps : [];
        return { filename, name: String(data.name || filename), url: String(data.url || ''), stepCount: steps.length };
      } catch {
        return { filename, name: filename, url: '(error reading)', stepCount: 0 };
      }
    });
    const suites = listYamlFiles(SUITES_DIR).map(filename => {
      try {
        const data = readYaml(join(SUITES_DIR, filename)) as Record<string, unknown>;
        const journeyList = Array.isArray(data.journeys) ? data.journeys : [];
        return { filename, name: String(data.name || filename), journeyCount: journeyList.length };
      } catch {
        return { filename, name: filename, journeyCount: 0 };
      }
    });
    const reports = listReportFiles();
    res.send(dashboardPage(journeys, suites, reports));
  });

  app.get('/journeys/new', (_req, res) => {
    res.send(journeyFormPage(null, null));
  });

  app.get('/journeys/:filename/edit', (req, res) => {
    const filename = req.params.filename;
    const filePath = join(JOURNEYS_DIR, filename);
    if (!existsSync(filePath)) { res.status(404).send('Not found'); return; }
    try {
      const raw = readYaml(filePath) as Record<string, unknown>;
      const journey: JourneyData = {
        name: String(raw.name || ''),
        description: raw.description ? String(raw.description) : undefined,
        url: String(raw.url || ''),
        viewport: raw.viewport as JourneyData['viewport'],
        variables: raw.variables as Record<string, string> | undefined,
        steps: expandSteps(Array.isArray(raw.steps) ? raw.steps : []),
      };
      res.send(journeyFormPage(journey, filename));
    } catch (e) {
      res.status(500).send('Error reading journey: ' + (e instanceof Error ? e.message : String(e)));
    }
  });

  app.get('/suites/new', (_req, res) => {
    const journeyFiles = listYamlFiles(JOURNEYS_DIR);
    res.send(suiteFormPage(null, null, journeyFiles));
  });

  app.get('/suites/:filename/edit', (req, res) => {
    const filename = req.params.filename;
    const filePath = join(SUITES_DIR, filename);
    if (!existsSync(filePath)) { res.status(404).send('Not found'); return; }
    try {
      const raw = readYaml(filePath) as Record<string, unknown>;
      const suite: SuiteData = {
        name: String(raw.name || ''),
        description: raw.description ? String(raw.description) : undefined,
        variables: raw.variables as Record<string, string> | undefined,
        journeys: expandJourneyRefs(Array.isArray(raw.journeys) ? raw.journeys : []),
        sharedSession: raw.sharedSession === true ? true : undefined,
      };
      const journeyFiles = listYamlFiles(JOURNEYS_DIR);
      res.send(suiteFormPage(suite, filename, journeyFiles));
    } catch (e) {
      res.status(500).send('Error reading suite: ' + (e instanceof Error ? e.message : String(e)));
    }
  });

  // ── API routes: Journeys ──

  app.get('/api/journeys', (_req, res) => {
    const list = listYamlFiles(JOURNEYS_DIR).map(filename => {
      try {
        const data = readYaml(join(JOURNEYS_DIR, filename)) as Record<string, unknown>;
        const steps = Array.isArray(data.steps) ? data.steps : [];
        return { filename, name: String(data.name || filename), url: String(data.url || ''), stepCount: steps.length };
      } catch {
        return { filename, name: filename, url: '', stepCount: 0 };
      }
    });
    res.json(list);
  });

  app.get('/api/journeys/:filename', (req, res) => {
    const filePath = join(JOURNEYS_DIR, req.params.filename);
    if (!existsSync(filePath)) { res.status(404).send('Not found'); return; }
    try {
      const raw = readYaml(filePath) as Record<string, unknown>;
      raw.steps = expandSteps(Array.isArray(raw.steps) ? raw.steps : []);
      res.json(raw);
    } catch (e) {
      res.status(500).send(String(e));
    }
  });

  app.post('/api/journeys', (req, res) => {
    try {
      const { data, filename: rawFilename } = req.body;
      const errors = validateJourneyData(data || {});
      if (errors.length > 0) { res.status(400).json({ errors }); return; }
      const filename = sanitizeFilename(rawFilename || data?._filename || '');
      const filePath = join(JOURNEYS_DIR, filename);
      if (existsSync(filePath)) { res.status(409).send('File already exists'); return; }
      const toWrite = buildJourneyYaml(data);
      writeYaml(filePath, toWrite);
      res.json({ filename });
    } catch (e) {
      res.status(400).send(e instanceof Error ? e.message : String(e));
    }
  });

  app.put('/api/journeys/:filename', (req, res) => {
    try {
      const filename = req.params.filename;
      const filePath = join(JOURNEYS_DIR, filename);
      if (!existsSync(filePath)) { res.status(404).send('Not found'); return; }
      const errors = validateJourneyData(req.body.data || {});
      if (errors.length > 0) { res.status(400).json({ errors }); return; }
      const toWrite = buildJourneyYaml(req.body.data);
      writeYaml(filePath, toWrite);
      res.json({ filename });
    } catch (e) {
      res.status(400).send(e instanceof Error ? e.message : String(e));
    }
  });

  app.delete('/api/journeys/:filename', (req, res) => {
    const filePath = join(JOURNEYS_DIR, req.params.filename);
    if (!existsSync(filePath)) { res.status(404).send('Not found'); return; }
    unlinkSync(filePath);
    res.json({ ok: true });
  });

  // ── API routes: Suites ──

  app.get('/api/suites', (_req, res) => {
    const list = listYamlFiles(SUITES_DIR).map(filename => {
      try {
        const data = readYaml(join(SUITES_DIR, filename)) as Record<string, unknown>;
        const journeys = Array.isArray(data.journeys) ? data.journeys : [];
        return { filename, name: String(data.name || filename), journeyCount: journeys.length };
      } catch {
        return { filename, name: filename, journeyCount: 0 };
      }
    });
    res.json(list);
  });

  app.get('/api/suites/:filename', (req, res) => {
    const filePath = join(SUITES_DIR, req.params.filename);
    if (!existsSync(filePath)) { res.status(404).send('Not found'); return; }
    try {
      const raw = readYaml(filePath) as Record<string, unknown>;
      raw.journeys = expandJourneyRefs(Array.isArray(raw.journeys) ? raw.journeys : []);
      res.json(raw);
    } catch (e) {
      res.status(500).send(String(e));
    }
  });

  app.post('/api/suites', (req, res) => {
    try {
      const { data, filename: rawFilename } = req.body;
      const errors = validateSuiteData(data || {});
      if (errors.length > 0) { res.status(400).json({ errors }); return; }
      const filename = sanitizeFilename(rawFilename || data?._filename || '');
      const filePath = join(SUITES_DIR, filename);
      if (existsSync(filePath)) { res.status(409).send('File already exists'); return; }
      const toWrite = buildSuiteYaml(data);
      writeYaml(filePath, toWrite);
      res.json({ filename });
    } catch (e) {
      res.status(400).send(e instanceof Error ? e.message : String(e));
    }
  });

  app.put('/api/suites/:filename', (req, res) => {
    try {
      const filename = req.params.filename;
      const filePath = join(SUITES_DIR, filename);
      if (!existsSync(filePath)) { res.status(404).send('Not found'); return; }
      const errors = validateSuiteData(req.body.data || {});
      if (errors.length > 0) { res.status(400).json({ errors }); return; }
      const toWrite = buildSuiteYaml(req.body.data);
      writeYaml(filePath, toWrite);
      res.json({ filename });
    } catch (e) {
      res.status(400).send(e instanceof Error ? e.message : String(e));
    }
  });

  app.delete('/api/suites/:filename', (req, res) => {
    const filePath = join(SUITES_DIR, req.params.filename);
    if (!existsSync(filePath)) { res.status(404).send('Not found'); return; }
    unlinkSync(filePath);
    res.json({ ok: true });
  });

  // ── Journey file list for suite picker ──

  app.get('/api/journey-files', (_req, res) => {
    res.json(listYamlFiles(JOURNEYS_DIR));
  });

  // ── API routes: Reports ──

  app.get('/api/reports', (_req, res) => {
    res.json(listReportFiles());
  });

  // ── API routes: Run ──

  app.post('/api/run/journey/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = join(JOURNEYS_DIR, filename);
    if (!existsSync(filePath)) { res.status(404).send('Journey not found'); return; }

    const active = getActiveRun();
    if (active) { res.status(409).json({ error: 'A run is already active', runId: active.id }); return; }

    const runId = startJourneyRun(filename);
    res.json({ runId });
  });

  app.get('/api/run/:id', (req, res) => {
    const job = getJob(req.params.id);
    if (!job) { res.status(404).json({ error: 'Run not found' }); return; }
    res.json(job);
  });

  // ── Start ──

  app.listen(port, () => {
    console.log(`\nAI Journey Tester UI running at http://localhost:${port}\n`);
  });
}

// ── Build YAML objects ───────────────────────────────────────────────

function buildJourneyYaml(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { name: data.name };
  if (data.description) out.description = data.description;
  out.url = data.url;
  if (data.viewport && typeof data.viewport === 'object') {
    const vp = data.viewport as { width?: number; height?: number };
    if (vp.width && vp.height) out.viewport = { width: vp.width, height: vp.height };
  }
  if (data.variables && typeof data.variables === 'object' && Object.keys(data.variables as object).length > 0) {
    out.variables = data.variables;
  }
  const rawSteps = Array.isArray(data.steps) ? data.steps : [];
  out.steps = normalizeSteps(rawSteps.map((s: Record<string, unknown>) => ({
    action: String(s.action || ''),
    description: s.description ? String(s.description) : undefined,
    timeout: s.timeout ? Number(s.timeout) : undefined,
    waitAfter: s.waitAfter ? Number(s.waitAfter) : undefined,
  })));
  return out;
}

function buildSuiteYaml(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { name: data.name };
  if (data.description) out.description = data.description;
  if (data.sharedSession === true) out.sharedSession = true;
  if (data.variables && typeof data.variables === 'object' && Object.keys(data.variables as object).length > 0) {
    out.variables = data.variables;
  }
  const rawJourneys = Array.isArray(data.journeys) ? data.journeys : [];
  out.journeys = normalizeJourneyRefs(rawJourneys.map((r: Record<string, unknown>) => ({
    path: journeyFileToSuitePath(suitePathToJourneyFile(String(r.path || ''))),
    variables: r.variables && typeof r.variables === 'object' && Object.keys(r.variables as object).length > 0
      ? r.variables as Record<string, string>
      : undefined,
  })));
  return out;
}
