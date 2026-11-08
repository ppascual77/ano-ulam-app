# Compliance

Business, tax and store obligations for selling AnoUlam Pro. Not code. Started 2026-11-08 while
setting up App Store subscriptions. General notes, not tax advice: have an accountant confirm the
tax parts once.

## Before launch (checklist)

- [ ] **BIR: register as self-employed** before Apple's first real payout. A few weeks before
      launch, get an accountant to do it (see BIR below).
- [x] **EU off in App Store availability.** Done 2026-11-08 at the app level: 148 countries (all
      175 minus the 27 EU). Do the same on each subscription's Availability, and keep it this way
      (see EU below).
- [x] **Paid Apps Agreement is Active** (needed even for sandbox purchases). Done 2026-11-08.
- [ ] **Small Business Program approved** (15% commission instead of 30%).
- [ ] **Legal entity address fixed.** The street line is doubled
      ("B9 L10 Phase 1 Suburbia East Parang Marikina City" twice) and shows on the tax forms.

## Apple (App Store Connect → Business)

| Item | Status | Notes |
| --- | --- | --- |
| Free Apps Agreement | Active | Nov 7, 2026 to Nov 7, 2027 |
| Paid Apps Agreement | Active (2026-11-08) | Nov 7, 2026 to Nov 7, 2027. Renew yearly |
| Bank account | Active | Philippine bank, PHP account. Apple totals sales in USD (royalty currency) and converts to PHP on payout |
| Certificate of Foreign Status of Beneficial Owner | Active (submitted 2026-11-08) | Apple's own form: no US employees or assets. Title: Owner |
| U.S. Form W-8BEN | Active (submitted 2026-11-08) | Foreign TIN = BIR TIN. Treaty claim below |
| EU Digital Services Act | Active: "not a trader, or don't plan to distribute in the EU" | Only true while the EU stays off |
| Small Business Program | Submitted 2026-11-08, pending | Answered No to all four associated-account questions (this is the only developer account). Apple emails the result |

### W-8BEN treaty claim

- Line 9: resident of the Philippines (ticked).
- Line 10: Article **13(2)**, **15%**, income from the sale of applications.
- Conditions: resident of the Philippines, no permanent establishment in the US, income from apps
  distributed through the App Store.
- Effect: Apple withholds 15% on **US sales only** instead of 30%. Philippine and other sales are
  not affected.
- 13(2) / 15% is the common claim for Filipino creators on US platforms. **Have the accountant
  confirm it.** A wrong claim is fixed by submitting a new form.

### EU (Digital Services Act)

Selling subscriptions makes you a "trader", and traders must have their address, phone and email
shown publicly on the EU App Store (for an individual, the home address). Declared "not a trader,
or don't plan to distribute in the EU" instead, so the **EU must stay off**. The 27 countries:
Austria, Belgium, Bulgaria, Croatia, Cyprus, Czechia, Denmark, Estonia, Finland, France, Germany,
Greece, Hungary, Ireland, Italy, Latvia, Lithuania, Luxembourg, Malta, Netherlands, Poland,
Portugal, Romania, Slovakia, Slovenia, Spain, Sweden. The UK, Switzerland and Norway are not EU
and can stay on.

To sell in the EU later: Business → Compliance → switch to trader, using a business address,
email and phone rather than personal ones.

## Philippine tax

### VAT

The customer pays the 12% VAT inside the price, and Apple remits it to the BIR directly (VAT on
Digital Services law, RA 12023, in effect since 2025). Nothing to file for App Store sales. Check
the Philippines is on Apple's list of countries where it collects and remits tax.

Web sales (e.g. Pro sold on anoulam.app through PayMongo) are different: nobody remits for you.
Under ₱3M a year in gross sales with the 8% option, that's income tax only, no VAT.

### BIR registration

- Apple never asks for it. Philippine law does: register when you start earning, so **before the
  first payout** (about a month after the month of the sales, once past Apple's payout minimum).
- One TIN per person, for life. If you've been employed, you already have one (BIR Form 2316,
  payslip, TIN ID): **update** it to add self-employment (Form 1905) instead of applying for a new
  one. No TIN yet: register fresh (Form 1901). Online via ORUS (orus.bir.gov.ph).
- No annual registration fee (the ₱500 fee was removed in 2024).
- Choose the **8% flat rate**: 8% of gross income above ₱250k a year, while under ₱3M. If also
  employed (mixed income earner), the 8% still applies to the app income but without the ₱250k
  exemption.
- Ongoing: quarterly and annual income tax returns plus simple books of accounts. An accountant
  typically charges about ₱2–5k for the registration and can file the quarterlies after. Send
  them Apple's monthly payment reports.
- Late registration has penalties, small for micro taxpayers (under ₱3M a year) under the Ease of
  Paying Taxes law. Fix it as soon as possible rather than leaving it.

### What a ₱99 subscription leaves you

| | |
| --- | --- |
| Customer pays | ₱99.00 |
| VAT (customer's, Apple remits) | −₱10.61 |
| Apple 15% (Small Business Program) | −₱13.26 |
| **Paid to you** | **₱75.13** |
| 8% income tax (only above ₱250k a year) | −₱6.01 |
| **Kept** | **≈ ₱69–75** |

Yearly at ₱599 (set 2026-11-08): about ₱455 paid out, roughly ₱38 a month. Without the Small Business Program, Apple takes 30% for each
subscriber's first year (about ₱62 paid out monthly). RevenueCat: free until about US$2,500 a
month in revenue, then about 1%. App Store Connect's pricing screen shows exact proceeds per price
point: trust that over these numbers.
