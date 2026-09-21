import { describe, expect, it } from 'vitest';
import {
  calculateDependencies,
  calculateImpact,
  calculateUrgency,
  calculateWorkload,
  combineFactors,
  daysUntil,
  prioritizeTasks,
  scoreToManualPriority,
  type ScorableTask,
} from './engine.js';

const NOW = new Date('2026-09-21T12:00:00Z');

function date(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function task(overrides: Partial<ScorableTask> & { id: string }): ScorableTask {
  return {
    title: `Tarea ${overrides.id}`,
    status: 'todo',
    priority: 3,
    dueDate: null,
    assignedToId: null,
    dependsOn: [],
    objectiveId: null,
    ...overrides,
  };
}

describe('daysUntil', () => {
  it('cuenta dias calendario ignorando la hora', () => {
    expect(daysUntil(date('2026-09-21'), NOW)).toBe(0);
    expect(daysUntil(date('2026-09-22'), NOW)).toBe(1);
    expect(daysUntil(date('2026-09-28'), NOW)).toBe(7);
  });

  it('es negativo para fechas pasadas', () => {
    expect(daysUntil(date('2026-09-18'), NOW)).toBe(-3);
  });
});

describe('calculateUrgency', () => {
  it('satura cuando la tarea ya vencio', () => {
    expect(calculateUrgency(date('2026-09-01'), NOW)).toBe(1);
  });

  it('satura el mismo dia y el dia siguiente', () => {
    expect(calculateUrgency(date('2026-09-21'), NOW)).toBe(1);
    expect(calculateUrgency(date('2026-09-22'), NOW)).toBe(1);
  });

  it('decae por tramos', () => {
    expect(calculateUrgency(date('2026-09-24'), NOW)).toBe(0.8);
    expect(calculateUrgency(date('2026-09-27'), NOW)).toBe(0.5);
    expect(calculateUrgency(date('2026-10-04'), NOW)).toBe(0.35);
    expect(calculateUrgency(date('2026-12-01'), NOW)).toBe(0.25);
  });

  it('da un valor bajo pero no nulo sin fecha limite', () => {
    expect(calculateUrgency(null, NOW)).toBe(0.2);
  });
});

describe('calculateDependencies', () => {
  it('suma 0.1 por tarea bloqueada', () => {
    expect(calculateDependencies(0)).toBe(0);
    expect(calculateDependencies(3)).toBeCloseTo(0.3);
  });

  it('se limita a 1', () => {
    expect(calculateDependencies(25)).toBe(1);
  });
});

describe('calculateImpact', () => {
  it('distingue objetivo critico, normal y ausente', () => {
    expect(calculateImpact({ id: 'o1', isCritical: true })).toBe(1);
    expect(calculateImpact({ id: 'o1', isCritical: false })).toBe(0.5);
    expect(calculateImpact(null)).toBe(0);
  });
});

describe('calculateWorkload', () => {
  it('penaliza a responsables saturados', () => {
    expect(calculateWorkload(3)).toBe(0);
    expect(calculateWorkload(7)).toBe(0.5);
    expect(calculateWorkload(12)).toBe(1);
  });
});

describe('combineFactors', () => {
  it('da 10 cuando todo esta al maximo y la persona esta libre', () => {
    expect(combineFactors({ urgency: 1, dependencies: 1, impact: 1, workload: 0 })).toBe(10);
  });

  it('respeta los pesos declarados', () => {
    // 1*0.4 + 0*0.3 + 0*0.2 + 1*0.1 = 0.5 -> 5.0
    expect(combineFactors({ urgency: 1, dependencies: 0, impact: 0, workload: 0 })).toBe(5);
  });

  it('nunca baja de 0', () => {
    const score = combineFactors({ urgency: 0.2, dependencies: 0, impact: 0, workload: 1 });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThan(1);
  });
});

describe('scoreToManualPriority', () => {
  it('reparte el score en los cinco niveles', () => {
    expect(scoreToManualPriority(9)).toBe(5);
    expect(scoreToManualPriority(7)).toBe(4);
    expect(scoreToManualPriority(5)).toBe(3);
    expect(scoreToManualPriority(3.5)).toBe(2);
    expect(scoreToManualPriority(1)).toBe(1);
  });
});

describe('prioritizeTasks', () => {
  it('ignora las tareas terminadas', () => {
    const results = prioritizeTasks(
      [task({ id: 'a' }), task({ id: 'b', status: 'done' })],
      [],
      NOW,
    );
    expect(results.map((r) => r.taskId)).toEqual(['a']);
  });

  it('devuelve las tareas ordenadas de mayor a menor score', () => {
    const results = prioritizeTasks(
      [
        task({ id: 'tranquila' }),
        task({ id: 'urgente', dueDate: date('2026-09-21') }),
        task({ id: 'proxima', dueDate: date('2026-09-27') }),
      ],
      [],
      NOW,
    );
    expect(results.map((r) => r.taskId)).toEqual(['urgente', 'proxima', 'tranquila']);
  });

  it('deriva por si mismo cuantas tareas bloquea cada tarea', () => {
    const results = prioritizeTasks(
      [
        task({ id: 'base' }),
        task({ id: 'x', dependsOn: ['base'] }),
        task({ id: 'y', dependsOn: ['base'] }),
      ],
      [],
      NOW,
    );
    const base = results.find((r) => r.taskId === 'base');
    expect(base?.factors.dependencies).toBeCloseTo(0.2);
    expect(base?.reason).toBe('Bloquea 2 tarea(s).');
  });

  it('no cuenta como bloqueadas las tareas ya terminadas', () => {
    const results = prioritizeTasks(
      [task({ id: 'base' }), task({ id: 'x', status: 'done', dependsOn: ['base'] })],
      [],
      NOW,
    );
    expect(results.find((r) => r.taskId === 'base')?.factors.dependencies).toBe(0);
  });

  it('eleva el impacto de las tareas ligadas a un objetivo critico', () => {
    const results = prioritizeTasks(
      [task({ id: 'con-okr', objectiveId: 'o1' }), task({ id: 'sin-okr' })],
      [{ id: 'o1', isCritical: true }],
      NOW,
    );
    expect(results.find((r) => r.taskId === 'con-okr')?.factors.impact).toBe(1);
    expect(results.find((r) => r.taskId === 'sin-okr')?.factors.impact).toBe(0);
  });

  it('penaliza al responsable que acumula tareas abiertas', () => {
    const many = Array.from({ length: 12 }, (_, i) => task({ id: `t${i}`, assignedToId: 'ana' }));
    const results = prioritizeTasks([...many, task({ id: 'libre', assignedToId: 'beto' })], [], NOW);

    expect(results.find((r) => r.taskId === 't0')?.factors.workload).toBe(1);
    expect(results.find((r) => r.taskId === 'libre')?.factors.workload).toBe(0);
  });

  it('explica el motivo en lenguaje natural', () => {
    const results = prioritizeTasks([task({ id: 'a', dueDate: date('2026-09-18') })], [], NOW);
    expect(results[0]?.reason).toBe('Vencida hace 3 día(s).');
  });
});
