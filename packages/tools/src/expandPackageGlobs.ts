import path from "path";
import fs from "fs-extra";
import glob from "fast-glob";

import { Tool, Package, PackageJSON, Packages, MonorepoRoot } from "./Tool";

/**
 * This internal method takes a list of one or more directory globs and the absolute path
 * to the root directory, and returns a list of all matching relative directories that
 * contain a `package.json` file.
 */
export async function expandPackageGlobs(
  packageGlobs: string[],
  directory: string
): Promise<Package[]> {
  const relativeDirectories: string[] = await glob(packageGlobs, {
    cwd: directory,
    onlyDirectories: true,
    ignore: ["**/node_modules"],
  });
  const directories = relativeDirectories
    .map((p) => path.resolve(directory, p))
    .sort();

  const discoveredPackages: Array<Package | undefined> = await Promise.all(
    directories.map((dir) =>
      fs
        .readJson(path.join(dir, "package.json"))
        .catch((err) => {
          if (err && (err as { code: string }).code === "ENOENT") {
            return undefined;
          }
          throw err;
        })
        .then((result: PackageJSON | undefined) => {
          if (result) {
            return {
              dir: path.resolve(dir),
              relativeDir: path.relative(directory, dir),
              packageJson: result,
            };
          }
        })
    )
  );

  return discoveredPackages.filter((pkg) => pkg) as Package[];
}

/**
 * A synchronous version of {@link expandPackagesGlobs}.
 */
export function expandPackageGlobsSync(
  packageGlobs: string[],
  directory: string
): Package[] {
  const relativeDirectories: string[] = glob.sync(packageGlobs, {
    cwd: directory,
    onlyDirectories: true,
    ignore: ["**/node_modules"],
  });
  const directories = relativeDirectories
    .map((p) => path.resolve(directory, p))
    .sort();

  const discoveredPackages: Array<Package | undefined> = directories.map(
    (dir) => {
      try {
        const packageJson: PackageJSON = fs.readJsonSync(
          path.join(dir, "package.json")
        );
        return {
          dir: path.resolve(dir),
          relativeDir: path.relative(directory, dir),
          packageJson,
        };
      } catch (err) {
        if (err && (err as { code: string }).code === "ENOENT") {
          return undefined;
        }
        throw err;
      }
    }
  );

  return discoveredPackages.filter((pkg) => pkg) as Package[];
}
