import {
  DamagesData,
  DamagesHead,
  ExpertStance,
  MedicalRecordQuality,
  UncertaintyLevel,
} from '../types';

export interface LiabilityScoreResult {
  probability: number;
  range: [number, number];
  uncertainty: UncertaintyLevel;
}

const MEDICAL_QUALITY_WEIGHTS: Record<MedicalRecordQuality, number> = {
  Complete: -2,
  Partial: 3,
  Poor: 7,
};

const STANCE_WEIGHTS: Record<ExpertStance, number> = {
  None: 0,
  Defense: -5,
  Plaintiff: 5,
};

export const calculateLiabilityScore = (
  baselineProbability: number,
  aggravatingFactors: number,
  mitigatingFactors: number,
  medicalRecordQuality: MedicalRecordQuality,
  expertCourtStance: ExpertStance,
): LiabilityScoreResult => {
  let probability =
    baselineProbability +
    (aggravatingFactors - mitigatingFactors) * 5 +
    MEDICAL_QUALITY_WEIGHTS[medicalRecordQuality] +
    STANCE_WEIGHTS[expertCourtStance];

  probability = Math.max(1, Math.min(99, probability));
  const range: [number, number] = [Math.max(0, probability - 12), Math.min(100, probability + 12)];
  const spread = range[1] - range[0];
  const uncertainty: UncertaintyLevel = spread <= 20 ? 'Low' : spread <= 30 ? 'Medium' : 'High';

  return { probability, range, uncertainty };
};

export const calculateHeadValue = (head: DamagesHead, damages: DamagesData): number => {
  if (!head.isActive) return 0;
  const baseLoss = Math.max(0, damages.wagePreInjury - damages.wagePostInjury);
  const disabilityFactor = 1 + damages.permanentDisabilityFunctional / 100;
  const durationFactor = 1 + damages.daysOfHospitalization / 365;
  const multiplier =
    typeof head.parameters?.multiplier === 'number' ? (head.parameters.multiplier as number) : 1;
  const manualAmount = Number.isFinite(head.calculatedAmount) ? head.calculatedAmount : 0;
  const derivedAmount = baseLoss * disabilityFactor * durationFactor * 12;
  return Math.round(Math.max(manualAmount, derivedAmount) * multiplier);
};

export const calculateMPL = (damages: DamagesData): number => {
  const baseIncomeLoss = Math.max(0, damages.wagePreInjury - damages.wagePostInjury);
  const horizonYears = Math.max(1, damages.lifeExpectancy - damages.currentAge);
  const disabilityRatio = damages.permanentDisabilityFunctional / 100;
  const incomeComponent = baseIncomeLoss * 12 * horizonYears * disabilityRatio;
  const headsComponent = damages.heads.reduce((sum, head) => sum + calculateHeadValue(head, damages), 0);
  const interestFactor = 1 + damages.interestRate / 100;
  return Math.round(Math.max(0, (incomeComponent + headsComponent) * interestFactor));
};

