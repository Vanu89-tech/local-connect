const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const pnpmStore = path.resolve(workspaceRoot, "node_modules/.pnpm");

const config = getDefaultConfig(projectRoot);

// .pnpm store explizit beobachten (pnpm-Symlinks werden sonst ignoriert)
config.watchFolders = Array.from(
  new Set([...(config.watchFolders ?? []), workspaceRoot, pnpmStore]),
);

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

config.resolver.unstable_enableSymlinks = true;

// Explizite Pfade für Pakete die via pnpm-Symlinks aufgelöst werden
const resolveFromProject = (pkg) =>
  path.resolve(require.resolve(`${pkg}/package.json`, { paths: [projectRoot] }), "..");

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  "react-native-url-polyfill": path.resolve(
    projectRoot,
    "node_modules/react-native-url-polyfill",
  ),
  "expo-notifications": resolveFromProject("expo-notifications"),
};

module.exports = config;
