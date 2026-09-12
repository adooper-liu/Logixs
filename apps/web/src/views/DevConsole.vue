<script setup lang="ts">
import { onMounted, ref } from "vue";
import PageHeader from "../components/ui/PageHeader.vue";

type ServiceState = "online" | "degraded" | "offline" | "checking";

interface ServiceStatus {
  name: string;
  state: ServiceState;
  detail: string;
}

const services = ref<ServiceStatus[]>([
  { name: "API", state: "checking", detail: "—" },
  { name: "数据库", state: "checking", detail: "—" },
  { name: "AI 服务", state: "checking", detail: "—" },
  { name: "Temporal", state: "checking", detail: "—" },
]);

async function probeOk(url: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function probeJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

onMounted(async () => {
  // API + 数据库（一次 /api/health 同时得两者状态）
  const health = await probeJson<{ status: string; database: string }>(
    "/api/health",
  );
  if (health) {
    services.value[0].state = health.status === "ok" ? "online" : "degraded";
    services.value[0].detail = health.status;
    services.value[1].state = health.database === "up" ? "online" : "offline";
    services.value[1].detail = health.database;
  } else {
    services.value[0].state = "offline";
    services.value[0].detail = "不可达";
    services.value[1].state = "offline";
    services.value[1].detail = "不可达";
  }

  // AI 服务
  const ai = await probeJson<{ status: string }>("/ai/health");
  services.value[2].state = ai ? "online" : "offline";
  services.value[2].detail = ai?.status ?? "不可达";

  // Temporal UI
  const temporalOk = await probeOk("/temporal/");
  services.value[3].state = temporalOk ? "online" : "offline";
  services.value[3].detail = temporalOk ? "up" : "不可达";
});

const tools = [
  {
    name: "Swagger（API 文档/调试）",
    url: "/api/docs",
    description: "可视化浏览与调用全部 API",
    external: false,
  },
  {
    name: "Prisma Studio（数据库）",
    url: "http://localhost:5555",
    description: "可视化查看/编辑数据库（需先 pnpm db:studio）",
    external: true,
  },
  {
    name: "Temporal UI（工作流）",
    url: "http://localhost:8233",
    description: "可视化查看工作流执行",
    external: true,
  },
];

const ports = [
  { service: "业务 PostgreSQL", port: "5433" },
  { service: "Temporal gRPC", port: "7233" },
  { service: "Temporal UI", port: "8233" },
  { service: "AI 服务", port: "8001" },
  { service: "API", port: "3000" },
  { service: "前端", port: "5173" },
];

const commands = [
  {
    command: "pnpm dev:all",
    description: "一键全起（基础设施+数据库+5 服务）",
  },
  { command: "pnpm dev", description: "只起前端 + API" },
  { command: "pnpm db:setup", description: "初始化数据库（迁移+seed）" },
  { command: "pnpm db:studio", description: "打开数据库可视化" },
  {
    command: "pnpm contract:drift",
    description: "契约类型与 Schema 无漂移检查",
  },
  { command: "pnpm validate", description: "全量质量门禁" },
];

function stateClass(state: ServiceState): string {
  return state;
}
</script>

<template>
  <div class="dev-console page-frame">
    <PageHeader eyebrow="开发者调试台" title="开发控制台" />

    <section class="block">
      <h2 class="block-title">服务状态</h2>
      <div class="services">
        <div
          v-for="service in services"
          :key="service.name"
          class="service-card"
        >
          <span class="dot" :class="stateClass(service.state)"></span>
          <span class="service-name">{{ service.name }}</span>
          <span class="service-detail">{{ service.detail }}</span>
        </div>
      </div>
    </section>

    <section class="block">
      <h2 class="block-title">工具入口</h2>
      <div class="tools">
        <a
          v-for="tool in tools"
          :key="tool.name"
          class="tool-card"
          :href="tool.url"
          :target="tool.external ? '_blank' : undefined"
          :rel="tool.external ? 'noopener' : undefined"
        >
          <span class="tool-name">{{ tool.name }}</span>
          <span class="tool-desc">{{ tool.description }}</span>
        </a>
      </div>
    </section>

    <section class="block">
      <h2 class="block-title">端口约定</h2>
      <table class="table">
        <thead>
          <tr>
            <th>服务</th>
            <th>端口</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in ports" :key="item.port">
            <td>{{ item.service }}</td>
            <td>{{ item.port }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="block">
      <h2 class="block-title">常用命令</h2>
      <table class="table">
        <thead>
          <tr>
            <th>命令</th>
            <th>作用</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in commands" :key="item.command">
            <td>
              <code>{{ item.command }}</code>
            </td>
            <td>{{ item.description }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped>
.dev-console {
  min-width: 0;
  min-height: 100%;
}
.block {
  margin-top: 20px;
}
.block-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text-secondary, #6b7280);
  margin: 0 0 10px;
}
.services {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}
.service-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid var(--app-border, #e5e7eb);
  border-radius: 8px;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #9ca3af;
  flex-shrink: 0;
}
.dot.online {
  background: var(--app-success, #16a34a);
}
.dot.degraded {
  background: var(--app-warn, #d97706);
}
.dot.offline {
  background: var(--app-danger, #dc2626);
}
.service-name {
  font-weight: 600;
}
.service-detail {
  margin-left: auto;
  font-size: 12px;
  color: var(--app-text-secondary, #6b7280);
}
.tools {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
.tool-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px;
  border: 1px solid var(--app-border, #e5e7eb);
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
}
.tool-card:hover {
  border-color: var(--app-accent, #2563eb);
}
.tool-name {
  font-weight: 600;
}
.tool-desc {
  font-size: 12px;
  color: var(--app-text-secondary, #6b7280);
}
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.table th,
.table td {
  text-align: left;
  padding: 8px 12px;
  border-bottom: 1px solid var(--app-border, #e5e7eb);
}
.table th {
  color: var(--app-text-secondary, #6b7280);
  font-weight: 600;
}
.table code {
  background: var(--app-bg-muted, #f3f4f6);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
}
</style>
