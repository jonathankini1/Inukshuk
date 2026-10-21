# Inukshuk Shopify theme

This branch is an Online Store 2.0 theme. Connect it from Shopify admin. Do not merge it into `main`.

Vercel publishes `main` as the current static site. Shopify should use `shopify-theme` only. Merging this branch into `main` would replace the live HTML site with theme files.

The previous static site is kept in `legacy-static/` on this branch.

## Connect from GitHub

1. Open the Shopify admin for `wwajbm-kv.myshopify.com`.
2. Go to **Online Store > Themes**.
3. Choose **Add theme**, then **Connect from GitHub**.
4. Sign in to GitHub if Shopify asks.
5. Choose the repository `jonathankini1/Inukshuk` and the branch `shopify-theme`.
6. Shopify adds the theme as an unpublished theme.

Connecting the branch does not publish it. Leave the current Horizon theme in place until the preview, the enquiry inbox and a test deposit have been checked. Publish later from **Online Store > Themes** only when you mean to replace the live theme.

## Pages to create

In **Online Store > Pages**, add two pages and assign the theme templates. The wording is already in the templates, so the page body can stay empty.

| Title | Handle | Theme template |
| --- | --- | --- |
| Privacy Notice | `privacy` | `privacy` |
| Website Terms | `terms` | `terms` |

To edit the wording, open the unpublished theme in the theme editor and choose the page. To paste into the page editor instead, tick **Use the page content** on that section and paste into the page body.

The privacy wording was updated because enquiries now go through the Shopify contact form, while land photos still stay on the visitor's device. Have that page reviewed before the theme is published.

## Menus

In **Online Store > Navigation** you can create menus and then assign them in the theme editor, in the Header and Footer sections. Until a menu is assigned, the theme uses its built-in links.

Header links, if you want a menu:

- What Is It: `/#what`
- Gallery: `/#gallery`
- Try It: `/#visualizer`
- Process: `/#process`
- Pricing: `/#pricing`
- FAQ: `/#faq`

Leave Enquire off that menu. The header already adds the Enquire button.

Footer menu, with three parent items and the links nested under them:

- Explore: What is an Inukshuk (`/#what`), Gallery, See it on your land, Our story
- Plan: How it works, Project scales, FAQ, Enquire
- Information: the Privacy page and the Terms page

## Deposit products

In the theme editor, open the homepage **Pricing** section. On each card, choose the matching product:

- Garden: Garden Inukshuk Booking Deposit
- Estate: Estate Inukshuk Booking Deposit
- Landmark: Landmark Inukshuk Booking Deposit

If the product picker is empty, the theme also looks for these handles:

- `garden-inukshuk-booking-deposit`
- `estate-inukshuk-booking-deposit`
- `landmark-inukshuk-booking-deposit`

Each card uses a normal Shopify product form. It adds that deposit and continues to checkout. The large price on the card is the commission guide price. The button amount is the live product price.

**Ask about Garden**, **Ask about Estate** and **Ask about Landmark** open the enquiry form with that scale selected.

## Enquiry inbox

The homepage form is Shopify's contact form (`contact`). It sends name, email, property location, land size, project scale, ideal timing and the message.

In **Settings > Notifications**, confirm the customer contact email goes to the inbox that should receive enquiries.

## Check before you publish

Preview the unpublished theme. Send a test enquiry and confirm it arrives. Place a test deposit and confirm checkout. Do not publish over Horizon until both look right.
