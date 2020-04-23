import path from "path";
import check from "../INCORRECT_REPOSITORY_FIELD";
import { getWS, getFakeWS } from "../../test-helpers";

describe("incorrect repository field", () => {
  it("should work", () => {
    let ws = getWS();
    let rootWorkspace = getFakeWS("root");

    (rootWorkspace.packageJson as any).repository =
      "https://github.com/Thinkmill/manypkg";
    rootWorkspace.dir = __dirname;
    let workspace = getFakeWS("no-repository-field");
    workspace.dir = path.join(__dirname, "packages/no-repository-field");
    ws.set("depends-on-one", workspace);
    ws.set("root", rootWorkspace);
    let errors = check.validate(workspace, ws, rootWorkspace);
    expect(errors.map(({ workspace, ...x }: any) => x)).toMatchInlineSnapshot(`
      Array [
        Object {
          "correctRepositoryField": "https://github.com/Thinkmill/manypkg/tree/master/packages/no-repository-field",
          "currentRepositoryField": undefined,
          "type": "INCORRECT_REPOSITORY_FIELD",
        },
      ]
    `);

    check.fix(errors[0]);

    expect((workspace.packageJson as any).repository).toBe(
      "https://github.com/Thinkmill/manypkg/tree/master/packages/no-repository-field"
    );
  });
  it("should fix root in a different format", () => {
    let ws = getWS();
    let rootWorkspace = getFakeWS("root");

    (rootWorkspace.packageJson as any).repository =
      "https://github.com/Thinkmill/manypkg.git";

    rootWorkspace.dir = __dirname;
    let workspace = getFakeWS("no-repository-field");
    workspace.dir = path.join(__dirname, "packages/no-repository-field");
    ws.set("depends-on-one", workspace);
    ws.set("root", rootWorkspace);
    let errors = check.validate(rootWorkspace, ws, rootWorkspace);
    expect(errors.map(({ workspace, ...x }: any) => x)).toMatchInlineSnapshot(`
      Array [
        Object {
          "correctRepositoryField": "https://github.com/Thinkmill/manypkg",
          "currentRepositoryField": "https://github.com/Thinkmill/manypkg.git",
          "type": "INCORRECT_REPOSITORY_FIELD",
        },
      ]
    `);

    check.fix(errors[0]);

    expect((rootWorkspace.packageJson as any).repository).toBe(
      "https://github.com/Thinkmill/manypkg"
    );
  });
});
