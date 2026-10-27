# Regulatory Compliance Matrix — IT Manager Review

**Date:** 2026-10-27
**Jurisdiction:** Philippines (primary), with global audience considerations

---

## 1. Philippine Law Compliance

### 1.1 Data Privacy Act of 2010 (RA 10173)

| Requirement | Section | Status | Implementation | Gap |
|---|---|---|---|---|
| **Lawful basis for processing** | Sec 12 | Planned | Consent (18+ gate) + legitimate interest (safety) | No documented lawful basis analysis |
| **Proportionality** | Sec 11(c) | By design | Minimal data collection, no persistent storage | Document in PIA |
| **Data minimization** | Sec 11(d) | By design | Hash-then-discard for IPs, no message storage | Verify in code review |
| **Purpose limitation** | Sec 11(b) | By design | Data used only for matching + safety | Document purposes explicitly |
| **Transparency / Privacy notice** | Sec 16 | Not started | Must publish before launch | CRITICAL gap — draft in M6, finalize in M8 |
| **Data subject rights** | Sec 16(c-f) | Partially by design | Most rights moot (no persistent data) | Document in privacy notice |
| **Security measures** | Sec 20 | Partially done | E2EE, rate limits, CSP planned | Complete implementation through M7 |
| **DPO appointment** | Sec 21-23 | Not done | Operator as interim DPO | Formalize before M8 |
| **NPC registration** | Sec 25 | Not done | Register as personal information controller | Before M8 |
| **Breach notification** | NPC Circular 16-03 | Not done | 72-hour notification procedure needed | CRITICAL gap |
| **Privacy Impact Assessment** | NPC Circular 16-01 | Not done | Required for high-risk processing | Create before M8 |
| **Data sharing agreement** | Sec 20(b) | Not done | Render as data processor | Review Render's DPA |

### 1.2 Cybercrime Prevention Act of 2012 (RA 10175)

| Requirement | Section | Status | Implementation | Gap |
|---|---|---|---|---|
| **Preservation of data** | Sec 13 | Not done | Must preserve data on lawful order | Procedure needed — what data CAN we preserve? |
| **Disclosure of data** | Sec 14 | Not done | Must disclose on court order | Procedure needed |
| **Real-time collection** | Sec 12 | Limited | E2EE prevents content interception by design | Document limitation in legal memo |
| **Aiding cybercrime** | Sec 5 | By design | Safety controls prevent platform facilitation | Document controls |
| **Security measures** | Sec 30 | Partially done | Implementing through milestones | Complete by M8 |

### 1.3 Safe Spaces Act of 2019 (RA 11313)

| Requirement | Section | Status | Implementation | Gap |
|---|---|---|---|---|
| **Prevention of gender-based harassment** | Sec 12 | Planned M6 | Report categories, content filters, bans | Not yet implemented |
| **Reporting mechanism** | Sec 12(a) | Planned M6 | `/report harassment`, `/report sexual` | Not yet implemented |
| **Action on reports** | Sec 12(b) | Planned M6/M7 | Auto-ban + human moderator escalation | Not yet implemented |
| **Non-facilitation** | Sec 12(c) | By design | Text-only, no media, no profiles | Document controls |
| **Sanctions for non-compliance** | Sec 18 | Risk | PHP 100K-500K fine per violation | Ensure compliance before launch |

### 1.4 Anti-Online Sexual Abuse or Exploitation of Children Law (RA 11930)

| Requirement | Section | Status | Implementation | Gap |
|---|---|---|---|---|
| **Age verification** | Sec 9 | Planned M6 | Self-declared 18+ gate | Self-declaration is weak; document accepted risk |
| **Reporting CSAEM** | Sec 9(a) | Not done | Must report to authorities | Law enforcement procedure needed |
| **Preservation of evidence** | Sec 9(b) | Limited | E2EE means no message content preserved | Document limitation |
| **Blocking/removal** | Sec 9(c) | Planned M6 | Ban system, `minor` report escalation | Not yet implemented |
| **Designated officer** | Sec 9(d) | Not done | Must designate responsible officer | Before M8 |
| **Technical measures** | Sec 9(e) | Partially planned | No media (by design), age gate, reporting | Complete implementation |

## 2. International Considerations

### 2.1 GDPR (EU Users)

The platform is accessible from the EU. Even without targeting EU users specifically, GDPR may apply if EU residents use the service.

| Requirement | GDPR Article | Status | Notes |
|---|---|---|---|
| Lawful basis | Art 6 | Consent + legitimate interest | Same as RA 10173 |
| Privacy notice | Art 13-14 | Not done | Must include GDPR-specific language |
| Data minimization | Art 5(1)(c) | By design | Strong compliance |
| Right to erasure | Art 17 | By design | No persistent data to erase |
| Data protection by design | Art 25 | By design | E2EE, no storage, hash-then-discard |
| Data Protection Impact Assessment | Art 35 | Not done | Required for large-scale monitoring |
| Cross-border transfer | Art 46 | Risk | Render (US company), Singapore servers |
| Representative in EU | Art 27 | Not done | May be required if GDPR applies |

### 2.2 COPPA (US Users Under 13)

**Not directly applicable** — the platform requires 18+ age confirmation. However:
- If a minor lies about their age (likely), COPPA obligations may still arise
- The "actual knowledge" standard in COPPA means: if the platform has actual knowledge a user is under 13, it must comply
- **Recommendation:** The `minor` report category creates "actual knowledge" when triggered — document the response procedure

## 3. Compliance Gaps — Action Items

| ID | Gap | Severity | Required By | Owner |
|---|---|---|---|---|
| CG-01 | No privacy notice drafted | CRITICAL | M8 (draft by M6) | Operator/Lawyer |
| CG-02 | No breach notification procedure | CRITICAL | M8 | Operator |
| CG-03 | No NPC registration | MAJOR | M8 | Operator |
| CG-04 | No DPO formally designated | MAJOR | M8 | Operator |
| CG-05 | No Privacy Impact Assessment | MAJOR | M8 | Operator/Lawyer |
| CG-06 | No law enforcement cooperation procedure | MAJOR | M8 | Operator/Lawyer |
| CG-07 | No terms of service | MAJOR | M8 | Operator/Lawyer |
| CG-08 | No acceptable use policy | MAJOR | M8 | Operator/Lawyer |
| CG-09 | No data processing agreement with Render | MAJOR | M8 | Operator |
| CG-10 | No RA 11930 designated officer | MAJOR | M8 | Operator |
| CG-11 | No GDPR cross-border transfer assessment | MINOR | Post-v1 | Operator/Lawyer |
| CG-12 | No GDPR representative in EU | MINOR | Post-v1 | Operator/Lawyer |
| CG-13 | No documented lawful basis analysis | MINOR | M8 | Operator/Lawyer |
| CG-14 | Legal review not yet scheduled | CRITICAL | Start during M6 | Operator |

## 4. Legal Review Timeline

```
M6 (Trust & Safety)     → Draft privacy notice, rules page, terms of service
                         → Engage Philippine lawyer (budget 2-4 weeks)
M7 (Quality)            → Lawyer reviews drafts
                         → NPC registration prepared
                         → DPO designated
M8 (Launch)             → Final legal sign-off
                         → All documents published
                         → Compliance checklist 100%
```

**Budget estimate for legal review:** PHP 15,000-50,000 depending on scope and lawyer. This is a hard prerequisite for launch.
