require("module-alias/register");

console.log("@/app resolves to:", require.resolve("@/app"));
console.log("@utils/logger resolves to:", require.resolve("@utils/logger"));
