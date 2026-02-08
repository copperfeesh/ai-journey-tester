export interface ValidationError {
  field: string;
  message: string;
}

export function validateJourneyData(data: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    errors.push({ field: 'name', message: 'Name is required.' });
  }

  if (!data.url || typeof data.url !== 'string' || !data.url.trim()) {
    errors.push({ field: 'url', message: 'URL is required.' });
  }

  if (!Array.isArray(data.steps) || data.steps.length === 0) {
    errors.push({ field: 'steps', message: 'At least one step is required.' });
  } else {
    for (let i = 0; i < data.steps.length; i++) {
      const step = data.steps[i] as Record<string, unknown>;
      if (!step.action || typeof step.action !== 'string' || !step.action.trim()) {
        errors.push({ field: `steps[${i}].action`, message: `Step ${i + 1} must have a non-empty action.` });
      }
    }
  }

  return errors;
}

export function validateSuiteData(data: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    errors.push({ field: 'name', message: 'Name is required.' });
  }

  if (!Array.isArray(data.journeys) || data.journeys.length === 0) {
    errors.push({ field: 'journeys', message: 'At least one journey is required.' });
  } else {
    for (let i = 0; i < data.journeys.length; i++) {
      const ref = data.journeys[i] as Record<string, unknown>;
      if (!ref.path || typeof ref.path !== 'string' || !ref.path.trim()) {
        errors.push({ field: `journeys[${i}].path`, message: `Journey ${i + 1} must have a path selected.` });
      }
    }
  }

  return errors;
}
