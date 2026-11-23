# Legal Setup Checklist for Moroccan E-Commerce Stores

> [!IMPORTANT]
> **Disclaimer:** The legal documents and templates included in this project (`legal.html`, `privacy.html`, `terms.html`) are standard reference templates and **do not constitute legal advice**. Each shop owner is solely responsible for ensuring compliance with applicable Moroccan laws and regulations. You must have these documents reviewed, adapted, and approved by a qualified attorney.

---

## 1. Overview of Legal Requirements in Morocco

Under Moroccan legislation, online commercial activities are subject to specific regulatory obligations:

1. **Law No. 31-08 (Consumer Protection):**
   - Mandatory pre-contractual information (clear prices, delivery timeframes, delivery fees).
   - Right of withdrawal of at least **7 days** from receipt of goods.
   - Clear terms of return, refund, and after-sales customer service.

2. **Law No. 09-08 (Personal Data Protection - CNDP):**
   - Prior declaration to the **CNDP** (Commission Nationale de contrôle de la protection des Données à caractère Personnel) before collecting and processing customer personal data for online sales.
   - If hosting servers or databases are located **outside Morocco** (e.g. cloud providers like Railway, AWS, DigitalOcean, OVH), an **authorization/declaration for cross-border data transfer** to the CNDP is required.
   - Customer rights must be clearly stated (access, rectification, opposition, deletion).

3. **Commercial Information (ICE & RC):**
   - Registered commercial entities and auto-entrepreneurs must display their legal identifier (ICE - *Identifiant Commun de l'Entreprise*) and Trade Register (*Registre du Commerce - RC*) number where applicable.

---

## 2. Configuration: `public/js/legal-config.js`

All legal information is configured in `public/js/legal-config.js`. Below is an explanation of every field and where it is displayed:

| Field | Description & Example | Where it Shows |
|---|---|---|
| `legalName` | Registered corporate name (e.g. `"SARL Ma Boutique"`, `"Mohammed Alami"`) | `legal.html` (Publisher), `terms.html` (Legal Info), `privacy.html` (Controller) |
| `legalForm` | Legal structure (e.g. `"SARL"`, `"SARL AU"`, `"Auto-entrepreneur"`) | `legal.html` (Publisher) |
| `capital` | Share capital (e.g. `"100 000 MAD"`) | `legal.html` (Publisher) |
| `address` | Registered business address (falls back to shop address from settings if empty) | `legal.html` (Publisher), `terms.html` (Contact) |
| `phone` | Official contact phone (falls back to shop phone from settings if empty) | `legal.html` (Publisher), `terms.html` (Contact, Returns, Support) |
| `contactEmail` | Official contact email (falls back to shop order email if empty) | `legal.html` (Publisher), `privacy.html` (Controller, Contact), `terms.html` (Contact, Support) |
| `ice` | Identifiant Commun de l'Entreprise (15 digits) | `legal.html` (Publisher), `terms.html` (Legal Info) |
| `rc` | Registre du Commerce number and court (e.g. `"123456 Casablanca"`) | `legal.html` (Publisher), `terms.html` (Legal Info) |
| `publicationDirector` | Full name of the publication director (e.g. `"Mohammed Alami"`) | `legal.html` (Publisher) |
| `hostName` | Web hosting provider name (e.g. `"Railway Inc."`, `"OVHcloud"`) | `legal.html` (Hosting), `privacy.html` (Data Hosting) |
| `hostAddress` | Address of the web hosting provider | `legal.html` (Hosting) |
| `hostPhone` | Support phone of the web hosting provider | `legal.html` (Hosting) |
| `cndpReference` | Receipt number of your CNDP declaration (e.g. `"D-W-123/2024"`) | `legal.html` (CNDP), `privacy.html` (CNDP) |
| `returnDays` | Return window in days (default: `7` per Law 31-08) | `terms.html` (Right of withdrawal) |
| `deliveryTime` | Estimated delivery duration (e.g. `"24 à 72 h"`) | `terms.html` (Delivery section) |
| `returnExclusions` | Excluded items from withdrawal (e.g. `"Produits périssables ou descellés"`) | `terms.html` (Right of withdrawal) |
| `pricesIncludeTax` | `true` if catalog prices include tax (TTC), `false` if taxes added at checkout | `terms.html` (Products and prices) |
| `dataHostedAbroad` | `true` if servers/data are outside Morocco, `false` if hosted locally | `privacy.html` (Data hosting section) |

---

## 3. Printable Shop Launch Checklist

Print or follow this checklist prior to launching your store publicly:

- [ ] **Step 1: Fill in Business Identity**
  - Open `public/js/legal-config.js`.
  - Enter your `legalName`, `legalForm`, `capital` (if applicable), `ice`, and `rc`.
  - Enter your `publicationDirector` name.

- [ ] **Step 2: Enter Hosting Provider Information**
  - Identify your server host (e.g., Railway, DigitalOcean, OVHcloud).
  - Set `hostName`, `hostAddress`, and `hostPhone`.
  - If your hosting server is located outside Morocco, ensure `dataHostedAbroad: true`.

- [ ] **Step 3: Commercial & Return Policies**
  - Verify `returnDays` matches your policy (minimum 7 days under Law 31-08).
  - Enter `deliveryTime` (e.g. `"24 à 72 h"`).
  - If you sell perishable or hygiene products, set `returnExclusions`.
  - Verify `pricesIncludeTax` matches your Admin settings (Tax enabled/disabled).

- [ ] **Step 4: CNDP Declaration Filing**
  - Prepare and submit your prior declaration dossier for e-commerce personal data processing to the CNDP ([cndp.ma](https://www.cndp.ma)).
  - If servers are abroad, submit the cross-border data transfer declaration.
  - When you receive your declaration receipt reference number, enter it into `cndpReference`.

- [ ] **Step 5: Visual Verification across Languages**
  - Open `/legal.html` in French, English, and Arabic. Verify that text displays cleanly and in RTL for Arabic.
  - Open `/privacy.html` in French, English, and Arabic. Verify your data controller and host information.
  - Open `/terms.html` in French, English, and Arabic. Verify return period, exclusions, and contact channels.
  - Verify that footer links on the home page, product page, and legal pages function correctly.

- [ ] **Step 6: Legal Review**
  - Have your finalized legal notices, privacy policy, and terms of sale reviewed by a qualified Moroccan business attorney.
