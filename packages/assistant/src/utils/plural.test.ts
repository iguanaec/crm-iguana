import { describe, expect, it } from 'vitest';
import { days, plural, tasks } from './plural.js';

describe('plural', () => {
  it('usa el singular para uno', () => {
    expect(plural(1, 'cosa', 'cosas')).toBe('1 cosa');
    expect(days(1)).toBe('1 día');
    expect(tasks(1)).toBe('1 tarea');
  });

  it('usa el plural para el resto, incluido el cero', () => {
    expect(days(0)).toBe('0 días');
    expect(days(3)).toBe('3 días');
    expect(tasks(12)).toBe('12 tareas');
  });
});
