import index from "./index.html";

Bun.serve({
  port: 3002,
  routes: {
    "/": index,
  },
  development: { hmr: true, console: true },
});

console.log("Spike 002 → http://localhost:3002");
