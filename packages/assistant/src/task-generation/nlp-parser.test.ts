import { describe, expect, it } from 'vitest';
import { parseTaskFromText, validateDraft } from './nlp-parser.js';

const NOW = new Date('2026-09-21T12:00:00Z');
const TEAM = [
  { id: 'u1', name: 'Juan Pérez' },
  { id: 'u2', name: 'María Gómez' },
];

function parse(text: string) {
  return parseTaskFromText(text, { now: NOW, teamMembers: TEAM });
}

function weekdayOf(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00Z`).getUTCDay();
}

describe('titulo', () => {
  it('conserva el texto y descarta lo que ya interpreto', () => {
    expect(parse('Revisar propuesta para el martes').title).toBe('Revisar propuesta');
    expect(parse('Implementar API de pagos en 8 horas').title).toBe('Implementar API de pagos');
  });

  it('no deja conectores huerfanos al final', () => {
    expect(parse('Llamar al cliente mañana').title).toBe('Llamar al cliente');
    expect(parse('Enviar cotización antes del viernes').title).toBe('Enviar cotización');
  });

  it('empieza en mayuscula', () => {
    expect(parse('revisar contrato').title).toBe('Revisar contrato');
  });
});

describe('fecha limite', () => {
  it('entiende hoy, mañana y pasado mañana', () => {
    expect(parse('Llamar cliente hoy').dueDate).toBe('2026-09-21');
    expect(parse('Llamar cliente mañana').dueDate).toBe('2026-09-22');
    expect(parse('Llamar cliente pasado mañana').dueDate).toBe('2026-09-23');
  });

  it('funciona sin acentos', () => {
    expect(parse('Llamar cliente manana').dueDate).toBe('2026-09-22');
  });

  it('resuelve el proximo dia de semana', () => {
    const martes = parse('Revisar propuesta para el martes').dueDate;
    expect(martes).not.toBeNull();
    expect(weekdayOf(martes!)).toBe(2);
    expect(martes! > '2026-09-21').toBe(true);

    const viernes = parse('Enviar informe antes del viernes').dueDate;
    expect(weekdayOf(viernes!)).toBe(5);
  });

  it('cuenta dias, semanas y meses', () => {
    expect(parse('Entregar diseño en 3 días').dueDate).toBe('2026-09-24');
    expect(parse('Entregar diseño en 2 semanas').dueDate).toBe('2026-10-05');
    expect(parse('Cerrar contrato la próxima semana').dueDate).toBe('2026-09-28');
  });

  it('entiende fin de mes', () => {
    expect(parse('Cerrar facturación a fin de mes').dueDate).toBe('2026-09-30');
  });

  it('acepta fechas explicitas', () => {
    expect(parse('Reunión de cierre 15/10').dueDate).toBe('2026-10-15');
    expect(parse('Reunión de cierre 03-11-2027').dueDate).toBe('2027-11-03');
  });

  it('descarta fechas imposibles', () => {
    expect(parse('Revisar documento 45/99').dueDate).toBeNull();
  });

  it('queda en null cuando no se menciona plazo', () => {
    expect(parse('Ordenar el archivo de contratos').dueDate).toBeNull();
  });
});

describe('prioridad', () => {
  it('reconoce los cinco niveles', () => {
    expect(parse('Responder correo, urgente').priority).toBe(5);
    expect(parse('Responder correo, importante').priority).toBe(4);
    expect(parse('Responder correo, normal').priority).toBe(3);
    expect(parse('Responder correo cuando puedas').priority).toBe(2);
    expect(parse('Responder correo algún día').priority).toBe(1);
  });

  it('usa 3 por defecto', () => {
    expect(parse('Responder correo del proveedor').priority).toBe(3);
  });
});

describe('estimacion de esfuerzo', () => {
  it('lee horas y minutos', () => {
    expect(parse('Implementar API en 8 horas').estimatedHours).toBe(8);
    expect(parse('Revisar PR en 30 minutos').estimatedHours).toBe(0.5);
    expect(parse('Ajustar copy en 1.5 horas').estimatedHours).toBe(1.5);
  });

  it('no confunde un plazo en dias con una estimacion', () => {
    const draft = parse('Entregar diseño en 3 días');
    expect(draft.estimatedHours).toBeNull();
    expect(draft.dueDate).toBe('2026-09-24');
  });
});

describe('responsable', () => {
  it('reconoce a un miembro del equipo por su nombre de pila', () => {
    const draft = parse('Hacer follow-up a Juan sobre diseño, urgente');
    expect(draft.assigneeId).toBe('u1');
    expect(draft.assigneeName).toBe('Juan Pérez');
    expect(draft.priority).toBe(5);
    expect(draft.title).toBe('Hacer follow-up sobre diseño');
  });

  it('ignora nombres que no estan en el equipo', () => {
    expect(parse('Coordinar con Fernanda el evento').assigneeId).toBeNull();
  });
});

describe('subtareas', () => {
  it('separa una lista escrita despues de dos puntos', () => {
    const draft = parse('Lanzar sitio con: diseño, desarrollo y testing');
    expect(draft.subtasks).toEqual(['diseño', 'desarrollo', 'testing']);
    expect(draft.title).toBe('Lanzar sitio');
  });

  it('separa una lista con guiones', () => {
    const draft = parse('Preparar propuesta\n- investigar mercado\n- armar presupuesto\n- redactar');
    expect(draft.subtasks).toEqual(['investigar mercado', 'armar presupuesto', 'redactar']);
    expect(draft.title).toBe('Preparar propuesta');
  });

  it('no parte una frase que solo tiene una coma', () => {
    expect(parse('Revisar contrato con el abogado').subtasks).toEqual([]);
  });
});

describe('confianza', () => {
  it('sube cuando reconoce mas señales', () => {
    const vago = parse('Ordenar archivos');
    const rico = parse('Hacer follow-up a Juan mañana, urgente, en 2 horas');
    expect(rico.confidence).toBeGreaterThan(vago.confidence);
    expect(rico.confidence).toBeLessThanOrEqual(0.99);
  });

  it('baja cuando el titulo queda demasiado corto', () => {
    expect(parse('mañana').confidence).toBeLessThan(0.7);
  });
});

describe('caso completo', () => {
  it('interpreta todas las señales de una frase', () => {
    const draft = parse('Preparar presentación para María el viernes, importante, en 4 horas');

    expect(draft.title).toBe('Preparar presentación');
    expect(draft.assigneeId).toBe('u2');
    expect(weekdayOf(draft.dueDate!)).toBe(5);
    expect(draft.priority).toBe(4);
    expect(draft.estimatedHours).toBe(4);
    expect(draft.matched.date).toBeTruthy();
    expect(draft.matched.priority).toBeTruthy();
  });
});

describe('validateDraft', () => {
  it('acepta un borrador correcto', () => {
    expect(validateDraft(parse('Revisar propuesta mañana'), NOW)).toEqual([]);
  });

  it('rechaza un titulo muy corto', () => {
    const problems = validateDraft(parse('abc'), NOW);
    expect(problems.map((p) => p.field)).toContain('title');
  });

  it('rechaza una fecha pasada', () => {
    const draft = { ...parse('Revisar propuesta'), dueDate: '2026-09-01' };
    const problems = validateDraft(draft, NOW);
    expect(problems.map((p) => p.field)).toContain('dueDate');
  });

  it('rechaza una estimacion fuera de rango', () => {
    const draft = { ...parse('Revisar propuesta'), estimatedHours: 80 };
    expect(validateDraft(draft, NOW).map((p) => p.field)).toContain('estimatedHours');
  });
});
