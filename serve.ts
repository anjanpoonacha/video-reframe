import index from "./index.html";

Bun.serve({
  port: 3000,
  routes: {
    "/": index,
    "/manifest.json": new Response(Bun.file("./manifest.json")),
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log("→ http://localhost:3000");
