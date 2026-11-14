# Privacy notice (DRAFT)

> **DRAFT for review by a Philippine lawyer. Not published, not legal advice, not yet approved by the operator.** Anything marked ◻ is a legal point nobody has verified. Placeholders in [square brackets] are decisions still open: [D-12](../../00-overview/open-decisions.md) (who is the DPO) and [D-16](../../00-overview/open-decisions.md) (which legal entity). The facts below match the code as of the content filter release; the single source of truth for data is the [data inventory](../data-inventory-and-retention.md).
>
> **Version:** draft 1 · **Date:** 2026-11-14 · **Matches gate text:** `2026-11-preview-5`

*Written to be read in two minutes.*

## Who we are
This chat service is run by **[operator legal name]** from the Philippines. Our Data Protection Officer is **[DPO name]**, reachable at **[contact email]**.

## The short version
- You do not need an account. We never ask your name, phone number or email.
- We cannot read your messages. They are locked in your browser and only your chat partner's browser can unlock them.
- We keep almost nothing, and what we keep is in the server's memory and disappears when it restarts.
- We do not use cookies, analytics, advertising or tracking.

## What we process, and for how long
| What | What it is for | How long we keep it |
|---|---|---|
| **Your IP address** | Limiting abuse. We turn it into a short scrambled code (a keyed hash) that **changes every day**, and we throw the address itself away. The address is never written to our logs | Only for the moment of the request. The scrambled code is kept in memory for up to 24 hours |
| **Your country** (a two-letter code) | "My country only" matching. We look it up from your IP address using data from DB-IP.com, which is a file on our server: **your address is not sent to anyone** | In memory while you are connected |
| **The interests you pick** (from a fixed list) | Matching you with someone who shares one | In memory while you search or chat. Your partner sees only the interests you **both** picked |
| **A random name** | So you and your partner can tell each other apart | For that chat only |
| **Encrypted messages and reactions** | Passing them to your partner. We cannot read them | In the server's memory, still encrypted, for up to about two minutes so that a dropped connection can catch up. **Never written to disk** |
| **Encryption public keys** | Setting up the encryption. Public keys are not secret | For that chat only |
| **"Is typing" signals** | Showing your partner you are typing. These are **not encrypted** and contain no text | Not kept |
| **A report you send** | Protecting people. Only the category you pick (for example "harassment") and scrambled codes of the two connections. **No messages**, because we cannot see them | In memory for up to one hour while reports are counted. The category and a short fragment of the reported connection's code are written to our logs |
| **A block** | Keeping a connection reported by three different people from matching | In memory for 24 hours |
| **Who you just chatted with** (as scrambled codes) | Not pairing the same two people again | In memory for 24 hours |
| **Short-lived technical codes** | A connection token (30 seconds) and a small puzzle your browser solves (about a minute) to keep automated scripts out | Seconds to a minute |
| **Server logs** | Keeping the service running. They record events and counts, **never** message text, ciphertext, keys, addresses, countries or which interests you chose | [log retention, ◻ decision D-14 with the host] |
| **Your acknowledgement of the rules** | So we do not ask you twice in one visit | In **your** browser's session storage until you close the tab |

## Why we are allowed to process it ◻
- **Your consent**, given when you tick the boxes before connecting. You can withdraw it by closing the page. ◻ NPC Circular 2023-04 on consent
- **Our legitimate interest in keeping people safe** (limiting abuse, blocking repeat offenders). ◻ RA 10173 Sec 12
- A lawyer must confirm the basis for each item before this notice is published.

## Who else handles your data
- **[Hosting company, currently Render]** runs the server, in **Singapore**. It can see network traffic reaching the server, including IP addresses, as any host can. ◻ cross-border transfer and processor agreement (see the [PIA](../privacy-impact-assessment.md))
- **DB-IP.com** provides a free country database. We download it; **we send them nothing about you**.
- Nobody else. We do not sell or share data and we have no advertisers.

## What we never collect
Your name, phone number, email, location beyond your country, device identifiers, contacts, photos, files or voice. There is no account, no profile and no chat history.

## What we cannot promise
Honesty matters more than comfort here.
1. **Your chat partner can save or share anything you write** (a screenshot, for example).
2. **Encryption in a web page depends on the code we send you.** If we, or someone who broke into our server, sent you altered code, it could read your chat. We use a strict security policy and publish the code, but this risk cannot be removed in a web app.
3. **The encryption has not been reviewed by an outside expert yet.**
4. **We can still see that two connections chatted, when, and roughly how much was sent.**
5. **Age is self-declared.** We cannot check it.
6. **Country detection can be wrong** (VPNs, mobile networks).
7. **Blocks and "not again" rules follow your network address**, so a VPN gets around them and a shared network (a school, mobile data) can be affected by one block.

## Your rights ◻ RA 10173 Sec 16 to 18
You may ask to know what we hold about you, to correct or delete it, to object, and to complain. Because we keep nothing that identifies a person and everything is short-lived, the honest answer to most requests is that **there is nothing to give you**; we will say so. How we handle a request: [data-subject-rights.md](../data-subject-rights.md). Contact **[DPO contact]**.

You may also complain to the **National Privacy Commission**. ◻ confirm the current complaint route.

## If something goes wrong
If personal data is breached in a way that matters, we follow the [breach procedure](../breach-notification.md), including telling the National Privacy Commission within 72 hours where the law requires it. ◻

## Orders from the authorities
We respond to lawful orders. We have **no message content to hand over**, and the only data we hold is short-lived and scrambled, as set out above. How we handle such a request: [law-enforcement-requests.md](../law-enforcement-requests.md). Our position on keeping traffic data for six months is an open decision (D-11). ◻ RA 10175 Sec 13, RA 11930 Sec 9

## Changes
When this notice changes, the version number at the gate changes and everyone is asked to read and accept it again.
