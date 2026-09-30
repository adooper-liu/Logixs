import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeControllerSources,
  formatRouteLine,
  summarizeRoutes,
} from "./check-route-access-metadata.mjs";

const CONTROLLER_FILE =
  "apps/api/src/modules/example/presentation/fixture.controller.ts";

const NEST = `import { Controller, Get, Post, Put, Patch, Delete, Options, Head, All } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { PublicEndpoint, ServiceEndpoint } from "../../../security/route-access.decorator";
import { RequireCapabilities } from "../../../security/require-capabilities.decorator";
`;

function audit(body, file = CONTROLLER_FILE) {
  return analyzeControllerSources([{ file, text: `${NEST}\n${body}` }]);
}

function only(routes) {
  assert.equal(routes.length, 1);
  return routes[0];
}

test("方法级 capability 单独成路由", () => {
  const route = only(
    audit(`
      @Controller("items")
      export class ItemsController {
        @Get(":id")
        @RequireCapabilities("planning.read")
        read() {}
      }
    `),
  );
  assert.equal(route.httpMethod, "GET");
  assert.equal(route.path, "/items/:id");
  assert.equal(route.classification, "capability");
  assert.deepEqual(route.capabilities, ["planning.read"]);
  assert.deepEqual(route.violations, []);
  assert.equal(
    formatRouteLine(route),
    `GET\t/items/:id\tItemsController.read\tcapability\tplanning.read\t-\t${CONTROLLER_FILE}`,
  );
});

test("没有方法级声明时继承类级 capability", () => {
  const route = only(
    audit(`
      @RequireCapabilities("planning.read")
      @Controller("items")
      export class ItemsController {
        @Get()
        @ApiOkResponse()
        list() {}
      }
    `),
  );
  assert.equal(route.classification, "capability");
  assert.deepEqual(route.capabilities, ["planning.read"]);
  assert.deepEqual(route.violations, []);
});

test("方法级 capability 覆盖类级 capability，与 getAllAndOverride 一致", () => {
  const routes = audit(`
    @RequireCapabilities("planning.read")
    @Controller("items")
    export class ItemsController {
      @Get()
      list() {}

      @Post()
      @RequireCapabilities("planning.draft")
      create() {}
    }
  `);
  assert.deepEqual(
    routes.map((route) => [route.methodName, route.capabilities]),
    [
      ["create", ["planning.draft"]],
      ["list", ["planning.read"]],
    ],
  );
  assert.deepEqual(routes[0].violations, []);
  assert.equal(routes[1].classification, "capability");
});

test("public、service、capability 都是合法分类", () => {
  const routes = analyzeControllerSources([
    {
      file: "apps/api/src/health/health.controller.ts",
      text: `
        import { Controller, Get } from "@nestjs/common";
        import { PublicEndpoint } from "../security/route-access.decorator";
        @PublicEndpoint()
        @Controller("health")
        export class HealthController {
          @Get()
          check() {}
        }
      `,
    },
    {
      file: "apps/api/src/modules/example/presentation/public.controller.ts",
      text: `${NEST}
        @PublicEndpoint()
        @Controller("health")
        export class HealthController {
          @Get()
          check() {}
        }`,
    },
    {
      file: "apps/api/src/modules/example/presentation/service.controller.ts",
      text: `${NEST}
        @ServiceEndpoint()
        @Controller("inbox")
        export class InboxController {
          @Post("messages")
          receive() {}
        }`,
    },
    {
      file: "apps/api/src/modules/example/presentation/user.controller.ts",
      text: `${NEST}
        @Controller("items")
        export class ItemsController {
          @Patch(":id")
          @RequireCapabilities("planning.draft", "container.read")
          update() {}
        }`,
    },
  ]);
  assert.deepEqual(
    routes.map((route) => route.classification),
    ["public", "public", "service", "capability"],
  );
  assert.deepEqual(routes[3].capabilities, [
    "planning.draft",
    "container.read",
  ]);
  assert.deepEqual(
    routes.flatMap((route) => route.violations),
    [],
  );
});

test("缺少分类、空 capability、冲突分类和动态参数都违规", () => {
  const routes = audit(`
    @PublicEndpoint()
    @Controller(prefix)
    export class MixedController {
      @Get()
      inheritedPublic() {}

      @Post()
      @RequireCapabilities("planning.draft")
      conflictsWithClass() {}

      @Put()
      @RequireCapabilities()
      emptyCapabilities() {}

      @Delete()
      plain() {}

      @Get(dynamicPath)
      unresolved() {}
    }
  `);
  const byMethod = Object.fromEntries(
    routes.map((route) => [route.methodName, route]),
  );
  assert.equal(byMethod.inheritedPublic.classification, "public");
  assert.equal(byMethod.inheritedPublic.path, "<unresolved>");
  assert.deepEqual(byMethod.inheritedPublic.violations, [
    "ROUTE_ARGUMENT_UNRESOLVED",
  ]);
  assert.equal(byMethod.conflictsWithClass.classification, "conflict");
  assert.ok(
    byMethod.conflictsWithClass.violations.includes(
      "ACCESS_CLASSIFICATION_CONFLICT",
    ),
  );
  assert.equal(byMethod.emptyCapabilities.classification, "conflict");
  assert.ok(byMethod.emptyCapabilities.violations.includes("CAPABILITY_EMPTY"));
  assert.equal(byMethod.plain.classification, "public");
  assert.equal(byMethod.unresolved.classification, "public");
  assert.deepEqual(byMethod.unresolved.violations, [
    "ROUTE_ARGUMENT_UNRESOLVED",
  ]);

  const emptyOnly = only(
    audit(`
      @Controller("items")
      export class ItemsController {
        @Post()
        @RequireCapabilities()
        create() {}
      }
    `),
  );
  assert.equal(emptyOnly.classification, "capability");
  assert.deepEqual(emptyOnly.capabilities, []);
  assert.deepEqual(emptyOnly.violations, ["CAPABILITY_EMPTY"]);

  const missing = only(
    audit(`
      @Controller("items")
      export class ItemsController {
        @Get()
        list() {}
      }
    `),
  );
  assert.equal(missing.classification, "missing");
  assert.deepEqual(missing.violations, ["ACCESS_CLASSIFICATION_MISSING"]);
});

test("同一方法上的 public 与 service 冲突，不能静默覆盖", () => {
  const route = only(
    audit(`
      @Controller("items")
      export class ItemsController {
        @Get()
        @PublicEndpoint()
        @ServiceEndpoint()
        both() {}
      }
    `),
  );
  assert.equal(route.classification, "conflict");
  assert.deepEqual(route.capabilities, []);
  assert.deepEqual(route.violations, ["ACCESS_METADATA_DUPLICATE"]);
});

test("非字面量、空白和重复 capability 违规", () => {
  const route = only(
    audit(`
      @Controller("items")
      export class ItemsController {
        @Post()
        @RequireCapabilities(dynamicCode, "planning.read", "planning.read", "  ")
        write() {}
      }
    `),
  );
  assert.equal(route.classification, "capability");
  assert.deepEqual(route.capabilities, ["planning.read"]);
  assert.deepEqual(route.violations, [
    "CAPABILITY_BLANK",
    "CAPABILITY_DUPLICATE",
    "CAPABILITY_NON_LITERAL",
  ]);
});

test("路径数组仍展开，无关装饰器不产生路由", () => {
  const routes = audit(`
    @Controller(["goods", "products"])
    export class ItemsController {
      @Get(["a", "b"])
      @ApiOkResponse()
      @RequireCapabilities("planning.read")
      collect() {}
    }
  `);
  assert.deepEqual(
    routes.map((route) => `${route.httpMethod} ${route.path}`),
    ["GET /goods/a", "GET /goods/b", "GET /products/a", "GET /products/b"],
  );
  assert.ok(routes.every((route) => route.violations.length === 0));
});

test("同名伪装饰器不认", () => {
  const route = only(
    analyzeControllerSources([
      {
        file: CONTROLLER_FILE,
        text: `
          import { Controller, Get } from "@nestjs/common";
          import { PublicEndpoint } from "./public-endpoint";
          import { RequireCapabilities } from "../../../modules/identity";
          @PublicEndpoint()
          @Controller("health")
          export class HealthController {
            @Get()
            @RequireCapabilities("planning.read")
            check() {}
          }
        `,
      },
    ]),
  );
  assert.equal(route.classification, "missing");
  assert.deepEqual(route.capabilities, []);
  assert.deepEqual(route.violations, ["ACCESS_CLASSIFICATION_MISSING"]);
});

test("重复装饰器失败关闭且不展开", () => {
  const access = only(
    audit(`
      @Controller("items")
      export class ItemsController {
        @Get()
        @RequireCapabilities("planning.read")
        @RequireCapabilities("planning.draft")
        write() {}
      }
    `),
  );
  assert.equal(access.httpMethod, "GET");
  assert.equal(access.classification, "conflict");
  assert.deepEqual(access.capabilities, []);
  assert.deepEqual(access.violations, ["ACCESS_METADATA_DUPLICATE"]);

  const http = only(
    audit(`
      @Controller("items")
      export class ItemsController {
        @Post("top")
        @Get("bottom")
        @RequireCapabilities("planning.read")
        collect() {}
      }
    `),
  );
  assert.equal(http.httpMethod, "POST");
  assert.equal(http.path, "/items/top");
  assert.equal(http.classification, "capability");
  assert.deepEqual(http.violations, ["HTTP_DECORATOR_DUPLICATE"]);
});

test("没有 Controller 的类、以及没有 HTTP 装饰器的方法都不计入", () => {
  const routes = audit(`
    class Helper {
      @Get()
      @RequireCapabilities("planning.read")
      ignored() {}
    }
    @Controller("items")
    export class ItemsController {
      @RequireCapabilities("planning.read")
      notARoute() {}
    }
  `);
  assert.deepEqual(routes, []);
});

test("排序稳定为 file、class、method、HTTP method，统计不依赖仓库现状", () => {
  const routes = analyzeControllerSources([
    {
      file: "apps/api/src/modules/example/presentation/b.controller.ts",
      text: `${NEST}
        @Controller("b")
        export class BController {
          @Post()
          zeta() {}
        }`,
    },
    {
      file: "apps/api/src/modules/example/presentation/a.controller.ts",
      text: `${NEST}
        @PublicEndpoint()
        @Controller("a")
        export class AController {
          @Get()
          alpha() {}
        }`,
    },
  ]);
  assert.deepEqual(
    routes.map(
      (route) => `${route.file}:${route.methodName}:${route.httpMethod}`,
    ),
    [
      "apps/api/src/modules/example/presentation/a.controller.ts:alpha:GET",
      "apps/api/src/modules/example/presentation/b.controller.ts:zeta:POST",
    ],
  );
  assert.deepEqual(summarizeRoutes(routes), {
    total: 2,
    public: 1,
    service: 0,
    capability: 0,
    missing: 1,
    conflict: 0,
  });
});
