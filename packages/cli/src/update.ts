import { getPackages, Packages } from "@manypkg/get-packages";
import semver from "semver";
import { DEPENDENCY_TYPES, versionRangeToRangeType } from "./checks/utils";
import spawn from "spawndamnit";
import pLimit from "p-limit";

import { writePackage } from "./utils";

export async function updateDependency([name, tag = "latest"]: string[]) {
  // handle no name is missing
  let { packages, tool, root }: Packages = await getPackages(process.cwd());
  let isScope = name.substring(0, 1) === "@";
  let newVersion = semver.validRange(tag);

  let packagesToUpdate = new Set<string>();

  let filteredPackages = packages.filter(({ packageJson }) => {
    let requiresUpdate = false;

    DEPENDENCY_TYPES.forEach(t => {
      let deps = packageJson[t];
      if (!deps) return;

      let packageNames = Object.keys(deps);
      packageNames.forEach(pkgName => {
        if ((isScope && pkgName.startsWith(name)) || pkgName === name) {
          requiresUpdate = true;
          packagesToUpdate.add(pkgName);
        }
      });
    });

    return requiresUpdate;
  });

  let newVersions = await Promise.all(
    [...packagesToUpdate].map(async pkgName => {
      if (!newVersion) {
        let info: any = await getPackageInfo(name);
        let distTags = info["dist-tags"];
        let version = (newVersion = distTags[tag]);

        return { pkgName, version };
      } else {
        return { pkgName, version: newVersion };
      }
    })
  );

  filteredPackages.forEach(({ packageJson }) => {
    DEPENDENCY_TYPES.forEach(t => {
      let deps = packageJson[t];

      if (deps) {
        newVersions.forEach(({ pkgName, version }) => {
          if (deps![pkgName]) {
            if (!newVersion) {
              deps![pkgName] = `${versionRangeToRangeType(
                deps![pkgName]
              )}${version}`;
            } else {
              deps![pkgName] = version;
            }
          }
        });
      }
    });
  });

  await Promise.all([...filteredPackages].map(writePackage));

  await spawn(
    {
      yarn: "yarn",
      pnpm: "pnpm",
      lerna: "lerna",
      root: "yarn",
      bolt: "bolt"
    }[tool],
    tool === "pnpm"
      ? ["install"]
      : tool === "lerna"
      ? ["bootstrap", "--since", "HEAD"]
      : [],
    { cwd: root.dir, stdio: "inherit" }
  );
}

const npmRequestLimit = pLimit(40);

function getCorrectRegistry() {
  let registry =
    process.env.npm_config_registry === "https://registry.yarnpkg.com"
      ? undefined
      : process.env.npm_config_registry;
  return registry;
}

function jsonParse(input: string) {
  try {
    return JSON.parse(input);
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.error("error parsing json:", input);
    }
    throw err;
  }
}

export function getPackageInfo(pkgName: string) {
  return npmRequestLimit(async () => {
    // Due to a couple of issues with yarnpkg, we also want to override the npm registry when doing
    // npm info.
    // Issues: We sometimes get back cached responses, i.e old data about packages which causes
    // `publish` to behave incorrectly. It can also cause issues when publishing private packages
    // as they will always give a 404, which will tell `publish` to always try to publish.
    // See: https://github.com/yarnpkg/yarn/issues/2935#issuecomment-355292633
    const envOverride = {
      npm_config_registry: getCorrectRegistry()
    };

    let result = await spawn("npm", ["info", pkgName, "--json"], {
      env: Object.assign({}, process.env, envOverride)
    });

    return jsonParse(result.stdout.toString());
  });
}
