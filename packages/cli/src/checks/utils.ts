import { Package } from "@manypkg/get-packages";
import * as semver from "semver";
import { highest } from "sembear";
import * as logger from "../logger";
import { ExitError } from "../errors";

export const NORMAL_DEPENDENCY_TYPES = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
] as const;

export const DEPENDENCY_TYPES = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;

export type Options = {
  defaultBranch?: string;
  ignoredRules?: string[];
  workspaceProtocol?: "allow" | "require";
  allowedDependencyVersions?: { [dependency: string]: string[] };
};

type RootCheck<ErrorType> = {
  type: "root";
  validate: (
    rootPackage: Package,
    allPackages: Map<string, Package>,
    options: Options
  ) => ErrorType[];
  fix?: (
    error: ErrorType,
    options: Options
  ) => void | { requiresInstall: boolean };
  print: (error: ErrorType, options: Options) => string;
};

type RootCheckWithFix<ErrorType> = {
  type: "root";
  validate: (
    rootPackage: Package,
    allPackages: Map<string, Package>,
    options: Options
  ) => ErrorType[];
  fix: (
    error: ErrorType,
    options: Options
  ) => void | { requiresInstall: boolean };
  print: (error: ErrorType, options: Options) => string;
};

type AllCheck<ErrorType> = {
  type: "all";
  validate: (
    workspace: Package,
    allWorkspaces: Map<string, Package>,
    rootWorkspace: Package | undefined,
    options: Options
  ) => ErrorType[];
  fix?: (
    error: ErrorType,
    options: Options
  ) => void | { requiresInstall: boolean };
  print: (error: ErrorType, options: Options) => string;
};

type AllCheckWithFix<ErrorType> = {
  type: "all";
  validate: (
    workspace: Package,
    allWorkspaces: Map<string, Package>,
    rootWorkspace: Package | undefined,
    options: Options
  ) => ErrorType[];
  fix: (
    error: ErrorType,
    options: Options
  ) => void | { requiresInstall: boolean };
  print: (error: ErrorType, options: Options) => string;
};

export function sortObject(prevObj: { [key: string]: string }) {
  let newObj: { [key: string]: string } = {};

  for (let key of Object.keys(prevObj).sort()) {
    newObj[key] = prevObj[key];
  }
  return newObj;
}

export function sortDeps(pkg: Package) {
  for (let depType of DEPENDENCY_TYPES) {
    let prevDeps = pkg.packageJson[depType];
    if (prevDeps) {
      pkg.packageJson[depType] = sortObject(prevDeps);
    }
  }
}

// export type Package = Package;

function weakMemoize<Arg, Ret>(func: (arg: Arg) => Ret): (arg: Arg) => Ret {
  let cache = new WeakMap<any, any>();
  // @ts-ignore
  return (arg) => {
    if (cache.has(arg)) {
      // $FlowFixMe
      return cache.get(arg);
    }
    let ret = func(arg);
    cache.set(arg, ret);
    return ret;
  };
}

export let getMostCommonRangeMap = weakMemoize(function getMostCommonRanges(
  allPackages: Map<string, Package>
) {
  let dependencyRangesMapping = new Map<string, { [key: string]: number }>();

  for (let [pkgName, pkg] of allPackages) {
    for (let depType of NORMAL_DEPENDENCY_TYPES) {
      let deps = pkg.packageJson[depType];
      if (deps) {
        for (let depName in deps) {
          const depSpecifier = deps[depName];
          if (!allPackages.has(depName)) {
            if (!semver.validRange(deps[depName])) {
              continue;
            }
            let dependencyRanges = dependencyRangesMapping.get(depName) || {};
            const specifierCount = dependencyRanges[depSpecifier] || 0;
            dependencyRanges[depSpecifier] = specifierCount + 1;
            dependencyRangesMapping.set(depName, dependencyRanges);
          }
        }
      }
    }
  }

  let mostCommonRangeMap = new Map<string, string>();

  for (let [depName, specifierMap] of dependencyRangesMapping) {
    const specifierMapEntryArray = Object.entries(specifierMap);

    const [first] = specifierMapEntryArray;
    const maxValue = specifierMapEntryArray.reduce((acc, value) => {
      if (acc[1] === value[1]) {
        // If all dependency ranges occurances are equal, pick the highest.
        // It's impossible to infer intention of the developer
        // when all ranges occur an equal amount of times
        const highestRange = highest([acc[0], value[0]]);
        return [highestRange, acc[1]];
      }

      if (acc[1] > value[1]) {
        return acc;
      }
      return value;
    }, first);

    mostCommonRangeMap.set(depName, maxValue[0]);
  }
  return mostCommonRangeMap;
});

export function versionRangeToRangeType(versionRange: string) {
  if (versionRange.charAt(0) === "^") return "^";
  if (versionRange.charAt(0) === "~") return "~";
  return "";
}

export function isArrayEqual(arrA: Array<string>, arrB: Array<string>) {
  for (var i = 0; i < arrA.length; i++) {
    if (arrA[i] !== arrB[i]) {
      return false;
    }
  }
  return true;
}

export function getClosestAllowedRange(
  range: string,
  allowedVersions: string[]
) {
  const major = semver.major(getVersionFromRange(range));
  const allowedVersionsWithSameMajor = allowedVersions.filter(
    (version) => semver.major(getVersionFromRange(version)) === major
  );
  const possibleRanges =
    allowedVersionsWithSameMajor.length > 0
      ? allowedVersionsWithSameMajor
      : allowedVersions;
  return possibleRanges.sort((a, b) =>
    semver.gt(getVersionFromRange(a), getVersionFromRange(b)) ? -1 : 1
  )[0];
}

function getVersionFromRange(range: string) {
  const minVersion = semver.minVersion(range);
  if (minVersion) {
    return minVersion;
  }
  logger.error(`Invalid range: ${range}`);
  throw new ExitError(1);
}

function makeCheck<ErrorType>(
  check: RootCheckWithFix<ErrorType>
): RootCheckWithFix<ErrorType>;
function makeCheck<ErrorType>(
  check: AllCheckWithFix<ErrorType>
): AllCheckWithFix<ErrorType>;
function makeCheck<ErrorType>(
  check: RootCheck<ErrorType>
): RootCheck<ErrorType>;
function makeCheck<ErrorType>(check: AllCheck<ErrorType>): AllCheck<ErrorType>;
function makeCheck<ErrorType>(
  check: RootCheck<ErrorType> | AllCheck<ErrorType>
): RootCheck<ErrorType> | AllCheck<ErrorType> {
  return check;
}

export { makeCheck };
