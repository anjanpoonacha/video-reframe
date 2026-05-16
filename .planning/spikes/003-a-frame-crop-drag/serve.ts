import index from "./index.html";

Bun.serve({
  port: 3003,
  routes: { "/": index },
  development: { hmr: true, console: true },
});

console.log("Spike 003a → http://localhost:3003");
