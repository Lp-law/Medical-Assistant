"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const medicalSpecialtyRules_1 = require("../medicalSpecialtyRules");
const buildClaim = (id, type, value, date = '2024-01-01') => ({
    id,
    type,
    value,
    date,
});
(0, vitest_1.describe)('medical specialty rules', () => {
    (0, vitest_1.it)('flags ortho complaints without imaging', () => {
        const findings = (0, medicalSpecialtyRules_1.runSpecialtyRules)([buildClaim('c1', 'Complaint', 'Back pain severe')], []);
        const ortho = findings.find((f) => f.code === 'MISSING_KEY_TEST_ORTHO');
        (0, vitest_1.expect)(ortho).toBeDefined();
        (0, vitest_1.expect)(ortho?.domain).toBe('ORTHO');
    });
    (0, vitest_1.it)('flags neuro complaints without neuro tests', () => {
        const findings = (0, medicalSpecialtyRules_1.runSpecialtyRules)([buildClaim('c2', 'Complaint', 'Neurologic weakness')], []);
        (0, vitest_1.expect)(findings.some((f) => f.code === 'MISSING_KEY_TEST_NEURO')).toBe(true);
    });
    (0, vitest_1.it)('flags cardio complaints without ECG', () => {
        const findings = (0, medicalSpecialtyRules_1.runSpecialtyRules)([buildClaim('c3', 'Complaint', 'Chest pain at rest')], []);
        (0, vitest_1.expect)(findings.some((f) => f.code === 'MISSING_KEY_TEST_CARDIO')).toBe(true);
    });
    (0, vitest_1.it)('flags psych complaints without plan', () => {
        const findings = (0, medicalSpecialtyRules_1.runSpecialtyRules)([buildClaim('c4', 'Complaint', 'PTSD symptoms')], []);
        (0, vitest_1.expect)(findings.some((f) => f.code === 'MISSING_KEY_TEST_PSYCH')).toBe(true);
    });
    (0, vitest_1.it)('flags rehab treatment gaps', () => {
        const findings = (0, medicalSpecialtyRules_1.runSpecialtyRules)([], [{ id: 't1', type: 'Therapy', description: 'Physiotherapy', date: '2024-01-01' }]);
        (0, vitest_1.expect)(findings.some((f) => f.code === 'TREATMENT_GAP_REHAB')).toBe(true);
    });
    (0, vitest_1.it)('flags dental infections without follow-up', () => {
        const findings = (0, medicalSpecialtyRules_1.runSpecialtyRules)([buildClaim('d1', 'Dental', 'abscess swelling mandible')], []);
        const dental = findings.find((f) => f.code === 'INFECTION_FOLLOWUP_MISSING_DENTAL');
        (0, vitest_1.expect)(dental).toBeDefined();
        (0, vitest_1.expect)(dental?.domain).toBe('DENTAL');
    });
    (0, vitest_1.it)('flags ENT hearing complaints without audiometry', () => {
        const findings = (0, medicalSpecialtyRules_1.runSpecialtyRules)([buildClaim('e1', 'ENT', 'tinnitus and hearing loss')], []);
        (0, vitest_1.expect)(findings.some((f) => f.code === 'MISSING_KEY_TEST_ENT_AUDIOMETRY')).toBe(true);
    });
    (0, vitest_1.it)('flags obgyn bleeding without ultrasound', () => {
        const findings = (0, medicalSpecialtyRules_1.runSpecialtyRules)([buildClaim('o1', 'OBGYN', 'pregnancy bleeding second trimester')], []);
        const finding = findings.find((f) => f.code === 'OBGYN_PREG_BLEED_NO_US');
        (0, vitest_1.expect)(finding?.domain).toBe('OBGYN');
    });
    (0, vitest_1.it)('flags emergency chest pain without ecg', () => {
        const findings = (0, medicalSpecialtyRules_1.runSpecialtyRules)([buildClaim('em1', 'ER', 'triage chest pain urgent')], []);
        const finding = findings.find((f) => f.code === 'EMERGENCY_CHEST_PAIN_NO_ECG');
        (0, vitest_1.expect)(finding?.domain).toBe('EMERGENCY');
    });
    (0, vitest_1.it)('flags icu sepsis without cultures', () => {
        const findings = (0, medicalSpecialtyRules_1.runSpecialtyRules)([buildClaim('icu1', 'ICU', 'sepsis septic shock refractory')], []);
        const finding = findings.find((f) => f.code === 'ICU_SEPSIS_NO_CULTURE');
        (0, vitest_1.expect)(finding?.domain).toBe('ICU');
    });
    (0, vitest_1.it)('flags general surgery acute abdomen without consult', () => {
        const findings = (0, medicalSpecialtyRules_1.runSpecialtyRules)([buildClaim('gs1', 'Surgery', 'acute abdomen peritonitis')], []);
        const finding = findings.find((f) => f.code === 'GENSURG_ACUTE_ABD_NO_REVIEW');
        (0, vitest_1.expect)(finding?.domain).toBe('GENERAL_SURGERY');
    });
    (0, vitest_1.it)('flags plastic surgery implant issues without device info', () => {
        const findings = (0, medicalSpecialtyRules_1.runSpecialtyRules)([buildClaim('p1', 'Plastic', 'implant rupture left breast')], []);
        const finding = findings.find((f) => f.code === 'PLASTIC_IMPLANT_NO_DEVICE_INFO');
        (0, vitest_1.expect)(finding?.domain).toBe('PLASTIC_SURGERY');
    });
    (0, vitest_1.it)('flags cosmetic injections without consent', () => {
        const findings = (0, medicalSpecialtyRules_1.runSpecialtyRules)([buildClaim('c99', 'Cosmetic', 'lip filler cosmetic correction')], []);
        const finding = findings.find((f) => f.code === 'COSMETIC_NO_CONSENT');
        (0, vitest_1.expect)(finding?.domain).toBe('COSMETIC_INJECTABLES');
    });
});
