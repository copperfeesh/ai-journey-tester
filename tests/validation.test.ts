import { describe, it, expect } from 'vitest';
import { validateJourneyData, validateSuiteData } from '../src/validation.js';

describe('validateJourneyData', () => {
  it('returns no errors for valid data', () => {
    const errors = validateJourneyData({
      name: 'Test',
      url: 'https://example.com',
      steps: [{ action: 'Click button' }],
    });
    expect(errors).toHaveLength(0);
  });

  it('requires name', () => {
    const errors = validateJourneyData({
      url: 'https://example.com',
      steps: [{ action: 'Click' }],
    });
    expect(errors).toContainEqual(expect.objectContaining({ field: 'name' }));
  });

  it('rejects empty name', () => {
    const errors = validateJourneyData({
      name: '  ',
      url: 'https://example.com',
      steps: [{ action: 'Click' }],
    });
    expect(errors).toContainEqual(expect.objectContaining({ field: 'name' }));
  });

  it('requires url', () => {
    const errors = validateJourneyData({
      name: 'Test',
      steps: [{ action: 'Click' }],
    });
    expect(errors).toContainEqual(expect.objectContaining({ field: 'url' }));
  });

  it('rejects empty url', () => {
    const errors = validateJourneyData({
      name: 'Test',
      url: '',
      steps: [{ action: 'Click' }],
    });
    expect(errors).toContainEqual(expect.objectContaining({ field: 'url' }));
  });

  it('requires steps array', () => {
    const errors = validateJourneyData({
      name: 'Test',
      url: 'https://example.com',
    });
    expect(errors).toContainEqual(expect.objectContaining({ field: 'steps' }));
  });

  it('rejects empty steps array', () => {
    const errors = validateJourneyData({
      name: 'Test',
      url: 'https://example.com',
      steps: [],
    });
    expect(errors).toContainEqual(expect.objectContaining({ field: 'steps' }));
  });

  it('rejects step with empty action', () => {
    const errors = validateJourneyData({
      name: 'Test',
      url: 'https://example.com',
      steps: [{ action: '' }],
    });
    expect(errors).toContainEqual(expect.objectContaining({ field: 'steps[0].action' }));
  });

  it('rejects step with missing action', () => {
    const errors = validateJourneyData({
      name: 'Test',
      url: 'https://example.com',
      steps: [{}],
    });
    expect(errors).toContainEqual(expect.objectContaining({ field: 'steps[0].action' }));
  });

  it('validates multiple steps independently', () => {
    const errors = validateJourneyData({
      name: 'Test',
      url: 'https://example.com',
      steps: [{ action: 'Click' }, { action: '' }, { action: 'Type' }],
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('steps[1].action');
  });

  it('returns multiple errors at once', () => {
    const errors = validateJourneyData({});
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe('validateSuiteData', () => {
  it('returns no errors for valid data', () => {
    const errors = validateSuiteData({
      name: 'My Suite',
      journeys: [{ path: 'journeys/test.yaml' }],
    });
    expect(errors).toHaveLength(0);
  });

  it('requires name', () => {
    const errors = validateSuiteData({
      journeys: [{ path: 'journeys/test.yaml' }],
    });
    expect(errors).toContainEqual(expect.objectContaining({ field: 'name' }));
  });

  it('requires journeys array', () => {
    const errors = validateSuiteData({
      name: 'Suite',
    });
    expect(errors).toContainEqual(expect.objectContaining({ field: 'journeys' }));
  });

  it('rejects empty journeys array', () => {
    const errors = validateSuiteData({
      name: 'Suite',
      journeys: [],
    });
    expect(errors).toContainEqual(expect.objectContaining({ field: 'journeys' }));
  });

  it('rejects journey with empty path', () => {
    const errors = validateSuiteData({
      name: 'Suite',
      journeys: [{ path: '' }],
    });
    expect(errors).toContainEqual(expect.objectContaining({ field: 'journeys[0].path' }));
  });
});
