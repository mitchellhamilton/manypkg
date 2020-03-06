// This is a modified version of the package-getting in bolt
// It supports yarn workspaces as well, and can fall back through
// several options

import fs from "fs-extra";
import path from "path";
import globby, { sync as globbySync } from "globby";
import readYamlFile, { sync as readYamlFileSync } from "read-yaml-file";
import { PackageJSON } from "@changesets/types";

type Tool = "yarn" | "bolt" | "pnpm" | "root";

export type Package = { packageJson: PackageJSON; dir: string };

type Packages = {
  tool: Tool;
  packages: Package[];
  root: Package;
};

export class PackageJsonMissingNameError extends Error {
  directories: string[];
  constructor(directories: string[]) {
    super(
      `The following package.jsons are missing the "name" field:\n${directories.join(
        "\n"
      )}`
    );
    this.directories = directories;
  }
}

export async function getPackages(cwd: string): Promise<Packages> {
  const pkg = await fs.readJson(path.join(cwd, "package.json"));

  let tool:
    | {
        type: Tool;
        packageGlobs: string[];
      }
    | undefined;

  if (pkg.workspaces) {
    if (Array.isArray(pkg.workspaces)) {
      tool = {
        type: "yarn",
        packageGlobs: pkg.workspaces
      };
    } else if (pkg.workspaces.packages) {
      tool = {
        type: "yarn",
        packageGlobs: pkg.workspaces.packages
      };
    }
  } else if (pkg.bolt && pkg.bolt.workspaces) {
    tool = {
      type: "bolt",
      packageGlobs: pkg.bolt.workspaces
    };
  } else {
    try {
      const manifest = await readYamlFile<{ packages?: string[] }>(
        path.join(cwd, "pnpm-workspace.yaml")
      );
      if (manifest && manifest.packages) {
        tool = {
          type: "pnpm",
          packageGlobs: manifest.packages
        };
      }
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
  }

  if (!tool) {
    const root = {
      dir: cwd,
      packageJson: pkg
    };
    if (!pkg.name) {
      throw new PackageJsonMissingNameError(["package.json"]);
    }
    return {
      tool: "root",
      root,
      packages: [root]
    };
  }

  const folders = await globby(tool.packageGlobs, {
    cwd,
    onlyDirectories: true,
    absolute: true,
    expandDirectories: false
  });

  let pkgJsonsMissingNameField: Array<string> = [];

  const results = (
    await Promise.all(
      folders.sort().map(dir =>
        fs
          .readJson(path.join(dir, "package.json"))
          .then(packageJson => {
            if (!packageJson.name) {
              pkgJsonsMissingNameField.push(
                path.relative(cwd, path.join(dir, "package.json"))
              );
            }
            return { packageJson, dir };
          })
          .catch(err => {
            if (err.code === "ENOENT") {
              return null;
            }
            throw err;
          })
      )
    )
  ).filter(x => x);
  if (pkgJsonsMissingNameField.length !== 0) {
    pkgJsonsMissingNameField.sort();
    throw new PackageJsonMissingNameError(pkgJsonsMissingNameField);
  }
  return {
    tool: tool.type,
    root: {
      dir: cwd,
      packageJson: pkg
    },
    packages: results as Package[]
  };
}

export function getPackagesSync(cwd: string): Packages {
  const pkg = fs.readJsonSync(path.join(cwd, "package.json"));

  let tool:
    | {
        type: Tool;
        packageGlobs: string[];
      }
    | undefined;

  if (pkg.workspaces) {
    if (Array.isArray(pkg.workspaces)) {
      tool = {
        type: "yarn",
        packageGlobs: pkg.workspaces
      };
    } else if (pkg.workspaces.packages) {
      tool = {
        type: "yarn",
        packageGlobs: pkg.workspaces.packages
      };
    }
  } else if (pkg.bolt && pkg.bolt.workspaces) {
    tool = {
      type: "bolt",
      packageGlobs: pkg.bolt.workspaces
    };
  } else {
    try {
      const manifest = readYamlFileSync<{ packages?: string[] }>(
        path.join(cwd, "pnpm-workspace.yaml")
      );
      if (manifest && manifest.packages) {
        tool = {
          type: "pnpm",
          packageGlobs: manifest.packages
        };
      }
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
  }

  if (!tool) {
    const root = {
      dir: cwd,
      packageJson: pkg
    };
    if (!pkg.name) {
      throw new PackageJsonMissingNameError(["package.json"]);
    }
    return {
      tool: "root",
      root,
      packages: [root]
    };
  }
  const folders = globbySync(tool.packageGlobs, {
    cwd,
    onlyDirectories: true,
    absolute: true,
    expandDirectories: false
  });

  let pkgJsonsMissingNameField: Array<string> = [];

  const results = folders
    .sort()
    .map(dir => {
      try {
        const packageJson = fs.readJsonSync(path.join(dir, "package.json"));
        if (!packageJson.name) {
          pkgJsonsMissingNameField.push(
            path.relative(cwd, path.join(dir, "package.json"))
          );
        }
        return { packageJson, dir };
      } catch (err) {
        if (err.code === "ENOENT") return null;
        throw err;
      }
    })
    .filter(x => x);

  if (pkgJsonsMissingNameField.length !== 0) {
    pkgJsonsMissingNameField.sort();
    throw new PackageJsonMissingNameError(pkgJsonsMissingNameField);
  }

  return {
    tool: tool.type,
    root: {
      dir: cwd,
      packageJson: pkg
    },
    packages: results as Package[]
  };
}
