export interface TaskConditionFact {
  id: string;
  factCode: string;
  timeKind: "actual" | "estimated";
  captureSource: string;
  evidenceRef: string | null;
}
