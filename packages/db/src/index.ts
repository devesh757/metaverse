import { PrismaClient } from "./generated/client";
export * from "./generated/client";

const prisma = new PrismaClient();

export default prisma;
