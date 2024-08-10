import path from "path";
import * as logger from "./logger";
import { getPackages, Packages, Package } from "@manypkg/get-packages";
import { PM, detect as detectPackageManager } from "detect-package-manager";
import { Options } from "./checks/utils";
import { checks } from "./checks";
import { ExitError } from "./errors";
import { writePackage, install } from "./utils";
import { runCmd } from "./run";
import { upgradeDependency } from "./upgrade";
import { npmTagAll } from "./npm-tag";
import spawn from "spawndamnit";
import pLimit from "p-limit";

type RootPackage = Package & {
  packageJson: {
    manypkg?: Options;
  };
};
type PackagesWithConfig = Packages & {
  rootPackage?: RootPackage;
};

let defaultOptions = {
  defaultBranch: "master",
};

let runChecks = (
  allWorkspaces: Map<string, Package>,
  rootWorkspace: RootPackage | undefined,
  shouldFix: boolean,
  options: Options
) => {
  let hasErrored = false;
  let requiresInstall = false;
  let ignoredRules = new Set(options.ignoredRules || []);
  for (let [ruleName, check] of Object.entries(checks)) {
    if (ignoredRules.has(ruleName)) {
      continue;
    }

    if (check.type === "all") {
      for (let [, workspace] of allWorkspaces) {
        let errors = check.validate(
          workspace,
          allWorkspaces,
          rootWorkspace,
          options
        );
        if (shouldFix && check.fix !== undefined) {
          for (let error of errors) {
            let output = check.fix(error as any, options) || {
              requiresInstall: false,
            };
            if (output.requiresInstall) {
              requiresInstall = true;
            }
          }
        } else {
          for (let error of errors) {
            hasErrored = true;
            logger.error(check.print(error as any, options));
          }
        }
      }
    }
    if (check.type === "root" && rootWorkspace) {
      let errors = check.validate(rootWorkspace, allWorkspaces, options);
      if (shouldFix && check.fix !== undefined) {
        for (let error of errors) {
          let output = check.fix(error as any, options) || {
            requiresInstall: false,
          };
          if (output.requiresInstall) {
            requiresInstall = true;
          }
        }
      } else {
        for (let error of errors) {
          hasErrored = true;
          logger.error(check.print(error as any, options));
        }
      }
    }
  }
  return { requiresInstall, hasErrored };
};

let execLimit = pLimit(4);

async function execCmd(args: string[]) {
  let { packages } = await getPackages(process.cwd());
  let highestExitCode = 0;
  await Promise.all(
    packages.map((pkg) => {
      return execLimit(async () => {
        let { code } = await spawn(args[0], args.slice(1), {
          cwd: pkg.dir,
          stdio: "inherit",
        });
        highestExitCode = Math.max(code, highestExitCode);
      });
    })
  );
  throw new ExitError(highestExitCode);
}

(async () => {
  let things = process.argv.slice(2);
  if (things[0] === "exec") {
    return execCmd(things.slice(1));
  }
  if (things[0] === "run") {
    return runCmd(things.slice(1), process.cwd());
  }
  if (things[0] === "upgrade") {
    return upgradeDependency(things.slice(1));
  }
  if (things[0] === "npm-tag") {
    return npmTagAll(things.slice(1));
  }
  if (things[0] !== "check" && things[0] !== "fix") {
    logger.error(
      `command ${things[0]} not found, only check, exec, run, upgrade, npm-tag and fix exist`
    );
    throw new ExitError(1);
  }
  let shouldFix = things[0] === "fix";
  let { tool, packages, rootPackage, rootDir } = (await getPackages(
    process.cwd()
  )) as PackagesWithConfig;

  let options: Options = {
    ...defaultOptions,
    ...rootPackage?.packageJson.manypkg,
  };

  let packagesByName = new Map<string, Package>(
    packages.map((x) => [x.packageJson.name, x])
  );
  if (rootPackage) {
    packagesByName.set(rootPackage.packageJson.name, rootPackage);
  }
  let { hasErrored, requiresInstall } = runChecks(
    packagesByName,
    rootPackage,
    shouldFix,
    options
  );
  const packageManager: PM = await detectPackageManager({
    cwd: rootDir,
  }).catch(() => "yarn");
  if (shouldFix) {
    await Promise.all(
      [...packagesByName].map(async ([pkgName, workspace]) => {
        writePackage(workspace);
      })
    );
    if (requiresInstall) {
      await install(tool.type, rootDir);
    }

    logger.success(`fixed workspaces!`);
  } else if (hasErrored) {
    logger.info(
      `the above errors may be fixable with ${packageManager} manypkg fix`
    );
    throw new ExitError(1);
  } else {
    logger.success(`workspaces valid!`);
  }
})().catch((err) => {
  if (err instanceof ExitError) {
    process.exit(err.code);
  } else {
    logger.error(err);
    process.exit(1);
  }
});
