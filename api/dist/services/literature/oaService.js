"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkOpenAccess = void 0;
const env_1 = require("../env");
const checkOpenAccess = async (doi) => {
    if (!doi)
        return null;
    if (!env_1.config.literature.unpaywallEmail) {
        console.warn('[literature] UNPAYWALL_EMAIL missing, skipping OA check');
        return null;
    }
    const url = `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=${encodeURIComponent(env_1.config.literature.unpaywallEmail)}`;
    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'LexMedical/1.0' },
        });
        if (!response.ok) {
            console.warn('[literature] unpaywall non-200', response.status);
            return null;
        }
        const payload = await response.json();
        return {
            oaStatus: payload.is_oa ? 'open' : 'closed',
            oaUrl: payload.best_oa_location?.url ?? payload.best_oa_location?.url_for_landing_page,
            oaPdfUrl: payload.best_oa_location?.url_for_pdf,
            license: payload.best_oa_location?.license,
            pmcId: payload.best_oa_location?.pmcid,
            pmcUrl: payload.best_oa_location?.pmcid ? `https://www.ncbi.nlm.nih.gov/pmc/articles/${payload.best_oa_location.pmcid}/` : undefined,
        };
    }
    catch (error) {
        console.warn('[literature] unpaywall error', error);
        return null;
    }
};
exports.checkOpenAccess = checkOpenAccess;
