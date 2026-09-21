import { describe, expect, it } from 'vitest';
import { wouldCreateCycle, type DependencyEdge } from './dependencies.js';

const graph: DependencyEdge[] = [
  { id: 'a', dependsOn: [] },
  { id: 'b', dependsOn: ['a'] },
  { id: 'c', dependsOn: ['b'] },
  { id: 'suelta', dependsOn: [] },
];

describe('wouldCreateCycle', () => {
  it('permite una dependencia nueva que no cierra nada', () => {
    expect(wouldCreateCycle('suelta', ['c'], graph)).toBe(false);
  });

  it('rechaza que una tarea dependa de si misma', () => {
    expect(wouldCreateCycle('a', ['a'], graph)).toBe(true);
  });

  it('rechaza un ciclo directo', () => {
    // b ya depende de a; hacer que a dependa de b los deja esperandose.
    expect(wouldCreateCycle('a', ['b'], graph)).toBe(true);
  });

  it('rechaza un ciclo indirecto', () => {
    // c -> b -> a, asi que a no puede depender de c.
    expect(wouldCreateCycle('a', ['c'], graph)).toBe(true);
  });

  it('acepta varias dependencias validas a la vez', () => {
    expect(wouldCreateCycle('suelta', ['a', 'b', 'c'], graph)).toBe(false);
  });

  it('detecta el ciclo aunque venga acompañado de dependencias validas', () => {
    expect(wouldCreateCycle('a', ['suelta', 'c'], graph)).toBe(true);
  });

  it('no se cuelga con un ciclo preexistente en los datos', () => {
    const cyclic: DependencyEdge[] = [
      { id: 'x', dependsOn: ['y'] },
      { id: 'y', dependsOn: ['x'] },
    ];
    expect(wouldCreateCycle('nueva', ['x'], cyclic)).toBe(false);
  });

  it('permite quitar todas las dependencias', () => {
    expect(wouldCreateCycle('c', [], graph)).toBe(false);
  });
});
