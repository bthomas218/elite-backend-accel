import { createServer } from "http";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });
const PORT = process.env.PORT || 3000;

const server = createServer(async (req, res) => {
  // Set JSON headers for all responses
  res.setHeader("Content-Type", "application/json");

  // GET /users - Fetch all users from PostgreSQL
  if (req.url === "/users" && req.method === "GET") {
    try {
      const users = await prisma.user.findMany();
      res.writeHead(200);
      return res.end(JSON.stringify({ success: true, data: users }));
    } catch (error) {
      res.writeHead(500);
      return res.end(
        JSON.stringify({ success: false, error: "Database query failed" }),
      );
    }
  }

  // POST /users - Create a dummy user for testing
  if (req.url === "/users" && req.method === "POST") {
    try {
      const randomEmail = `user-${Date.now()}@accelerator.com`;
      const newUser = await prisma.user.create({
        data: {
          email: randomEmail,
          name: "Engine Graduate",
        },
      });
      res.writeHead(201);
      return res.end(JSON.stringify({ success: true, data: newUser }));
    } catch (error) {
      res.writeHead(500);
      return res.end(
        JSON.stringify({ success: false, error: "Failed to create user" }),
      );
    }
  }

  // Default Health Check Route
  if (req.url === "/" && req.method === "GET") {
    res.writeHead(200);
    return res.end(
      JSON.stringify({ status: "healthy", database: "connected" }),
    );
  }

  // 404 Route
  res.writeHead(404);
  res.end(JSON.stringify({ error: "Route not found" }));
});

// Graceful Shutdown: Close database connections when the server stops
const gracefulShutdown = async () => {
  console.log("\n🛑 Shutting down gracefully...");
  await prisma.$disconnect();
  server.close(() => {
    console.log("👋 Server terminated cleanly.");
    process.exit(0);
  });
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

server.listen(PORT, () => {
  console.log(`🚀 Production API layer running on port ${PORT}`);
});
