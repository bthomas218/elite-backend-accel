import { createServer } from "http";

const PORT = process.env.PORT || 3000;

const server = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "healthy", timestamp: new Date() }));
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
