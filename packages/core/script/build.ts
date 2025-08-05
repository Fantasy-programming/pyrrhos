import { Glob, $ } from "bun"

console.log("🧹 Cleaning dist directory...")
await $`rm -rf dist`

console.log("📦 Building ES modules...")
const files = new Glob("./src/**/*.{ts,tsx}").scan()
for await (const file of files) {
  await Bun.build({
    format: "esm",
    outdir: "dist/esm",
    external: ["*"],
    root: "src",
    entrypoints: [file],
  })
}

console.log("🔧 Generating TypeScript declarations...")
try {
  await $`tsc --outDir dist/types --declaration --emitDeclarationOnly --declarationMap`
  console.log("✅ Build completed successfully!")
} catch (error) {
  console.log("⚠️  TypeScript declarations failed, but ES modules built successfully")
  console.log("📝 You can still use the package, but without full type support")
}