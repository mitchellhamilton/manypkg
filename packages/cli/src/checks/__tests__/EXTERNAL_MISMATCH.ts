import internalMismatch from "../EXTERNAL_MISMATCH";
import { getWS, getFakeWS, getRootWS } from "../../test-helpers";

let rootWorkspace = getRootWS();

it("should error if the ranges are valid and they are not equal", () => {
  let ws = getWS();

  ws.get("pkg-1")!.packageJson.dependencies = { something: "1.0.0" };

  let pkg2 = getFakeWS("pkg-2");
  pkg2.packageJson.dependencies = {
    something: "2.0.0",
  };
  ws.set("pkg-2", pkg2);

  let errors = internalMismatch.validate(pkg2, ws, rootWorkspace, {});
  expect(errors.length).toEqual(0);

  errors = internalMismatch.validate(ws.get("pkg-1")!, ws, rootWorkspace, {});
  expect(errors.length).toEqual(1);
  expect(errors).toMatchInlineSnapshot(`
    [
      {
        "dependencyName": "something",
        "dependencyRange": "1.0.0",
        "mostCommonDependencyRange": "2.0.0",
        "type": "EXTERNAL_MISMATCH",
        "workspace": {
          "dir": "fake/monorepo/packages/pkg-1",
          "packageJson": {
            "dependencies": {
              "something": "1.0.0",
            },
            "name": "pkg-1",
            "version": "1.0.0",
          },
          "relativeDir": "packages/pkg-1",
        },
      },
    ]
  `);
});

it("should error and return the correct expectedRange when the ranges are valid, they are not equal and there are more than 2", () => {
  let ws = getWS();

  ws.get("pkg-1")!.packageJson.dependencies = { something: "1.0.0" };

  let pkg2 = getFakeWS("pkg-2");
  pkg2.packageJson.dependencies = {
    something: "2.0.0",
  };
  ws.set("pkg-2", pkg2);

  let pkg3 = getFakeWS("pkg-3");
  pkg3.packageJson.dependencies = {
    something: "1.0.0",
  };

  ws.set("pkg-3", pkg3);
  let errors = internalMismatch.validate(
    ws.get("pkg-1")!,
    ws,
    rootWorkspace,
    {}
  );
  expect(errors.length).toEqual(0);

  errors = internalMismatch.validate(pkg2, ws, rootWorkspace, {});
  expect(errors.length).toEqual(1);
  expect(errors).toMatchInlineSnapshot(`
    [
      {
        "dependencyName": "something",
        "dependencyRange": "2.0.0",
        "mostCommonDependencyRange": "1.0.0",
        "type": "EXTERNAL_MISMATCH",
        "workspace": {
          "dir": "fake/monorepo/packages/pkg-2",
          "packageJson": {
            "dependencies": {
              "something": "2.0.0",
            },
            "name": "pkg-2",
            "version": "1.0.0",
          },
          "relativeDir": "packages/pkg-2",
        },
      },
    ]
  `);
});

it("should error and return the correct expectedRange when the ranges are valid, but the 2nd dependnecy is most common", () => {
  let ws = getWS();

  ws.get("pkg-1")!.packageJson.dependencies = { something: "2.0.0" };

  let pkg2 = getFakeWS("pkg-2");
  pkg2.packageJson.dependencies = {
    something: "1.0.0",
  };
  ws.set("pkg-2", pkg2);

  let pkg3 = getFakeWS("pkg-3");
  pkg3.packageJson.dependencies = {
    something: "1.0.0",
  };

  ws.set("pkg-3", pkg3);
  let errors = internalMismatch.validate(
    ws.get("pkg-1")!,
    ws,
    rootWorkspace,
    {}
  );

  expect(errors.length).toEqual(1);
  expect(errors).toMatchInlineSnapshot(`
    [
      {
        "dependencyName": "something",
        "dependencyRange": "2.0.0",
        "mostCommonDependencyRange": "1.0.0",
        "type": "EXTERNAL_MISMATCH",
        "workspace": {
          "dir": "fake/monorepo/packages/pkg-1",
          "packageJson": {
            "dependencies": {
              "something": "2.0.0",
            },
            "name": "pkg-1",
            "version": "1.0.0",
          },
          "relativeDir": "packages/pkg-1",
        },
      },
    ]
  `);

  errors = internalMismatch.validate(pkg2, ws, rootWorkspace, {});
  expect(errors.length).toEqual(0);
});

it("should error and return the correct expectedRange when the ranges are valid, but everything wants a different version", () => {
  let ws = getWS();

  ws.get("pkg-1")!.packageJson.dependencies = { something: "1.0.0" };

  let pkg2 = getFakeWS("pkg-2");
  pkg2.packageJson.dependencies = {
    something: "2.0.0",
  };
  ws.set("pkg-2", pkg2);

  let pkg3 = getFakeWS("pkg-3");
  pkg3.packageJson.dependencies = {
    something: "3.0.0",
  };

  ws.set("pkg-3", pkg3);
  let errors = internalMismatch.validate(
    ws.get("pkg-1")!,
    ws,
    rootWorkspace,
    {}
  );
  expect(errors.length).toEqual(1);
  expect(errors).toMatchInlineSnapshot(`
    [
      {
        "dependencyName": "something",
        "dependencyRange": "1.0.0",
        "mostCommonDependencyRange": "3.0.0",
        "type": "EXTERNAL_MISMATCH",
        "workspace": {
          "dir": "fake/monorepo/packages/pkg-1",
          "packageJson": {
            "dependencies": {
              "something": "1.0.0",
            },
            "name": "pkg-1",
            "version": "1.0.0",
          },
          "relativeDir": "packages/pkg-1",
        },
      },
    ]
  `);

  errors = internalMismatch.validate(pkg2, ws, rootWorkspace, {});
  expect(errors.length).toEqual(1);
  expect(errors).toMatchInlineSnapshot(`
    [
      {
        "dependencyName": "something",
        "dependencyRange": "2.0.0",
        "mostCommonDependencyRange": "3.0.0",
        "type": "EXTERNAL_MISMATCH",
        "workspace": {
          "dir": "fake/monorepo/packages/pkg-2",
          "packageJson": {
            "dependencies": {
              "something": "2.0.0",
            },
            "name": "pkg-2",
            "version": "1.0.0",
          },
          "relativeDir": "packages/pkg-2",
        },
      },
    ]
  `);

  errors = internalMismatch.validate(pkg3, ws, rootWorkspace, {});
  expect(errors.length).toEqual(0);
});

it("should not error if the value is not a valid semver range", () => {
  let ws = getWS();

  ws.get("pkg-1")!.packageJson.dependencies = { something: "1.0.0" };

  let pkg2 = getFakeWS("pkg-2");
  pkg2.packageJson.dependencies = {
    something: "git:x",
  };
  ws.set("pkg-2", pkg2);

  let errors = internalMismatch.validate(pkg2, ws, rootWorkspace, {});
  expect(errors.length).toEqual(0);

  errors = internalMismatch.validate(ws.get("pkg-1")!, ws, rootWorkspace, {});
  expect(errors.length).toEqual(0);
});

it("should not error if the range is included in the allowedDependencyVersions option", () => {
  let ws = getWS();

  ws.get("pkg-1")!.packageJson.dependencies = { something: "1.0.0" };

  let pkg2 = getFakeWS("pkg-2");
  pkg2.packageJson.dependencies = {
    something: "2.0.0",
  };
  ws.set("pkg-2", pkg2);

  const options = {
    allowedDependencyVersions: {
      something: ["1.0.0", "2.0.0"],
    },
  };

  let errors = internalMismatch.validate(pkg2, ws, rootWorkspace, options);
  expect(errors.length).toEqual(0);

  errors = internalMismatch.validate(
    ws.get("pkg-1")!,
    ws,
    rootWorkspace,
    options
  );
  expect(errors.length).toEqual(0);
});

it("should error and fix the version to the closest allowed one when adding an allowed major", () => {
  const options = {
    allowedDependencyVersions: {
      something: ["^1.0.0", "2.0.0"],
    },
  };

  let ws = getWS();

  ws.get("pkg-1")!.packageJson.dependencies = { something: "^1.0.0" };

  // version 1.0.0 is the most commonly used one
  let pkg1a = getFakeWS("pkg-1a");
  pkg1a.packageJson.dependencies = {
    something: "^1.0.0",
  };
  ws.set("pkg-1a", pkg1a);

  // version 2.0.0 is allowed
  let pkg2 = getFakeWS("pkg-2");
  pkg2.packageJson.dependencies = {
    something: "2.0.0",
  };
  ws.set("pkg-2", pkg2);

  // try to add version 2.1.0
  let pkg2a = getFakeWS("pkg-2a");
  pkg2a.packageJson.dependencies = {
    something: "^2.1.0",
  };
  ws.set("pkg-2a", pkg2a);

  let errors = internalMismatch.validate(pkg2a, ws, rootWorkspace, options);
  expect(errors.length).toEqual(1);
  expect(errors[0]).toEqual(
    expect.objectContaining({
      dependencyName: "something",
      dependencyRange: "^2.1.0",
      mostCommonDependencyRange: "2.0.0",
    })
  );
  internalMismatch.fix(errors[0], options);
  expect(pkg2a.packageJson.dependencies.something).toEqual("2.0.0");

  // try to add version 1.0.1
  let pkg1b = getFakeWS("pkg-1b");
  pkg1b.packageJson.dependencies = {
    something: "^1.0.1",
  };
  ws.set("pkg-1b", pkg1b);

  errors = internalMismatch.validate(pkg1b, ws, rootWorkspace, options);
  expect(errors.length).toEqual(1);
  expect(errors[0]).toEqual(
    expect.objectContaining({
      dependencyName: "something",
      dependencyRange: "^1.0.1",
      mostCommonDependencyRange: "^1.0.0",
    })
  );
  internalMismatch.fix(errors[0], options);
  expect(pkg1b.packageJson.dependencies.something).toEqual("^1.0.0");
});

it("should error and fix the version to the highest allowed one when adding a newer major", () => {
  const options = {
    allowedDependencyVersions: {
      something: ["1.0.0", "^2.0.0"],
    },
  };

  let ws = getWS();

  ws.get("pkg-1")!.packageJson.dependencies = { something: "1.0.0" };

  // version 1.0.0 is the most commonly used one
  let pkg1a = getFakeWS("pkg-1a");
  pkg1a.packageJson.dependencies = {
    something: "1.0.0",
  };
  ws.set("pkg-1a", pkg1a);

  // version 2.0.0 is allowed
  let pkg2 = getFakeWS("pkg-2");
  pkg2.packageJson.dependencies = {
    something: "^2.0.0",
  };
  ws.set("pkg-2", pkg2);

  // try to add version 3.0.0
  let pkg3 = getFakeWS("pkg-3");
  pkg3.packageJson.dependencies = {
    something: "3.0.0",
  };
  ws.set("pkg-3", pkg3);

  let errors = internalMismatch.validate(pkg3, ws, rootWorkspace, options);
  expect(errors.length).toEqual(1);
  expect(errors[0]).toEqual(
    expect.objectContaining({
      dependencyName: "something",
      dependencyRange: "3.0.0",
      mostCommonDependencyRange: "^2.0.0",
    })
  );
  internalMismatch.fix(errors[0], options);
  expect(pkg3.packageJson.dependencies.something).toEqual("^2.0.0");
});
