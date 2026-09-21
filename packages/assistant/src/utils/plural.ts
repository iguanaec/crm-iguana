/**
 * Concuerda el sustantivo con la cantidad. Los textos del asistente los lee una
 * persona, y "1 tarea(s)" delata que los escribió una plantilla.
 */
export function plural(count: number, singular: string, many: string): string {
  return `${count} ${count === 1 ? singular : many}`;
}

export function days(count: number): string {
  return plural(count, 'día', 'días');
}

export function tasks(count: number): string {
  return plural(count, 'tarea', 'tareas');
}
