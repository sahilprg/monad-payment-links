import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the dev server be opened through a GitHub Codespaces web address.
  allowedDevOrigins: ["*.app.github.dev"],
  // Tailwind CSS: this rule is what turns the class names into styles.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
