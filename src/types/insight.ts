export interface Insight {
  id: string;
  title: string;
  whatHappened: string;
  whyItHappened: string;
  whatToFix: string;
  howToPractice: string;
  severity: "critical" | "moderate" | "minor";
  isMock: boolean;
}
