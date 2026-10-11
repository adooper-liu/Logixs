<script setup lang="ts">
import WorkbenchPageHeader from "../../components/workbench/WorkbenchPageHeader.vue";
</script>

<template>
  <main class="page-frame linked-feature-reference">
    <p class="linked-feature-reference__notice">
      合成结构演练数据，不是生产记录
    </p>
    <WorkbenchPageHeader stage-code="sourcing" eyebrow="关联子功能结构参考" />
    <section aria-label="来源上下文">
      <h2>受控来源引用</h2>
      <dl>
        <div>
          <dt>来源工作台</dt>
          <dd>选品立项</dd>
        </div>
        <div>
          <dt>来源对象</dt>
          <dd>合成机会 REF-001</dd>
        </div>
        <div>
          <dt>来源事项</dt>
          <dd>品类定义</dd>
        </div>
      </dl>
    </section>
    <section aria-label="独立业务界面">
      <h2>独立业务界面</h2>
      <p>
        该子功能拥有自己的业务目的、事实、权限、动作与结果，不嵌入原工作台右栏。
      </p>
    </section>
  </main>
</template>

<style scoped>
.linked-feature-reference {
  display: grid;
  gap: var(--space-3);
}

.linked-feature-reference__notice,
.linked-feature-reference section {
  margin: 0;
  padding: var(--space-3);
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--surface);
  color: var(--ink-soft);
}

.linked-feature-reference__notice {
  border-style: dashed;
}

.linked-feature-reference h2,
.linked-feature-reference p,
.linked-feature-reference dl,
.linked-feature-reference dd {
  margin: 0;
}

.linked-feature-reference h2 {
  color: var(--ink);
  font-size: var(--text-title);
}

.linked-feature-reference dl {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
  margin-top: var(--space-3);
}

.linked-feature-reference dt {
  color: var(--muted);
  font-size: var(--text-micro);
}

.linked-feature-reference dd {
  color: var(--ink);
  font-size: var(--text-meta);
  font-weight: 600;
}

@media (max-width: 680px) {
  .linked-feature-reference dl {
    grid-template-columns: 1fr;
  }
}
</style>
