import { describe, it, expect, vi } from 'vitest';
import { resolveSelector } from '../src/browser.js';

// Create a mock page object that tracks which methods are called
function createMockPage() {
  const locator = { kind: 'locator' };

  return {
    getByRole: vi.fn().mockReturnValue(locator),
    getByText: vi.fn().mockReturnValue(locator),
    getByLabel: vi.fn().mockReturnValue(locator),
    getByPlaceholder: vi.fn().mockReturnValue(locator),
    locator: vi.fn().mockReturnValue(locator),
    _locator: locator,
  };
}

describe('resolveSelector', () => {
  it('handles role=button[name="Submit"]', () => {
    const page = createMockPage();
    resolveSelector(page as any, 'role=button[name="Submit"]');
    expect(page.getByRole).toHaveBeenCalledWith('button', { name: 'Submit' });
  });

  it('handles role=heading[name="Title"]', () => {
    const page = createMockPage();
    resolveSelector(page as any, 'role=heading[name="Title"]');
    expect(page.getByRole).toHaveBeenCalledWith('heading', { name: 'Title' });
  });

  it('handles role-only selectors like role=button', () => {
    const page = createMockPage();
    resolveSelector(page as any, 'role=button');
    expect(page.getByRole).toHaveBeenCalledWith('button');
  });

  it('handles text= selectors', () => {
    const page = createMockPage();
    resolveSelector(page as any, 'text=Click here');
    expect(page.getByText).toHaveBeenCalledWith('Click here');
  });

  it('handles label= selectors', () => {
    const page = createMockPage();
    resolveSelector(page as any, 'label=Email');
    expect(page.getByLabel).toHaveBeenCalledWith('Email');
  });

  it('handles placeholder= selectors', () => {
    const page = createMockPage();
    resolveSelector(page as any, 'placeholder=Enter email');
    expect(page.getByPlaceholder).toHaveBeenCalledWith('Enter email');
  });

  it('handles css= selectors', () => {
    const page = createMockPage();
    resolveSelector(page as any, 'css=#my-id');
    expect(page.locator).toHaveBeenCalledWith('#my-id');
  });

  it('handles ARIA snapshot style: link "About"', () => {
    const page = createMockPage();
    resolveSelector(page as any, 'link "About"');
    expect(page.getByRole).toHaveBeenCalledWith('link', { name: 'About' });
  });

  it('handles ARIA snapshot style: button "Submit"', () => {
    const page = createMockPage();
    resolveSelector(page as any, 'button "Submit"');
    expect(page.getByRole).toHaveBeenCalledWith('button', { name: 'Submit' });
  });

  it('handles ARIA snapshot style: heading "Title"', () => {
    const page = createMockPage();
    resolveSelector(page as any, 'heading "Title"');
    expect(page.getByRole).toHaveBeenCalledWith('heading', { name: 'Title' });
  });

  it('strips text= prefix inside ARIA style quotes', () => {
    const page = createMockPage();
    resolveSelector(page as any, 'link "text=(Top)"');
    expect(page.getByRole).toHaveBeenCalledWith('link', { name: '(Top)' });
  });

  it('handles Haiku style: link[text="About"]', () => {
    const page = createMockPage();
    resolveSelector(page as any, 'link[text="About"]');
    expect(page.getByRole).toHaveBeenCalledWith('link', { name: 'About' });
  });

  it('handles Haiku style: button[text="Submit"]', () => {
    const page = createMockPage();
    resolveSelector(page as any, 'button[text="Submit"]');
    expect(page.getByRole).toHaveBeenCalledWith('button', { name: 'Submit' });
  });

  it('falls back to CSS selector for complex selectors', () => {
    const page = createMockPage();
    resolveSelector(page as any, 'div.container > span');
    expect(page.locator).toHaveBeenCalledWith('div.container > span');
  });

  it('uses getByText for plain text without special chars', () => {
    const page = createMockPage();
    resolveSelector(page as any, 'Hello World');
    expect(page.getByText).toHaveBeenCalledWith('Hello World');
  });
});
