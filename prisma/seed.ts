import { PrismaClient, Role, TaskStatus, TaskPriority } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Database Seeding...');

  // Clean existing database
  await prisma.notification.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Create Users (1 Admin, 2 Project Managers, 4 Developers)
  const admin = await prisma.user.create({
    data: {
      email: 'admin@agency.com',
      passwordHash,
      name: 'Sarah Connor (Admin)',
      role: Role.ADMIN
    }
  });

  const pm1 = await prisma.user.create({
    data: {
      email: 'pm.ravi@agency.com',
      passwordHash,
      name: 'Ravi Sharma (PM)',
      role: Role.PROJECT_MANAGER
    }
  });

  const pm2 = await prisma.user.create({
    data: {
      email: 'pm.elena@agency.com',
      passwordHash,
      name: 'Elena Rostova (PM)',
      role: Role.PROJECT_MANAGER
    }
  });

  const dev1 = await prisma.user.create({
    data: {
      email: 'dev.alex@agency.com',
      passwordHash,
      name: 'Alex Chen (Dev)',
      role: Role.DEVELOPER
    }
  });

  const dev2 = await prisma.user.create({
    data: {
      email: 'dev.maria@agency.com',
      passwordHash,
      name: 'Maria Garcia (Dev)',
      role: Role.DEVELOPER
    }
  });

  const dev3 = await prisma.user.create({
    data: {
      email: 'dev.kenji@agency.com',
      passwordHash,
      name: 'Kenji Sato (Dev)',
      role: Role.DEVELOPER
    }
  });

  const dev4 = await prisma.user.create({
    data: {
      email: 'dev.zara@agency.com',
      passwordHash,
      name: 'Zara Malik (Dev)',
      role: Role.DEVELOPER
    }
  });

  console.log('✅ Created 7 Users (1 Admin, 2 PMs, 4 Devs)');

  // 2. Create Clients
  const clientAcme = await prisma.client.create({
    data: {
      name: 'Acme Corporation',
      email: 'contact@acme.com',
      company: 'Acme Corp Industries'
    }
  });

  const clientStarlight = await prisma.client.create({
    data: {
      name: 'Starlight Fintech',
      email: 'info@starlight.io',
      company: 'Starlight Financial Technology'
    }
  });

  const clientNexus = await prisma.client.create({
    data: {
      name: 'Nexus Healthcare',
      email: 'dev@nexushealth.org',
      company: 'Nexus Global Health'
    }
  });

  console.log('✅ Created 3 Clients');

  // 3. Create 3 Projects (with 5+ tasks each)
  const project1 = await prisma.project.create({
    data: {
      name: 'Acme E-Commerce Redesign',
      description: 'Full stack revamp of Acme shopping portal with React & Node',
      clientId: clientAcme.id,
      managerId: pm1.id
    }
  });

  const project2 = await prisma.project.create({
    data: {
      name: 'Starlight Payment Gateway Integration',
      description: 'Secure PCI-DSS compliant API integration for crypto payments',
      clientId: clientStarlight.id,
      managerId: pm1.id
    }
  });

  const project3 = await prisma.project.create({
    data: {
      name: 'Nexus Telehealth Mobile Portal',
      description: 'Real-time patient video consultation web app',
      clientId: clientNexus.id,
      managerId: pm2.id
    }
  });

  console.log('✅ Created 3 Projects');

  // Date helper
  const now = new Date();
  const pastDate1 = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago (Overdue)
  const pastDate2 = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago (Overdue)
  const futureDate1 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days in future
  const futureDate2 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days in future

  // 4. Create Tasks for Project 1 (Acme - managed by PM Ravi)
  const p1t1 = await prisma.task.create({
    data: {
      title: 'Design Checkout Flow UI',
      description: 'Create responsive dark glassmorphism payment page mockup',
      projectId: project1.id,
      assigneeId: dev1.id,
      status: TaskStatus.DONE,
      priority: TaskPriority.HIGH,
      dueDate: pastDate1,
      isOverdue: false
    }
  });

  const p1t2 = await prisma.task.create({
    data: {
      title: 'Setup Stripe Webhooks Handler',
      description: 'Implement backend endpoint for order payment status confirmation',
      projectId: project1.id,
      assigneeId: dev1.id,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.CRITICAL,
      dueDate: pastDate1, // OVERDUE
      isOverdue: true
    }
  });

  const p1t3 = await prisma.task.create({
    data: {
      title: 'GraphQL API Caching Layer',
      description: 'Add Redis caching for product search catalog',
      projectId: project1.id,
      assigneeId: dev2.id,
      status: TaskStatus.IN_REVIEW,
      priority: TaskPriority.MEDIUM,
      dueDate: futureDate1
    }
  });

  const p1t4 = await prisma.task.create({
    data: {
      title: 'Cart Persistence Bugfix',
      description: 'Fix local storage sync issue during page reload',
      projectId: project1.id,
      assigneeId: dev2.id,
      status: TaskStatus.TODO,
      priority: TaskPriority.LOW,
      dueDate: futureDate2
    }
  });

  const p1t5 = await prisma.task.create({
    data: {
      title: 'SEO & OpenGraph Meta Tags',
      description: 'Add dynamic title, meta descriptions, and image previews',
      projectId: project1.id,
      assigneeId: dev3.id,
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      dueDate: futureDate2
    }
  });

  // 5. Create Tasks for Project 2 (Starlight - managed by PM Ravi)
  const p2t1 = await prisma.task.create({
    data: {
      title: 'OAuth 2.0 Identity Server Setup',
      description: 'Setup JWT authentication and refresh token rotation',
      projectId: project2.id,
      assigneeId: dev3.id,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.CRITICAL,
      dueDate: pastDate2, // OVERDUE
      isOverdue: true
    }
  });

  const p2t2 = await prisma.task.create({
    data: {
      title: 'Crypto Wallet SDK Integration',
      description: 'Integrate Web3 provider support for USDC payouts',
      projectId: project2.id,
      assigneeId: dev4.id,
      status: TaskStatus.IN_REVIEW,
      priority: TaskPriority.HIGH,
      dueDate: futureDate1
    }
  });

  const p2t3 = await prisma.task.create({
    data: {
      title: 'Audit Transaction Log Database Constraints',
      description: 'Ensure double-entry accounting integrity with foreign keys',
      projectId: project2.id,
      assigneeId: dev4.id,
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
      dueDate: futureDate2
    }
  });

  const p2t4 = await prisma.task.create({
    data: {
      title: 'Fraud Detection Rate Limit',
      description: 'Add IP rate limiting to withdraw endpoint',
      projectId: project2.id,
      assigneeId: dev1.id,
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      dueDate: futureDate2
    }
  });

  const p2t5 = await prisma.task.create({
    data: {
      title: 'Automated E2E Payment Suite',
      description: 'Write Cypress tests for payment failure retries',
      projectId: project2.id,
      assigneeId: dev2.id,
      status: TaskStatus.TODO,
      priority: TaskPriority.LOW,
      dueDate: futureDate2
    }
  });

  // 6. Create Tasks for Project 3 (Nexus - managed by PM Elena)
  const p3t1 = await prisma.task.create({
    data: {
      title: 'WebRTC Signaling Protocol',
      description: 'Establish Socket.io peer-to-peer connection for video streams',
      projectId: project3.id,
      assigneeId: dev2.id,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.CRITICAL,
      dueDate: futureDate1
    }
  });

  const p3t2 = await prisma.task.create({
    data: {
      title: 'HIPAA Encryption for Chat Logs',
      description: 'Encrypt doctor-patient text messages at rest',
      projectId: project3.id,
      assigneeId: dev4.id,
      status: TaskStatus.IN_REVIEW,
      priority: TaskPriority.HIGH,
      dueDate: futureDate1
    }
  });

  const p3t3 = await prisma.task.create({
    data: {
      title: 'Prescription Upload OCR Engine',
      description: 'Extract handwritten medicine text using Tesseract',
      projectId: project3.id,
      assigneeId: dev3.id,
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      dueDate: futureDate2
    }
  });

  const p3t4 = await prisma.task.create({
    data: {
      title: 'Doctor Appointment Calendar Sync',
      description: 'Sync consultations with Google Calendar API',
      projectId: project3.id,
      assigneeId: dev1.id,
      status: TaskStatus.TODO,
      priority: TaskPriority.LOW,
      dueDate: futureDate2
    }
  });

  const p3t5 = await prisma.task.create({
    data: {
      title: 'Emergency SOS Alert Button',
      description: 'Trigger immediate push notifications to on-call medical staff',
      projectId: project3.id,
      assigneeId: dev4.id,
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
      dueDate: futureDate2
    }
  });

  console.log('✅ Created 15 Tasks (including 2 Overdue tasks)');

  // 7. Seed Pre-existing Activity Logs
  await prisma.activityLog.createMany({
    data: [
      {
        projectId: project1.id,
        taskId: p1t1.id,
        userId: dev1.id,
        action: 'STATUS_CHANGE',
        details: 'Alex Chen (Dev) moved Task "Design Checkout Flow UI" from IN_PROGRESS → DONE',
        createdAt: new Date(now.getTime() - 60 * 60 * 1000)
      },
      {
        projectId: project1.id,
        taskId: p1t3.id,
        userId: dev2.id,
        action: 'STATUS_CHANGE',
        details: 'Maria Garcia (Dev) moved Task "GraphQL API Caching Layer" from IN_PROGRESS → IN_REVIEW',
        createdAt: new Date(now.getTime() - 40 * 60 * 1000)
      },
      {
        projectId: project2.id,
        taskId: p2t2.id,
        userId: dev4.id,
        action: 'STATUS_CHANGE',
        details: 'Zara Malik (Dev) moved Task "Crypto Wallet SDK Integration" from TODO → IN_REVIEW',
        createdAt: new Date(now.getTime() - 25 * 60 * 1000)
      },
      {
        projectId: project1.id,
        taskId: p1t2.id,
        userId: pm1.id,
        action: 'TASK_OVERDUE',
        details: 'Task "Setup Stripe Webhooks Handler" became Overdue',
        createdAt: new Date(now.getTime() - 10 * 60 * 1000)
      },
      {
        projectId: project3.id,
        taskId: p3t2.id,
        userId: dev4.id,
        action: 'STATUS_CHANGE',
        details: 'Zara Malik (Dev) moved Task "HIPAA Encryption for Chat Logs" from IN_PROGRESS → IN_REVIEW',
        createdAt: new Date(now.getTime() - 2 * 60 * 1000)
      }
    ]
  });

  console.log('✅ Created Pre-existing Activity Log Entries');

  // 8. Seed Sample Notifications
  await prisma.notification.createMany({
    data: [
      {
        userId: pm1.id,
        taskId: p1t3.id,
        message: 'Task "GraphQL API Caching Layer" was moved to In Review by Maria Garcia',
        isRead: false
      },
      {
        userId: dev1.id,
        taskId: p1t2.id,
        message: 'Task "Setup Stripe Webhooks Handler" is now overdue!',
        isRead: false
      }
    ]
  });

  console.log('✅ Created Initial Seed Notifications');
  console.log('🎉 Seeding Complete!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
