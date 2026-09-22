from __future__ import annotations

import argparse
import json
from decimal import Decimal
from pathlib import Path
from typing import Any


def records(sheet: dict[str, Any], header_row: int = 1) -> list[dict[str, Any]]:
    headers = {c["column"]: c["value"] for c in sheet["cells"] if c["row"] == header_row}
    rows: dict[int, dict[str, Any]] = {}
    for cell in sheet["cells"]:
        if cell["row"] <= header_row or cell["column"] not in headers:
            continue
        rows.setdefault(cell["row"], {})[str(headers[cell["column"]])] = cell["value"]
    return [rows[index] for index in sorted(rows)]


def number(value: Any) -> Decimal:
    return Decimal(str(value).replace(",", ""))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("extract", type=Path)
    parser.add_argument("fixture", type=Path)
    parser.add_argument("report", type=Path)
    args = parser.parse_args()
    evidence = json.loads(args.extract.read_text(encoding="utf-8"))
    fixture = json.loads(args.fixture.read_text(encoding="utf-8"))
    files = {item["name"]: item for item in evidence["files"]}
    checks = []

    def check(code: str, observed: Any, expected: Any, source: str) -> None:
        passed = observed == expected
        checks.append({"code": code, "passed": passed, "observed": observed,
                       "expected": expected, "source": source})
        if not passed:
            raise AssertionError(f"{code}: observed={observed!r} expected={expected!r}")

    check("source.file_count", evidence["fileCount"], 44, "source directory")
    check("source.parse_errors", [f["name"] for f in evidence["files"] if f["parseError"]], [], "extract manifest")
    duplicates: dict[str, list[str]] = {}
    for item in evidence["files"]:
        duplicates.setdefault(item["sha256"], []).append(item["name"])
    duplicate_sets = sorted(sorted(names) for names in duplicates.values() if len(names) > 1)
    check("source.exact_duplicate_sets", duplicate_sets,
          [["26DSC01811,26DSC01812NBOZ9FF56400Wayfair上海 (1).xls",
            "26DSC01811,26DSC01812NBOZ9FF56400Wayfair上海.xls"]], "SHA-256")

    bom_file = files["报关平台.xlsx"]
    bom_sheet = next(s for s in bom_file["extracted"]["sheets"] if s["name"] == "货物BOM")
    bom_rows = records(bom_sheet)
    check("bom.row_count", len(bom_rows), 15, "报关平台.xlsx/货物BOM")
    check("bom.quantity_sum", str(sum(number(row["出运数量"]) for row in bom_rows)), "504", "报关平台.xlsx/货物BOM")
    check("bom.gross_weight_sum", str(sum(number(row["毛重(KG)"]) for row in bom_rows)), "7723.0", "报关平台.xlsx/货物BOM")
    check("bom.volume_sum", str(sum(number(row["体积"]) for row in bom_rows)), "67.25", "报关平台.xlsx/货物BOM")
    fixture_snapshots = [item["sourceSnapshot"] for item in fixture["productLines"]]
    check("fixture.product_snapshots_exact", fixture_snapshots == bom_rows, True,
          "fixture versus 报关平台.xlsx/货物BOM")

    platform_file = files["引出数据_备货平台拖进港数据_0921160106.xlsx"]
    platform_rows = records(next(s for s in platform_file["extracted"]["sheets"] if s["name"] == "sheet1"))
    sample_platform_rows = [row for row in platform_rows if row.get("备货单号") == "26DSC01812"]
    check("platform.earlier_gross_weight", sorted({str(number(r["毛重"])) for r in sample_platform_rows}),
          ["7706.6"], "备货平台拖进港数据/毛重")
    check("platform.earlier_volume", sorted({str(number(r["体积"])) for r in sample_platform_rows}),
          ["67.57"], "备货平台拖进港数据/体积")

    customs_sheet = next(s for s in files["报关平台.xlsx"]["extracted"]["sheets"] if s["name"] == "报关票数")
    customs_rows = records(customs_sheet)
    customs_totals = {"packages": sum(number(r["箱数"]) for r in customs_rows),
                      "grossWeightKg": sum(number(r["毛重"]) for r in customs_rows),
                      "volumeCbm": sum(number(r["体积"]) for r in customs_rows)}
    check("customs.invoice_count", len(customs_rows), 2, "报关平台.xlsx/报关票数")
    check("customs.package_sum", str(customs_totals["packages"]), "504", "报关平台.xlsx/报关票数")
    check("customs.gross_weight_sum", str(customs_totals["grossWeightKg"]), "7723", "报关平台.xlsx/报关票数")
    check("customs.volume_sum", str(customs_totals["volumeCbm"]), "67.25", "报关平台.xlsx/报关票数")

    premanifest = files["26DSC01811-NBOZ9FF56400预配舱单.xls"]["extracted"]["sheets"][0]
    by_address = {cell["address"]: cell["value"] for cell in premanifest["cells"]}
    check("manifest.container_1", [by_address[k] for k in ("A15", "B15", "K15", "L15", "M15")],
          ["HMMU4207629", "26H0407883", "949", "9630.90", "65.79"], "预配舱单/按箱统计")
    check("manifest.container_2", [by_address[k] for k in ("A16", "B16", "K16", "L16", "M16")],
          ["HMMU4956442", "26H0407525", "504", "7723.00", "67.25"], "预配舱单/按箱统计")
    check("manifest.total", [by_address[k] for k in ("J20", "L20", "M20")],
          ["1453", "17353.90", "133.04"], "预配舱单/总票统计")

    fixture_containers = {item["containerNumber"]: item for item in fixture["containers"]}
    check("fixture.container_1", [fixture_containers["HMMU4207629"][k] for k in ("packageCount", "grossWeightKg", "volumeCbm")],
          [949, 9630.9, 65.79], "fixture versus premanifest")
    check("fixture.container_2", [fixture_containers["HMMU4956442"][k] for k in ("packageCount", "grossWeightKg", "volumeCbm")],
          [504, 7723.0, 67.25], "fixture versus premanifest")

    pdf_text = "\n".join(page["text"] for page in files["26DSC01811-NBOZ9FF56400出运备注清单.pdf"]["extracted"]["pages"])
    for token in ("HMMU4207629/26H0407883 949.00/9630.90/65.79",
                  "HMMU4956442/26H0407525 504.00/7723.00/67.25"):
        check("pdf." + token[:11], token in pdf_text, True, "出运备注清单.pdf")

    report = {"status": "passed", "sourceFileCount": evidence["fileCount"],
              "checkCount": len(checks), "checks": checks,
              "preservedDifferences": fixture["observedConflicts"]}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "passed", "checkCount": len(checks), "report": str(args.report)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
