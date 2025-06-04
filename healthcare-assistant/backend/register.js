// backend/register.js
const path = require("path");
const moduleAlias = require("module-alias");

// Set up module aliases
moduleAlias.addAliases({
  "@": path.join(__dirname, "src"),
  "@utils": path.join(__dirname, "src/utils"),
  "@routes": path.join(__dirname, "src/routes"),
  "@services": path.join(__dirname, "src/services"),
  "@models": path.join(__dirname, "src/models"),
  "@controllers": path.join(__dirname, "src/controllers"),
});

console.log("Module aliases configured");
