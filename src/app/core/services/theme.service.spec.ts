import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('defaults to light theme when nothing is stored', () => {
    const service = new ThemeService();

    expect(service.theme()).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('toggle() switches to dark and applies the dark class to <html>', () => {
    const service = new ThemeService();

    service.toggle();

    expect(service.theme()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('toggle() persists the choice so a new instance picks it up', () => {
    const service = new ThemeService();

    service.toggle();
    const reloaded = new ThemeService();

    expect(reloaded.theme()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('toggling twice returns to light and removes the dark class', () => {
    const service = new ThemeService();

    service.toggle();
    service.toggle();

    expect(service.theme()).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
