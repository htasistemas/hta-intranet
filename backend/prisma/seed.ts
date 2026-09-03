import { PrismaClient, ClientStatus, ClientType, Priority, TaskStatus, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, addHours, startOfDay, subMonths } from "date-fns";

const prisma = new PrismaClient();

async function seed(): Promise<void> {
  const adminEmail = "adrianomtorresbr@gmail.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword) throw new Error("SEED_ADMIN_PASSWORD deve ser configurada para executar o seed.");
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  const legacyAdmin = await prisma.user.findUnique({ where: { email: "admin@clientflow.com" } });
  if (!existingAdmin && legacyAdmin) {
    await prisma.user.update({ where: { id: legacyAdmin.id }, data: { email: adminEmail } });
  }
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { name: "Administrador Torresoft", passwordHash },
    create: {
      name: "Administrador Torresoft",
      email: adminEmail,
      passwordHash,
      role: UserRole.ADMIN
    }
  });

  const categories = await Promise.all(
    [
      { name: "Consultoria", color: "#2DD4BF" },
      { name: "Premium", color: "#3B82F6" },
      { name: "Renovacao", color: "#A78BFA" },
      { name: "Software", color: "#38BDF8" }
    ].map((category) => prisma.category.upsert({ where: { name: category.name }, update: category, create: category }))
  );
  const [consultoria, premium, renovacao] = categories;
  if (!consultoria || !premium || !renovacao) throw new Error("Categorias iniciais nao foram criadas.");

  const columns = await Promise.all(
    [
      { title: "Nao iniciado", status: TaskStatus.NOT_STARTED, position: 0 },
      { title: "Em andamento", status: TaskStatus.IN_PROGRESS, position: 1 },
      { title: "Pausado", status: TaskStatus.PAUSED, position: 2 },
      { title: "Concluido", status: TaskStatus.COMPLETED, position: 3 }
    ].map((column) => prisma.taskColumn.upsert({ where: { status: column.status }, update: column, create: column }))
  );
  const [notStarted, inProgress, paused, completed] = columns;
  if (!notStarted || !inProgress || !paused || !completed) throw new Error("Colunas iniciais nao foram criadas.");

  await prisma.auditLog.deleteMany({ where: { userId: admin.id } });
  await prisma.task.deleteMany({ where: { userId: admin.id } });
  await prisma.schedule.deleteMany({ where: { userId: admin.id } });
  await prisma.note.deleteMany({ where: { userId: admin.id } });
  await prisma.project.deleteMany({ where: { ownerId: admin.id } });
  await prisma.clientProduct.deleteMany({ where: { ownerId: admin.id } });
  await prisma.productService.deleteMany({ where: { ownerId: admin.id } });
  await prisma.client.deleteMany({ where: { ownerId: admin.id } });

  const clientInput = [
    { name: "Atlas Tecnologia Ltda", document: "48282945000130", type: ClientType.COMPANY, status: ClientStatus.ACTIVE, categoryId: premium.id, expectedValue: 18500, email: "contato@atlas.example", city: "Sao Paulo", state: "SP" },
    { name: "Mariana Costa", document: "44234567890", type: ClientType.INDIVIDUAL, status: ClientStatus.ACTIVE, categoryId: consultoria.id, expectedValue: 5200, email: "mariana@example.com", city: "Curitiba", state: "PR", birthDate: addDays(new Date(), 3) },
    { name: "Horizonte Comercio", document: "18392011000145", type: ClientType.COMPANY, status: ClientStatus.PROSPECT, categoryId: renovacao.id, expectedValue: 12300, email: "diretoria@horizonte.example", city: "Recife", state: "PE" },
    { name: "Lucas Almeida", document: "59345678901", type: ClientType.INDIVIDUAL, status: ClientStatus.INACTIVE, categoryId: consultoria.id, expectedValue: 2300, email: "lucas@example.com", city: "Belo Horizonte", state: "MG" }
  ];

  const clients = [];
  for (const [index, input] of clientInput.entries()) {
    clients.push(
      await prisma.client.create({
        data: {
          ...input,
          ownerId: admin.id,
          phone: `(11) 9999${index}-000${index}`,
          whatsapp: `(11) 9999${index}-000${index}`,
          createdAt: subMonths(new Date(), index),
          contacts: { create: [{ type: "EMAIL", value: input.email, primary: true }] }
        }
      })
    );
  }
  const [atlas, mariana, horizonte] = clients;
  if (!atlas || !mariana || !horizonte) throw new Error("Clientes iniciais nao foram criados.");

  const today = startOfDay(new Date());
  const [portalProduto, consultoriaProduto, suporteProduto] = await Promise.all([
    prisma.productService.create({
      data: {
        ownerId: admin.id,
        code: "SRV-PORTAL",
        name: "Portal de Relacionamento",
        type: "PROJECT",
        category: "Implantacao",
        commercialDescription: "Portal corporativo para relacionamento com clientes e indicadores executivos.",
        unit: "projeto",
        price: 48000,
        cost: 22000,
        margin: 54.16,
        sla: "Atendimento em ate 8 horas uteis",
        deliveryTime: "60 dias",
        technicalOwner: "Equipe Torresoft"
      }
    }),
    prisma.productService.create({
      data: {
        ownerId: admin.id,
        code: "SRV-CONSULT",
        name: "Consultoria Mensal",
        type: "SUBSCRIPTION",
        category: "Consultoria",
        unit: "mensal",
        price: 5200,
        cost: 1800,
        margin: 65.38,
        sla: "Retorno em ate 1 dia util",
        deliveryTime: "Recorrente",
        technicalOwner: "Consultoria"
      }
    }),
    prisma.productService.create({
      data: {
        ownerId: admin.id,
        code: "SRV-SUPORTE",
        name: "Suporte Premium",
        type: "SUBSCRIPTION",
        category: "Suporte",
        unit: "mensal",
        price: 2400,
        cost: 900,
        margin: 62.5,
        sla: "Atendimento em ate 4 horas uteis",
        deliveryTime: "Recorrente",
        technicalOwner: "Suporte"
      }
    })
  ]);
  const [portalAtlas, consultoriaMariana] = await Promise.all([
    prisma.project.create({
      data: {
        ownerId: admin.id,
        clientId: atlas.id,
        productId: portalProduto.id,
        name: "Portal de Relacionamento Atlas",
        code: "PRJ-ATLAS-01",
        description: "Implantacao do portal de relacionamento e indicadores executivos.",
        status: "ACTIVE",
        priority: Priority.HIGH,
        startDate: addDays(today, -15),
        dueDate: addDays(today, 30),
        budget: 48000,
        progress: 42,
        color: "#3B82F6"
      }
    }),
    prisma.project.create({
      data: {
        ownerId: admin.id,
        clientId: mariana.id,
        productId: consultoriaProduto.id,
        name: "Plano de Consultoria Mariana",
        code: "PRJ-MAR-01",
        description: "Planejamento e entregas consultivas do trimestre.",
        status: "PLANNING",
        priority: Priority.MEDIUM,
        startDate: addDays(today, 5),
        dueDate: addDays(today, 60),
        budget: 9600,
        progress: 10,
        color: "#2DD4BF"
      }
    })
  ]);

  await prisma.clientProduct.createMany({
    data: [
      { ownerId: admin.id, clientId: atlas.id, productId: suporteProduto.id, startDate: addDays(today, -90), renewalDate: addDays(today, 18), contractedValue: 2400, status: "ACTIVE", responsible: "Comercial" },
      { ownerId: admin.id, clientId: mariana.id, productId: consultoriaProduto.id, startDate: addDays(today, -30), renewalDate: addDays(today, 27), contractedValue: 5200, status: "ACTIVE", responsible: "Consultoria" }
    ]
  });

  await prisma.schedule.createMany({
    data: [
      { userId: admin.id, clientId: atlas.id, projectId: portalAtlas.id, categoryId: premium.id, type: "MEETING", title: "Reuniao estrategica - Atlas", startAt: addHours(today, 10), endAt: addHours(today, 11), color: "#3B82F6" },
      { userId: admin.id, clientId: mariana.id, projectId: consultoriaMariana.id, categoryId: consultoria.id, type: "FOLLOW_UP", title: "Follow-up Mariana", startAt: addHours(today, 14), endAt: addHours(today, 15), color: "#2DD4BF" },
      { userId: admin.id, clientId: horizonte.id, categoryId: renovacao.id, type: "DEMONSTRATION", title: "Proposta Horizonte", startAt: addDays(addHours(today, 9), 2), endAt: addDays(addHours(today, 10), 2), color: "#A78BFA" }
    ]
  });

  await prisma.task.createMany({
    data: [
      { userId: admin.id, clientId: atlas.id, projectId: portalAtlas.id, columnId: inProgress.id, title: "Preparar renovacao de contrato", priority: Priority.HIGH, status: TaskStatus.IN_PROGRESS, dueDate: addDays(today, 2), position: 0 },
      { userId: admin.id, clientId: mariana.id, projectId: consultoriaMariana.id, columnId: notStarted.id, title: "Enviar proposta comercial", priority: Priority.URGENT, status: TaskStatus.NOT_STARTED, dueDate: addDays(today, 1), position: 0 },
      { userId: admin.id, clientId: horizonte.id, columnId: paused.id, title: "Revisar documentos", priority: Priority.MEDIUM, status: TaskStatus.PAUSED, dueDate: addDays(today, 4), position: 0 },
      { userId: admin.id, clientId: atlas.id, columnId: completed.id, title: "Registrar reuniao inicial", priority: Priority.LOW, status: TaskStatus.COMPLETED, position: 0 }
    ]
  });

  await prisma.note.create({ data: { userId: admin.id, clientId: atlas.id, title: "Preferencias", content: "Cliente prefere reunioes no periodo da manha." } });
  await prisma.auditLog.createMany({
    data: clients.map((client) => ({ userId: admin.id, clientId: client.id, entity: "Client", entityId: client.id, action: "CREATED", changes: { source: "seed" } }))
  });
}

seed()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
