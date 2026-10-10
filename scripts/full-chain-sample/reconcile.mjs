const ref = (record) => `${record.recordType}:${record.businessKey}`;

function check(code, status, recordRefs = [], reason = undefined) {
  return { code, status, recordRefs, ...(reason ? { reason } : {}) };
}

export function runPackageChecks({ records, policy }) {
  const checks = [];
  const keys = new Set();
  for (const record of records) {
    const key = `${record.recordType}|${record.businessKey}`;
    const duplicate = keys.has(key);
    keys.add(key);
    checks.push(
      check(
        "CHECK_UNIQUE_BUSINESS_KEY",
        duplicate ? "fail" : "pass",
        [ref(record)],
        duplicate ? "duplicate business key" : undefined,
      ),
    );
  }
  const byType = (type) =>
    records.filter((record) => record.recordType === type);
  const cargoReady = new Set(
    byType("cargo_ready_release").map((record) => record.businessKey),
  );
  const stuffing = byType("stuffing_snapshot_line");
  for (const record of stuffing) {
    const cargoReadyNo = record.payload.cargoReadyNo;
    checks.push(
      check(
        "CHECK_REFERENCE_EXISTS",
        cargoReady.has(cargoReadyNo) ? "pass" : "fail",
        [ref(record)],
        cargoReady.has(cargoReadyNo)
          ? undefined
          : "referenced cargo-ready record is absent",
      ),
    );
  }
  const stuffingByHbl = new Set(
    stuffing.map((record) => record.payload.houseBillNo).filter(Boolean),
  );
  const bookings = new Map(
    byType("booking_commitment").map((record) => [
      record.payload.bookingNo,
      record.payload.masterBillNo,
    ]),
  );
  for (const dispatch of byType("dispatch_fact")) {
    const booking = [...bookings.entries()].find(
      ([, mbl]) => mbl && mbl === dispatch.payload.masterBillNo,
    );
    checks.push(
      check(
        "CHECK_MBL_MATCH",
        booking ? "pass" : "fail",
        [ref(dispatch)],
        booking ? undefined : "no matching master bill reference",
      ),
    );
  }
  for (const customs of byType("export_customs_case")) {
    const inScope =
      stuffingByHbl.has(customs.payload.houseBillNo) ||
      byType("booking_commitment").some((record) =>
        normalizeRefs(record.payload.houseBillRefs).includes(
          customs.payload.houseBillNo,
        ),
      );
    checks.push(
      check(
        "CHECK_HBL_SCOPE",
        inScope ? "pass" : "fail",
        [ref(customs)],
        inScope ? undefined : "customs HBL is outside booking/stuffing scope",
      ),
    );
  }
  for (const dispatch of byType("dispatch_fact")) {
    const gateIn = dispatch.payload.gateInDate;
    const departed = dispatch.payload.departedAt;
    if (gateIn && departed)
      checks.push(
        check(
          "CHECK_DATE_ORDER",
          gateIn <= departed ? "pass" : "fail",
          [ref(dispatch)],
          gateIn <= departed ? undefined : "gate-in occurs after departure",
        ),
      );
  }
  const numericCheck = (code, actual, expected, recordRefs) => {
    if (actual === undefined || expected === undefined) return;
    checks.push(
      check(
        code,
        Number(actual) === Number(expected) ? "pass" : "fail",
        recordRefs,
        Number(actual) === Number(expected)
          ? undefined
          : "reconciliation mismatch",
      ),
    );
  };
  for (const cargo of byType("cargo_ready_release")) {
    const lines = stuffing.filter(
      (record) => record.payload.cargoReadyNo === cargo.businessKey,
    );
    numericCheck(
      "CHECK_QUANTITY_RECONCILIATION",
      lines.reduce(
        (sum, record) => sum + Number(record.payload.quantity ?? 0),
        0,
      ),
      cargo.payload.quantity,
      [ref(cargo), ...lines.map(ref)],
    );
    numericCheck(
      "CHECK_WEIGHT_RECONCILIATION",
      lines.reduce(
        (sum, record) => sum + Number(record.payload.grossWeight ?? 0),
        0,
      ),
      cargo.payload.grossWeight,
      [ref(cargo), ...lines.map(ref)],
    );
    numericCheck(
      "CHECK_VOLUME_RECONCILIATION",
      lines.reduce(
        (sum, record) => sum + Number(record.payload.volume ?? 0),
        0,
      ),
      cargo.payload.volume,
      [ref(cargo), ...lines.map(ref)],
    );
  }
  for (const record of records) {
    if (
      record.derivation?.recomputedValue !== undefined &&
      record.payload.derivedValue !== undefined
    )
      checks.push(
        check(
          "CHECK_DERIVATION_RECOMPUTED",
          String(record.derivation.recomputedValue) ===
            String(record.payload.derivedValue)
            ? "pass"
            : "fail",
          [ref(record)],
          String(record.derivation.recomputedValue) ===
            String(record.payload.derivedValue)
            ? undefined
            : "derived value does not match recomputation",
        ),
      );
  }
  for (const record of records) {
    if (
      record.payload.amount !== undefined &&
      record.payload.amount !== null &&
      !record.payload.currency
    )
      checks.push(
        check(
          "CHECK_AMOUNT_CURRENCY",
          "fail",
          [ref(record)],
          "amount requires currency",
        ),
      );
  }
  const checkCodes = [
    "CHECK_UNIQUE_BUSINESS_KEY",
    "CHECK_REFERENCE_EXISTS",
    "CHECK_MBL_MATCH",
    "CHECK_HBL_SCOPE",
    "CHECK_DATE_ORDER",
    "CHECK_QUANTITY_RECONCILIATION",
    "CHECK_WEIGHT_RECONCILIATION",
    "CHECK_VOLUME_RECONCILIATION",
    "CHECK_DERIVATION_RECOMPUTED",
  ];
  const addNotApplicable = (code) => {
    const definition = policy?.checks?.[code];
    if (!checks.some((item) => item.code === code) && definition?.defaultStatus)
      checks.push(check(code, definition.defaultStatus, [], definition.reason));
  };
  for (const code of checkCodes) addNotApplicable(code);
  return checks;
}

function normalizeRefs(value) {
  return value
    ? String(value)
        .split(/[+,/\s]+/u)
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

export function hasBlockingChecks(checks) {
  return checks.some((checkResult) => checkResult.status === "fail");
}
