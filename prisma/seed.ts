import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.routine.deleteMany();
  await prisma.routine.createMany({
    data: [
      {
        name: "Ejemplo — tren superior",
        description:
          "Movimientos básicos para pecho y espalda. Consulta con tu entrenador antes de aplicar cargas.",
        gifUrl: "/images/routines/placeholder.gif",
        category: "pecho",
        sortOrder: 0,
      },
      {
        name: "Ejemplo — piernas",
        description:
          "Activación y trabajo de cuádriceps e isquiotibiales. Ajusta series según tu nivel.",
        gifUrl: "/images/routines/placeholder.gif",
        category: "piernas",
        sortOrder: 1,
      },
    ],
  });

  await prisma.answer.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.questionOption.deleteMany();
  await prisma.question.deleteMany();
  await prisma.trainerGroup.deleteMany();

  await prisma.trainerGroup.createMany({
    data: [
      { label: "Mañana — Entrenador A", sortOrder: 0 },
      { label: "Tarde — Entrenador B", sortOrder: 1 },
      { label: "Noche — Entrenador C", sortOrder: 2 },
    ],
  });

  await prisma.question.create({
    data: {
      text: "¿Cuántas repeticiones suelen usarse para hipertrofia?",
      sortOrder: 0,
      options: {
        create: [
          { text: "1–3", sortOrder: 0 },
          { text: "6–12", sortOrder: 1 },
          { text: "30–50", sortOrder: 2 },
        ],
      },
    },
  });

  await prisma.question.create({
    data: {
      text: "Antes del entrenamiento es recomendable:",
      sortOrder: 1,
      options: {
        create: [
          { text: "Ayuno total", sortOrder: 0 },
          { text: "Calentar y movilizar articulaciones", sortOrder: 1 },
          { text: "Máximo peso sin calentar", sortOrder: 2 },
        ],
      },
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
