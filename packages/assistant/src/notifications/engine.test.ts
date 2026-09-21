import { describe, expect, it } from 'vitest';
import {
  composeDailyDigest,
  composeDeadlineAlert,
  shouldAlertDeadline,
  type NotifiableTask,
} from './engine.js';

const NOW = new Date('2026-09-21T12:00:00Z');

function date(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function task(overrides: Partial<NotifiableTask> = {}): NotifiableTask {
  return {
    id: 't1',
    title: 'Enviar propuesta',
    status: 'todo',
    priority: 3,
    dueDate: null,
    aiPriorityScore: null,
    ...overrides,
  };
}

describe('shouldAlertDeadline', () => {
  it('avisa dentro de los dos dias de margen', () => {
    expect(shouldAlertDeadline(task({ dueDate: date('2026-09-23') }), NOW)).toBe(true);
    expect(shouldAlertDeadline(task({ dueDate: date('2026-09-21') }), NOW)).toBe(true);
  });

  it('avisa de lo que ya vencio', () => {
    expect(shouldAlertDeadline(task({ dueDate: date('2026-09-10') }), NOW)).toBe(true);
  });

  it('no avisa de algo aun lejano', () => {
    expect(shouldAlertDeadline(task({ dueDate: date('2026-09-30') }), NOW)).toBe(false);
  });

  it('no avisa de tareas terminadas', () => {
    expect(shouldAlertDeadline(task({ dueDate: date('2026-09-21'), status: 'done' }), NOW)).toBe(
      false,
    );
  });

  it('no avisa sin fecha limite', () => {
    expect(shouldAlertDeadline(task({ dueDate: null }), NOW)).toBe(false);
  });

  it('calla lo de prioridad baja: eso va en el resumen', () => {
    expect(shouldAlertDeadline(task({ dueDate: date('2026-09-22'), priority: 2 }), NOW)).toBe(
      false,
    );
  });

  it('avisa de algo de prioridad baja si el puntaje lo pone arriba', () => {
    expect(
      shouldAlertDeadline(
        task({ dueDate: date('2026-09-22'), priority: 2, aiPriorityScore: 7.5 }),
        NOW,
      ),
    ).toBe(true);
  });
});

describe('composeDeadlineAlert', () => {
  it('dice cuanto falta en palabras', () => {
    expect(composeDeadlineAlert(task({ dueDate: date('2026-09-21') }), NOW).title).toContain(
      'vence hoy',
    );
    expect(composeDeadlineAlert(task({ dueDate: date('2026-09-22') }), NOW).title).toContain(
      'vence mañana',
    );
    expect(composeDeadlineAlert(task({ dueDate: date('2026-09-23') }), NOW).title).toContain(
      'vence en 2 días',
    );
  });

  it('cambia el tono cuando ya se paso', () => {
    const alert = composeDeadlineAlert(task({ dueDate: date('2026-09-18') }), NOW);
    expect(alert.title).toBe('Se pasó: Enviar propuesta');
    expect(alert.message).toContain('venció hace 3 días');
  });

  it('incluye el proyecto cuando se conoce', () => {
    const alert = composeDeadlineAlert(
      task({ dueDate: date('2026-09-21'), projectName: 'Portal Acme' }),
      NOW,
    );
    expect(alert.message).toContain('Portal Acme');
  });
});

describe('composeDailyDigest', () => {
  it('no vale la pena mandarlo cuando no hay nada', () => {
    const digest = composeDailyDigest({
      recommended: null,
      recommendedReason: '',
      overdue: [],
      dueToday: [],
      blockedCount: 0,
    });
    expect(digest.worthSending).toBe(false);
  });

  it('abre con la recomendacion', () => {
    const digest = composeDailyDigest({
      recommended: task({ title: 'Definir esquema' }),
      recommendedReason: 'Desbloquea 2 tareas.',
      overdue: [],
      dueToday: [],
      blockedCount: 0,
    });
    expect(digest.worthSending).toBe(true);
    expect(digest.message).toContain('Empieza por: Definir esquema');
    expect(digest.message).toContain('Desbloquea 2 tareas.');
  });

  it('cuenta lo vencido y lo de hoy', () => {
    const digest = composeDailyDigest({
      recommended: null,
      recommendedReason: '',
      overdue: [task({ id: 'a', title: 'Acta' })],
      dueToday: [task({ id: 'b', title: 'Llamada' })],
      blockedCount: 2,
    });

    expect(digest.title).toBe('2 cosas piden atención hoy');
    expect(digest.message).toContain('Vencidas (1): Acta.');
    expect(digest.message).toContain('Para hoy (1): Llamada.');
    expect(digest.message).toContain('2 tareas esperan');
  });

  it('resume en lugar de listar todo cuando hay muchas', () => {
    const many = Array.from({ length: 6 }, (_, i) => task({ id: `t${i}`, title: `Tarea ${i}` }));
    const digest = composeDailyDigest({
      recommended: null,
      recommendedReason: '',
      overdue: many,
      dueToday: [],
      blockedCount: 0,
    });

    expect(digest.message).toContain('y 3 más');
    expect(digest.message).not.toContain('Tarea 4');
  });
});
