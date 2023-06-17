const fs = require("fs");
const path = require("path");

/**
 * from node_models copy to dist
 */
async function cpvm2(file) {
  const src = path.join(__dirname, "node_modules", "vm2", "lib", file);
  const dest = path.join(__dirname, "dist", file);
  fs.copyFileSync(src, dest);
}

(async () => {
  cpvm2("bridge.js");
  cpvm2("events.js");
  cpvm2("setup-sandbox.js");
  cpvm2("setup-node-sandbox.js");
})();
