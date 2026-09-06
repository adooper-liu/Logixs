import { computed, shallowRef, watch, type Ref } from "vue";
import {
  queryDataTableRows,
  resolveDataTableCell,
  resolveDataTableProjection,
  type DataTableColumnDefinition,
  type DataTableProcessingMode,
  type DataTableProjection,
  type DataTableRow,
  type DataTableSort,
} from "./dataTableContract";

export interface DataTableExternalFilterView {
  readonly columnCode: string;
  readonly label: string;
  readonly displayValue: string;
}

interface UseDynamicDataTableOptions {
  projection: Ref<DataTableProjection>;
  processingMode: Ref<DataTableProcessingMode>;
  externalFilters: Ref<Readonly<Record<string, string>>>;
  query: Ref<string>;
  filter: Ref<string>;
  onSortChange: (sort: DataTableSort) => void;
}

export const useDynamicDataTable = (options: UseDynamicDataTableOptions) => {
  const hiddenColumnCodes = shallowRef<readonly string[]>([]);
  const currentSort = shallowRef<DataTableSort>();
  const clientPage = shallowRef(0);
  const resolution = computed(() =>
    resolveDataTableProjection(options.projection.value),
  );
  const availableColumns = computed(() => resolution.value.columns);

  watch(
    () => options.projection.value.schema,
    (schema) => {
      const hideable = new Set(
        schema.columns
          .filter((column) => column.hideable)
          .map((column) => column.code),
      );
      hiddenColumnCodes.value = hiddenColumnCodes.value.filter((code) =>
        hideable.has(code),
      );
      currentSort.value = schema.defaultSort;
      clientPage.value = 0;
    },
    { immediate: true },
  );

  watch(
    [options.query, options.filter, options.externalFilters],
    () => {
      clientPage.value = 0;
    },
    { deep: true },
  );

  const visibleColumnCodes = computed(() => {
    const hidden = new Set(hiddenColumnCodes.value);
    return availableColumns.value
      .filter((column) => !hidden.has(column.code))
      .map((column) => column.code);
  });
  const visibleColumns = computed(() => {
    const visible = new Set(visibleColumnCodes.value);
    return availableColumns.value.filter((column) => visible.has(column.code));
  });
  const matchAllFilterCode = computed(
    () =>
      options.projection.value.schema.quickFilters?.find(
        (item) => item.matchAll,
      )?.code,
  );
  const queriedRows = computed(() => {
    if (options.processingMode.value === "server") return resolution.value.rows;
    return queryDataTableRows({
      rows: resolution.value.rows,
      columns: availableColumns.value,
      query: options.query.value,
      filterCode: options.filter.value,
      matchAllFilterCode: matchAllFilterCode.value,
      externalFilters: options.externalFilters.value,
      sort: currentSort.value,
    });
  });
  const clientLimit = computed(() => options.projection.value.pageInfo.limit);
  const clientPageCount = computed(() =>
    Math.max(1, Math.ceil(queriedRows.value.length / clientLimit.value)),
  );
  const displayedRows = computed(() => {
    if (options.processingMode.value === "server") return queriedRows.value;
    const offset = clientPage.value * clientLimit.value;
    return queriedRows.value.slice(offset, offset + clientLimit.value);
  });
  const resultTotal = computed(() =>
    options.processingMode.value === "server"
      ? options.projection.value.pageInfo.total
      : queriedRows.value.length,
  );
  const resultStart = computed(() => {
    if (!resultTotal.value) return 0;
    return options.processingMode.value === "server"
      ? options.projection.value.pageInfo.offset + 1
      : clientPage.value * clientLimit.value + 1;
  });
  const resultEnd = computed(() =>
    Math.min(
      resultTotal.value,
      resultStart.value + displayedRows.value.length - 1,
    ),
  );
  const hasPrevious = computed(() =>
    options.processingMode.value === "server"
      ? options.projection.value.pageInfo.hasPrevious
      : clientPage.value > 0,
  );
  const hasNext = computed(() =>
    options.processingMode.value === "server"
      ? options.projection.value.pageInfo.hasNext
      : clientPage.value + 1 < clientPageCount.value,
  );

  const externalFilterEntries = computed<DataTableExternalFilterView[]>(() =>
    Object.entries(options.externalFilters.value).flatMap(
      ([columnCode, value]) => {
        const column = availableColumns.value.find(
          (item) => item.code === columnCode,
        );
        if (!column) return [];
        const matchingRow = resolution.value.rows.find((row) => {
          const cell = resolveDataTableCell(column, row.values[column.code]);
          return (cell.code ?? cell.displayValue) === value;
        });
        const displayValue = matchingRow
          ? resolveDataTableCell(column, matchingRow.values[column.code])
              .displayValue
          : value;
        return [{ columnCode, label: column.label, displayValue }];
      },
    ),
  );

  const rowLabel = (row: DataTableRow) => {
    const column = availableColumns.value.find(
      (item) =>
        item.code === options.projection.value.schema.rowLabelColumnCode,
    );
    return column
      ? resolveDataTableCell(column, row.values[column.code]).displayValue
      : row.rowId;
  };
  const columnStyle = (column: DataTableColumnDefinition) => ({
    width: `${column.width}px`,
    minWidth: `${column.width}px`,
  });
  const stickyStyle = (column: DataTableColumnDefinition) => {
    if (!column.pinned) return undefined;
    const index = visibleColumns.value.findIndex(
      (item) => item.code === column.code,
    );
    const related =
      column.pinned === "left"
        ? visibleColumns.value.slice(0, index)
        : visibleColumns.value.slice(index + 1);
    const offset = related
      .filter((item) => item.pinned === column.pinned)
      .reduce((total, item) => total + item.width, 0);
    return { [column.pinned]: `${offset}px` };
  };
  const ariaSort = (column: DataTableColumnDefinition) => {
    if (!column.sortable) return undefined;
    if (currentSort.value?.columnCode !== column.code) return "none";
    return currentSort.value.direction === "asc" ? "ascending" : "descending";
  };
  const sortLabel = (column: DataTableColumnDefinition) => {
    const nextDirection =
      currentSort.value?.columnCode === column.code &&
      currentSort.value.direction === "asc"
        ? "降序"
        : "升序";
    return `按${column.label}${nextDirection}排列`;
  };
  const changeSort = (column: DataTableColumnDefinition) => {
    if (!column.sortable) return;
    const sort: DataTableSort = {
      columnCode: column.code,
      direction:
        currentSort.value?.columnCode === column.code &&
        currentSort.value.direction === "asc"
          ? "desc"
          : "asc",
    };
    currentSort.value = sort;
    clientPage.value = 0;
    options.onSortChange(sort);
  };
  const toggleColumn = (columnCode: string) => {
    const hidden = new Set(hiddenColumnCodes.value);
    if (hidden.has(columnCode)) hidden.delete(columnCode);
    else hidden.add(columnCode);
    hiddenColumnCodes.value = [...hidden];
  };
  const previousPage = () => {
    if (hasPrevious.value && options.processingMode.value === "client")
      clientPage.value -= 1;
  };
  const nextPage = () => {
    if (hasNext.value && options.processingMode.value === "client")
      clientPage.value += 1;
  };

  return {
    resolution,
    availableColumns,
    visibleColumnCodes,
    visibleColumns,
    currentSort,
    displayedRows,
    resultTotal,
    resultStart,
    resultEnd,
    hasPrevious,
    hasNext,
    externalFilterEntries,
    rowLabel,
    columnStyle,
    stickyStyle,
    ariaSort,
    sortLabel,
    changeSort,
    toggleColumn,
    previousPage,
    nextPage,
  };
};
