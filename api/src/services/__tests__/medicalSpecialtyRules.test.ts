import { describe, expect, it } from 'vitest';
import { runSpecialtyRules } from '../medicalSpecialtyRules';

const buildClaim = (id: string, type: string, value: string, date = '2024-01-01') => ({
  id,
  type,
  value,
  date,
});

describe('medical specialty rules', () => {
  it('flags ortho complaints without imaging', () => {
    const findings = runSpecialtyRules([buildClaim('c1', 'Complaint', 'Back pain severe')], []);
    const ortho = findings.find((f) => f.code === 'MISSING_KEY_TEST_ORTHO');
    expect(ortho).toBeDefined();
    expect(ortho?.domain).toBe('ORTHO');
  });

  it('flags neuro complaints without neuro tests', () => {
    const findings = runSpecialtyRules([buildClaim('c2', 'Complaint', 'Neurologic weakness')], []);
    expect(findings.some((f) => f.code === 'MISSING_KEY_TEST_NEURO')).toBe(true);
  });

  it('flags cardio complaints without ECG', () => {
    const findings = runSpecialtyRules([buildClaim('c3', 'Complaint', 'Chest pain at rest')], []);
    expect(findings.some((f) => f.code === 'MISSING_KEY_TEST_CARDIO')).toBe(true);
  });

  it('flags psych complaints without plan', () => {
    const findings = runSpecialtyRules([buildClaim('c4', 'Complaint', 'PTSD symptoms')], []);
    expect(findings.some((f) => f.code === 'MISSING_KEY_TEST_PSYCH')).toBe(true);
  });

  it('flags rehab treatment gaps', () => {
    const findings = runSpecialtyRules(
      [],
      [{ id: 't1', type: 'Therapy', description: 'Physiotherapy', date: '2024-01-01' }],
    );
    expect(findings.some((f) => f.code === 'TREATMENT_GAP_REHAB')).toBe(true);
  });

  it('flags dental infections without follow-up', () => {
    const findings = runSpecialtyRules([buildClaim('d1', 'Dental', 'abscess swelling mandible')], []);
    const dental = findings.find((f) => f.code === 'INFECTION_FOLLOWUP_MISSING_DENTAL');
    expect(dental).toBeDefined();
    expect(dental?.domain).toBe('DENTAL');
  });

  it('flags ENT hearing complaints without audiometry', () => {
    const findings = runSpecialtyRules([buildClaim('e1', 'ENT', 'tinnitus and hearing loss')], []);
    expect(findings.some((f) => f.code === 'MISSING_KEY_TEST_ENT_AUDIOMETRY')).toBe(true);
  });

  it('flags obgyn bleeding without ultrasound', () => {
    const findings = runSpecialtyRules([buildClaim('o1', 'OBGYN', 'pregnancy bleeding second trimester')], []);
    const finding = findings.find((f) => f.code === 'OBGYN_PREG_BLEED_NO_US');
    expect(finding?.domain).toBe('OBGYN');
  });

  it('flags emergency chest pain without ecg', () => {
    const findings = runSpecialtyRules([buildClaim('em1', 'ER', 'triage chest pain urgent')], []);
    const finding = findings.find((f) => f.code === 'EMERGENCY_CHEST_PAIN_NO_ECG');
    expect(finding?.domain).toBe('EMERGENCY');
  });

  it('flags icu sepsis without cultures', () => {
    const findings = runSpecialtyRules([buildClaim('icu1', 'ICU', 'sepsis septic shock refractory')], []);
    const finding = findings.find((f) => f.code === 'ICU_SEPSIS_NO_CULTURE');
    expect(finding?.domain).toBe('ICU');
  });

  it('flags general surgery acute abdomen without consult', () => {
    const findings = runSpecialtyRules([buildClaim('gs1', 'Surgery', 'acute abdomen peritonitis')], []);
    const finding = findings.find((f) => f.code === 'GENSURG_ACUTE_ABD_NO_REVIEW');
    expect(finding?.domain).toBe('GENERAL_SURGERY');
  });

  it('flags plastic surgery implant issues without device info', () => {
    const findings = runSpecialtyRules([buildClaim('p1', 'Plastic', 'implant rupture left breast')], []);
    const finding = findings.find((f) => f.code === 'PLASTIC_IMPLANT_NO_DEVICE_INFO');
    expect(finding?.domain).toBe('PLASTIC_SURGERY');
  });

  it('flags cosmetic injections without consent', () => {
    const findings = runSpecialtyRules([buildClaim('c99', 'Cosmetic', 'lip filler cosmetic correction')], []);
    const finding = findings.find((f) => f.code === 'COSMETIC_NO_CONSENT');
    expect(finding?.domain).toBe('COSMETIC_INJECTABLES');
  });
});

