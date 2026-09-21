import type { ManualPriority, ParsedTaskDraft } from '@crm/types';

export interface ParseOptions {
  /** Nombres del equipo, para reconocer a quien se asigna sin adivinar. */
  teamMembers?: Array<{ id: string; name: string }>;
  now?: Date;
}

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

const PRIORITY_PATTERNS: Array<{ re: RegExp; priority: ManualPriority }> = [
  { re: /\b(urgent[ei]s?|asap|cr[ií]tic[oa]s?|inmediat[oa]s?|ya mismo|para ayer)\b/i, priority: 5 },
  { re: /\b(important[ei]s?|priorit[ai]ri[oa]s?|cuanto antes|pronto)\b/i, priority: 4 },
  { re: /\b(normal|regular|est[aá]ndar)\b/i, priority: 3 },
  { re: /\b(cuando pued[ao]s?|sin prisa|sin apuro|tranquil[oa])\b/i, priority: 2 },
  { re: /\b(backlog|alg[uú]n d[ií]a|eventualmente|a futuro|baja prioridad)\b/i, priority: 1 },
];

const DURATION_RE = /\b(?:toma|dura|estimad[oa] en|en)?\s*(\d+(?:[.,]\d+)?)\s*(horas?|hrs?|h|minutos?|mins?|d[ií]as?)\b/i;

/** Quita diacriticos para comparar palabras, sin tocar el texto que se mostrara. */
function fold(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function atUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  const next = atUtcMidnight(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** Proximo dia de semana. Si coincide con hoy, se entiende la semana siguiente. */
function nextWeekday(from: Date, weekday: number): Date {
  const current = atUtcMidnight(from).getUTCDay();
  const delta = (weekday - current + 7) % 7;
  return addDays(from, delta === 0 ? 7 : delta);
}

interface Extraction<T> {
  value: T;
  matchedText: string | null;
  rest: string;
}

function extractSubtasks(input: string): Extraction<string[]> {
  const bulleted = input.match(/(?:^|\n)\s*[-*•]\s*(.+)/g);
  if (bulleted && bulleted.length >= 2) {
    const subtasks = bulleted.map((line) => line.replace(/^[\s\n]*[-*•]\s*/, '').trim()).filter(Boolean);
    const rest = input.replace(/(?:^|\n)\s*[-*•]\s*.+/g, ' ').trim();
    return { value: subtasks, matchedText: bulleted.join(' '), rest };
  }

  const listed = input.match(/\b(?:subtareas?|pasos?|fases?|incluye|con)\s*:\s*(.+)$/i);
  if (listed?.[1]) {
    const subtasks = listed[1]
      .split(/\s*(?:,|;|\by\b|\be\b)\s*/i)
      .map((part) => part.trim())
      .filter((part) => part.length > 1);

    if (subtasks.length >= 2) {
      return { value: subtasks, matchedText: listed[0], rest: input.replace(listed[0], ' ').trim() };
    }
  }

  return { value: [], matchedText: null, rest: input };
}

function extractDuration(input: string): Extraction<number | null> {
  const match = input.match(DURATION_RE);
  if (!match?.[1] || !match[2]) return { value: null, matchedText: null, rest: input };

  const amount = Number.parseFloat(match[1].replace(',', '.'));
  const unit = fold(match[2]);

  // Dias y semanas describen un plazo, no un esfuerzo: los resuelve extractDueDate.
  if (unit.startsWith('d')) return { value: null, matchedText: null, rest: input };

  const hours = unit.startsWith('min') ? amount / 60 : amount;
  return {
    value: Math.round(hours * 100) / 100,
    matchedText: match[0].trim(),
    rest: input.replace(match[0], ' '),
  };
}

function extractDueDate(input: string, now: Date): Extraction<Date | null> {
  const found = (value: Date, matchedText: string): Extraction<Date | null> => ({
    value,
    matchedText,
    rest: input.replace(matchedText, ' '),
  });

  const passedTomorrow = input.match(/\bpasado\s+ma[nñ]ana\b/i);
  if (passedTomorrow) return found(addDays(now, 2), passedTomorrow[0]);

  const tomorrow = input.match(/\bma[nñ]ana\b/i);
  if (tomorrow) return found(addDays(now, 1), tomorrow[0]);

  const today = input.match(/\b(hoy|hoy mismo)\b/i);
  if (today) return found(atUtcMidnight(now), today[0]);

  const weekday = input.match(
    /\b(?:para\s+(?:el\s+)?|antes\s+del?\s+|el\s+|este\s+|pr[oó]ximo\s+)?(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/i,
  );
  if (weekday?.[1]) {
    const target = WEEKDAYS[fold(weekday[1])];
    if (target !== undefined) return found(nextWeekday(now, target), weekday[0]);
  }

  const inDays = input.match(/\ben\s+(\d+)\s+(d[ií]as?|semanas?|meses?|mes)\b/i);
  if (inDays?.[1] && inDays[2]) {
    const amount = Number.parseInt(inDays[1], 10);
    const unit = fold(inDays[2]);
    const days = unit.startsWith('semana') ? amount * 7 : unit.startsWith('mes') ? amount * 30 : amount;
    return found(addDays(now, days), inDays[0]);
  }

  const nextWeek = input.match(/\b(?:la\s+)?pr[oó]xima\s+semana\b/i);
  if (nextWeek) return found(addDays(now, 7), nextWeek[0]);

  const endOfMonth = input.match(/\b(?:a\s+)?fin(?:al)?\s+de\s+mes\b/i);
  if (endOfMonth) {
    const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    return found(last, endOfMonth[0]);
  }

  const explicit = input.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (explicit?.[1] && explicit[2]) {
    const day = Number.parseInt(explicit[1], 10);
    const month = Number.parseInt(explicit[2], 10);
    const rawYear = explicit[3] ? Number.parseInt(explicit[3], 10) : now.getUTCFullYear();
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;

    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const parsed = new Date(Date.UTC(year, month - 1, day));
      if (parsed.getUTCDate() === day && parsed.getUTCMonth() === month - 1) {
        return found(parsed, explicit[0]);
      }
    }
  }

  return { value: null, matchedText: null, rest: input };
}

function extractPriority(input: string): Extraction<ManualPriority | null> {
  for (const { re, priority } of PRIORITY_PATTERNS) {
    const match = input.match(re);
    if (match) {
      return { value: priority, matchedText: match[0], rest: input.replace(match[0], ' ') };
    }
  }
  return { value: null, matchedText: null, rest: input };
}

function extractAssignee(
  input: string,
  teamMembers: Array<{ id: string; name: string }>,
): Extraction<{ id: string; name: string } | null> {
  for (const member of teamMembers) {
    const firstName = member.name.trim().split(/\s+/)[0];
    if (!firstName || firstName.length < 2) continue;

    const re = new RegExp(`\\b(?:a|para|con|asignar\\s+a)\\s+(${escapeRegex(firstName)})\\b`, 'i');
    const match = input.match(re);
    if (match) {
      return { value: member, matchedText: match[0], rest: input.replace(match[0], ' ') };
    }
  }
  return { value: null, matchedText: null, rest: input };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const LEFTOVER_CONNECTORS =
  /\b(?:para|antes\s+del?|el|la|los|las|de|del|en|a|con|y|que|este|esta)\b\s*$/i;

function cleanTitle(value: string): string {
  let title = value
    .replace(/\s+/g, ' ')
    .replace(/\s*[,;:.]+\s*$/g, '')
    .trim();

  // Un conector huerfano al final es residuo de lo que ya se extrajo.
  let previous = '';
  while (title !== previous) {
    previous = title;
    title = title.replace(LEFTOVER_CONNECTORS, '').replace(/\s*[,;:.]+\s*$/g, '').trim();
  }

  return title.replace(/^./, (c) => c.toUpperCase());
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Convierte una frase en un borrador de tarea. No toca la base de datos: quien
 * llama decide si guardarlo, y `confidence` indica cuanto se pudo reconocer.
 */
export function parseTaskFromText(input: string, options: ParseOptions = {}): ParsedTaskDraft {
  const now = options.now ?? new Date();
  const teamMembers = options.teamMembers ?? [];

  const subtasks = extractSubtasks(input.trim());
  const duration = extractDuration(subtasks.rest);
  const dueDate = extractDueDate(duration.rest, now);
  const priority = extractPriority(dueDate.rest);
  const assignee = extractAssignee(priority.rest, teamMembers);

  const title = cleanTitle(assignee.rest);

  let confidence = 0.7;
  if (dueDate.matchedText) confidence += 0.15;
  if (priority.matchedText) confidence += 0.05;
  if (assignee.matchedText) confidence += 0.05;
  if (duration.matchedText) confidence += 0.03;
  if (subtasks.value.length > 0) confidence += 0.02;
  if (title.length < 5) confidence -= 0.3;

  return {
    title,
    description: null,
    dueDate: dueDate.value ? toIsoDate(dueDate.value) : null,
    priority: priority.value ?? 3,
    estimatedHours: duration.value,
    assigneeName: assignee.value?.name ?? null,
    assigneeId: assignee.value?.id ?? null,
    subtasks: subtasks.value,
    confidence: Math.max(0, Math.min(0.99, Math.round(confidence * 100) / 100)),
    matched: {
      date: dueDate.matchedText,
      priority: priority.matchedText,
      duration: duration.matchedText,
      assignee: assignee.matchedText,
    },
  };
}

export interface DraftProblem {
  field: string;
  message: string;
}

/** Revisa el borrador antes de guardarlo. Devuelve los problemas, sin corregir nada. */
export function validateDraft(draft: ParsedTaskDraft, now: Date = new Date()): DraftProblem[] {
  const problems: DraftProblem[] = [];

  if (draft.title.trim().length < 5) {
    problems.push({ field: 'title', message: 'El título necesita al menos 5 caracteres.' });
  }

  if (draft.dueDate) {
    const due = new Date(`${draft.dueDate}T00:00:00Z`);
    if (Number.isNaN(due.getTime())) {
      problems.push({ field: 'dueDate', message: 'La fecha límite no es válida.' });
    } else if (due < atUtcMidnight(now)) {
      problems.push({ field: 'dueDate', message: 'La fecha límite ya pasó.' });
    }
  }

  if (draft.estimatedHours !== null && (draft.estimatedHours <= 0 || draft.estimatedHours > 40)) {
    problems.push({ field: 'estimatedHours', message: 'La estimación debe estar entre 0 y 40 horas.' });
  }

  return problems;
}
