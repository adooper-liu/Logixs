from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


TENANT_ID = "demo-real-sample-20260921"
BATCH_ID = "demo-import-26dsc01812-bom"
ORDER_IDS = {
    "26DSC01811": "demo-order-26dsc01811",
    "26DSC01812": "demo-order-26dsc01812",
}
CONTAINER_IDS = {
    "26DSC01811": "demo-container-hmmu4207629",
    "26DSC01812": "demo-container-hmmu4956442",
}
UNIT_CODES = {"件": "piece", "套": "set"}


def sheet_records(sheet: dict[str, Any]) -> list[dict[str, Any]]:
    headers = {cell["column"]: cell["value"] for cell in sheet["cells"] if cell["row"] == 1}
    rows: dict[int, dict[str, Any]] = {}
    for cell in sheet["cells"]:
        if cell["row"] <= 1 or cell["column"] not in headers:
            continue
        rows.setdefault(cell["row"], {})[str(headers[cell["column"]])] = cell["value"]
    return [rows[index] for index in sorted(rows)]


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def build_sql(fixture: dict[str, Any]) -> str:
    source = fixture["sources"]["bom"]
    lines = [
        "-- Real-data demo seed. Idempotent within the dedicated demo tenant.",
        "-- Source values are preserved in import_row.snapshot; this file does not advance lifecycle nodes.",
        "BEGIN;",
        "",
        "INSERT INTO import_batch (id, tenant_id, operator_id, idempotency_key, file_name, file_hash,",
        "  source_file_status, source_content_type, source_size_bytes, parser_version, status,",
        "  row_count, column_count, mapping_suggestions, confirmed_quantity_unit, created_at, updated_at)",
        f"VALUES ({sql_literal(BATCH_ID)}, {sql_literal(TENANT_ID)}, 'demo-seed',",
        "  'real-sample-20260921-26dsc01812-bom', " + sql_literal(source["sha256"]) + ",",
        "  'not_retained', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',",
        f"  {source['sizeBytes']}, 'real-sample-v1', 'completed', {len(fixture['productLines'])},",
        "  36, '[]'::jsonb, NULL, TIMESTAMPTZ '2026-09-21T00:00:00+08:00', TIMESTAMPTZ '2026-09-21T00:00:00+08:00')",
        "ON CONFLICT (tenant_id, idempotency_key) DO UPDATE SET",
        "  file_hash = EXCLUDED.file_hash, row_count = EXCLUDED.row_count,",
        "  column_count = EXCLUDED.column_count, updated_at = EXCLUDED.updated_at;",
        "",
    ]
    for order_number, order_id in ORDER_IDS.items():
        lines.extend([
            "INSERT INTO replenishment_order (id, tenant_id, order_number, created_at, updated_at)",
            f"VALUES ({sql_literal(order_id)}, {sql_literal(TENANT_ID)}, {sql_literal(order_number)},",
            "  TIMESTAMP '2026-09-21 00:00:00', TIMESTAMP '2026-09-21 00:00:00')",
            "ON CONFLICT (tenant_id, order_number) DO UPDATE SET updated_at = EXCLUDED.updated_at;",
            "",
        ])
    for container in fixture["containers"]:
        lines.extend([
            "INSERT INTO container_record (id, tenant_id, order_number, replenishment_order_id,",
            "  main_order_number, container_number, current_status, created_at, updated_at)",
            f"VALUES ({sql_literal(container['id'])}, {sql_literal(TENANT_ID)}, {sql_literal(container['orderNumber'])},",
            f"  {sql_literal(ORDER_IDS[container['orderNumber']])}, '26DSC01811', {sql_literal(container['containerNumber'])},",
            "  'shipped', TIMESTAMP '2026-09-21 00:00:00', TIMESTAMP '2026-09-21 00:00:00')",
            "ON CONFLICT (id) DO UPDATE SET",
            "  replenishment_order_id = EXCLUDED.replenishment_order_id,",
            "  main_order_number = EXCLUDED.main_order_number, container_number = EXCLUDED.container_number,",
            "  current_status = EXCLUDED.current_status, updated_at = EXCLUDED.updated_at;",
            "",
        ])
    for index, product in enumerate(fixture["productLines"], start=1):
        row_id = f"demo-row-26dsc01812-{index:02d}"
        snapshot = json.dumps(product["sourceSnapshot"], ensure_ascii=False, separators=(",", ":"))
        lines.extend([
            "INSERT INTO import_row (id, batch_id, row_no, snapshot, created_at)",
            f"VALUES ({sql_literal(row_id)}, {sql_literal(BATCH_ID)}, {index}, {sql_literal(snapshot)}::jsonb,",
            "  TIMESTAMP '2026-09-21 00:00:00')",
            "ON CONFLICT (batch_id, row_no) DO UPDATE SET snapshot = EXCLUDED.snapshot;",
            "",
            "INSERT INTO replenishment_order_line (id, tenant_id, replenishment_order_id, product_number,",
            "  shipped_quantity, quantity_unit, contract_number, source_batch_id, source_row_id,",
            "  is_current, created_at, updated_at)",
            f"VALUES ('demo-line-26dsc01812-{index:02d}', {sql_literal(TENANT_ID)}, 'demo-order-26dsc01812',",
            f"  {sql_literal(product['productNumber'])}, {product['shippedQuantity']}, {sql_literal(product['quantityUnit'])},",
            f"  {sql_literal(product['contractNumber'])}, {sql_literal(BATCH_ID)}, {sql_literal(row_id)}, true,",
            "  TIMESTAMP '2026-09-21 00:00:00', TIMESTAMP '2026-09-21 00:00:00')",
            "ON CONFLICT (source_batch_id, source_row_id) DO UPDATE SET",
            "  product_number = EXCLUDED.product_number, shipped_quantity = EXCLUDED.shipped_quantity,",
            "  quantity_unit = EXCLUDED.quantity_unit, contract_number = EXCLUDED.contract_number,",
            "  is_current = true, updated_at = EXCLUDED.updated_at;",
            "",
        ])
    lines.extend(["COMMIT;", ""])
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("extract", type=Path)
    parser.add_argument("fixture", type=Path)
    parser.add_argument("sql", type=Path)
    parser.add_argument("manifest", type=Path)
    args = parser.parse_args()
    evidence = json.loads(args.extract.read_text(encoding="utf-8"))
    files = {item["name"]: item for item in evidence["files"]}
    bom_file = files["报关平台.xlsx"]
    bom_sheet = next(item for item in bom_file["extracted"]["sheets"] if item["name"] == "货物BOM")
    bom_rows = sheet_records(bom_sheet)
    products = []
    for row in bom_rows:
        unit = UNIT_CODES.get(str(row["出运单位"]))
        if unit is None:
            raise ValueError(f"Unmapped quantity unit: {row['出运单位']}")
        products.append({
            "orderNumber": "26DSC01812",
            "productNumber": str(row["货号"]),
            "productName": row["品名"],
            "shippedQuantity": row["出运数量"],
            "quantityUnit": unit,
            "contractNumber": str(row["合同号"]),
            "contractLineNumber": row["合同行号"],
            "declarationQuantity": row["报关数量"],
            "declarationUnit": row["报关单位"],
            "packageCount": row["箱数"],
            "grossWeightKg": row["毛重(KG)"],
            "netWeightKg": row["净重(KG)"],
            "volumeCbm": row["体积"],
            "hsCode": str(row["海关编码"]),
            "declarationNameZh": row["报关品名"],
            "declarationNameEn": row["报关英文品名"],
            "inspectionRequired": row["商检"],
            "declarationInvoiceNumber": row["报关发票号"],
            "houseBillSuffix": row["字母"],
            "supplier": row["供应商"],
            "declarationEntity": row["报关公司"],
            "declarationUnitPriceCny": row["FOB单价(报关)"],
            "declarationUnitPriceUsd": row["FOB单价$"],
            "sourceSnapshot": row,
        })
    fixture = {
        "fixtureVersion": 1,
        "tenantId": TENANT_ID,
        "sourceDate": "2026-09-21",
        "sources": {
            "bom": {"fileName": bom_file["name"], "sha256": bom_file["sha256"],
                    "sizeBytes": bom_file["sizeBytes"], "sheet": "货物BOM"},
            "sourceDirectoryFileCount": evidence["fileCount"],
        },
        "shipment": {"mainOrderNumber": "26DSC01811", "combinedOrderNumbers": ["26DSC01811", "26DSC01812"],
            "masterBillNumber": "NBOZ9FF56400", "bookingNumber": "SQSJ26090200041842",
            "vesselName": "YM MASCULINITY", "voyageNumber": "108E", "carrier": "HMM",
            "originPort": "宁波", "destinationPort": "温哥华", "transshipmentPort": "塔科马",
            "containerType": "40HQ", "plannedContainerCount": 2,
            "etd": "2026-09-18", "actualDepartureDate": "2026-09-18", "eta": "2026-10-08"},
        "containers": [
            {"id": CONTAINER_IDS["26DSC01811"], "orderNumber": "26DSC01811",
             "containerNumber": "HMMU4207629", "sealNumber": "26H0407883",
             "houseBills": ["NBOZ9FF56400A", "NBOZ9FF56400B"], "packageCount": 949,
             "grossWeightKg": 9630.90, "volumeCbm": 65.79},
            {"id": CONTAINER_IDS["26DSC01812"], "orderNumber": "26DSC01812",
             "containerNumber": "HMMU4956442", "sealNumber": "26H0407525",
             "houseBills": ["NBOZ9FF56400C", "NBOZ9FF56400D"], "packageCount": 504,
             "grossWeightKg": 7723.00, "volumeCbm": 67.25},
        ],
        "houseBills": [
            {"number": "NBOZ9FF56400A", "containerNumber": "HMMU4207629", "packageCount": 459, "grossWeightKg": 4251.90, "volumeCbm": 31.74},
            {"number": "NBOZ9FF56400B", "containerNumber": "HMMU4207629", "packageCount": 490, "grossWeightKg": 5379.00, "volumeCbm": 34.05},
            {"number": "NBOZ9FF56400C", "containerNumber": "HMMU4956442", "packageCount": 479, "grossWeightKg": 7223.00, "volumeCbm": 60.93},
            {"number": "NBOZ9FF56400D", "containerNumber": "HMMU4956442", "packageCount": 25, "grossWeightKg": 500.00, "volumeCbm": 6.32},
        ],
        "productLines": products,
        "observedConflicts": [{"scope": "26DSC01812 / HMMU4956442", "field": "grossWeightKg",
            "earlierValue": 7706.60, "finalDocumentValue": 7723.00},
            {"scope": "26DSC01812 / HMMU4956442", "field": "volumeCbm",
             "earlierValue": 67.57, "finalDocumentValue": 67.25}],
    }
    source_manifest = {"sourceDirectoryFileCount": evidence["fileCount"], "files": []}
    for item in evidence["files"]:
        extracted = item["extracted"]
        entry = {"fileName": item["name"], "sizeBytes": item["sizeBytes"],
                 "sha256": item["sha256"], "actualFormat": extracted["format"],
                 "parseStatus": extracted.get("status", "parsed"),
                 "parseError": item["parseError"]}
        if "sheets" in extracted:
            entry["sheets"] = [{"name": sheet["name"], "rowCount": sheet["rowCount"],
                                "columnCount": sheet["columnCount"]} for sheet in extracted["sheets"]]
        if "pageCount" in extracted:
            entry["pageCount"] = extracted["pageCount"]
        if "entries" in extracted:
            entry["archiveEntries"] = [{"name": child["name"], "sizeBytes": child["sizeBytes"],
                                        "sha256": child["sha256"],
                                        "actualFormat": child["content"]["format"]}
                                       for child in extracted["entries"]]
        source_manifest["files"].append(entry)
    args.fixture.parent.mkdir(parents=True, exist_ok=True)
    args.sql.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    args.fixture.write_text(json.dumps(fixture, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    args.sql.write_text(build_sql(fixture), encoding="utf-8")
    args.manifest.write_text(json.dumps(source_manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"productLines": len(products), "fixture": str(args.fixture), "sql": str(args.sql),
                      "manifest": str(args.manifest)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
