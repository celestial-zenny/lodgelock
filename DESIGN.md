---
name: LodgeLock
description: Verified lodges near FUTO. Your rent is held until you get the keys.
colors:
  security-paper: "#eff2ec"
  paper-white: "#fafbf8"
  intaglio-ink: "#10221c"
  ink-muted: "#4a5a53"
  hairline: "#d3dbd3"
  hairline-strong: "#6e7e76"
  intaglio-green: "#17493d"
  intaglio-green-deep: "#103a30"
  green-wash: "#e0ebe5"
  note-green: "#0d2a23"
  note-mist: "#bfd3ca"
  gold-foil: "#c9a24a"
  foil-wash: "#f3ebd4"
  foil-ink: "#5b4510"
  paid-green: "#256b3b"
  paid-wash: "#e2f0e4"
  dispute-red: "#a3241b"
  dispute-wash: "#f8e5e2"
typography:
  display:
    fontFamily: "Noto Serif Display, Georgia, serif"
    fontSize: "4.75rem"
    fontWeight: 500
    lineHeight: 0.98
    letterSpacing: "-0.02em"
    fontVariation: "\"wdth\" 88"
  headline:
    fontFamily: "Noto Serif Display, Georgia, serif"
    fontSize: "2.6rem"
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Noto Serif Display, Georgia, serif"
    fontSize: "1.25rem"
    fontWeight: 600
  money:
    fontFamily: "Noto Serif Display, Georgia, serif"
    fontSize: "4rem"
    fontWeight: 500
    lineHeight: 1
    fontFeature: "\"lnum\", \"tnum\""
  body:
    fontFamily: "Geologica, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geologica, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    letterSpacing: "0.14em"
rounded:
  control: "10px"
  button: "12px"
  card: "14px"
  panel: "16px"
  pill: "9999px"
spacing:
  gutter: "16px"
  gutter-wide: "24px"
  section: "64px"
components:
  button-primary:
    backgroundColor: "{colors.intaglio-green}"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.button}"
    height: "48px"
    padding: "0 20px"
  button-primary-hover:
    backgroundColor: "{colors.intaglio-green-deep}"
  button-secondary:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.intaglio-ink}"
    rounded: "{rounded.button}"
    height: "48px"
  button-foil:
    backgroundColor: "{colors.gold-foil}"
    textColor: "{colors.note-green}"
    rounded: "{rounded.button}"
    height: "48px"
  card:
    backgroundColor: "{colors.paper-white}"
    rounded: "{rounded.card}"
  held-note:
    backgroundColor: "{colors.note-green}"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.card}"
  chip-held:
    backgroundColor: "{colors.note-green}"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.pill}"
  chip-handed-over:
    backgroundColor: "{colors.foil-wash}"
    textColor: "{colors.foil-ink}"
    rounded: "{rounded.pill}"
  chip-paid-out:
    backgroundColor: "{colors.paid-wash}"
    textColor: "{colors.paid-green}"
    rounded: "{rounded.pill}"
---

# Design System: LodgeLock

## Overview

**Creative North Star: "The Held Note"**

Rent held by LodgeLock is printed like money. The product borrows the language of security printing (guilloche linework, serial numbers, microtext, a windowed gold thread) and spends it only where the student's rent is held, so the most important fact on any screen also looks the most valuable. Everything else is quiet security paper and intaglio-green ink.

Student-facing surfaces (home, lodges, lodge detail, booking) carry the note; landlord, agent and admin tools stay plain and fast in the same palette and type. The page ground is light because students use it on phones in daylight.

**Key Characteristics:**
- Security-paper ground, intaglio-green ink, deep note-green for held rent.
- Gold foil only for the held state, the logo's shackle and one thread per note.
- An engraved serif for headlines and every naira figure; a precise sans for the interface.
- Double hairline frames, like the border of a banknote.

## Colors

A restrained banknote palette: tinted neutrals from security paper, one ink, one note colour, one foil.

### Primary
- **Intaglio Green** (#17493d): actions, links, the active tab, the logo body. Deepens to #103a30 on hover.
- **Note Green** (#0d2a23): the held-rent note and dark feature panels. Text on it is white or Note Mist (#bfd3ca).

### Secondary
- **Gold Foil** (#c9a24a): the held state (chip, track step), the logo shackle, the note's security thread and rosette. Foil Wash (#f3ebd4) with Foil Ink (#5b4510) for the "Handed over" state.

### Neutral
- **Security Paper** (#eff2ec): page ground. **Paper White** (#fafbf8): cards and inputs.
- **Intaglio Ink** (#10221c): body text (14.7:1 on paper). **Ink Muted** (#4a5a53): secondary text (6.5:1).
- **Hairline** (#d3dbd3): borders and dividers. **Hairline Strong** (#6e7e76): input borders (4.1:1).

### Semantic
- **Paid Green** (#256b3b on #e2f0e4): money released ("Paid out", scout-inspected).
- **Dispute Red** (#a3241b on #f8e5e2): disputes, destructive actions, errors.

### Named Rules
**The Foil Is Earned Rule.** Gold appears only where rent is held or on the logo. A gold button, border or highlight anywhere else spends the signal.

## Typography

**Display Font:** Noto Serif Display (fallback Georgia, serif), self-hosted, width axis at 88.
**Body Font:** Geologica (fallback system-ui), self-hosted.
**Character:** an engraved, high-contrast serif for what matters (names, headlines, money) against a calm, exact sans for everything the student operates. Each face has a one-glyph companion file carrying the naira sign.

### Hierarchy
- **Display** (500, 2.9rem mobile to 4.75rem desktop, 0.98): the home headline only.
- **Headline** (500, 2.1rem to 2.6rem, 1.05): page titles; lodge and booking names up to 3rem.
- **Title** (600, 1.25rem): section headings.
- **Money** (500, lining tabular figures): every naira amount that matters; 4rem on the note, 1.75rem on lodge cards.
- **Body** (400, 1rem, 1.5): interface text and prose, 65–75ch.
- **Label / Serial** (500, 0.6875rem, 0.14em tracking, capitals): booking serials and note labels. Never monospace.

## Layout

Mobile first with a 16px gutter (24px from 640px). A bottom tab bar on phones; from 1024px a 16rem sidebar replaces it and the top bar. Content columns: 2xl to 6xl max widths by page. Lodge detail on desktop pairs a fluid column with a 22rem sticky price card; on phones the price and booking sit in a bar above the tab bar. One spacing rhythm, with more space above a heading than below it.

## Elevation & Depth

Flat by default. Cards are separated by hairlines, not shadows. The held note is the one lifted object (`0 24px 48px -28px rgba(6,26,20,0.85)`). Toasts lift above the page. Linked cards lift 2px on hover for fine pointers only.

## Shapes

Radii: 10px controls, 12px buttons, 14px cards and the note, 16px feature panels, pills for chips. Cards carry a double hairline: the border plus an inset rule 4px inside it. The note has an outer note-green margin and an inner foil-tinted frame.

## Components

### Held note
The signature component. Note-green paper in a double frame, a guilloche rosette (public/print/rosette.svg, used as a mask) in the top-left corner, a serial top right, a windowed gold security thread down the right edge, and a microtext rule along the bottom. Used on the home example, the lodge detail "rent held" explainer and a booking's held panel (with that booking's serial).

### Buttons
Primary in intaglio green; secondary on paper with a hairline; foil only inside dark panels; destructive in dispute red. 48px tall. They step up 1px on hover and press down on click.

### Status chips
Not paid (outlined), Rent held (note green, gold lock), Handed over (foil wash, key), Paid out (paid green, check), plus In dispute, Cancelled and Refunded. The label is always text.

### Lodge visual
Until real photos exist: an engraved elevation per area ink (green, blue, aubergine), drawn in line with hatching, labelled "Photos after scout visit". Never a stock photo.

## Do's and Don'ts

- **Do** put security print (rosette, thread, microtext, serial) only on held-rent moments.
- **Do** set every naira figure that matters in the engraved serif.
- **Do** keep landlord and admin tools plain.
- **Don't** use gold for decoration, or a metallic gradient for foil: the thread is printed, flat gold.
- **Don't** use monospace for serials or labels.
- **Don't** show any photo a student could mistake for the real room.
