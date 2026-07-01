import { createServer } from "http";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Ollama } from "ollama";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });
const ollama = new Ollama({
  host: process.env.OLLAMA_HOST || "http://127.0.0.1:11434",
});
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

  // Generate-bio
  if (req.url === "/generate-bio" && req.method === "POST") {
    const chunks: Buffer[] = [];

    // 1. Gather the streaming incoming chunks
    req.on("data", (chunk) => {
      chunks.push(chunk);
    });

    // 2. Once the stream is fully finished, process the data
    req.on("end", async () => {
      try {
        // Safely combine and parse all chunks into a single string
        const rawBody = Buffer.concat(chunks).toString();
        const requestData = JSON.parse(rawBody);
        const { id, topic } = requestData;

        // Validate the parsed payload
        if (!id || !topic) {
          res.writeHead(400);
          return res.end(
            JSON.stringify({ success: false, error: "Missing id or topic" }),
          );
        }

        const userId = parseInt(id, 10);

        // Fetch the user from Postgres
        const user = await prisma.user.findUnique({
          where: { id: userId },
        });

        if (!user) {
          res.writeHead(404);
          return res.end(
            JSON.stringify({ success: false, error: "User not found" }),
          );
        }

        // Call Ollama (Using 'llama3.2', removing the 'ollama/' prefix which the SDK doesn't need)
        const response = await ollama.generate({
          model: "llama3.2",
          prompt: `System: You are an elite tech biographer. Create a short professional bio for ${user.name || "a student"} focused on the topic: ${topic}.`,
        });

        // Send the successful response from WITHIN the 'end' event block
        res.writeHead(200);
        return res.end(
          JSON.stringify({
            success: true,
            message: "Bio generated successfully",
            data: { bio: response.response },
          }),
        );
      } catch (error) {
        console.error("Pipeline failure:", error);
        res.writeHead(500);
        return res.end(
          JSON.stringify({
            success: false,
            error: "Failed to process request or generate bio",
          }),
        );
      }
    });

    return; // Prevents the execution from falling through
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
