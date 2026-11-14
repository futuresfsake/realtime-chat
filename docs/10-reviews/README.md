# 10-reviews: Past reviews (archive)

Point-in-time reviews of this project. They are kept **unchanged** as a record of what was found and proposed on each date. They are not current guidance, and some contain statements that were later corrected.

**Do not edit files in the dated folders.** When a finding leads to a change, update the living document in its home folder and the [compliance matrix](../09-compliance/compliance-matrix.md).

## Reviews
| Date | Review | Scope | Record |
|---|---|---|---|
| 2026-10-18 | Legal and compliance brief | Philippine law overview for an anonymous chat platform | [2026-10-18-legal-brief](2026-10-18-legal-brief/legal-considerations.md) |
| 2026-10-27 | IT manager production readiness review | Architecture, security, data, operations: 47 findings | [2026-10-27-it-manager](2026-10-27-it-manager/README.md) |
| 2026-10-28 | DICT-style security and data privacy review | Retention, roles, deployment security, tooling, crosswalk | [2026-10-28-dict](2026-10-28-dict/README.md) |
| 2026-11-13 | Documentation restructure | Folder layout; compliance folder created; citations corrected | This table |
| 2026-11-14 | **Final audit** (a self-audit by the author, not independent) | Repository, history, dependencies, tests, the running production build, docs; 12 findings | [2026-11-14-final-audit](2026-11-14-final-audit.md) |

## Where each review document went (2026-11-13)
Documents that describe how the system should be built or run were moved to the folder that owns the topic and are now maintained there. Documents that record findings stayed here.

### IT manager review
| Document | Now |
|---|---|
| API versioning | Living: [03-design/api-versioning.md](../03-design/api-versioning.md) |
| Authentication and authorization | Living: [04-security/authentication-authorization.md](../04-security/authentication-authorization.md) |
| Performance requirements | Living: [02-requirements/performance-requirements.md](../02-requirements/performance-requirements.md) |
| Testing requirements | Living: [05-quality/testing-requirements.md](../05-quality/testing-requirements.md) |
| Infrastructure requirements | Living: [06-operations/infrastructure-requirements.md](../06-operations/infrastructure-requirements.md) |
| Monitoring and observability | Living: [06-operations/monitoring-observability.md](../06-operations/monitoring-observability.md) |
| Incident response plan | Living: [06-operations/incident-response-plan.md](../06-operations/incident-response-plan.md) |
| Disaster recovery | Living: [06-operations/disaster-recovery.md](../06-operations/disaster-recovery.md) |
| README, executive summary, security audit | Archived here |
| Compliance matrix | Archived here. Replaced by [09-compliance/compliance-matrix.md](../09-compliance/compliance-matrix.md) |
| Data governance | Archived here. Replaced by [09-compliance/data-inventory-and-retention.md](../09-compliance/data-inventory-and-retention.md) |

### DICT-style review
| Document | Now |
|---|---|
| Management capabilities | Living: [09-compliance/roles-and-access.md](../09-compliance/roles-and-access.md) |
| Security gates by milestone | Living: [09-compliance/compliance-gates.md](../09-compliance/compliance-gates.md) |
| Deployment security checklist | Living: [06-operations/deployment-security.md](../06-operations/deployment-security.md) |
| Security tooling | Living: [07-process/security-tooling.md](../07-process/security-tooling.md) |
| README, compliance crosswalk, data privacy and retention | Archived here. Replaced by the [09-compliance](../09-compliance/README.md) documents |

### Legal brief
Archived whole. Its content was split across the [regulatory register](../09-compliance/regulatory-register.md), [child protection and online safety](../09-compliance/child-protection-and-online-safety.md), [public policies](../09-compliance/public-policies.md) and [compliance gates](../09-compliance/compliance-gates.md).

## Known errors in the archived records
Corrected in the living documents; left as written here.

| Record | Statement | Correction |
|---|---|---|
| IT review, compliance matrix | "Data Privacy Act of 2010" | The Act is from 2012 |
| IT review, compliance matrix | RA 10175 Sec 12 (real-time collection) listed as a duty | Struck down in *Disini v. Secretary of Justice* (2014) |
| IT review, compliance matrix | NPC Circular 16-01 cited for privacy impact assessments; "Sec 25" for registration; "Sec 30" for security measures | See the [regulatory register](../09-compliance/regulatory-register.md) |
| IT review, compliance matrix; legal brief | Platform duties and a platform fine under RA 11313 Sec 12 and 18 | The Act penalises the harasser; platform duties are not spelled out. Counsel to confirm |
| Legal brief | Report child exploitation to NCMEC | NCMEC is a United States body. Report to the PNP or NBI |
| IT review, data governance; DICT review | Ciphertext or messages held for "milliseconds" | Relayed events stay in a memory buffer for up to about 100 seconds |
| IT review, incident plan (as first written) | Preserve child-safety metadata "for up to 90 days" | Period is set by RA 11930 and the legal hold; see the child-safety procedure |

## Adding a review
Create `YYYY-MM-DD-name/` with a `README.md` giving the reviewer, scope and verdict. Add a row to the table above. Turn accepted findings into changes to living documents; do not link to a review as if it were the rule.
