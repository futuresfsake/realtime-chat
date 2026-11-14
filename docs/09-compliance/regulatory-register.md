# Regulatory Register

**Last reviewed:** 2026-11-13 · **Owner:** DPO (D-12) · **Next review:** before the M6 release

The list of Philippine laws, rules and regulators that apply to an anonymous one-to-one text chat run from the Philippines and hosted in Singapore. What we do about each obligation is in the [compliance matrix](compliance-matrix.md).

> Citations are from engineering's reading and are **not yet verified by counsel** (◻). Section numbers, deadlines and circular numbers in particular must be checked against the current official text.

## 1. Laws that apply directly

### RA 10173, Data Privacy Act of 2012 (DPA), and its IRR
Regulator: **National Privacy Commission (NPC)**.

| Topic | Source ◻ | What it asks of us |
|---|---|---|
| Scope and reach | Sec 4, Sec 6 | Applies to processing of personal information, including by an entity with links to the Philippines |
| Privacy principles | Sec 11 | Transparency, legitimate purpose, proportionality |
| Lawful basis | Sec 12 (personal), Sec 13 (sensitive) | Each processing purpose needs a stated basis |
| Processors | Sec 14; IRR rules on outsourcing | A contract with each processor (Render); we stay responsible |
| Data subject rights | Sec 16, Sec 18; IRR Sec 34 | Informed, access, object, rectify, erase or block, damages, portability, complain to the NPC |
| Security measures | Sec 20; NPC Circular 2023-06 | Organizational, physical and technical measures |
| Accountability and transfers | Sec 21 | We answer for data sent to a processor or abroad; designate an accountable person (DPO) |
| Breach notification | Sec 20(f); IRR Sec 38 to 42; NPC Circular 16-03 | Notify the NPC and affected data subjects within 72 hours of knowledge or reasonable belief |
| Registration | NPC Circular 2022-04 | Register the DPO and data processing systems if a threshold is met (250+ employees, sensitive data of 1,000+ people, or processing likely to pose a risk to rights and freedoms) |
| DPO designation | NPC Advisory 2017-01 | Name a DPO; publish contact details |
| Privacy impact assessment | NPC Advisory 2017-03 | Assess before launch and on significant change |
| Consent | NPC Circular 2023-04 | Consent must be specific, informed and evidenced; no deceptive design |
| Legitimate interest | NPC Circular 2023-07 | A documented three-part test when we rely on it |
| Administrative fines | NPC Circular 2022-01 | Fines scaled to gross income for infractions |
| Penalties | Sec 25 to 37 | Criminal liability for unauthorized processing, negligent access, concealment of breaches |

**Earlier docs got these wrong** (corrected here): the Act is from **2012**, not 2010; NPC Circular 16-01 is not the PIA guidance; Sec 25 is a penalty clause, not the registration rule.

### RA 10175, Cybercrime Prevention Act of 2012, its IRR, and the Rule on Cybercrime Warrants
Bodies: **DOJ Office of Cybercrime (DOJ-OOC)**, **PNP Anti-Cybercrime Group (PNP-ACG)**, **NBI Cybercrime Division (NBI-CCD)**, **Cybercrime Investigation and Coordinating Center (CICC)**. Cases are heard by designated cybercrime courts.

| Topic | Source ◻ | What it asks of us |
|---|---|---|
| We are a "service provider" | Sec 3(n) | The duties below attach to us |
| Preservation | Sec 13 | Keep the integrity of **traffic data and subscriber information for at least six months** from the transaction; preserve content data for six months from a preservation order; one extension of six months |
| Disclosure | Sec 14; A.M. No. 17-11-03-SC | Disclose subscriber, traffic or relevant data **only on a court warrant**, within 72 hours of the order |
| Search, seizure, examination | Sec 15; A.M. No. 17-11-03-SC | Cooperate with a valid warrant (WDCD, WSSECD, WECD, WICD) |
| Non-compliance | Sec 20 | Punishable as obstruction of justice (PD 1829) |
| Real-time collection of traffic data | Sec 12 | **Struck down** by the Supreme Court in *Disini v. Secretary of Justice* (2014). Not an obligation |
| Offences users may commit | Sec 4, Sec 6 | Illegal access, cyber libel, identity theft, and other crimes committed through ICT carry heavier penalties. Relevant to our rules page, not a duty to monitor content |

The six-month rule conflicts with our "keep almost nothing" design. See [law-enforcement-requests.md](law-enforcement-requests.md) and decision D-11.

### RA 11930, Anti-OSAEC and Anti-CSAEM Act (2022), and its IRR
Bodies: **National Coordination Center against OSAEC and CSAEM (NCC-OSAEC-CSAEM)** under the Inter-Agency Council Against Trafficking (IACAT), DOJ, **PNP Women and Children Protection Center (WCPC)**, NBI, DSWD.

| Topic | Source ◻ | What it asks of internet intermediaries |
|---|---|---|
| Terms of service | Sec 9 | Prohibit child sexual abuse or exploitation in the terms |
| Preservation | Sec 9 | Preserve subscriber or registration information and traffic data **in our control and possession** for six months (extendible); content data for longer on notice |
| Report | Sec 9 | Notify the PNP or NBI promptly (the Act sets a short deadline counted in hours) on learning of abuse committed through our service |
| Block or take down | Sec 9 | Act within 24 hours of a notice from a competent authority |
| Prevent and detect | Sec 9 | Have mechanisms to prevent, detect, respond and report |
| Cooperate | Sec 9 | Give user particulars to authorities on lawful request |

This Act applies **despite** the Data Privacy Act where the two meet. Details and exact deadlines: [child-protection-and-online-safety.md](child-protection-and-online-safety.md).

**Earlier docs got this wrong:** the legal brief named NCMEC, which is a United States body. The Philippine channels are the PNP, the NBI and the NCC-OSAEC-CSAEM.

### RA 11313, Safe Spaces Act (2019)
Bodies: PNP-ACG receives complaints of gender-based online sexual harassment; CICC coordinates.

| Topic | Source ◻ | What it means for us |
|---|---|---|
| Gender-based online sexual harassment | Sec 12 | Defines the offence: unwanted sexual remarks, threats, stalking, misogynistic or homophobic slurs online |
| Penalties | Sec 14 | Fall on the **person who harasses**, not expressly on the platform |

The Act does not spell out platform duties the way RA 11930 does. Reporting, instant exit, bans and cooperation with complaints are our **risk controls and good practice**, and they support a victim's ability to complain. **Earlier docs overstated this** by listing "Sec 12(a) to (c) platform obligations" and a platform fine under "Sec 18"; counsel must confirm what, if anything, binds the operator.

## 2. Laws that apply in specific situations
| Law | When it matters | Our position ◻ |
|---|---|---|
| RA 9208 as amended by RA 10364 and RA 11862 (Anti-Trafficking in Persons) | A report or order involving trafficking. The 2022 amendment adds duties for internet intermediaries | Covered by the same procedure as RA 11930 |
| RA 8792, E-Commerce Act of 2000 | Liability of service providers for user content; legal weight of electronic records | Supports acting promptly once we have actual knowledge of unlawful use |
| RA 4200, Anti-Wiretapping Act | Recording private communications without consent is a crime | Supports our rule: never record, log or store message content |
| RA 11479, Anti-Terrorism Act of 2020 | Surveillance or data orders, which need a Court of Appeals order | Treat as a law-enforcement request; counsel handles |
| RA 9775, Anti-Child Pornography Act of 2009 | Older duties on ISPs and content hosts | Understood to be superseded by RA 11930; counsel to confirm |
| RA 6809 (age of majority is 18) and the Family Code | A minor cannot give valid consent | Basis for the 18+ gate |
| RA 7610 (special protection of children) | Any report involving a child | Escalate under the child-safety procedure |
| Revised Penal Code (threats, unjust vexation, libel) with RA 10175 Sec 6 | User conduct | Listed in the rules page |

## 3. Assessed as not applicable today
Re-check this table whenever a feature is added.

| Law | Why it does not apply now | What would make it apply |
|---|---|---|
| RA 11934, SIM Registration Act | We collect no phone numbers | Phone verification |
| RA 9995, Anti-Photo and Video Voyeurism Act | Text only | Image or video sharing |
| RA 11967, Internet Transactions Act; RA 7394, Consumer Act | Nothing is sold; no transactions | Paid features, ads, a marketplace |
| RA 7925 and NTC rules on value-added services | We run over the open internet and operate no telecom network | Counsel says otherwise; SMS or voice features |
| RA 11055, Philippine Identification System Act | No identity verification | ID-based age checks |
| RA 10627, Anti-Bullying Act | Applies to schools | A product aimed at schools |
| BSP and AMLA rules | No payments | Payments |

## 4. Government ICT policy we follow by choice
These bind government agencies, not a private chat service. We align with them because they are the local standard a reviewer will measure us against.

| Policy | What we take from it |
|---|---|
| RA 10844 (DICT Act) | DICT sets national ICT and cybersecurity policy; know the agencies |
| National Cybersecurity Plan 2023 to 2028 | Report significant incidents to the national CERT; keep a vulnerability disclosure policy (`SECURITY.md`) |
| DICT Cloud First Policy (Department Circular 2017-002, amended 2020) | Classify data before choosing hosting; record the hosting region; prefer providers with recognised security certifications |
| NPC Circular 2023-06 (security of personal data) | Our security baseline, though parts are aimed at government |
| PNS ISO/IEC 27001 and 27701 | Reference control sets; no certification planned for v1 |

Details: [ict-deployment-standards.md](ict-deployment-standards.md).

## 5. Outside the Philippines
| Regime | Position |
|---|---|
| EU GDPR, UK GDPR | May apply if we offer the service to people there. v1 launches as a **Philippines beta** to keep one legal regime. Our data minimisation is the same answer everywhere |
| US COPPA and state privacy laws | 18+ service. A `minor` report gives actual knowledge and triggers the child-safety procedure |
| Singapore PDPA | Hosting in Singapore does not by itself make us a Singapore organisation; counsel to confirm |

Global opening is a post-v1 decision with its own legal review.

## 6. Regulators and contacts
Contact details change. The DPO verifies them every quarter and keeps the live list in the incident contact sheet (not in this public repo if it includes personal numbers).

| Body | When we contact them |
|---|---|
| National Privacy Commission | Breach notification, registration, rights complaints |
| DOJ Office of Cybercrime | Central authority for cybercrime matters; preservation and international requests |
| PNP Anti-Cybercrime Group | Cybercrime complaints, online harassment complaints |
| PNP Women and Children Protection Center | Child abuse or exploitation reports |
| NBI Cybercrime Division | Cybercrime and child exploitation reports |
| NCC-OSAEC-CSAEM (IACAT) | Coordination on child exploitation and trafficking |
| CICC | Coordination; scam and cybercrime hotline |
| National CERT (DICT) | Significant security incidents |

## 7. Watch list
Things that would change this register. Check at each quarterly review.
- Amendments to the Data Privacy Act and new NPC circulars or advisories
- Any law or rule on **age verification** or minors' access to online platforms
- A national cybersecurity law
- New implementing rules under RA 11930 and RA 11862
- Supreme Court rulings on cybercrime warrants or intermediary liability
