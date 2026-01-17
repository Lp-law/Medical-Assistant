"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSpecialtyRules = void 0;
const normalize = (value) => (value ?? '').toLowerCase();
const hasKeyword = (text, keywords) => keywords.some((keyword) => text.includes(keyword));
const findClaims = (claims, keywords) => claims.filter((claim) => hasKeyword(normalize(`${claim.type ?? ''} ${claim.value ?? ''}`), keywords));
const hasSupportingClaim = (claims, keywords) => findClaims(claims, keywords).length > 0;
const hasTimelineEvent = (timeline, keywords) => timeline.some((event) => hasKeyword(normalize(event.type), keywords) || hasKeyword(normalize(event.description), keywords));
const collectIds = (items) => items.map((claim) => claim.id).filter((id) => Boolean(id));
const LEGAL_DISCLAIMER = 'המערכת אינה מחליפה מומחה רפואי. זהו כלי תומך החלטה משפטית בלבד.';
const needsEvidenceRegex = /(MISSING|NO_|WITHOUT|GAP)/i;
const contradictionRegex = /(CONTRADICTION|INCONSISTENT)/i;
const enrichFinding = (finding) => {
    const claimIds = finding.relatedClaimIds?.filter(Boolean);
    const hasClaims = Boolean(claimIds && claimIds.length);
    const basis = finding.basis ??
        (hasClaims ? [`טענות קשורות: ${claimIds.join(', ')}`] : ['הסקה מבוססת ציר הזמן וכללי מומחה דטרמיניסטי']);
    let missingEvidence = finding.missingEvidence ?? [];
    if (!missingEvidence.length) {
        if (needsEvidenceRegex.test(finding.code)) {
            missingEvidence = ['יש לצרף את הבדיקה או התיעוד החסר המוזכר בממצא זה.'];
        }
        else if (contradictionRegex.test(finding.code)) {
            missingEvidence = ['נדרש הסבר קליני כתוב או חוות דעת מומחה להסרת הסתירה.'];
        }
        else {
            missingEvidence = ['מומלץ לתמוך בבדיקה נוספת או חוות דעת מומחה אנושי.'];
        }
    }
    return {
        ...finding,
        assertionType: finding.assertionType ?? (finding.severity === 'critical' ? 'INTERPRETATION' : 'POSSIBILITY'),
        basis,
        missingEvidence,
        reliability: finding.reliability ??
            {
                level: finding.severity === 'critical' ? 'medium' : 'low',
                rationale: 'כלל מומחה דטרמיניסטי בהתבסס על התיעוד המנותח.',
            },
        caution: finding.caution ?? LEGAL_DISCLAIMER,
    };
};
const pushFinding = (findings, finding) => {
    findings.push(enrichFinding({
        ...finding,
        relatedClaimIds: finding.relatedClaimIds?.filter(Boolean),
    }));
};
const filterClaims = (claims, include, exclude = []) => findClaims(claims, include).filter((claim) => {
    if (!exclude.length)
        return true;
    const text = normalize(`${claim.type ?? ''} ${claim.value ?? ''}`);
    return !exclude.some((keyword) => text.includes(keyword));
});
const runSpecialtyRules = (claims, timeline) => {
    const safeClaims = Array.isArray(claims) ? claims : [];
    const safeTimeline = Array.isArray(timeline) ? timeline : [];
    const findings = [];
    const hasTimelineKeywords = (keywords) => hasTimelineEvent(safeTimeline, keywords);
    // ORTHO
    const orthoComplaints = filterClaims(safeClaims, ['back pain', 'lumbar', 'knee', 'shoulder', 'orthopedic', 'spine']);
    if (orthoComplaints.length) {
        const hasImaging = hasSupportingClaim(safeClaims, ['mri', 'ct', 'x-ray', 'xr', 'ultrasound']);
        const hasExam = hasSupportingClaim(safeClaims, ['physical exam', 'range of motion', 'orthopedic exam']);
        if (!hasImaging || !hasExam) {
            pushFinding(findings, {
                code: 'MISSING_KEY_TEST_ORTHO',
                message: 'תלונה אורטופדית ללא הדמיה ו/או בדיקה גופנית מתועדות.',
                severity: 'warning',
                domain: 'ORTHO',
                relatedClaimIds: collectIds(orthoComplaints),
            });
        }
    }
    // NEURO
    const neuroComplaints = filterClaims(safeClaims, ['neurolog', 'numbness', 'weakness', 'seizure', 'stroke', 'paresthesia']);
    if (neuroComplaints.length && !hasSupportingClaim(safeClaims, ['neurological exam', 'emg', 'nerve conduction', 'ct', 'mri'])) {
        pushFinding(findings, {
            code: 'MISSING_KEY_TEST_NEURO',
            message: 'תלונה נוירולוגית ללא בדיקה או הדמיה נוירולוגית.',
            severity: 'warning',
            domain: 'NEURO',
            relatedClaimIds: collectIds(neuroComplaints),
        });
    }
    // CARDIO
    const cardioComplaints = filterClaims(safeClaims, ['chest pain', 'shortness of breath', 'dyspnea', 'palpitation']);
    if (cardioComplaints.length && !hasSupportingClaim(safeClaims, ['ecg', 'ekg', 'troponin', 'cardiac', 'echo', 'angiography'])) {
        pushFinding(findings, {
            code: 'MISSING_KEY_TEST_CARDIO',
            message: 'תלונה קרדיאלית ללא ECG/בדיקות בסיסיות.',
            severity: 'critical',
            domain: 'CARDIO',
            relatedClaimIds: collectIds(cardioComplaints),
        });
    }
    // PSYCH
    const psychComplaints = filterClaims(safeClaims, ['ptsd', 'depression', 'anxiety', 'psychi', 'mental']);
    if (psychComplaints.length && !hasSupportingClaim(safeClaims, ['psychiatry', 'therapy', 'cbt', 'ssri', 'psych follow-up'])) {
        pushFinding(findings, {
            code: 'MISSING_KEY_TEST_PSYCH',
            message: 'תלונות פסיכיאטריות ללא אבחנה או מעקב טיפולי מתועד.',
            severity: 'warning',
            domain: 'PSYCH',
            relatedClaimIds: collectIds(psychComplaints),
        });
    }
    // REHAB
    if (safeTimeline.some((event) => hasKeyword(normalize(event.type), ['therapy', 'rehab', 'physio']))) {
        if (!hasTimelineKeywords(['follow', 'review', 'evaluation'])) {
            pushFinding(findings, {
                code: 'TREATMENT_GAP_REHAB',
                message: 'טיפול שיקומי ללא תיעוד המשך או מעקב.',
                severity: 'info',
                domain: 'REHAB',
            });
        }
    }
    // DENTAL
    const dentalTrauma = filterClaims(safeClaims, ['jaw fracture', 'mandible', 'maxilla', 'שבר', 'fracture jaw', 'bite trauma']);
    if (dentalTrauma.length && !hasSupportingClaim(safeClaims, ['panoramic', 'ct', 'cbct', 'dental x-ray', 'occlusal'])) {
        pushFinding(findings, {
            code: 'MISSING_KEY_TEST_DENTAL_IMAGING',
            message: 'פגיעה דנטלית ללא CT/צילום פנורמי תומך.',
            severity: 'critical',
            domain: 'DENTAL',
            relatedClaimIds: collectIds(dentalTrauma),
        });
    }
    const dentalImplant = filterClaims(safeClaims, ['implant', 'extraction', 'root canal', 'crown', 'bridge']);
    if (dentalImplant.length && !hasSupportingClaim(safeClaims, ['pre-op', 'post-op', 'follow-up', 'complication', 'צילום'])) {
        pushFinding(findings, {
            code: 'MISSING_KEY_DOC_DENTAL_PRE_POST',
            message: 'טיפול דנטלי חודרני ללא תיעוד לפני/אחרי או סיבוכים.',
            severity: 'warning',
            domain: 'DENTAL',
            relatedClaimIds: collectIds(dentalImplant),
        });
    }
    const dentalInfection = filterClaims(safeClaims, ['abscess', 'infection', 'swelling', 'cellulitis', 'נפיחות']);
    if (dentalInfection.length && !hasSupportingClaim(safeClaims, ['antibiotic', 'drainage', 'incision', 'follow-up'])) {
        pushFinding(findings, {
            code: 'INFECTION_FOLLOWUP_MISSING_DENTAL',
            message: 'זיהום דנטלי ללא אנטיביוטיקה/ניקוז/מעקב מתועד.',
            severity: 'warning',
            domain: 'DENTAL',
            relatedClaimIds: collectIds(dentalInfection),
        });
    }
    const dentalNerve = filterClaims(safeClaims, ['paresthesia', 'hypoesthesia', 'mental nerve', 'nerve injury', 'numbness']);
    if (dentalNerve.length && !hasSupportingClaim(safeClaims, ['neurolog', 'sensory test', 'cbct', 'emg'])) {
        pushFinding(findings, {
            code: 'NERVE_INJURY_EVAL_MISSING',
            message: 'פגיעה עצבית דנטלית ללא בדיקה נוירולוגית/תחושתית.',
            severity: 'warning',
            domain: 'DENTAL',
            relatedClaimIds: collectIds(dentalNerve),
        });
    }
    // ENT
    const entAirway = filterClaims(safeClaims, ['sinusitis', 'nasal polyp', 'airway', 'throat mass', 'laryngeal', 'stridor']);
    if (entAirway.length && !hasSupportingClaim(safeClaims, ['endoscopy', 'fiberoptic', 'ct', 'mri', 'scope'])) {
        pushFinding(findings, {
            code: 'MISSING_KEY_TEST_ENT_ENDOSCOPY',
            message: 'תלונות אף-אוזן-גרון ללא אנדוסקופיה/הדמיה.',
            severity: 'warning',
            domain: 'ENT',
            relatedClaimIds: collectIds(entAirway),
        });
    }
    const entHearing = filterClaims(safeClaims, ['hearing loss', 'tinnitus', 'otitis', 'ear fullness']);
    if (entHearing.length && !hasSupportingClaim(safeClaims, ['audiogram', 'tympanometry', 'hearing test'])) {
        pushFinding(findings, {
            code: 'MISSING_KEY_TEST_ENT_AUDIOMETRY',
            message: 'פגיעה בשמיעה ללא בדיקת שמיעה פורמלית.',
            severity: 'warning',
            domain: 'ENT',
            relatedClaimIds: collectIds(entHearing),
        });
    }
    const entInfection = filterClaims(safeClaims, ['otitis', 'mastoiditis', 'tonsillitis', 'pharyngitis']);
    if (entInfection.length && !hasSupportingClaim(safeClaims, ['culture', 'antibiotic', 'follow-up', 'control visit'])) {
        pushFinding(findings, {
            code: 'ENT_INFECTION_FOLLOWUP_GAP',
            message: 'זיהום ENT ללא תרבית/טיפול ומעקב מתועדים.',
            severity: 'warning',
            domain: 'ENT',
            relatedClaimIds: collectIds(entInfection),
        });
    }
    // GASTRO
    const gastroBleed = filterClaims(safeClaims, ['gi bleed', 'hematemesis', 'melena', 'ulcer', 'varices']);
    if (gastroBleed.length && !hasSupportingClaim(safeClaims, ['endoscopy', 'gastroscopy', 'banding', 'colonoscopy'])) {
        pushFinding(findings, {
            code: 'MISSING_KEY_TEST_GASTRO_ENDO',
            message: 'דימום/כיב במערכת העיכול ללא תיעוד אנדוסקופי.',
            severity: 'critical',
            domain: 'GASTRO',
            relatedClaimIds: collectIds(gastroBleed),
        });
    }
    const gastroLiver = filterClaims(safeClaims, ['hepatitis', 'cirrhosis', 'liver failure', 'pancreatitis']);
    if (gastroLiver.length && !hasSupportingClaim(safeClaims, ['lft', 'ast', 'alt', 'amylase', 'lipase', 'bilirubin'])) {
        pushFinding(findings, {
            code: 'MISSING_KEY_TEST_GASTRO_LABS',
            message: 'מצב כבד/לבלב ללא בדיקות מעבדה תומכות.',
            severity: 'warning',
            domain: 'GASTRO',
            relatedClaimIds: collectIds(gastroLiver),
        });
    }
    if (safeTimeline.some((event) => hasKeyword(normalize(event.type), ['biologic', 'steroid', 'infusion']))) {
        if (!hasTimelineKeywords(['clinic visit', 'follow', 'monitor', 'labs'])) {
            pushFinding(findings, {
                code: 'GASTRO_TREATMENT_GAP',
                message: 'טיפול מדכא חיסון ללא מעקב/בדיקות לאחר מכן.',
                severity: 'warning',
                domain: 'GASTRO',
            });
        }
    }
    // OBGYN
    const pregnancyBleeding = filterClaims(safeClaims, ['pregnancy bleeding', 'vaginal bleed', 'placenta previa', 'שליה']);
    if (pregnancyBleeding.length && !hasSupportingClaim(safeClaims, ['ultrasound', 'us', 'sonography', 'doppler'])) {
        pushFinding(findings, {
            code: 'OBGYN_PREG_BLEED_NO_US',
            message: 'דימום בהריון ללא תיעוד אולטרסאונד או מעקב עוברי.',
            severity: 'critical',
            domain: 'OBGYN',
            relatedClaimIds: collectIds(pregnancyBleeding),
        });
    }
    const preeclampsia = filterClaims(safeClaims, ['preeclampsia', 'gestational hypertension', 'רעלת']);
    if (preeclampsia.length && !hasSupportingClaim(safeClaims, ['proteinuria', 'urine protein', 'platelets', 'lft', 'creatinine'])) {
        pushFinding(findings, {
            code: 'OBGYN_HTN_NO_LABS',
            message: 'לחץ דם בהריון ללא בדיקות מעבדה או חלבון בשתן מתועדים.',
            severity: 'warning',
            domain: 'OBGYN',
            relatedClaimIds: collectIds(preeclampsia),
        });
    }
    const cesarean = filterClaims(safeClaims, ['cesarean', 'c-section', 'ניתוח קיסרי']);
    if (cesarean.length && !hasSupportingClaim(safeClaims, ['indication', 'placenta', 'fetal distress', 'labor arrest'])) {
        pushFinding(findings, {
            code: 'OBGYN_CSECTION_NO_INDICATION',
            message: 'ניתוח קיסרי ללא תיעוד אינדיקציה רפואית.',
            severity: 'warning',
            domain: 'OBGYN',
            relatedClaimIds: collectIds(cesarean),
        });
    }
    const postpartumInfection = filterClaims(safeClaims, ['postpartum fever', 'lochia odor', 'זיהום לאחר לידה']);
    if (postpartumInfection.length && !hasSupportingClaim(safeClaims, ['antibiotic', 'culture', 'wound care', 'follow-up'])) {
        pushFinding(findings, {
            code: 'OBGYN_POSTPARTUM_INFECTION_GAP',
            message: 'חשד לזיהום לאחר לידה ללא טיפול ומעקב מתועדים.',
            severity: 'warning',
            domain: 'OBGYN',
            relatedClaimIds: collectIds(postpartumInfection),
        });
    }
    const fetalDistress = filterClaims(safeClaims, ['reduced fetal movement', 'non reassuring', 'oligohydramnios', 'fetal distress']);
    if (fetalDistress.length && !hasSupportingClaim(safeClaims, ['nst', 'ctg', 'biophysical profile', 'doppler', 'fetal monitoring'])) {
        pushFinding(findings, {
            code: 'OBGYN_FETAL_MONITORING_MISSING',
            message: 'חשד למצוקת עובר ללא ניטור עוברי מתועד.',
            severity: 'critical',
            domain: 'OBGYN',
            relatedClaimIds: collectIds(fetalDistress),
        });
    }
    const vbacClaims = filterClaims(safeClaims, ['vbac', 'trial of labor after cesarean', 'לידה לאחר קיסרי']);
    if (vbacClaims.length && !hasSupportingClaim(safeClaims, ['consent', 'risk discussion', 'signed'])) {
        pushFinding(findings, {
            code: 'OBGYN_VBAC_NO_CONSENT',
            message: 'נסיון לידה לאחר קיסרי ללא הסכמה מדעת מפורטת.',
            severity: 'warning',
            domain: 'OBGYN',
            relatedClaimIds: collectIds(vbacClaims),
        });
    }
    // EMERGENCY
    const emergencyChestPain = filterClaims(safeClaims, ['er chest pain', 'emergency chest', 'triage chest']);
    if (emergencyChestPain.length && !hasSupportingClaim(safeClaims, ['ecg', 'troponin', 'saturation', 'monitor'])) {
        pushFinding(findings, {
            code: 'EMERGENCY_CHEST_PAIN_NO_ECG',
            message: 'כאב חזה בחדר מיון ללא ECG/טרופונין/סטורציה מתועדים.',
            severity: 'critical',
            domain: 'EMERGENCY',
            relatedClaimIds: collectIds(emergencyChestPain),
        });
    }
    const emergencyDyspnea = filterClaims(safeClaims, ['shortness of breath', 'dyspnea', 'respiratory distress']);
    if (emergencyDyspnea.length && !hasSupportingClaim(safeClaims, ['pulse ox', 'abg', 'blood gas', 'chest x-ray'])) {
        pushFinding(findings, {
            code: 'EMERGENCY_DYSPNEA_NO_SAT',
            message: 'קוצר נשימה בחדר מיון ללא סטורציה/בדיקת גזים/צילום.',
            severity: 'critical',
            domain: 'EMERGENCY',
            relatedClaimIds: collectIds(emergencyDyspnea),
        });
    }
    const headTraumaClaims = filterClaims(safeClaims, ['head trauma', 'concussion', 'loss of consciousness', 'gcs']);
    if (headTraumaClaims.length && !hasSupportingClaim(safeClaims, ['ct head', 'neuroimaging', 'neuro exam'])) {
        pushFinding(findings, {
            code: 'EMERGENCY_HEAD_TRAUMA_NO_CT',
            message: 'חבלת ראש בחדר מיון ללא הדמיה/בדיקה נוירולוגית מתועדת.',
            severity: 'warning',
            domain: 'EMERGENCY',
            relatedClaimIds: collectIds(headTraumaClaims),
        });
    }
    const fractureClaims = filterClaims(safeClaims, ['fracture', 'bone deformity', 'דפורמציה', 'קרסול שבור']);
    if (fractureClaims.length && !hasSupportingClaim(safeClaims, ['x-ray', 'ct', 'splint', 'immobilization'])) {
        pushFinding(findings, {
            code: 'EMERGENCY_FRACTURE_NO_IMAGING',
            message: 'חשד לשבר במיון ללא הדמיה/קיבוע מתועדים.',
            severity: 'warning',
            domain: 'EMERGENCY',
            relatedClaimIds: collectIds(fractureClaims),
        });
    }
    const feverClaims = filterClaims(safeClaims, ['fever 39', 'sepsis suspicion', 'febrile']);
    if (feverClaims.length && !hasSupportingClaim(safeClaims, ['cbc', 'blood culture', 'lactate', 'urine test'])) {
        pushFinding(findings, {
            code: 'EMERGENCY_FEVER_NO_LABS',
            message: 'חום גבוה במיון ללא בדיקות דם בסיסיות.',
            severity: 'warning',
            domain: 'EMERGENCY',
            relatedClaimIds: collectIds(feverClaims),
        });
    }
    const severePainClaims = filterClaims(safeClaims, ['10/10 pain', 'severe pain', 'analgesia']);
    if (severePainClaims.length && !hasSupportingClaim(safeClaims, ['analgesic', 'pain control', 'medication given'])) {
        pushFinding(findings, {
            code: 'EMERGENCY_PAIN_NO_ANALGESIA',
            message: 'תלונת כאב חריפה במיון ללא תיעוד טיפול בכאב.',
            severity: 'info',
            domain: 'EMERGENCY',
            relatedClaimIds: collectIds(severePainClaims),
        });
    }
    // ICU
    const sepsisClaims = filterClaims(safeClaims, ['sepsis', 'septic shock', 'bacteremia']);
    if (sepsisClaims.length && !hasSupportingClaim(safeClaims, ['blood culture', 'lactate', 'antibiotic plan'])) {
        pushFinding(findings, {
            code: 'ICU_SEPSIS_NO_CULTURE',
            message: 'אבחנת ספסיס ביחידה ללא תרביות/מדדי דלקת מתועדים.',
            severity: 'critical',
            domain: 'ICU',
            relatedClaimIds: collectIds(sepsisClaims),
        });
    }
    const ventilationClaims = filterClaims(safeClaims, ['mechanical ventilation', 'intubated', 'respiratory failure']);
    if (ventilationClaims.length && !hasSupportingClaim(safeClaims, ['abg', 'ventilator settings', 'weaning plan'])) {
        pushFinding(findings, {
            code: 'ICU_VENTILATION_NO_ABG',
            message: 'חולה מונשם ללא בדיקות גזים/תכנית הנשמה מעודכנת.',
            severity: 'warning',
            domain: 'ICU',
            relatedClaimIds: collectIds(ventilationClaims),
        });
    }
    const shockClaims = filterClaims(safeClaims, ['shock', 'vasopressor', 'map <', 'hypotension']);
    if (shockClaims.length && !hasSupportingClaim(safeClaims, ['lactate', 'hemodynamic monitoring', 'echo bedside'])) {
        pushFinding(findings, {
            code: 'ICU_SHOCK_NO_LACTATE',
            message: 'מצב שוק ללא ניטור לקטט/המודינמיקה מתועדת.',
            severity: 'critical',
            domain: 'ICU',
            relatedClaimIds: collectIds(shockClaims),
        });
    }
    const sedationClaims = filterClaims(safeClaims, ['sedation', 'propofol', 'midazolam', 'dexmedetomidine']);
    if (sedationClaims.length && !hasSupportingClaim(safeClaims, ['sedation scale', 'daily interruption', 'sedation plan'])) {
        pushFinding(findings, {
            code: 'ICU_SEDATION_NO_PLAN',
            message: 'טיפול סדציה ללא תכנית הערכה יומית/מדד סדציה.',
            severity: 'warning',
            domain: 'ICU',
            relatedClaimIds: collectIds(sedationClaims),
        });
    }
    const neuroChangeClaims = filterClaims(safeClaims, ['altered mental status', 'coma', 'gcs drop']);
    if (neuroChangeClaims.length && !hasSupportingClaim(safeClaims, ['ct head', 'neuro imaging', 'neuro consult'])) {
        pushFinding(findings, {
            code: 'ICU_NEURO_CHANGE_NO_IMAGING',
            message: 'שינוי נוירולוגי בטיפול נמרץ ללא הדמיה/ייעוץ מתועד.',
            severity: 'warning',
            domain: 'ICU',
            relatedClaimIds: collectIds(neuroChangeClaims),
        });
    }
    const nutritionClaims = filterClaims(safeClaims, ['tpn', 'enteral feeding', 'malnutrition']);
    if (nutritionClaims.length && !hasSupportingClaim(safeClaims, ['dietician', 'calorie target', 'monitoring weight'])) {
        pushFinding(findings, {
            code: 'ICU_NUTRITION_NO_PLAN',
            message: 'תזונת ICU ללא תכנית מזון/מעקב תזונתי מסודר.',
            severity: 'info',
            domain: 'ICU',
            relatedClaimIds: collectIds(nutritionClaims),
        });
    }
    // GENERAL SURGERY
    const acuteAbdomen = filterClaims(safeClaims, ['acute abdomen', 'peritonitis', 'guarding', 'rigid abdomen']);
    if (acuteAbdomen.length && !hasSupportingClaim(safeClaims, ['surgical consult', 'imaging', 'ct abdomen'])) {
        pushFinding(findings, {
            code: 'GENSURG_ACUTE_ABD_NO_REVIEW',
            message: 'חשד לבטן חריפה ללא ייעוץ כירורגי/הדמיה מתועדת.',
            severity: 'critical',
            domain: 'GENERAL_SURGERY',
            relatedClaimIds: collectIds(acuteAbdomen),
        });
    }
    const appendicitisClaims = filterClaims(safeClaims, ['appendicitis', 'rlq pain', 'מקברני']);
    if (appendicitisClaims.length && !hasSupportingClaim(safeClaims, ['appendix ultrasound', 'ct abdomen', 'wbc', 'crp'])) {
        pushFinding(findings, {
            code: 'GENSURG_APPENDICITIS_NO_IMAGING',
            message: 'חשד לאפנדיציטיס ללא הדמיה או בדיקות דלקת.',
            severity: 'warning',
            domain: 'GENERAL_SURGERY',
            relatedClaimIds: collectIds(appendicitisClaims),
        });
    }
    const gallbladderClaims = filterClaims(safeClaims, ['cholecystitis', 'gallbladder', 'biliary colic']);
    if (gallbladderClaims.length && !hasSupportingClaim(safeClaims, ['ultrasound', 'hidascan', 'lft'])) {
        pushFinding(findings, {
            code: 'GENSURG_GALLBLADDER_NO_US',
            message: 'חשד לבעיה בכיס מרה ללא אולטרסאונד/בדיקות כבד.',
            severity: 'warning',
            domain: 'GENERAL_SURGERY',
            relatedClaimIds: collectIds(gallbladderClaims),
        });
    }
    const postopBleed = filterClaims(safeClaims, ['postoperative bleed', 'drop hemoglobin', 'hematoma post op']);
    if (postopBleed.length && !hasSupportingClaim(safeClaims, ['cbc', 'coagulation', 'imaging', 'surgical review'])) {
        pushFinding(findings, {
            code: 'GENSURG_POSTOP_BLEED_NO_LABS',
            message: 'חשד לדימום לאחר ניתוח ללא בדיקות דם/הדמיה.',
            severity: 'warning',
            domain: 'GENERAL_SURGERY',
            relatedClaimIds: collectIds(postopBleed),
        });
    }
    const postopComplications = filterClaims(safeClaims, ['wound infection', 'dehiscence', 'ileus', 'abscess']);
    if (postopComplications.length && !hasSupportingClaim(safeClaims, ['treatment plan', 'antibiotic', 'follow-up'])) {
        pushFinding(findings, {
            code: 'GENSURG_POSTOP_COMPLICATION_NO_PLAN',
            message: 'סיבוך לאחר ניתוח ללא תכנית טיפול ומעקב.',
            severity: 'warning',
            domain: 'GENERAL_SURGERY',
            relatedClaimIds: collectIds(postopComplications),
        });
    }
    const obstructionClaims = filterClaims(safeClaims, ['bowel obstruction', 'ileus', 'vomiting bilious']);
    if (obstructionClaims.length && !hasSupportingClaim(safeClaims, ['abdominal x-ray', 'ct', 'ng tube', 'surgical plan'])) {
        pushFinding(findings, {
            code: 'GENSURG_OBSTRUCTION_NO_IMAGING',
            message: 'חשד לחסימת מעי ללא הדמיה/בדיקות מעקב.',
            severity: 'warning',
            domain: 'GENERAL_SURGERY',
            relatedClaimIds: collectIds(obstructionClaims),
        });
    }
    // PLASTIC SURGERY
    const plasticOps = filterClaims(safeClaims, ['breast reconstruction', 'facelift', 'rhinoplasty', 'abdominoplasty']);
    if (plasticOps.length && !hasSupportingClaim(safeClaims, ['pre-op photo', 'consent', 'baseline exam'])) {
        pushFinding(findings, {
            code: 'PLASTIC_MAJOR_OP_NO_BASELINE',
            message: 'ניתוח פלסטי משמעותי ללא תיעוד בסיסי/צילום לפני.',
            severity: 'warning',
            domain: 'PLASTIC_SURGERY',
            relatedClaimIds: collectIds(plasticOps),
        });
    }
    const plasticInfection = filterClaims(safeClaims, ['flap necrosis', 'infection reconstruction', 'cellulitis graft']);
    if (plasticInfection.length && !hasSupportingClaim(safeClaims, ['antibiotic', 'drainage', 'wound care'])) {
        pushFinding(findings, {
            code: 'PLASTIC_INFECTION_NO_TREATMENT',
            message: 'זיהום או נמק ניתוח פלסטי ללא טיפול מתועד.',
            severity: 'critical',
            domain: 'PLASTIC_SURGERY',
            relatedClaimIds: collectIds(plasticInfection),
        });
    }
    const implantClaims = filterClaims(safeClaims, ['implant rupture', 'silicone', 'implant exchange']);
    if (implantClaims.length && !hasSupportingClaim(safeClaims, ['lot', 'batch', 'manufacturer', 'catalog'])) {
        pushFinding(findings, {
            code: 'PLASTIC_IMPLANT_NO_DEVICE_INFO',
            message: 'החלפת/השתלת שתל ללא תיעוד פרטי המכשיר.',
            severity: 'warning',
            domain: 'PLASTIC_SURGERY',
            relatedClaimIds: collectIds(implantClaims),
        });
    }
    const necrosisClaims = filterClaims(safeClaims, ['skin necrosis', 'flap failure', 'ischemia skin']);
    if (necrosisClaims.length && !hasSupportingClaim(safeClaims, ['debridement', 'hyperbaric', 'reoperation'])) {
        pushFinding(findings, {
            code: 'PLASTIC_NECROSIS_NO_PLAN',
            message: 'נמק לאחר ניתוח פלסטי ללא תכנית טיפול מתועדת.',
            severity: 'warning',
            domain: 'PLASTIC_SURGERY',
            relatedClaimIds: collectIds(necrosisClaims),
        });
    }
    const revisionClaims = filterClaims(safeClaims, ['revision surgery', 'scar revision', 'touch-up']);
    if (revisionClaims.length && !hasSupportingClaim(safeClaims, ['asymmetry', 'contracture', 'patient complaint', 'photo'])) {
        pushFinding(findings, {
            code: 'PLASTIC_REVISION_NO_REASON',
            message: 'ניתוח תיקון פלסטי ללא תיעוד סיבה רפואית/אסתטית מנומקת.',
            severity: 'info',
            domain: 'PLASTIC_SURGERY',
            relatedClaimIds: collectIds(revisionClaims),
        });
    }
    const fatTransferClaims = filterClaims(safeClaims, ['fat transfer', 'lipofilling', 'fat graft']);
    if (fatTransferClaims.length && !hasSupportingClaim(safeClaims, ['follow-up', 'volume', 'ultrasound', 'complication'])) {
        pushFinding(findings, {
            code: 'PLASTIC_FAT_TRANSFER_NO_FOLLOWUP',
            message: 'הזרקת שומן ללא תיעוד נפחים/מעקב לאחר הטיפול.',
            severity: 'warning',
            domain: 'PLASTIC_SURGERY',
            relatedClaimIds: collectIds(fatTransferClaims),
        });
    }
    const donorClaims = filterClaims(safeClaims, ['skin graft', 'donor site', 'split thickness']);
    if (donorClaims.length && !hasSupportingClaim(safeClaims, ['donor assessment', 'dressing', 'follow-up'])) {
        pushFinding(findings, {
            code: 'PLASTIC_DONOR_NO_MONITOR',
            message: 'אזור תורם להשתלה ללא תיעוד מעקב/חבישה.',
            severity: 'warning',
            domain: 'PLASTIC_SURGERY',
            relatedClaimIds: collectIds(donorClaims),
        });
    }
    // COSMETIC INJECTABLES
    const botoxClaims = filterClaims(safeClaims, ['botox', 'botulinum toxin', 'wrinkle injection']);
    if (botoxClaims.length && !hasSupportingClaim(safeClaims, ['units', 'dose', 'site', 'batch', 'lot'])) {
        pushFinding(findings, {
            code: 'COSMETIC_BOTOX_NO_DOSAGE',
            message: 'טיפול בוטוקס ללא תיעוד מיקום/מינון/מספר אצווה.',
            severity: 'warning',
            domain: 'COSMETIC_INJECTABLES',
            relatedClaimIds: collectIds(botoxClaims),
        });
    }
    const fillerClaims = filterClaims(safeClaims, ['hyaluronic acid', 'dermal filler', 'juvederm', 'restylane']);
    if (fillerClaims.length && !hasSupportingClaim(safeClaims, ['product name', 'lot', 'hyaluronidase', 'syringe'])) {
        pushFinding(findings, {
            code: 'COSMETIC_FILLER_NO_BATCH',
            message: 'הזרקת חומצה היאלורונית ללא תיעוד סוג ומספר אצווה.',
            severity: 'warning',
            domain: 'COSMETIC_INJECTABLES',
            relatedClaimIds: collectIds(fillerClaims),
        });
    }
    const vascularEvents = filterClaims(safeClaims, ['vascular occlusion', 'blanching', 'vision loss', 'embolism']);
    if (vascularEvents.length && !hasSupportingClaim(safeClaims, ['hyaluronidase', 'er referral', 'warm compress', 'aspirin'])) {
        pushFinding(findings, {
            code: 'COSMETIC_VASCULAR_EVENT_NO_PLAN',
            message: 'חשד לסיבוך וסקולרי ללא תיעוד טיפול דחוף.',
            severity: 'critical',
            domain: 'COSMETIC_INJECTABLES',
            relatedClaimIds: collectIds(vascularEvents),
        });
    }
    const cosmeticProcedures = filterClaims(safeClaims, ['cosmetic', 'aesthetic', 'injectable', 'lip filler']);
    if (cosmeticProcedures.length && !hasSupportingClaim(safeClaims, ['consent', 'risk discussion', 'signed'])) {
        pushFinding(findings, {
            code: 'COSMETIC_NO_CONSENT',
            message: 'הליך הזרקות אסתטי ללא תיעוד הסכמה מדעת.',
            severity: 'warning',
            domain: 'COSMETIC_INJECTABLES',
            relatedClaimIds: collectIds(cosmeticProcedures),
        });
    }
    const painClaims = filterClaims(safeClaims, ['severe pain injection', 'vision disturbance', 'neuropathy after filler']);
    if (painClaims.length && !hasSupportingClaim(safeClaims, ['er referral', 'ophthalmology', 'urgent review'])) {
        pushFinding(findings, {
            code: 'COSMETIC_PAIN_NO_EVAL',
            message: 'תלונת כאב חריגה לאחר הזרקה ללא תיעוד הפניה/טיפול דחוף.',
            severity: 'warning',
            domain: 'COSMETIC_INJECTABLES',
            relatedClaimIds: collectIds(painClaims),
        });
    }
    const infectionClaims = filterClaims(safeClaims, ['cellulitis filler', 'abscess injection', 'warmth swelling filler']);
    if (infectionClaims.length && !hasSupportingClaim(safeClaims, ['antibiotic', 'drainage', 'culture'])) {
        pushFinding(findings, {
            code: 'COSMETIC_INFECTION_NO_TREATMENT',
            message: 'זיהום לאחר הזרקה אסתטית ללא טיפול אנטיביוטי/ניקוז.',
            severity: 'warning',
            domain: 'COSMETIC_INJECTABLES',
            relatedClaimIds: collectIds(infectionClaims),
        });
    }
    const followupClaims = filterClaims(safeClaims, ['touch-up', 'maintenance', 'booster']);
    if (followupClaims.length && !hasSupportingClaim(safeClaims, ['follow-up', 'photo comparison', 'plan update'])) {
        pushFinding(findings, {
            code: 'COSMETIC_NO_FOLLOWUP_NOTE',
            message: 'טיפול אסתטי סדרתי ללא תיעוד מעקב/תוצאה.',
            severity: 'info',
            domain: 'COSMETIC_INJECTABLES',
            relatedClaimIds: collectIds(followupClaims),
        });
    }
    return findings;
};
exports.runSpecialtyRules = runSpecialtyRules;
