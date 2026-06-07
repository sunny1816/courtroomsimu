# LEXA Demo Validation

Five sanitized Indian-law style case summaries were run through the local mock workflow on 2026-06-06.

| Case | Scenario focus | Verdict | Confidence |
|------|----------------|---------|------------|
| State v. Rohan | Witness assault, death, recovered rod, forensic doubt | Guilty | 0.73 |
| State v. Meera | Theft allegation, no witness, CCTV unavailable, alibi | Insufficient Evidence | 0.59 |
| State v. Arjun | CCTV, recovered stolen cash, fingerprints, owner identification | Guilty | 0.77 |
| State v. Kavya | Threat allegation, no medical report, no independent witness | Insufficient Evidence | 0.55 |
| State v. Dev | Two witnesses, medical report, bodily injury, no alibi | Guilty | 0.82 |

The sample bundled in `data/sample_cases/sample_case.txt` returns `Guilty` with 0.74 confidence in mock mode.
