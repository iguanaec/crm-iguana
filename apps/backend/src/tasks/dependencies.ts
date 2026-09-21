/**
 * Las dependencias forman un grafo dirigido. Un ciclo (A espera a B, B espera a
 * A) dejaria trabajo imposible de empezar y haria que el motor de priorizacion
 * se contradiga, asi que se rechaza al guardar.
 */

export interface DependencyEdge {
  id: string;
  dependsOn: string[];
}

/**
 * Indica si darle a `taskId` las dependencias `nextDependsOn` cerraria un ciclo.
 * Recorre hacia arriba desde cada dependencia buscando volver a `taskId`.
 */
export function wouldCreateCycle(
  taskId: string,
  nextDependsOn: string[],
  graph: DependencyEdge[],
): boolean {
  if (nextDependsOn.includes(taskId)) return true;

  const dependenciesOf = new Map(graph.map((edge) => [edge.id, edge.dependsOn]));
  // La tarea editada aun no tiene sus nuevas dependencias en el grafo cargado.
  dependenciesOf.set(taskId, nextDependsOn);

  const visited = new Set<string>();
  const stack = [...nextDependsOn];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === taskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    stack.push(...(dependenciesOf.get(current) ?? []));
  }

  return false;
}
