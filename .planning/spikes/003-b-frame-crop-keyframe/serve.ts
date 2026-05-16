import index from "./index.html";

Bun.serve({
  port: 3004,
  routes: { "/": index },
  development: { hmr: true, console: true },
});

console.log("Spike 003b → http://localhost:3004");
