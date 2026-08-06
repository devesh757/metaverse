import { PrismaClient } from "./generated/client";
import { PrismaPg } from "@prisma/adapter-pg";
export * from "./generated/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
const prisma = new PrismaClient({ adapter });

export default prisma;
