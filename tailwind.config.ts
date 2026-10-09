import type { Config } from "tailwindcss";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tokens = require("./tailwind.tokens.js");
export default { content: ["./src/**/*.{ts,tsx}"], theme: tokens.theme, plugins: [] } satisfies Config;
