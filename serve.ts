import index from "./index.html";

Bun.serve({
  port: 3000,
  hostname: "0.0.0.0",
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
console.log("→ http://192.168.1.4:3000 (mobile)");
