# Privacy notice

**Effective date:** [set on deployment]
**Operator:** [legal name of the deploying institution or company, address, and privacy contact email]

> Template notice. The deploying operator's counsel must complete the bracketed fields and confirm this notice against the operator's own obligations before anyone uses the tool.

## The short version

- Your check-ins, notes, and coach conversation are **encrypted on your device** and never leave it.
- If you **choose** to turn on the live AI coach, the messages you send it go to [AI provider] to generate a reply. Nothing else does.
- The operator cannot read your data. There are no analytics, trackers, advertising, or cookies.
- The app never contacts your employer, program, or anyone else about you.

## What is stored, and where

| Data | Where | Who can read it |
|---|---|---|
| Email, first name, check-in answers, scores, optional hours, call nights and adverse-event flag, coach conversation, settings | This browser, encrypted with AES-256-GCM under a key derived from your passphrase | Only someone who knows your passphrase |
| A SHA-256 hash of your email, used to find your encrypted record | This browser | Anyone with access to the device could confirm that a known email has an account here, but not read anything |

We do not have a copy. If you forget your passphrase, your data cannot be recovered by anyone.

## What is sent, and only if you turn it on

The live AI coach is off until you agree on a consent screen. When it is on, each message you send the coach is transmitted to the operator's server function and then to [AI provider], together with:

- up to 12 of your recent coach messages, excluding anything flagged as a crisis message;
- your latest score, its band, which dimensions scored highest, whether the score went up or down, and whether you flagged an adverse event or more than 80 hours.

Your name and email are **never** sent. Messages flagged as crisis messages are **never** sent. The operator's function does not log message content. [AI provider]'s handling is governed by [the operator's agreement with the provider, including retention period and whether data may be used for training]. You can turn the live coach off at any time in Settings.

## Your choices and rights

- **Download:** Settings, then "Download my data", gives you everything in a JSON file.
- **Delete:** Settings, then "Delete account", permanently erases your account from this browser. "Clear coach history" erases only the conversation.
- **Withdraw consent:** turn off the live coach in Settings.

Depending on where you live, you may have additional rights over data the operator processes. [Operator to list applicable state rights and how to exercise them, for example under Maryland's Online Data Privacy Act, Washington's My Health My Data Act, or the California Consumer Privacy Act, where they apply.]

## Health information

This tool collects information about your wellbeing. [Operator to state whether HIPAA applies. When an employer offers a wellbeing tool to its own workforce, the data is generally not protected health information, but that depends on the arrangement. For example, the answer can change if the tool is part of a group health plan or an employee assistance program.] Where HIPAA does not apply, the FTC Health Breach Notification Rule and state consumer-health-data laws may. The local-first design is intended to keep the operator from ever holding identifiable health data.

## Security

See `SECURITY.md`. In short: encryption at rest, a strict content security policy, no third-party requests, an idle lock after [15] minutes, and a published penetration-test record.

## Changes

We will post changes here with a new effective date. Material changes to what is sent off the device will require your consent again.
