// Metro-Konfiguration für das Monorepo: Metro muss die Workspace-Wurzel
// beobachten und node_modules sowohl in apps/mobile als auch im Repo-Root
// auflösen, damit `@village-wars/shared` (Symlink) gefunden wird.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
