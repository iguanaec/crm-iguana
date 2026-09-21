import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@iguana.co';
const DEMO_PASSWORD = 'demo1234';

/** Fecha a N dias de hoy, a medianoche UTC (las columnas son DATE). */
function inDays(days: number): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

async function main(): Promise<void> {
  // Recrear al usuario demo arrastra sus datos en cascada, asi el seed es repetible.
  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });

  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      name: 'Camila Ortiz',
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
      timezone: 'America/Bogota',
    },
  });

  const [acme, nortec] = await Promise.all([
    prisma.client.create({
      data: {
        userId: user.id,
        name: 'Laura Restrepo',
        company: 'Acme Logística',
        email: 'laura@acme.co',
        phone: '+57 300 123 4567',
        tags: ['retainer', 'prioritario'],
        notes: 'Renovación de contrato en diciembre.',
      },
    }),
    prisma.client.create({
      data: {
        userId: user.id,
        name: 'Diego Salcedo',
        company: 'Nortec',
        email: 'diego@nortec.io',
        tags: ['nuevo'],
      },
    }),
  ]);

  const portal = await prisma.project.create({
    data: {
      userId: user.id,
      clientId: acme.id,
      name: 'Portal de clientes Acme',
      description: 'Autogestión de envíos y facturas para los clientes de Acme.',
      color: '#2dd4a7',
      startDate: inDays(-20),
      endDate: inDays(45),
      pipelines: {
        create: [
          { name: 'Por hacer', position: 0, color: '#6b7a73' },
          { name: 'En curso', position: 1, color: '#5b9dd9' },
          { name: 'Revisión', position: 2, color: '#f5a524' },
          { name: 'Listo', position: 3, color: '#2dd4a7' },
        ],
      },
    },
    include: { pipelines: { orderBy: { position: 'asc' } } },
  });

  const marca = await prisma.project.create({
    data: {
      userId: user.id,
      clientId: nortec.id,
      name: 'Identidad Nortec',
      description: 'Manual de marca y sitio de presentación.',
      color: '#d55181',
      startDate: inDays(-5),
      endDate: inDays(60),
      pipelines: {
        create: [
          { name: 'Por hacer', position: 0, color: '#6b7a73' },
          { name: 'En curso', position: 1, color: '#5b9dd9' },
          { name: 'Listo', position: 2, color: '#2dd4a7' },
        ],
      },
    },
    include: { pipelines: { orderBy: { position: 'asc' } } },
  });

  const porHacer = portal.pipelines[0]!;
  const enCurso = portal.pipelines[1]!;
  const revision = portal.pipelines[2]!;
  const marcaPorHacer = marca.pipelines[0]!;

  const lanzamiento = await prisma.objective.create({
    data: {
      userId: user.id,
      projectId: portal.id,
      title: 'Lanzar el portal antes de fin de trimestre',
      description: 'Que los clientes de Acme puedan consultar sus envíos sin llamar.',
      goalType: 'completion',
      targetValue: 100,
      currentValue: 35,
      unit: 'porcentaje',
      isCritical: true,
      startDate: inDays(-20),
      endDate: inDays(45),
    },
  });

  await prisma.objective.create({
    data: {
      userId: user.id,
      title: 'Facturar 40 millones este trimestre',
      goalType: 'revenue',
      targetValue: 40_000_000,
      currentValue: 12_500_000,
      unit: 'COP',
      startDate: inDays(-20),
      endDate: inDays(70),
    },
  });

  // El esquema de datos bloquea al resto: sirve para ver el factor de dependencias.
  const esquema = await prisma.task.create({
    data: {
      projectId: portal.id,
      pipelineId: enCurso.id,
      createdById: user.id,
      assignedToId: user.id,
      objectiveId: lanzamiento.id,
      title: 'Definir el esquema de datos de envíos',
      description: 'Tablas de envío, estado y trazabilidad.',
      status: 'in_progress',
      priority: 4,
      dueDate: inDays(1),
      estimatedHours: 6,
      position: 0,
    },
  });

  const tasks = await Promise.all([
    prisma.task.create({
      data: {
        projectId: portal.id,
        pipelineId: porHacer.id,
        createdById: user.id,
        assignedToId: user.id,
        objectiveId: lanzamiento.id,
        title: 'Construir la API de consulta de envíos',
        status: 'todo',
        priority: 3,
        dueDate: inDays(6),
        estimatedHours: 12,
        dependsOn: [esquema.id],
        position: 0,
      },
    }),
    prisma.task.create({
      data: {
        projectId: portal.id,
        pipelineId: porHacer.id,
        createdById: user.id,
        objectiveId: lanzamiento.id,
        title: 'Diseñar la pantalla de seguimiento',
        status: 'todo',
        priority: 3,
        dueDate: inDays(8),
        estimatedHours: 8,
        dependsOn: [esquema.id],
        position: 1,
      },
    }),
    // Vencida a proposito: es lo primero que deberia señalar el asistente.
    prisma.task.create({
      data: {
        projectId: portal.id,
        pipelineId: revision.id,
        createdById: user.id,
        assignedToId: user.id,
        title: 'Enviar el acta de la reunión de arranque',
        status: 'review',
        priority: 2,
        dueDate: inDays(-3),
        estimatedHours: 1,
        position: 0,
      },
    }),
    prisma.task.create({
      data: {
        projectId: portal.id,
        pipelineId: porHacer.id,
        createdById: user.id,
        title: 'Revisar la política de retención de datos',
        status: 'todo',
        priority: 2,
        estimatedHours: 3,
        position: 2,
      },
    }),
    prisma.task.create({
      data: {
        projectId: marca.id,
        pipelineId: marcaPorHacer.id,
        createdById: user.id,
        assignedToId: user.id,
        title: 'Presentar tres rutas de identidad',
        status: 'todo',
        priority: 5,
        dueDate: inDays(2),
        estimatedHours: 10,
        position: 0,
      },
    }),
    prisma.task.create({
      data: {
        projectId: marca.id,
        pipelineId: marcaPorHacer.id,
        createdById: user.id,
        title: 'Recopilar referencias visuales del sector',
        status: 'todo',
        priority: 3,
        dueDate: inDays(12),
        estimatedHours: 4,
        position: 1,
      },
    }),
  ]);

  await prisma.taskHistory.create({
    data: {
      taskId: esquema.id,
      changedById: user.id,
      changeType: 'status_changed',
      field: 'status',
      oldValue: 'todo',
      newValue: 'in_progress',
    },
  });

  console.log(`Listo. Entra con ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  2 clientes, 2 proyectos, 7 pipelines, ${tasks.length + 1} tareas, 2 objetivos`);
}

main()
  .catch((error) => {
    console.error('El seed falló:', error);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
