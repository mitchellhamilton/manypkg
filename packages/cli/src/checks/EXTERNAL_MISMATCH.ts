import {
  makeCheck,
  getMostCommonRangeMap,
  getClosestAllowedRange,
  NORMAL_DEPENDENCY_TYPES,
} from "./utils";
import { Package } from "@manypkg/get-packages";
import { validRange } from "semver";

type ErrorType = {
  type: "EXTERNAL_MISMATCH";
  workspace: Package;
  dependencyName: string;
  dependencyRange: string;
  mostCommonDependencyRange: string;
};

export default makeCheck<ErrorType>({
  validate: (workspace, allWorkspace, rootWorkspace, options) => {
    let errors: ErrorType[] = [];
    let mostCommonRangeMap = getMostCommonRangeMap(allWorkspace);
    for (let depType of NORMAL_DEPENDENCY_TYPES) {
      let deps = workspace.packageJson[depType];

      if (deps) {
        for (let depName in deps) {
          let range = deps[depName];
          let mostCommonRange = mostCommonRangeMap.get(depName);
          const allowedVersions =
            options.allowedDependencyVersions &&
            options.allowedDependencyVersions[depName];
          if (
            mostCommonRange !== undefined &&
            mostCommonRange !== range &&
            !(allowedVersions && allowedVersions.includes(range)) &&
            validRange(range)
          ) {
            errors.push({
              type: "EXTERNAL_MISMATCH",
              workspace,
              dependencyName: depName,
              dependencyRange: range,
              mostCommonDependencyRange: allowedVersions
                ? getClosestAllowedRange(range, allowedVersions)
                : mostCommonRange,
            });
          }
        }
      }
    }
    return errors;
  },
  fix: (error) => {
    for (let depType of NORMAL_DEPENDENCY_TYPES) {
      let deps = error.workspace.packageJson[depType];
      if (deps && deps[error.dependencyName]) {
        deps[error.dependencyName] = error.mostCommonDependencyRange;
      }
    }
    return { requiresInstall: true };
  },
  print: (error) =>
    `${error.workspace.packageJson.name} has a dependency on ${error.dependencyName}@${error.dependencyRange} but the most common range in the repo is ${error.mostCommonDependencyRange}, the range should be set to ${error.mostCommonDependencyRange}`,
  type: "all",
});
